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
                print("Index is not a date")

    def _detect_frequency_and_gaps(self) -> Dict[str, Any]:
        result = {
            "frequency": "Unknown (Irregular)",
            "missing_dates_count": 0,
            "missing_dates": []
        }

        if len(self.df) <= 1:
            return result

        sorted_index = self.df.index.sort_values().drop_duplicates()
        
        deltas = sorted_index.to_series().diff().dropna()
        
        if deltas.empty:
            return result

        dominant_delta = deltas.mode()[0]
        result["frequency"] = str(dominant_delta)
        
        ideal_range = pd.date_range(
            start=sorted_index.min(), 
            end=sorted_index.max(), 
            freq=dominant_delta
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
            "outliers": {}
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
        print("\n--- DATA HEALTH CARD ---")
        
        print(f"Rows:      {report['rows']}")
        print(f"Frequency: {report['frequency']}")
        
        if report["missing_dates_count"] > 0:
            print(f"Missing Dates (Gaps): {report['missing_dates_count']}")
            print(f"  Example gaps:       {', '.join(report['missing_dates'])}...")
        else:
            print("Missing Dates:        0")

        if report["outliers"]:
            print("\nExtreme Outliers (Z-score > 3):")
            print(f"{'Column':<20} | {'Count'}")
            print("-" * 30)
            for col, count in report["outliers"].items():
                print(f"{col:<20} | {count}")
        else:
            print("\nNo extreme outliers detected.")