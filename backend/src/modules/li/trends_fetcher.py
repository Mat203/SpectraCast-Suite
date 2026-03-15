import pandas as pd
import time
import random
from pytrends.request import TrendReq
from typing import List

class TrendsFetcher:
    def __init__(self, hl='en-US', tz=360):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/122.0.0.0 Safari/537.36",
        }
        self.pytrends = TrendReq(hl=hl, tz=tz, requests_args={'headers': self.headers})

    def fetch_data(self, queries: List[str], geo_code: str, timeframe: str = 'today 5-y') -> pd.DataFrame:
        all_data = pd.DataFrame()
        chunk_size = 3
        query_chunks = [queries[i:i + chunk_size] for i in range(0, len(queries), chunk_size)]

        for i, chunk in enumerate(query_chunks, start=1):
            print(f"Fetching batch {i}/{len(query_chunks)}: {chunk}")
            for attempt in range(3):
                try:
                    self.pytrends.build_payload(chunk, geo=geo_code, timeframe=timeframe)
                    df_chunk = self.pytrends.interest_over_time()
                    
                    if not df_chunk.empty:
                        df_chunk = df_chunk.drop(columns=['isPartial'], errors='ignore')
                        all_data = df_chunk if all_data.empty else all_data.join(df_chunk, how='outer')
                    break
                except Exception as e:
                    print(f"Attempt {attempt + 1} failed: {e}")
                    time.sleep(15)
            
            if i < len(query_chunks):
                time.sleep(random.uniform(3, 5))
        
        return all_data