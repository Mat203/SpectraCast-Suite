from types import SimpleNamespace

import pandas as pd
import pytest

from backend.src.modules.li.trends_fetcher import TrendsFetcher


class FakeClient:
    def __init__(self, results):
        self._results = results
        self.calls = []

    def search(self, payload):
        self.calls.append(payload)
        return self._results


def test_generate_mock_data_has_queries(monkeypatch):
    fixed_today = pd.Timestamp("2024-01-07")
    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.pd.Timestamp.today", lambda: fixed_today)

    fetcher = TrendsFetcher(api_key="x")
    df = fetcher._generate_mock_data(["q1", "q2"])

    assert "q1" in df.columns
    assert "q2" in df.columns
    assert len(df) == 260


def test_fetch_data_uses_serpapi_results(monkeypatch):
    timeline_data = [
        {
            "timestamp": "1704067200",
            "values": [{"query": "q1", "extracted_value": 10}],
        },
        {
            "timestamp": "1706745600",
            "values": [{"query": "q1", "extracted_value": 12}],
        },
    ]
    results = {"interest_over_time": {"timeline_data": timeline_data}}

    fetcher = TrendsFetcher(api_key="x")
    fetcher.client = FakeClient(results)

    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.time.sleep", lambda *_args: None)

    df = fetcher.fetch_data(["q1"], geo_code="UA", timeframe="today 12-m")

    assert "q1" in df.columns
    assert len(df) == 2


def test_fetch_data_falls_back_to_mock(monkeypatch):
    fixed_today = pd.Timestamp("2024-01-07")
    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.pd.Timestamp.today", lambda: fixed_today)

    results = {"interest_over_time": {"timeline_data": []}}

    fetcher = TrendsFetcher(api_key="x")
    fetcher.client = FakeClient(results)

    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.time.sleep", lambda *_args: None)

    df = fetcher.fetch_data(["q1", "q2"], geo_code="UA", timeframe="today 12-m")

    assert "q1" in df.columns
    assert "q2" in df.columns
    assert len(df) == 260
