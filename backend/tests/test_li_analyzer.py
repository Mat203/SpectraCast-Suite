import pandas as pd
import pytest

from backend.src.modules.li.analyzer import CorrelationAnalyzer


def test_infer_numeric_date_format_detects_year_month():
    analyzer = CorrelationAnalyzer()
    sample = pd.Series(["202401", "202402", "202403"])

    assert analyzer._infer_numeric_date_format(sample) == "%Y%m"


def test_infer_numeric_date_format_rejects_mixed_samples():
    analyzer = CorrelationAnalyzer()
    sample = pd.Series(["202401", "2024-02"])

    assert analyzer._infer_numeric_date_format(sample) is None


def test_get_datetime_column_prefers_hint():
    analyzer = CorrelationAnalyzer()
    df = pd.DataFrame({
        "event_time": ["2024-01-01", "2024-01-02"],
        "value": [1, 2],
    })

    assert analyzer._get_datetime_column(df) == "event_time"


def test_fallback_datetime_column_uses_first_column():
    analyzer = CorrelationAnalyzer()
    df = pd.DataFrame({
        "col1": ["20240101", "20240102", "20240103"],
        "value": [1, 2, 3],
    })

    assert analyzer._get_fallback_datetime_column(df) == "col1"


def test_ensure_datetime_index_raises_when_missing():
    analyzer = CorrelationAnalyzer()
    df = pd.DataFrame({"value": [1, 2, 3]})

    with pytest.raises(ValueError, match="Datetime column not found"):
        analyzer._ensure_datetime_index(df, "primary")


def test_calculate_lags_returns_results():
    analyzer = CorrelationAnalyzer()
    dates = pd.date_range("2024-01-01", periods=8, freq="MS")
    primary_df = pd.DataFrame({
        "date": dates,
        "target": [10, 20, 30, 40, 50, 60, 70, 80],
    })
    trends_df = pd.DataFrame({
        "date": dates,
        "query_a": [12, 19, 33, 41, 52, 59, 71, 79],
    })

    results = analyzer.calculate_lags(primary_df, "target", trends_df, max_lag=2)

    assert not results.empty
    assert "Search Query" in results.columns
    assert "Correlation (Lag 0)" in results.columns


def test_calculate_lags_returns_empty_frame_when_insufficient():
    analyzer = CorrelationAnalyzer()
    dates = pd.date_range("2024-01-01", periods=4, freq="MS")
    primary_df = pd.DataFrame({"date": dates, "target": [1, 2, 3, 4]})
    trends_df = pd.DataFrame({"date": dates, "query_a": [1, 2, 3, 4]})

    results = analyzer.calculate_lags(primary_df, "target", trends_df, max_lag=2)

    assert results.empty
    assert "Search Query" in results.columns
