import os
import time
import pandas as pd
import requests
from typing import List
class TrendsFetcher:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("SERPAPI_KEY")
        self.base_url = "https://serpapi.com/search"
        self.timeout_seconds = 10

    def fetch_data(self, queries: List[str], geo_code: str, timeframe: str = 'today 5-y') -> pd.DataFrame:
        all_data = pd.DataFrame()
        
        chunk_size = 5 
        query_chunks = [queries[i:i + chunk_size] for i in range(0, len(queries), chunk_size)]

        for i, chunk in enumerate(query_chunks, start=1):
            print(f"Fetching batch {i}/{len(query_chunks)} via SerpAPI: {chunk}")
            
            q_string = ",".join(chunk)
            
            try:
                response = requests.get(
                    self.base_url,
                    params={
                        "engine": "google_trends",
                        "q": q_string,
                        "geo": geo_code,
                        "date": timeframe,
                        "data_type": "TIMESERIES",
                        "api_key": self.api_key,
                    },
                    timeout=self.timeout_seconds,
                )
                if not response.ok:
                    raise RuntimeError(f"SerpAPI returned HTTP {response.status_code}")

                results = response.json()
                
                interest_data = results.get("interest_over_time", {}).get("timeline_data", [])
                
                if interest_data:
                    parsed_rows = []
                    for item in interest_data:
                        row = {"date": pd.to_datetime(int(item.get("timestamp")), unit='s')}
                        for val in item.get("values", []):
                            query_name = val.get("query")
                            row[query_name] = val.get("extracted_value", 0)
                        parsed_rows.append(row)
                    
                    df_chunk = pd.DataFrame(parsed_rows)
                    
                    if not df_chunk.empty:
                        df_chunk = df_chunk.set_index("date")
                        all_data = df_chunk if all_data.empty else all_data.join(df_chunk, how='outer')
                else:
                    print(f"  [!] SerpAPI не повернув даних для: {chunk}. Пропускаємо.")

            except requests.Timeout:
                print(f"  [!] SerpAPI timeout ({self.timeout_seconds}s) for: {chunk}. Пропускаємо.")
            except Exception as e:
                print(f"  [!] Помилка SerpAPI: {e}. Пропускаємо.")

            if i < len(query_chunks):
                time.sleep(5)
        
        return all_data