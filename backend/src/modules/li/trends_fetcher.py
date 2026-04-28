import os
import time
import serpapi
import pandas as pd
import numpy as np
from typing import List
from dotenv import load_dotenv

load_dotenv()

class TrendsFetcher:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("SERPAPI_KEY")
        
        self.client = serpapi.Client(api_key=self.api_key)

    def _generate_mock_data(self, queries: List[str]) -> pd.DataFrame:

        print(f"Використовується заглушка (Mock Data) для: {queries}")
        dates = pd.date_range(end=pd.Timestamp.today(), periods=260, freq='W')
        mock_dict = {'date': dates}
        for q in queries:
            mock_dict[q] = np.random.randint(0, 101, size=len(dates))
            
        return pd.DataFrame(mock_dict).set_index('date')

    def fetch_data(self, queries: List[str], geo_code: str, timeframe: str = 'today 5-y') -> pd.DataFrame:
        all_data = pd.DataFrame()
        
        chunk_size = 5 
        query_chunks = [queries[i:i + chunk_size] for i in range(0, len(queries), chunk_size)]

        for i, chunk in enumerate(query_chunks, start=1):
            print(f"Fetching batch {i}/{len(query_chunks)} via SerpAPI: {chunk}")
            
            q_string = ",".join(chunk)
            
            try:
                results = self.client.search({
                    "engine": "google_trends",
                    "q": q_string,
                    "geo": geo_code,
                    "date": timeframe,
                    "data_type": "TIMESERIES"
                })
                
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
                    print(f"  [!] SerpAPI не повернув даних для: {chunk}. Перехід на заглушку.")
                    df_mock = self._generate_mock_data(chunk)
                    all_data = df_mock if all_data.empty else all_data.join(df_mock, how='outer')

            except Exception as e:
                print(f"  [!] Помилка SerpAPI: {e}. Перехід на заглушку.")
                df_mock = self._generate_mock_data(chunk)
                all_data = df_mock if all_data.empty else all_data.join(df_mock, how='outer')

            if i < len(query_chunks):
                time.sleep(5)
        
        return all_data