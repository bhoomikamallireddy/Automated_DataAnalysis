import json
import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai 
from google.genai import types

# Ensure environment variables are loaded

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# 2. Load the file

def get_llm_insights(analysis_results):
    """
    Uses Gemini AI to generate high-level data strategy and executive summaries
    based on the JSON results from the EDA and ML engines.
    """
    try:
        # 1. API Setup
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {"error": "GEMINI_API_KEY not found in environment variables."}
        # Initialize the NEW client
        client = genai.Client(api_key=api_key)
        # Use a CURRENT model (gemini-2.5-flash)
        model_id='gemini-2.5-flash'
        
      
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

        # 4. Generate and Sanitize
        response = client.models.generate_content(
            model=model_id,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        raw_text = response.text.strip()
        # Clean markdown if necessary
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1].replace("json", "", 1).split("```")[0].strip()

        data = json.loads(raw_text)

        # --- NEW: DEFENSIVE NORMALIZER ---
        # 1. Force summary to be a string
        if not isinstance(data.get("summary"), str):
            data["summary"] = str(data.get("summary"))

        # 2. Force hypotheses to be a List[String]
        clean_hypotheses = []
        raw_hypotheses = data.get("hypotheses", [])
        if isinstance(raw_hypotheses, list):
            for h in raw_hypotheses:
                if isinstance(h, dict):
                    # Extract values if LLM gave an object like {question: "..."}
                    val = h.get("question") or h.get("investigation_focus") or list(h.values())[0]
                    clean_hypotheses.append(str(val))
                else:
                    clean_hypotheses.append(str(h))
        data["hypotheses"] = clean_hypotheses[:3] # Keep it concise

        # 3. Handle cleaning_tips (sometimes LLM returns list instead of string)
        tips = data.get("cleaning_tips", "")
        if isinstance(tips, list):
            data["cleaning_tips"] = ". ".join([str(t) for t in tips])
            
        # 4. Force feature_suggestions to be a List[String]
        clean_suggestions = []
        raw_suggestions = data.get("feature_suggestions", [])
        if isinstance(raw_suggestions, list):
          for s in raw_suggestions:
            if isinstance(s, dict):
               # Extract text if LLM gave an object
                val = list(s.values())[0] 
                clean_suggestions.append(str(val))
            else:
                clean_suggestions.append(str(s))
        data["feature_suggestions"] = clean_suggestions[:3] # Ensure exactly 3    
            
        return data

    except Exception as e:
        print(f"LLM Error: {e}")
        return None # Return None to trigger rule-based fallback in tasks.py