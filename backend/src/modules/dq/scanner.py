import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any

class DataScanner:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        if not isinstance(self.df.index, pd.DatetimeIndex):
            try:
                self.df.index = pd.to_datetime(self.df.index)
            except Exception:
                print("Warning: Index is not a date. Time-based scanning may be limited.")

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
        deltas = sorted_index.to_series().diff().dropna()
        
        if deltas.empty:
            return result

        dominant_delta_days = deltas.mode()[0].days
        
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
        
        ideal_range = pd.date_range(
            start=sorted_index.min(), 
            end=sorted_index.max(), 
            freq=freq_str
        )
        
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

        time_check_results = self._detect_frequency_and_gaps()
        report.update(time_check_results)

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