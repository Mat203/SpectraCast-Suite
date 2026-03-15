import os
from typing import List
from google import genai
from dotenv import load_dotenv

class QueryGenerator:
    def __init__(self):
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found.")
        self.client = genai.Client(api_key=api_key)

    def generate(self, target_variable: str, region: str, extra_info: str = "") -> List[str]:
        prompt = f"""
        You are an expert economic data analyst. 
        Generate exactly 20 search queries for Google Trends that may precede or correlate with the dynamics of '{target_variable}' in the '{region}' region. 
        Additional context: {extra_info}
        
        Consider synonyms, slang, related products, and leading indicators in the primary language of that region.
        
        CRITICAL RULE: Return ONLY a comma-separated list of the 20 queries. 
        Do NOT include bullet points, numbers, quotes, markdown formatting (like ```), or any introductory/concluding text. 
        Example output format: query one, query two, query three
        """
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash", 
                contents=prompt
            )
            raw_text = response.text.strip()
            queries = [q.strip() for q in raw_text.split(',') if q.strip()]
            

            if len(queries) < 5 and '\n' in raw_text:
                queries = [q.strip().lstrip('-*0123456789. ') for q in raw_text.split('\n') if q.strip()]
            
            return queries[:15]
        except Exception as e:
            print(f"Error generating queries: {e}")
            return []