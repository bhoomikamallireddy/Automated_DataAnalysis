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
        - "feature_suggestions": 3 new semantic features that could be engineered from the current columns.
        - "hypotheses": 2 deep business questions the user should investigate based on these stats.
        """

        # 4. Generate and Sanitize
        response = model.generate_content(prompt)
        raw_text = response.text.strip()

        # Extra safety: Clean markdown backticks if the model ignores the config
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.split("```")[0].strip()

        return json.loads(raw_text)

    except json.JSONDecodeError:
        return {"error": "LLM returned invalid JSON format", "raw_response": response.text if 'response' in locals() else None}
    except Exception as e:
        return {"error": f"LLM Insight Engine Error: {str(e)}"}