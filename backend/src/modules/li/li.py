import pandas as pd
import sys
import os
from typing import Optional
from .query_generator import QueryGenerator
from .trends_fetcher import TrendsFetcher
from .analyzer import CorrelationAnalyzer

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
from backend.src.core.loader import DataLoader
from backend.src.api.services.storage import StorageService

class LeadingIndicatorsModule:
    def __init__(self):
        self.generator = QueryGenerator()
        self.fetcher = TrendsFetcher()
        self.analyzer = CorrelationAnalyzer()
        self.storage = StorageService()
        self.loader = DataLoader(storage=self.storage)

    def run(self):
        print("\n" + "="*40)
        print(" MODULE 2: LEADING INDICATORS")
        print("="*40)

        filename = input("Введіть назву файлу (напр. test.csv): ").strip()
        primary_df = self.loader.load_csv(filename)
        
        if primary_df is None:
            return

        target_col = input("Введіть назву цільової колонки (Target): ").strip()
        if target_col not in primary_df.columns:
            print(f"Помилка: Колонку '{target_col}' не знайдено.")
            return

        region = input("Регіон (напр. Україна): ").strip()
        geo = input("Код країни ISO (напр. UA): ").strip().upper() or "UA"
        
        extra = input("Додаткова інформація (натисніть Enter, щоб пропустити): ").strip()

        print("\n[*] Gemini генерує пошукові запити...")
        queries = self.generator.generate(target_col, region, extra_info=extra)

        if not queries:
            print("Не вдалося згенерувати запити.")
            return


        trends_df = self.fetcher.fetch_data(queries, geo)
        
        if trends_df.empty:
            print("Дані Google Trends відсутні.")
            return

        trends_key = self.storage.join_key("outputs", f"raw_trends_{target_col}_{geo}.csv")
        self.storage.write_csv(trends_key, trends_df, include_index=True)
        print(f"[v] Сирі дані трендів збережено у: s3://{self.storage.bucket}/{trends_key}")

        results_df = self.analyzer.calculate_lags(primary_df, target_col, trends_df)
        
        print("\n" + "="*40)
        print(" ФІНАЛЬНИЙ РЕЗУЛЬТАТ: ТОП ПОКАЗНИКІВ")
        print("="*40)
        print(results_df.head(10).to_string(index=False))
        
        final_key = self.storage.join_key("outputs", f"correlations_{target_col}_{geo}.csv")
        self.storage.write_csv(final_key, results_df, include_index=False)
        print(f"\n[*] Звіт по кореляціям збережено у: s3://{self.storage.bucket}/{final_key}")
    
    def run_api(
        self,
        primary_df: pd.DataFrame,
        target_col: str,
        region: str,
        geo: str,
        extra: str,
        file_id: str,
        user_api_key: Optional[str] = None,
    ):
        print(f"\n[*] NOT OUR GEMINI Gemini генерує пошукові запити для {target_col}...")
        generator = QueryGenerator(api_key=user_api_key) if user_api_key else self.generator
        queries = generator.generate(target_col, region, extra_info=extra)

        if not queries:
            raise ValueError("Не вдалося згенерувати запити.")

        trends_df = self.fetcher.fetch_data(queries, geo)
        if trends_df.empty:
            raise ValueError("Дані Google Trends відсутні.")

        trends_key = self.storage.join_key("outputs", f"raw_trends_{file_id}.csv")
        self.storage.write_csv(trends_key, trends_df, include_index=True)

        results_df = self.analyzer.calculate_lags(primary_df, target_col, trends_df)
        
        final_key = self.storage.join_key("outputs", f"correlations_{file_id}.csv")
        self.storage.write_csv(final_key, results_df, include_index=False)

        return queries, trends_key, final_key, results_df

if __name__ == "__main__":
    app = LeadingIndicatorsModule()
    app.run()