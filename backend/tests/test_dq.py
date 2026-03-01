import unittest
import pandas as pd
import numpy as np

from ..src.modules.dq.dq import DataScanner

class TestDataScanner(unittest.TestCase):
    
    def test_init_index_conversion(self):
        df = pd.DataFrame(
            {"Price": [100, 105]}, 
            index=["2024-01-01", "2024-01-02"]
        )
        scanner = DataScanner(df)
        self.assertIsInstance(scanner.df.index, pd.DatetimeIndex)

    def test_clean_data_no_gaps(self):
        dates = pd.date_range("2024-01-01", periods=5, freq="D")
        df = pd.DataFrame({"Price": [100, 101, 102, 103, 104]}, index=dates)
        
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        
        self.assertEqual(report["missing_dates_count"], 0)
        self.assertEqual(report["frequency"], "1 days 00:00:00")

    def test_missing_dates_detection(self):
        dates = pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-04", "2024-01-05"])
        df = pd.DataFrame({"Price": [100, 101, 103, 104]}, index=dates)
        
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        
        self.assertEqual(report["missing_dates_count"], 1)
        self.assertIn("2024-01-03", report["missing_dates"])

    def test_outlier_detection(self):
        dates = pd.date_range("2024-01-01", periods=15, freq="D")
        
        values = [100] * 14 + [5000] 
        df = pd.DataFrame({"Price": values}, index=dates)
        
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        
        self.assertIn("Price", report["outliers"])
        self.assertEqual(report["outliers"]["Price"], 1)

    def test_single_row_handling(self):
        df = pd.DataFrame({"Price": [100]}, index=["2024-01-01"])
        
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        
        self.assertEqual(report["frequency"], "Unknown (Irregular)")
        self.assertEqual(report["missing_dates_count"], 0)

if __name__ == "__main__":
    unittest.main()