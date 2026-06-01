import numpy as np
import pandas as pd
import pytest

from backend.src.modules.dq.cleaner import DataCleaner
from backend.src.modules.dq.scanner import DataScanner


def test_hidden_missing_values_are_coerced():
    df = pd.DataFrame({"value": ["1", "NaN", " "]})
    scanner = DataScanner(df)
    report = scanner.run_health_check()

    assert report["missing_values"]["value"] == 2


def test_detects_datetime_column_and_missing_dates():
    df = pd.DataFrame(
        {
            "date": ["2024-01-01", "2024-01-02", "2024-01-04"],
            "price": [100, 101, 103],
        }
    )

    report = DataScanner(df).run_health_check()

    assert report["has_datetime_axis"] is True
    assert report["missing_dates_count"] == 1
    assert "2024-01-03" in report["missing_dates"]
    assert report["frequency"] == "B"
    assert report["display_frequency"] == "Business Daily (Mon-Fri)"


def test_no_datetime_axis_falls_back_to_unknown():
    df = pd.DataFrame({"price": [1, 2, 3]})

    report = DataScanner(df).run_health_check()

    assert report["has_datetime_axis"] is False
    assert report["frequency"] == "Unknown"
    assert report["display_frequency"] == "Unknown (Irregular)"


def test_business_daily_frequency_detected():
    df = pd.DataFrame(
        {
            "timestamp": pd.date_range("2024-01-01", periods=10, freq="B"),
            "price": range(10),
        }
    )

    report = DataScanner(df).run_health_check()

    assert report["frequency"] == "B"
    assert report["display_frequency"] == "Business Daily (Mon-Fri)"


def test_align_datetime_index_inserts_gaps():
    dates = pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-04", "2024-01-05"])
    df = pd.DataFrame({"price": [100, 101, 103, 104]}, index=dates)

    cleaner = DataCleaner(df)
    cleaner.align_datetime_index("D")

    assert len(cleaner.df) == 5
    assert pd.isna(cleaner.df.loc["2024-01-03", "price"])


def test_align_datetime_index_unknown_frequency_no_change():
    dates = pd.date_range("2024-01-01", periods=4, freq="D")
    df = pd.DataFrame({"price": [100, 101, 103, 104]}, index=dates)

    cleaner = DataCleaner(df)
    cleaner.align_datetime_index("Unknown")

    assert len(cleaner.df) == 4


def test_impute_linear_fills_missing():
    dates = pd.date_range("2024-01-01", periods=5, freq="D")
    df = pd.DataFrame({"price": [100, np.nan, 104, np.nan, 108]}, index=dates)

    cleaner = DataCleaner(df)
    cleaner.impute_column("price", "1")

    assert cleaner.df["price"].isna().sum() == 0
    assert cleaner.df["price"].iloc[1] == pytest.approx(102.0)


def test_impute_backward_fill_is_disabled():
    dates = pd.date_range("2024-01-01", periods=5, freq="D")
    df = pd.DataFrame({"price": [100, np.nan, 104, np.nan, 108]}, index=dates)

    cleaner = DataCleaner(df)
    cleaner.impute_column("price", "4")

    assert cleaner.df["price"].isna().sum() == 2


def test_impute_seasonal_requires_datetime_index():
    df = pd.DataFrame({"price": [100, np.nan, 104]}, index=["A", "B", "C"])

    cleaner = DataCleaner(df)
    cleaner.impute_column("price", "5")

    assert pd.isna(cleaner.df["price"].iloc[1])


def test_seasonal_lag_from_frequency():
    scanner = DataScanner(pd.DataFrame({"value": [1, 2, 3]}))

    assert scanner._seasonal_lag_from_frequency("MS") == 12
    assert scanner._seasonal_lag_from_frequency("QS") == 4
    assert scanner._seasonal_lag_from_frequency("W") == 52
    assert scanner._seasonal_lag_from_frequency("D") == 7
    assert scanner._seasonal_lag_from_frequency("2D") == 182


def test_recommend_missing_value_strategy_seasonal():
    dates = pd.date_range("2023-01-01", periods=24, freq="MS")
    pattern = list(range(12)) * 2
    values = pd.Series(pattern, index=dates).astype(float)
    values.iloc[5] = np.nan
    df = pd.DataFrame({"date": dates, "seasonal": values.values})

    scanner = DataScanner(df)
    rec = scanner.recommend_missing_value_strategy("seasonal", "MS")

    assert rec is not None
    assert rec["strategy_code"] == "5"


def test_recommend_missing_value_strategy_financial_asset_ffill():
    dates = pd.date_range("2024-01-01", periods=6, freq="D")
    values = pd.Series([100, 102, np.nan, 101, 98, 97], index=dates)
    df = pd.DataFrame({"date": dates, "price": values.values})

    scanner = DataScanner(df)
    rec = scanner.recommend_missing_value_strategy("price", "D")

    assert rec is not None
    assert rec["strategy_code"] == "3"


def test_recommend_missing_value_strategy_linear():
    dates = pd.date_range("2024-01-01", periods=11, freq="D")
    base = [100, 101, 99, 101, 99, 100, 101, 99, 101, 99, 100]
    target = pd.Series(base, index=dates).astype(float)
    target.iloc[3] = np.nan
    corr = pd.Series([value * 2 for value in base], index=dates).astype(float)
    df = pd.DataFrame({"date": dates, "target": target.values, "corr": corr.values})

    scanner = DataScanner(df)
    rec = scanner.recommend_missing_value_strategy("target", "Unknown")

    assert rec is not None
    assert rec["strategy_code"] == "1"


def test_recommend_missing_value_strategy_linear():
    dates = pd.date_range("2024-01-01", periods=6, freq="D")
    values = pd.Series([100, 100.1, 100.2, 100.3, 100.4, 100.5], index=dates).astype(float)
    values.iloc[2] = np.nan
    df = pd.DataFrame({"date": dates, "signal": values.values})

    scanner = DataScanner(df)
    rec = scanner.recommend_missing_value_strategy("signal", "D")

    assert rec is not None
    assert rec["strategy_code"] == "1"


def test_recommend_missing_value_strategy_non_numeric_returns_none():
    dates = pd.date_range("2024-01-01", periods=4, freq="D")
    df = pd.DataFrame({"date": dates, "label": ["a", None, "c", "d"]})

    scanner = DataScanner(df)
    rec = scanner.recommend_missing_value_strategy("label", "D")

    assert rec is None


def test_impute_knn_fills_numeric_column_and_keeps_non_numeric():
    dates = pd.date_range("2024-01-01", periods=5, freq="D")
    df = pd.DataFrame(
        {
            "price": [100, np.nan, 104, 106, 108],
            "category": ["A", "B", "A", "B", "A"],
        },
        index=dates,
    )

    cleaner = DataCleaner(df)
    cleaner.impute_column("price", "6")

    assert cleaner.df["price"].isna().sum() == 0
    assert cleaner.df["category"].iloc[1] == "B"


def test_handle_outliers_clip_iqr_caps_values():
    dates = pd.date_range("2024-01-01", periods=5, freq="D")
    df = pd.DataFrame({"price": [100, 101, 5000, 103, 104]}, index=dates)
    outlier_mask = pd.Series([False, False, True, False, False], index=dates)

    series = df["price"].astype(float)
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    upper_bound = q3 + 1.5 * iqr

    cleaner = DataCleaner(df)
    cleaner.handle_outliers("price", "clip_iqr", outlier_mask)

    assert cleaner.df["price"].iloc[2] == pytest.approx(upper_bound)


def test_handle_outliers_replaces_with_mean():
    dates = pd.date_range("2024-01-01", periods=5, freq="D")
    df = pd.DataFrame({"price": [100, 101, 5000, 103, 104]}, index=dates)
    outlier_mask = pd.Series([False, False, True, False, False], index=dates)

    expected_mean = df["price"].mean()

    cleaner = DataCleaner(df)
    cleaner.handle_outliers("price", "mean", outlier_mask)

    assert cleaner.df["price"].iloc[2] == pytest.approx(expected_mean)


def test_handle_outliers_drop_all_rows():
    dates = pd.date_range("2024-01-01", periods=5, freq="D")
    df = pd.DataFrame({"price": [100, 101, 5000, 103, 104]}, index=dates)
    outlier_mask = pd.Series([True, True, True, True, True], index=dates)

    cleaner = DataCleaner(df)
    cleaner.handle_outliers("price", "drop", outlier_mask)

    assert len(cleaner.df) == 0
