import pandas as pd

from backend.src.modules.li.trends_fetcher import TrendsFetcher


class FakeResponse:
    def __init__(self, results, ok: bool = True, status_code: int = 200):
        self._results = results
        self.ok = ok
        self.status_code = status_code

    def json(self):
        return self._results



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

    def fake_get(*_args, **_kwargs):
        return FakeResponse(results)

    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.requests.get", fake_get)

    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.time.sleep", lambda *_args: None)

    df = fetcher.fetch_data(["q1"], geo_code="UA", timeframe="today 12-m")

    assert "q1" in df.columns
    assert len(df) == 2


def test_fetch_data_falls_back_to_mock(monkeypatch):
    fixed_today = pd.Timestamp("2024-01-07")
    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.pd.Timestamp.today", lambda: fixed_today)

    results = {"interest_over_time": {"timeline_data": []}}

    fetcher = TrendsFetcher(api_key="x")

    def fake_get(*_args, **_kwargs):
        return FakeResponse(results)

    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.requests.get", fake_get)

    monkeypatch.setattr("backend.src.modules.li.trends_fetcher.time.sleep", lambda *_args: None)

    df = fetcher.fetch_data(["q1", "q2"], geo_code="UA", timeframe="today 12-m")

    assert df.empty
    assert list(df.columns) == []
