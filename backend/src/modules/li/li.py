import os
import pandas as pd
from typing import List
from dotenv import load_dotenv
from google import genai

class LeadingIndicators:
    def __init__(self):
        env_path = os.path.join(os.path.dirname(__file__), '../../.env')
        load_dotenv(dotenv_path=env_path)

        api_key = os.getenv("GEMINI_API_KEY")

        if not api_key:
            raise ValueError("GEMINI_API_KEY not found. Please check your .env file.")

        self.client = genai.Client(api_key=api_key)

    def generate_search_queries(self, target_variable: str, region: str, extra_info: str = "") -> List[str]:
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
                 queries = [q.strip().lstrip('-').lstrip('*').lstrip('0123456789. ').strip() 
                            for q in raw_text.split('\n') if q.strip()]

            return queries[:20]

        except Exception as e:
            print(f"Error generating queries from LLM: {e}")
            return []

    def run_hypothesis_generation(self, df: pd.DataFrame = None) -> List[str]:
        
        if df is not None:
            print(f"Dataset loaded. Rows: {len(df)}, Columns: {len(df.columns)}")
        
        target = input("Enter Target Variable (e.g., Безробіття): ").strip()
        region = input("Enter Region (e.g., Україна): ").strip()
        extra = input("Enter Extra Info (optional, press Enter to skip): ").strip()

        print("\nSending context to Gemini and generating semantic queries...")
        
        queries = self.generate_search_queries(target, region, extra)

        if not queries:
            print("Failed to generate queries.")
            return []

        print("\n--- GENERATED HYPOTHESES ---")
        for i, query in enumerate(queries, start=1):
            print(f"{i}. {query}")
            
        print("-" * 28)
        print(f"Total queries generated: {len(queries)}")
        
        return queries
    
if __name__ == "__main__":
    li_module = LeadingIndicators()
    generated_keywords = li_module.run_hypothesis_generation()