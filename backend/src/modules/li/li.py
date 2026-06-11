import pandas as pd
from typing import Optional
from .query_generator import QueryGenerator
from .trends_fetcher import TrendsFetcher
from .analyzer import CorrelationAnalyzer

from backend.src.core.loader import DataLoader
from backend.src.api.services.storage import StorageService

class LeadingIndicatorsModule:
    def __init__(self):
        self.generator = QueryGenerator()
        self.fetcher = TrendsFetcher()
        self.analyzer = CorrelationAnalyzer()
        self.storage = StorageService()
        self.loader = DataLoader(storage=self.storage)

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
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Generating search queries for target column: %s", target_col)
        generator = QueryGenerator(api_key=user_api_key) if user_api_key else self.generator
        queries = generator.generate(target_col, region, extra_info=extra)

        if not queries:
            raise ValueError("Failed to generate search queries.")

        trends_df = self.fetcher.fetch_data(queries, geo)
        if trends_df.empty:
            raise ValueError("No Google Trends data available.")

        trends_key = self.storage.join_key("outputs", f"raw_trends_{file_id}.csv")
        self.storage.write_csv(trends_key, trends_df, include_index=True)

        results_df = self.analyzer.calculate_lags(primary_df, target_col, trends_df)

        final_key = self.storage.join_key("outputs", f"correlations_{file_id}.csv")
        self.storage.write_csv(final_key, results_df, include_index=False)

        return queries, trends_key, final_key, results_df