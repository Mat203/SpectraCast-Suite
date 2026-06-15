import pandas as pd
import pytest

from backend.src.modules.li.li import LeadingIndicatorsModule


class FakeGenerator:
    def __init__(self, queries):
        self.queries = queries
        self.calls = []

    def generate(self, target, region, extra_info=""):
        self.calls.append((target, region, extra_info))
        return self.queries


class FakeFetcher:
    def __init__(self, df):
        self.df = df
        self.calls = []

    def fetch_data(self, queries, geo, timeframe="today 5-y"):
        self.calls.append((queries, geo, timeframe))
        return self.df


class FakeAnalyzer:
    def __init__(self, df):
        self.df = df
        self.calls = []

    def calculate_lags(self, primary_df, target_col, trends_df, max_lag=3):
        self.calls.append((target_col, max_lag))
        return self.df


def build_module(fake_storage, generator, fetcher, analyzer):
    module = LeadingIndicatorsModule.__new__(LeadingIndicatorsModule)
    module.generator = generator
    module.fetcher = fetcher
    module.analyzer = analyzer
    module.storage = fake_storage
    module.loader = None
    return module


def test_run_api_success(fake_storage):
    primary_df = pd.DataFrame({"target": [1, 2, 3]}, index=pd.date_range("2024-01-01", periods=3, freq="D"))
    trends_df = pd.DataFrame({"query": [1, 2, 3]}, index=pd.date_range("2024-01-01", periods=3, freq="D"))
    results_df = pd.DataFrame([
        {"Search Query": "query", "Correlation (Lag 0)": 0.5, "Result": "Synchronous"},
    ])

    generator = FakeGenerator(["query"])
    fetcher = FakeFetcher(trends_df)
    analyzer = FakeAnalyzer(results_df)
    module = build_module(fake_storage, generator, fetcher, analyzer)

    queries, trends_key, corr_key, results = module.run_api(
        primary_df=primary_df,
        target_col="target",
        region="UA",
        geo="UA",
        extra="",
        file_id="file-1",
    )

    assert queries == ["query"]
    assert trends_key.endswith("raw_trends_file-1.csv")
    assert corr_key.endswith("correlations_file-1.csv")
    assert not results.empty
    assert fake_storage.exists(trends_key)
    assert fake_storage.exists(corr_key)


def test_run_api_raises_when_no_queries(fake_storage):
    primary_df = pd.DataFrame({"target": [1, 2, 3]}, index=pd.date_range("2024-01-01", periods=3, freq="D"))

    generator = FakeGenerator([])
    fetcher = FakeFetcher(pd.DataFrame())
    analyzer = FakeAnalyzer(pd.DataFrame())
    module = build_module(fake_storage, generator, fetcher, analyzer)

    with pytest.raises(ValueError, match="Failed to generate search queries."):
        module.run_api(
            primary_df=primary_df,
            target_col="target",
            region="UA",
            geo="UA",
            extra="",
            file_id="file-2",
        )


def test_run_api_raises_when_trends_empty(fake_storage):
    primary_df = pd.DataFrame({"target": [1, 2, 3]}, index=pd.date_range("2024-01-01", periods=3, freq="D"))

    generator = FakeGenerator(["query"])
    fetcher = FakeFetcher(pd.DataFrame())
    analyzer = FakeAnalyzer(pd.DataFrame())
    module = build_module(fake_storage, generator, fetcher, analyzer)

    with pytest.raises(ValueError, match="No Google Trends data available."):
        module.run_api(
            primary_df=primary_df,
            target_col="target",
            region="UA",
            geo="UA",
            extra="",
            file_id="file-3",
        )
