import os
import sys
import pandas as pd
from typing import List
from dotenv import load_dotenv
from google import genai
from pytrends.request import TrendReq
import time
import random

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from  backend.src.core.loader import DataLoader

class LeadingIndicators:
    def __init__(self):
        env_path = os.path.join(os.path.dirname(__file__), '../../../../.env')
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
        chunk_size = 3
        query_chunks = [queries[i:i + chunk_size] for i in range(0, len(queries), chunk_size)]
        
        for i, chunk in enumerate(query_chunks, start=1):
            print(f"Fetching batch {i}/{len(query_chunks)}: {chunk}")
            
            max_retries = 3
            
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
                        
                    break 
                    
                except Exception as e:
                    print(f"  -> Attempt {attempt + 1} failed: {e}")
                    if attempt < max_retries - 1:
                        print("  -> Retrying in 15 seconds...")
                        time.sleep(15)
                    else:
                        print(f"  -> Failed batch {i} completely after {max_retries} attempts.")
            
            if i < len(query_chunks):
                sleep_time = random.uniform(3, 10)
                print(f"Sleeping for {sleep_time:.1f} seconds to protect IP...")
                time.sleep(sleep_time)
                    
        if not all_data.empty:
            print(f"\nSuccessfully downloaded trends data. Shape: {all_data.shape}")
        
        return all_data

    def calculate_lagged_correlations(self, primary_df: pd.DataFrame, target_col: str, trends_df: pd.DataFrame, max_lag: int = 3) -> pd.DataFrame:
        print("\nCalculating cross-correlations with search trends...")
        
        primary_monthly = primary_df.resample('MS').mean()
        trends_monthly = trends_df.resample('MS').mean()
        
        merged_df = primary_monthly.join(trends_monthly, how='inner')
        
        if len(merged_df) < max_lag + 3:
            print(f"Warning: Not enough overlapping dates (only {len(merged_df)} months found). Correlations may be inaccurate.")
            
        results = []
        trend_columns = [col for col in trends_df.columns]
        
        for query in trend_columns:
            if query not in merged_df.columns:
                 continue
                 
            correlations = {'Search Query': query}
            
            corr_0 = merged_df[target_col].corr(merged_df[query])
            corr_0 = 0.0 if pd.isna(corr_0) else round(corr_0, 3)
            correlations['Correlation (Lag 0)'] = corr_0
            
            best_lag_corr = 0
            best_lag = 0
            
            # Lags 1 to max_lag
            for lag in range(1, max_lag + 1):
                lagged_corr = merged_df[target_col].shift(-lag).corr(merged_df[query])
                lagged_corr = 0.0 if pd.isna(lagged_corr) else round(lagged_corr, 3)
                
                correlations[f'Correlation (Lag -{lag})'] = lagged_corr
                
                if abs(lagged_corr) > abs(best_lag_corr):
                    best_lag_corr = lagged_corr
                    best_lag = lag
            
            max_abs_corr = max(abs(corr_0), abs(best_lag_corr))
            
            if max_abs_corr < 0.4:
                result_cat = "Noise"
            elif max_abs_corr >= 0.4 and best_lag > 0:
                result_cat = f"Strong Lead (Lag -{best_lag})"
            else:
                 result_cat = "Synchronous Indicator"
                 
            correlations['Result'] = result_cat
            results.append(correlations)
            
        results_df = pd.DataFrame(results)
        
        if 'Correlation (Lag -1)' in results_df.columns:
            results_df = results_df.sort_values(by='Correlation (Lag -1)', key=abs, ascending=False)
            
        return results_df

    def run_hypothesis_generation(self):
        print("\n" + "="*40)
        print(" MODULE 2: LEADING INDICATORS")
        print(" Hypothesis Generation & Data Mining")
        print("="*40)
        
        filename = input("Enter the filename of your dataset (e.g., test.csv): ").strip()
        loader = DataLoader()
        primary_df = loader.load_csv(filename)
        
        if primary_df is None:
            print("Failed to load dataset. Exiting.")
            return
            
        print("\nAvailable columns in dataset:", list(primary_df.columns))
        target_col = input("Enter the column name to predict (Target Variable): ").strip()
        
        if target_col not in primary_df.columns:
            print(f"Error: Column '{target_col}' not found in dataset.")
            return

        region = input("Enter Region (e.g., Україна): ").strip()
        geo_code = input("Enter Region ISO Code for Google Trends (e.g., UA): ").strip().upper()
        if not geo_code:
            geo_code = 'UA'
        extra = input("Enter Extra Info (optional): ").strip()

        print("\nSending context to Gemini and generating semantic queries...")
        queries = self.generate_search_queries(target_col, region, extra)

        if not queries:
            print("Failed to generate queries. Exiting.")
            return

        print("\n--- GENERATED HYPOTHESES ---")
        for i, query in enumerate(queries, start=1):
            print(f"{i}. {query}")
        
        trends_df = self.fetch_google_trends_data(queries=queries, geo_code=geo_code)
        
        if trends_df.empty:
             print("No trend data gathered. Exiting.")
             return
             
        trends_filename = f"trends_{target_col}_{geo_code}.csv"
        trends_df.to_csv(trends_filename)
        print(f"\n[*] Raw Google Trends data saved to '{trends_filename}'")
             
        results_df = self.calculate_lagged_correlations(primary_df, target_col, trends_df)
        
        print("\n" + "="*40)
        print(" FINAL RESULT: TOP PREDICTIVE QUERIES")
        print("="*40)
        print(results_df.head(5).to_string(index=False))
        
        results_filename = f"correlations_{target_col}_{geo_code}.csv"
        results_df.to_csv(results_filename, index=False)
        print(f"\n[*] Correlation results saved to '{results_filename}'")
            
        return results_df
    
if __name__ == "__main__":
    li_module = LeadingIndicators()
    final_results = li_module.run_hypothesis_generation()