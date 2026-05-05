import logging
import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, Optional

class DataScanner:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.logger = logging.getLogger(__name__)
        if not self._has_datetime_axis():
            self.logger.info("Datetime column not found. Time-based scanning will be skipped.")

    def _get_datetime_column(self) -> Optional[str]:
        for column in self.df.columns:
            series = self.df[column]
            if pd.api.types.is_datetime64_any_dtype(series):
                return column
            if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
                continue

            sample = series.dropna().astype(str)
            if sample.empty:
                continue

            if sample.str.fullmatch(r"\d+").all():
                continue

            name_hint = str(column).lower()
            has_name_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
            has_separator = sample.str.contains(r"[-/:T ]").any()
            parsed = pd.to_datetime(sample, errors="coerce", infer_datetime_format=True)
            if parsed.notna().mean() >= 0.8 and (has_name_hint or has_separator):
                return column
        return None

    def _has_datetime_axis(self) -> bool:
        return isinstance(self.df.index, pd.DatetimeIndex) or self._get_datetime_column() is not None

    def _resolve_datetime_index(self) -> Optional[pd.DatetimeIndex]:
        if isinstance(self.df.index, pd.DatetimeIndex):
            return self.df.index

        datetime_column = self._get_datetime_column()
        if not datetime_column:
            return None

        series = pd.to_datetime(self.df[datetime_column], errors="coerce", infer_datetime_format=True)
        series = series.dropna()
        if len(series) < 2:
            return None

        return pd.DatetimeIndex(series)

    def _detect_frequency_and_gaps(self) -> Dict[str, Any]:
        result = {
            "frequency": "Unknown",
            "display_frequency": "Unknown (Irregular)",
            "missing_dates_count": 0,
            "missing_dates": []
        }

        datetime_index = self._resolve_datetime_index()
        if len(self.df) <= 1 or datetime_index is None:
            return result

        sorted_index = datetime_index.sort_values().drop_duplicates()
        if len(sorted_index) < 2:
            return result

        deltas = sorted_index.to_series().diff().dropna()
        
        if deltas.empty:
            return result

        try:
            dominant_delta = deltas.mode().iloc[0]
        except (IndexError, ValueError):
            return result

        dominant_delta_days = dominant_delta.days
        if dominant_delta_days <= 0:
            return result
        
        if 28 <= dominant_delta_days <= 31:
            most_frequent_day = pd.Series(sorted_index.day).mode()[0]
            freq_str = 'MS' if most_frequent_day == 1 else 'ME'
            display_freq = "Monthly"
        elif 89 <= dominant_delta_days <= 93:
            freq_str = 'QS' 
            display_freq = "Quarterly"
        elif dominant_delta_days == 7:
            freq_str = 'W'
            display_freq = "Weekly"
        elif dominant_delta_days == 1:
            has_weekends = (sorted_index.dayofweek >= 5).any()
            if not has_weekends:
                freq_str = 'B'
                display_freq = "Business Daily (Mon-Fri)"
            else:
                freq_str = 'D'
                display_freq = "Daily"
        else:
            freq_str = f"{dominant_delta_days}D"
            display_freq = f"Every {dominant_delta_days} days"

        result["frequency"] = freq_str
        result["display_frequency"] = display_freq
        
        try:
            ideal_range = pd.date_range(
                start=sorted_index.min(),
                end=sorted_index.max(),
                freq=freq_str
            )
        except Exception:
            return result
        
        missing_dates = ideal_range.difference(sorted_index)
        
        result["missing_dates_count"] = len(missing_dates)
        if len(missing_dates) > 0:
            result["missing_dates"] = [d.strftime('%Y-%m-%d') for d in missing_dates[:5]]

        return result

    def _seasonal_lag_from_frequency(self, frequency: str) -> Optional[int]:
        if frequency in {"MS", "ME"}:
            return 12
        if frequency == "QS":
            return 4
        if frequency == "W":
            return 52
        if frequency in {"D", "B"}:
            return 7
        if frequency.endswith("D"):
            try:
                day_stride = int(frequency[:-1])
            except ValueError:
                return None
            if day_stride > 0:
                return max(1, int(round(365 / day_stride)))
        return None

    def _is_financial_asset(self, column_name: str) -> bool:
        name = column_name.lower()
        tokens = (
            "price",
            "close",
            "open",
            "high",
            "low",
            "volume",
            "fx",
            "rate",
            "yield",
            "usd",
            "eur",
            "gbp",
            "jpy",
            "btc",
            "eth",
            "stock",
            "equity",
            "index",
        )
        return any(token in name for token in tokens)

    def recommend_missing_value_strategy(self, column_name: str, frequency: str) -> Optional[Dict[str, Any]]:
        if column_name not in self.df.columns:
            return None

        series = self.df[column_name]
        if not pd.api.types.is_numeric_dtype(series):
            return None

        total_count = len(series)
        missing_count = int(series.isna().sum())
        if missing_count == 0 or total_count == 0:
            return None

        available = series.dropna()
        if available.empty:
            return None

        mean_val = float(available.mean())
        std_val = float(available.std(ddof=0))
        cv = std_val / abs(mean_val) if mean_val != 0 else float("inf")

        autocorr_lag1 = available.autocorr(lag=1)
        autocorr_lag1 = float(autocorr_lag1) if not np.isnan(autocorr_lag1) else 0.0

        seasonal_lag = self._seasonal_lag_from_frequency(frequency)
        seasonal_corr = 0.0
        if seasonal_lag and len(available) > seasonal_lag:
            seasonal_value = available.autocorr(lag=seasonal_lag)
            seasonal_corr = float(seasonal_value) if not np.isnan(seasonal_value) else 0.0

        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        max_corr = 0.0
        if len(numeric_cols) > 1 and column_name in numeric_cols:
            corr_matrix = self.df[numeric_cols].corr()
            if column_name in corr_matrix:
                other_corrs = corr_matrix[column_name].drop(labels=[column_name]).abs()
                if not other_corrs.empty:
                    max_corr = float(other_corrs.max())

        missing_ratio = missing_count / total_count if total_count else 1.0

        if seasonal_corr > 0.6:
            strategy_code = "5"
            strategy_label = "seasonal_mean"
            reasoning = (
                "Detected a strong seasonal pattern, so seasonal means preserve cyclical behavior."
            )
        elif cv < 0.15 and autocorr_lag1 > 0.8:
            strategy_code = "1"
            strategy_label = "linear"
            reasoning = (
                "Low volatility and strong trend continuity make linear interpolation reliable."
            )
        elif cv >= 0.15 or self._is_financial_asset(column_name):
            strategy_code = "3"
            strategy_label = "ffill"
            reasoning = (
                "High volatility or financial pricing favors forward fill to avoid creating artificial trends."
            )
        elif missing_ratio < 0.1 and max_corr > 0.6:
            strategy_code = "6"
            strategy_label = "knn"
            reasoning = (
                "Few missing values and strong cross-column correlation support KNN imputation."
            )
        else:
            strategy_code = "1"
            strategy_label = "linear"
            reasoning = "Defaulted to linear interpolation for a smooth, low-bias fill."

        return {
            "strategy_code": strategy_code,
            "strategy": strategy_label,
            "reasoning": reasoning,
            "metrics": {
                "cv": cv,
                "autocorr_lag1": autocorr_lag1,
                "seasonal_corr": seasonal_corr,
                "missing_ratio": missing_ratio,
                "max_corr": max_corr,
            },
        }

    def run_health_check(self) -> Dict[str, Any]:
        report = {
            "rows": len(self.df),
            "columns": list(self.df.columns),
            "outliers": {},
            "outlier_strategy_recommendations": {},
            "missing_values": self.df.isna().sum().to_dict(),
            "missing_value_strategy_recommendations": {},
        }

        if self._has_datetime_axis():
            time_check_results = self._detect_frequency_and_gaps()
            report.update(time_check_results)
        else:
            report.update({
                "frequency": "Unknown",
                "display_frequency": "Unknown (Irregular)",
                "missing_dates_count": 0,
                "missing_dates": [],
                "time_series_message": "Time column not found. Time series analysis skipped.",
            })

        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        frequency = report.get("frequency", "Unknown")
        
        for col in numeric_cols:
            z_scores = np.abs(stats.zscore(self.df[col], nan_policy='omit'))
            outliers_count = np.count_nonzero(z_scores > 3)
            
            if outliers_count > 0:
                report["outliers"][col] = outliers_count

            series = self.df[col].dropna()
            if series.empty:
                continue

            skew_value = float(series.skew())
            abs_skew = abs(skew_value)

            if abs_skew > 1.0:
                strategy = "iqr_clip"
                reasoning = (
                    "High skewness in the time series. The IQR method minimizes the impact of extreme values without losing data points"
                )
            elif abs_skew > 0.5:
                strategy = "median"
                reasoning = (
                    "Moderate skewness. Using the median provides robustness against outliers that distort the mean"
                )
            else:
                strategy = "mean"
                reasoning = (
                    "Distribution is close to symmetric. Using the mean is statistically optimal for filling anomalies"
                )

            report["outlier_strategy_recommendations"][col] = {
                "skew": skew_value,
                "strategy": strategy,
                "reasoning": reasoning,
            }

            if report["missing_values"].get(col, 0) > 0:
                missing_rec = self.recommend_missing_value_strategy(col, frequency)
                if missing_rec:
                    report["missing_value_strategy_recommendations"][col] = missing_rec

        return report

    def print_report(self, report: Dict[str, Any]):
        print("\n" + "="*40)
        print(" DATA HEALTH CARD")
        print("="*40)
        print(f"Rows:      {report['rows']}")
        print(f"Frequency: {report['display_frequency']}")
        
        if report["missing_dates_count"] > 0:
            print(f"Missing Dates (Gaps): {report['missing_dates_count']}")
            print(f"  Example gaps:       {', '.join(report['missing_dates'])}...")
        else:
            print("Missing Dates:        0")

        print("\nMissing Values (NaNs):")
        for col, count in report['missing_values'].items():
            if count > 0:
                print(f"  - {col}: {count} missing")

        if report["outliers"]:
            print("\nExtreme Outliers (Z-score > 3):")
            for col, count in report["outliers"].items():
                print(f"  - {col}: {count} outliers")
        else:
            print("\nNo extreme outliers detected.")

        if report.get("outlier_strategy_recommendations"):
            print("\nOutlier Strategy Recommendations (Skew-based):")
            for col, rec in report["outlier_strategy_recommendations"].items():
                print(f"  - {col}: {rec['strategy']} (skew={rec['skew']:.2f})")