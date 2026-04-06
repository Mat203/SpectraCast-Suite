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

    def test_frequency_daily(self):
        dates = pd.date_range("2024-01-01", periods=14, freq="D")
        df = pd.DataFrame({"Price": range(14)}, index=dates)
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "D")
        self.assertEqual(report["display_frequency"], "Daily")

    def test_frequency_business_daily(self):
        dates = pd.date_range("2024-01-01", periods=10, freq="B")
        df = pd.DataFrame({"Price": range(10)}, index=dates)
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "B")
        self.assertEqual(report["display_frequency"], "Business Daily (Mon-Fri)")

    def test_frequency_weekly(self):
        dates = pd.date_range("2024-01-01", periods=5, freq="W")
        df = pd.DataFrame({"Price": range(5)}, index=dates)
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "W")
        self.assertEqual(report["display_frequency"], "Weekly")

    def test_frequency_monthly_start(self):
        dates = pd.date_range("2024-01-01", periods=5, freq="MS")
        df = pd.DataFrame({"Price": range(5)}, index=dates)
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "MS")
        self.assertEqual(report["display_frequency"], "Monthly")

    def test_frequency_monthly_end(self):
        dates = pd.date_range("2024-01-31", periods=5, freq="ME")
        df = pd.DataFrame({"Price": range(5)}, index=dates)
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "ME")
        self.assertEqual(report["display_frequency"], "Monthly")

    def test_frequency_quarterly(self):
        dates = pd.date_range("2024-01-01", periods=5, freq="QS")
        df = pd.DataFrame({"Price": range(5)}, index=dates)
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "QS")
        self.assertEqual(report["display_frequency"], "Quarterly")

    def test_frequency_irregular(self):
        dates = pd.to_datetime(["2024-01-01", "2024-01-03", "2024-01-05", "2024-01-07"])
        df = pd.DataFrame({"Price": range(4)}, index=dates)
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "2D")
        self.assertEqual(report["display_frequency"], "Every 2 days")

    def test_empty_dataframe(self):
        df = pd.DataFrame()
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "Unknown")
        self.assertEqual(report["missing_dates_count"], 0)

    def test_non_datetime_index(self):
        df = pd.DataFrame({"Price": [1, 2, 3]}, index=["a", "b", "c"])
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        self.assertEqual(report["frequency"], "Unknown")
        self.assertEqual(report["display_frequency"], "Unknown (Irregular)")
        self.assertEqual(report["missing_dates_count"], 0)

class TestDataCleaner(unittest.TestCase):

    def setUp(self):
        self.dates = pd.date_range("2024-01-01", periods=5, freq="D")
        self.df_missing = pd.DataFrame({"Price": [100, np.nan, 104, np.nan, 108]}, index=self.dates)
        self.df_outliers = pd.DataFrame({"Price": [100, 101, 5000, 103, 104]}, index=self.dates)

        # For testing alignment
        self.dates_gaps = pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-04", "2024-01-05"])
        self.df_gaps = pd.DataFrame({"Price": [100, 101, 103, 104]}, index=self.dates_gaps)

        # For testing non-datetime index
        self.df_non_dt = pd.DataFrame({"Price": [100, 101]}, index=["A", "B"])

    def test_align_datetime_index_proper_reindexing(self):
        cleaner = DataCleaner(self.df_gaps)
        cleaner.align_datetime_index("D")

        self.assertEqual(len(cleaner.df), 5)
        self.assertTrue(pd.isna(cleaner.df.loc["2024-01-03", "Price"]))
        self.assertEqual(cleaner.df.loc["2024-01-04", "Price"], 103.0)

    def test_align_datetime_index_unknown_freq(self):
        cleaner = DataCleaner(self.df_gaps)
        cleaner.align_datetime_index("Unknown")

        self.assertEqual(len(cleaner.df), 4)
        self.assertNotIn("2024-01-03", cleaner.df.index)

    def test_align_datetime_index_non_datetime(self):
        cleaner = DataCleaner(self.df_non_dt)
        cleaner.align_datetime_index("D")

        self.assertEqual(len(cleaner.df), 2)
        self.assertEqual(list(cleaner.df.index), ["A", "B"])

    def test_impute_linear(self):
        cleaner = DataCleaner(self.df_missing)
        cleaner.impute_column("Price", "1")  # Linear
        
        self.assertEqual(cleaner.df["Price"].iloc[1], 102.0)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_impute_spline(self):

        dates = pd.date_range("2024-01-01", periods=6, freq="D")
        df_spline = pd.DataFrame({"Price": [100, 102, np.nan, 106, 108, 110]}, index=dates)
        cleaner = DataCleaner(df_spline)
        cleaner.impute_column("Price", "2")  # Spline

        self.assertFalse(pd.isna(cleaner.df["Price"].iloc[2]))
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_impute_ffill(self):
        cleaner = DataCleaner(self.df_missing)
        cleaner.impute_column("Price", "3")  # FFill

        self.assertEqual(cleaner.df["Price"].iloc[1], 100.0)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_impute_bfill(self):
        cleaner = DataCleaner(self.df_missing)
        cleaner.impute_column("Price", "4")  # BFill

        self.assertEqual(cleaner.df["Price"].iloc[1], 104.0)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_impute_seasonal(self):
        # Create a dataframe spanning at least a year
        dates_year = pd.date_range("2023-01-01", periods=13, freq="MS")
        values = [100.0] * 12 + [np.nan]
        df_seasonal = pd.DataFrame({"Price": values}, index=dates_year)

        cleaner = DataCleaner(df_seasonal)
        cleaner.impute_column("Price", "5")  # Seasonal

        self.assertEqual(cleaner.df["Price"].iloc[12], 100.0)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_impute_seasonal_short(self):
        cleaner = DataCleaner(self.df_missing)
        cleaner.impute_column("Price", "5") # Seasonal
        self.assertEqual(cleaner.df["Price"].iloc[1], 104.0)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_impute_knn(self):
        df_knn = pd.DataFrame({
            "Price": [100, np.nan, 104, 106, 108],
            "Feature": [10, 12, 14, 16, 18]
        }, index=self.dates)
        cleaner = DataCleaner(df_knn)
        cleaner.impute_column("Price", "6")  # KNN Imputer

        self.assertFalse(pd.isna(cleaner.df["Price"].iloc[1]))
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_impute_pass(self):
        cleaner = DataCleaner(self.df_missing)
        cleaner.impute_column("Price", "7")  # Pass

        self.assertTrue(pd.isna(cleaner.df["Price"].iloc[1]))

    def test_impute_column_all_nans(self):
        df_all_nans = pd.DataFrame({"Price": [np.nan, np.nan, np.nan]}, index=self.dates[:3])
        cleaner = DataCleaner(df_all_nans)
        cleaner.impute_column("Price", "1")
        self.assertEqual(cleaner.df["Price"].isna().sum(), 3)

    def test_impute_column_no_nans(self):
        df_no_nans = pd.DataFrame({"Price": [100, 101, 102]}, index=self.dates[:3])
        cleaner = DataCleaner(df_no_nans)
        cleaner.impute_column("Price", "1")
        self.assertEqual(cleaner.df["Price"].iloc[1], 101)

    def test_impute_column_knn_non_numeric(self):
        df_knn_mixed = pd.DataFrame({
            "Price": [100, np.nan, 104, 106, 108],
            "Category": ["A", "B", "A", "B", "A"]
        }, index=self.dates)
        cleaner = DataCleaner(df_knn_mixed)
        cleaner.impute_column("Price", "6")  # KNN Imputer

        self.assertFalse(pd.isna(cleaner.df["Price"].iloc[1]))
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)
        self.assertEqual(cleaner.df["Category"].iloc[1], "B")

    def test_impute_column_seasonal_non_datetime(self):
        df_non_dt = pd.DataFrame({"Price": [100, np.nan, 104]}, index=["A", "B", "C"])
        cleaner = DataCleaner(df_non_dt)
        cleaner.impute_column("Price", "5")

        self.assertTrue(pd.isna(cleaner.df["Price"].iloc[1]))

    def test_handle_outliers_smoothing(self):
        cleaner = DataCleaner(self.df_outliers)
        outlier_mask = pd.Series([False, False, True, False, False], index=self.dates)

        cleaner.handle_outliers("Price", "1", outlier_mask) # Smoothing

        self.assertTrue(cleaner.df["Price"].iloc[2] < 5000)
        self.assertEqual(cleaner.df["Price"].isna().sum(), 0)

    def test_handle_outliers_delete_and_interpolate(self):
        cleaner = DataCleaner(self.df_outliers)
        
        outlier_mask = pd.Series([False, False, True, False, False], index=self.dates)
        
        cleaner.handle_outliers("Price", "2", outlier_mask) # Delete & Interpolate
        
        self.assertEqual(cleaner.df["Price"].iloc[2], 102.0)

    def test_handle_outliers_ignore(self):
        cleaner = DataCleaner(self.df_outliers)
        outlier_mask = pd.Series([False, False, True, False, False], index=self.dates)
        
        cleaner.handle_outliers("Price", "3", outlier_mask) # Ignore
        
        self.assertEqual(cleaner.df["Price"].iloc[2], 5000)

    def test_handle_outliers_int_cast(self):
        df_int = pd.DataFrame({"Price": [100, 101, 5000, 103, 104]}, index=self.dates)
        df_int["Price"] = df_int["Price"].astype("int64")
        cleaner = DataCleaner(df_int)

        outlier_mask = pd.Series([False, False, True, False, False], index=self.dates)

        cleaner.handle_outliers("Price", "2", outlier_mask)

        self.assertEqual(cleaner.df["Price"].dtype, "float64")
        self.assertEqual(cleaner.df["Price"].iloc[2], 102.0)

    def test_handle_outliers_all_false_mask(self):
        cleaner = DataCleaner(self.df_outliers)
        outlier_mask = pd.Series([False, False, False, False, False], index=self.dates)

        cleaner.handle_outliers("Price", "2", outlier_mask)

        self.assertEqual(cleaner.df["Price"].iloc[2], 5000)

    def test_handle_outliers_all_true_mask(self):
        cleaner = DataCleaner(self.df_outliers)
        outlier_mask = pd.Series([True, True, True, True, True], index=self.dates)

        cleaner.handle_outliers("Price", "2", outlier_mask)

        self.assertEqual(cleaner.df["Price"].isna().sum(), 5)

if __name__ == "__main__":
    unittest.main()