import json
import os
import time
import requests
import logging
from pathlib import Path
from dotenv import load_dotenv
# The GenAI client may be installed under different top-level package names
# depending on the wheel/distribution. Import defensively so tests and CI
# don't break if the module is exposed as `google.genai`, `google_genai`, or
# a direct `genai` package.
try:
    from google import genai  # preferred
    from google.genai import types
except Exception:
    try:
        import google_genai as genai
        from google_genai import types
    except Exception:
        try:
            import genai
            from genai import types
        except Exception:
            # Provide a lightweight shim so test patching (patch('api.llm_utils.genai.Client'))
            # continues to work even if the real package is not importable in CI.
            from types import SimpleNamespace
            genai = SimpleNamespace(Client=lambda *a, **k: None)
            types = SimpleNamespace(GenerateContentConfig=lambda **k: None)
from google.api_core import exceptions as gemini_exceptions


logger = logging.getLogger(__name__)

# Ensure environment variables are loaded
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# 2. Load the file
def get_llm_insights(analysis_results):
        """
         Uses Gemini AI to generate high-level data strategy and executive summaries
         based on the JSON results from the EDA and ML engines.
        """
        # 1. API Setup
        gemini_key = os.getenv("GEMINI_API_KEY")
        grok_key = os.getenv("XAI_API_KEY") 

        #  Targeted Prompting
        prompt = f"""
        You are an expert Senior Data Scientist. Analyze this JSON summary of a dataset:
        {json.dumps(analysis_results, indent=2)}

        Analyze the metadata, influential features, and missing values.
        Return a JSON object with exactly these keys:
        - "summary": A professional 3-sentence non-technical overview of the data patterns.

        - "cleaning_tips": Actionable strategies for any missing values or outliers found.

        - "feature_suggestions": Exactly 3 items. Each item MUST be a single string formatted as 'Title: Brief Description'. Do NOT use nested objects.

        - "hypotheses": 3 deep business questions the user should investigate based on these stats.

        """
        # --- STAGE 1: GEMINI ---
        if gemini_key:
          logger.info("Attempting insights with Gemini...")
          gemini_data = _call_gemini(gemini_key, prompt)
          if gemini_data:
            return _normalize_response(gemini_data)

        # --- STAGE 2: GROK FALLBACK ---
        if grok_key:
           logger.warning("Gemini failed/overloaded. Switching to Grok fallback...")
           grok_data = _call_grok(grok_key, prompt)
           if grok_data:
            return _normalize_response(grok_data)

        logger.error("All LLM providers unavailable. Triggering system fallback.")
        return None
    
def _call_gemini(api_key, prompt, max_retries=2):
    """Internal helper for Gemini API with retry logic for 429/503"""
    try:
        client = genai.Client(api_key=api_key)
        for i in range(max_retries):
            try:
                response = client.models.generate_content(
                    model='gemini-2.5-flash-lite', 
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                )
                raw_text = response.text.strip()
                raw_text = _strip_json_fence(raw_text)
                return json.loads(raw_text)
            except (gemini_exceptions.ResourceExhausted, gemini_exceptions.ServiceUnavailable):
                time.sleep((i + 1) * 10)
        return None
    except Exception as e:
        logger.error("Gemini API error: %s", e, exc_info=True)
        return None


def _strip_json_fence(raw_text):
    if not raw_text.startswith("```"):
        return raw_text

    fence_parts = raw_text.split("```", 2)
    fenced_body = next((part for part in fence_parts[1:] if part.strip()), "")
    return fenced_body.replace("json", "", 1).strip()


def _call_grok(api_key, prompt, max_retries=2):
    """Internal helper for xAI Grok API"""
    url = "https://api.x.ai/v1/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    payload = {
        "model": "grok-beta", 
        "messages": [
            {"role": "system", "content": "You are a Senior Data Scientist. Return JSON only."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    for i in range(max_retries):
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code == 200:
                return _parse_grok_response(resp.json())
            elif resp.status_code in [429, 503]:
                time.sleep((i + 1) * 10)
        except Exception as e:
            logger.error("Grok API error: %s", e, exc_info=True)
    return None

def _parse_grok_response(response_data):
    choices = response_data.get("choices") or []
    first_choice = next(iter(choices), {})
    message = first_choice.get("message") or {}
    content = message.get("content")
    
    if not content:
        return None
        
    # Strip fences from Grok too, just in case!
    clean_content = _strip_json_fence(content.strip())
    return json.loads(clean_content)

def _normalize_response(data):
    """Main Orchestrator: Defensive cleaning to match Frontend expectations"""

    # 1. Clean Summary (String)
    data["summary"] = str(data.get("summary") or "")

    # 2. Clean Hypotheses (List of Strings)
    # Prefer extracting from structured dict items when available; if the
    # LLM returned plain strings only, accept them. This avoids mixing raw
    # stray strings with higher-quality dict-derived hypotheses.
    raw_hypotheses = data.get("hypotheses", [])
    data["hypotheses"] = _clean_hypotheses(raw_hypotheses, max_items=3)

    # 3. Clean Cleaning Tips (String)
    data["cleaning_tips"] = _clean_cleaning_tips(data.get("cleaning_tips", ""))

    # 4. Clean Feature Suggestions (List of Strings)
    data["feature_suggestions"] = _clean_list_items(
        data.get("feature_suggestions", []), max_items=3
    )

    return data


def _clean_cleaning_tips(tips):
    if isinstance(tips, list):
        return ". ".join([str(t) for t in tips])
    return str(tips)


def _clean_list_items(raw_list, max_items):
    """Helper: Extracts strings from mixed lists/dicts and caps the length"""
    if not isinstance(raw_list, list):
        return []
    
    clean_items = []
    for item in raw_list:
        val = _extract_string_value(item)
        if val:  # Filters out empty strings immediately
            clean_items.append(val)
    
    return clean_items[:max_items]


def _clean_hypotheses(raw_list, max_items):
    """Specialised cleaning for hypotheses: prefer dict-derived values.

    If any structured (dict) hypotheses exist, return only those values in
    order; otherwise fall back to treating raw strings as hypotheses.
    """
    if not isinstance(raw_list, list):
        return []

    # Extract from dicts first
    dict_vals = []
    primitive_vals = []
    for item in raw_list:
        if isinstance(item, dict):
            val = _extract_string_value(item)
            if val:
                dict_vals.append(val)
        else:
            # Keep primitives as fallback
            v = _extract_string_value(item)
            if v:
                primitive_vals.append(v)

    if dict_vals:
        return dict_vals[:max_items]
    return (dict_vals + primitive_vals)[:max_items]


def _extract_string_value(item):
    """Helper: Safely extracts a string from potential dicts returned by LLMs"""
    
    if isinstance(item, dict):
        if not item:
            return ""
        
        # Preferred keys first
        val = item.get("question") or item.get("investigation_focus")
        if val:
            return str(val)
        
        # Safe fallback (NO IndexError risk)
        return str(next(iter(item.values()), ""))

    return str(item) if item is not None else ""
