import logging
import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, Optional

class DataScanner:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.logger = logging.getLogger(__name__)
        datetime_column = self._get_datetime_column()
        if not isinstance(self.df.index, pd.DatetimeIndex):
            if datetime_column:
                self.df = self.df.set_index(datetime_column, drop=False)
            else:
                self.logger.info("Datetime column not found. Time-based scanning will be skipped.")

    def _get_datetime_column(self) -> Optional[str]:
        for column in self.df.columns:
            if pd.api.types.is_datetime64_any_dtype(self.df[column]):
                return column
        return None

    def _has_datetime_axis(self) -> bool:
        return isinstance(self.df.index, pd.DatetimeIndex) or self._get_datetime_column() is not None

    def _detect_frequency_and_gaps(self) -> Dict[str, Any]:
        result = {
            "frequency": "Unknown",
            "display_frequency": "Unknown (Irregular)",
            "missing_dates_count": 0,
            "missing_dates": []
        }

        if len(self.df) <= 1 or not isinstance(self.df.index, pd.DatetimeIndex):
            return result

        sorted_index = self.df.index.sort_values().drop_duplicates()
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
        
        missing_dates = ideal_range.difference(self.df.index)
        
        result["missing_dates_count"] = len(missing_dates)
        if len(missing_dates) > 0:
            result["missing_dates"] = [d.strftime('%Y-%m-%d') for d in missing_dates[:5]]

        return result

    def run_health_check(self) -> Dict[str, Any]:
        report = {
            "rows": len(self.df),
            "columns": list(self.df.columns),
            "outliers": {},
            "missing_values": self.df.isna().sum().to_dict()
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
                "time_series_message": "Часова колонка не знайдена. Аналіз часових рядів пропущено",
            })

        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            z_scores = np.abs(stats.zscore(self.df[col], nan_policy='omit'))
            outliers_count = np.count_nonzero(z_scores > 3)
            
            if outliers_count > 0:
                report["outliers"][col] = outliers_count

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