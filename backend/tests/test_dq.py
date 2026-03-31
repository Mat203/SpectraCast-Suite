import unittest
import pandas as pd
import numpy as np

from backend.src.modules.dq.scanner import DataScanner
from backend.src.modules.dq.cleaner import DataCleaner

class TestDataScanner(unittest.TestCase):
    
    def test_init_index_conversion(self):
        df = pd.DataFrame(
            {"Price": [100, 105]}, 
            index=["2024-01-01", "2024-01-02"]
        )
        scanner = DataScanner(df)
        self.assertIsInstance(scanner.df.index, pd.DatetimeIndex)

    def test_clean_data_no_gaps(self):
        dates = pd.date_range("2024-01-01", periods=7, freq="D")
        df = pd.DataFrame({"Price": [100, 101, 102, 103, 104, 105, 106]}, index=dates)
        
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        
        self.assertEqual(report["missing_dates_count"], 0)
        self.assertEqual(report["frequency"], "D") 

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
        
        self.assertEqual(report["display_frequency"], "Unknown (Irregular)")
        self.assertEqual(report["missing_dates_count"], 0)


class TestDataCleaner(unittest.TestCase):

    def setUp(self):
        self.dates = pd.date_range("2024-01-01", periods=5, freq="D")
        self.df_missing = pd.DataFrame({"Price": [100, np.nan, 104, np.nan, 108]}, index=self.dates)
        self.df_outliers = pd.DataFrame({"Price": [100, 101, 5000, 103, 104]}, index=self.dates)

    def test_impute_linear(self):
        cleaner = DataCleaner(self.df_missing)
        cleaner.impute_column("Price", "1")  # Linear
        
        self.assertEqual(cleaner.df["Price"].iloc[1], 102.0)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_handle_outliers_delete_and_interpolate(self):
        cleaner = DataCleaner(self.df_outliers)
        
        outlier_mask = pd.Series([False, False, True, False, False], index=self.dates)
        
        cleaner.handle_outliers("Price", "2", outlier_mask) # Delete & Interpolate
        
        self.assertEqual(cleaner.df["Price"].iloc[2], 102.0)

    def test_handle_outliers_smoothing(self):
        cleaner = DataCleaner(self.df_outliers)
        outlier_mask = pd.Series([False, False, True, False, False], index=self.dates)
        
        cleaner.handle_outliers("Price", "1", outlier_mask) # Smoothing
        
        self.assertTrue(cleaner.df["Price"].iloc[2] < 5000)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

if __name__ == "__main__":
    unittest.main()