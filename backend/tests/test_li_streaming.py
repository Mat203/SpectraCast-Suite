import pandas as pd
import pytest
import numpy as np
from typing import Optional

from backend.src.modules.li.streaming import stream_leading_indicator_events, _convert_numpy_types


class FakeGenerator:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self.queries = ["query1"]

    def generate(self, target, region, extra_info):
        return self.queries


class FakeFetcher:
    def __init__(self, df):
        self.df = df

    def fetch_data(self, queries, geo):
        return self.df


class FakeAnalyzer:
    def __init__(self, df):
        self.df = df

    def calculate_lags(self, primary_df, target_col, trends_df):
        return self.df


class FakeStorage:
    def join_key(self, prefix, filename):
        return f"{prefix}/{filename}"

    def write_csv(self, key, df, include_index):
        pass


class FakeModule:
    def __init__(self, generator, fetcher, analyzer, storage):
        self.generator = generator
        self.fetcher = fetcher
        self.analyzer = analyzer
        self.storage = storage


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
def mock_run_sync(monkeypatch):
    async def fake_run_sync(func, *args, **kwargs):
        return func(*args, **kwargs)
    
    monkeypatch.setattr("backend.src.modules.li.streaming.anyio.to_thread.run_sync", fake_run_sync)


def test_convert_numpy_types():
    assert _convert_numpy_types(np.int64(5)) == 5
    assert _convert_numpy_types(np.float64(3.14)) == 3.14
    assert _convert_numpy_types(np.array([1, 2])) == [1, 2]
    assert _convert_numpy_types({"a": np.int32(1)}) == {"a": 1}
    assert _convert_numpy_types([np.float32(1.5)]) == [1.5]
    assert _convert_numpy_types("standard_string") == "standard_string"


@pytest.mark.anyio
async def test_stream_leading_indicator_events_success(monkeypatch, mock_run_sync):
    primary_df = pd.DataFrame({"target": [1, 2, 3]})
    trends_df = pd.DataFrame({"query1": [10, 20, 30]})
    results_df = pd.DataFrame([
        {"Search Query": "query1", "Correlation (Lag 0)": 0.5, "Result": "Synchronous"}
    ])

    fake_module = FakeModule(
        FakeGenerator(),
        FakeFetcher(trends_df),
        FakeAnalyzer(results_df),
        FakeStorage()
    )
    monkeypatch.setattr("backend.src.modules.li.streaming.LeadingIndicatorsModule", lambda: fake_module)

    events = []
    async for event in stream_leading_indicator_events(
        primary_df, "target", "UA", "UA", "", "file-1", user_api_key="custom_key"
    ):
        events.append(event)

    assert len(events) == 4
    assert events[0]["stage"] == "Sending request to LLM..."
    assert events[1]["stage"] == "Fetching data from Google Trends..."
    assert events[2]["stage"] == "Finalizing calculations..."
    
    final_event = events[3]
    assert final_event["status"] == "done"
    assert final_event["data"]["status"] == "success"
    assert final_event["data"]["queries_generated"] == ["query1"]
    assert final_event["data"]["trends_file"] == "outputs/raw_trends_file-1.csv"
    assert final_event["data"]["correlations_file"] == "outputs/correlations_file-1.csv"
    assert len(final_event["data"]["top_results"]) == 1
    assert final_event["data"]["top_results"][0]["Search Query"] == "query1"


@pytest.mark.anyio
async def test_stream_leading_indicator_events_no_queries(monkeypatch, mock_run_sync):
    primary_df = pd.DataFrame({"target": [1, 2, 3]})
    
    class EmptyGenerator(FakeGenerator):
        def generate(self, target, region, extra_info):
            return []

    fake_module = FakeModule(EmptyGenerator(), FakeFetcher(pd.DataFrame()), FakeAnalyzer(pd.DataFrame()), FakeStorage())
    monkeypatch.setattr("backend.src.modules.li.streaming.LeadingIndicatorsModule", lambda: fake_module)

    with pytest.raises(ValueError, match="Failed to generate queries."):
        async for _ in stream_leading_indicator_events(primary_df, "target", "UA", "UA", "", "file-2"):
            pass


@pytest.mark.anyio
async def test_stream_leading_indicator_events_no_trends(monkeypatch, mock_run_sync):
    primary_df = pd.DataFrame({"target": [1, 2, 3]})
    fake_module = FakeModule(FakeGenerator(), FakeFetcher(pd.DataFrame()), FakeAnalyzer(pd.DataFrame()), FakeStorage())
    monkeypatch.setattr("backend.src.modules.li.streaming.LeadingIndicatorsModule", lambda: fake_module)

    events = []
    with pytest.raises(ValueError, match="Google Trends data is missing."):
        async for event in stream_leading_indicator_events(primary_df, "target", "UA", "UA", "", "file-3"):
            events.append(event)
    
    assert len(events) == 2 
