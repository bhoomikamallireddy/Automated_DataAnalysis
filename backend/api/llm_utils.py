import json
import os
import time
import requests
import logging
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types
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

        - "hypotheses": 2 deep business questions the user should investigate based on these stats.

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
                if raw_text.startswith("```"):
                    raw_text = raw_text.split("```")[1].replace("json", "", 1).split("```")[0].strip()
                return json.loads(raw_text)
            except (gemini_exceptions.ResourceExhausted, gemini_exceptions.ServiceUnavailable):
                time.sleep((i + 1) * 10)
        return None
    except Exception as e:
        logger.error("Gemini API error: %s", e, exc_info=True)
        return None

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
                return json.loads(resp.json()['choices'][0]['message']['content'])
            elif resp.status_code in [429, 503]:
                time.sleep((i + 1) * 10)
        except Exception as e:
            logger.error("Grok API error: %s", e, exc_info=True)
    return None

def _normalize_response(data):
    """Defensive cleaning: Ensures data types match what the Frontend expects"""
    # 1. Ensure Summary is a string
    if not isinstance(data.get("summary"), str):
        data["summary"] = str(data.get("summary", ""))

    # 2. Ensure Hypotheses is a List of Strings
    raw_h = data.get("hypotheses", [])
    clean_h = []
    if isinstance(raw_h, list):
        for h in raw_h:
            if isinstance(h, dict):
                val = h.get("question") or h.get("investigation_focus") or list(h.values())[0]
                clean_h.append(str(val))
            else:
                clean_h.append(str(h))
    data["hypotheses"] = clean_h[:2]

    # 3. Ensure Cleaning Tips is a single string
    tips = data.get("cleaning_tips", "")
    if isinstance(tips, list):
        data["cleaning_tips"] = ". ".join([str(t) for t in tips])

    # 4. Ensure Feature Suggestions is a List of Strings
    raw_s = data.get("feature_suggestions", [])
    clean_s = []
    if isinstance(raw_s, list):
        for s in raw_s:
            if isinstance(s, dict):
                val = list(s.values())[0]
                clean_s.append(str(val))
            else:
                clean_s.append(str(s))
    data["feature_suggestions"] = clean_s[:3]
    return data   


