import os
import pandas as pd
from typing import List
from dotenv import load_dotenv
from google import genai
from pytrends.request import TrendReq
import time
import random

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

    def fetch_google_trends_data(self, queries: List[str], geo_code: str = 'UA', timeframe: str = 'today 5-y') -> pd.DataFrame:
        if not queries:
            print("Error: No queries provided to fetch.")
            return pd.DataFrame()

        print("\nInitializing Google Trends API connection (Spoofing User-Agent)...")
        
        custom_headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9,uk;q=0.8",
        }
        
        pytrends = TrendReq(
            hl='en-US', 
            tz=360, 
            requests_args={'headers': custom_headers}
        )
        
        all_data = pd.DataFrame()
        chunk_size = 2
        query_chunks = [queries[i:i + chunk_size] for i in range(0, len(queries), chunk_size)]
        
        for i, chunk in enumerate(query_chunks, start=1):
            print(f"Fetching batch {i}/{len(query_chunks)}: {chunk}")
            
            max_retries = 3
            success = False
            
            for attempt in range(max_retries):
                try:
                    pytrends.build_payload(chunk, geo=geo_code, timeframe=timeframe)
                    df_chunk = pytrends.interest_over_time()
                    
                    if not df_chunk.empty and 'isPartial' in df_chunk.columns:
                        df_chunk = df_chunk[df_chunk['isPartial'] == False]
                        df_chunk = df_chunk.drop(columns=['isPartial'])
                    
                    if not df_chunk.empty:
                        if all_data.empty:
                            all_data = df_chunk
                        else:
                            all_data = all_data.join(df_chunk, how='outer')
                    else:
                        print(f"  -> Warning: No data found for batch {i}")
                        
                    success = True
                    break 
                    
                except Exception as e:
                    print(f"  -> Attempt {attempt + 1} failed: {e}")
                    if attempt < max_retries - 1:
                        print("  -> Retrying in 15 seconds...")
                        time.sleep(15)
                    else:
                        print(f"  -> Failed batch {i} completely after {max_retries} attempts.")
            
            if i < len(query_chunks):
                sleep_time = random.uniform(20, 35)
                print(f"Sleeping for {sleep_time:.1f} seconds to protect IP...")
                time.sleep(sleep_time)
                    
        if not all_data.empty:
            print(f"\nSuccessfully downloaded trends data. Shape: {all_data.shape}")
        
        return all_data

    def run_hypothesis_generation(self, df: pd.DataFrame = None):
        print("\n" + "="*40)
        print(" MODULE 2: LEADING INDICATORS")
        print(" Hypothesis Generation & Data Mining")
        print("="*40)
        
        target = input("Enter Target Variable (e.g., Безробіття): ").strip()
        region = input("Enter Region (e.g., Україна): ").strip()
        
        geo_code = input("Enter Region ISO Code for Google Trends (e.g., UA): ").strip().upper()
        if not geo_code:
            geo_code = 'UA'
            
        extra = input("Enter Extra Info (optional): ").strip()

        print("\nSending context to Gemini and generating semantic queries...")
        queries = self.generate_search_queries(target, region, extra)

        if not queries:
            print("Failed to generate queries. Exiting.")
            return

        print("\n--- GENERATED HYPOTHESES ---")
        for i, query in enumerate(queries, start=1):
            print(f"{i}. {query}")
        
        trends_df = self.fetch_google_trends_data(queries=queries, geo_code=geo_code)
        
        if not trends_df.empty:
            print("\nPreview of downloaded Google Trends data:")
            print(trends_df.tail())
            
        return trends_df
    
if __name__ == "__main__":
    li_module = LeadingIndicators()
    generated_keywords = li_module.run_hypothesis_generation()