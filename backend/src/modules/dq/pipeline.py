import os
import sys
from pathlib import Path

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.src.core.loader import DataLoader
from backend.src.modules.dq.scanner import DataScanner
from backend.src.modules.dq.cleaner import DataCleaner

def run_dq_pipeline():
    print("\n" + "="*40)
    print(" MODULE 1: DATA QUALITY (DQ)")
    print(" Diagnostics & Imputation")
    print("="*40)

    filename = input("Enter dataset filename (e.g., test.csv): ").strip()
    loader = DataLoader()
    df = loader.load_csv(filename)

    if df is None:
        return

    scanner = DataScanner(df)
    report = scanner.run_health_check()
    scanner.print_report(report)

    if report['missing_dates_count'] == 0 and sum(report['missing_values'].values()) == 0:
        print("\nDataset is clean. No imputation needed.")
        return

    cleaner = DataCleaner(df)
    
    if report['missing_dates_count'] > 0:
        align = input("\nDo you want to align the index and insert missing dates? (y/n): ").strip().lower()
        if align == 'y':
            cleaner.align_datetime_index(report['frequency'])

    print("\nSelect Imputation Method for columns with NaNs:")
    print("1. Linear Interpolation (Best for stable trends)")
    print("2. Spline Interpolation (Best for curved trends)")
    print("3. Forward Fill (Carry last observation forward)")
    print("4. Backward Fill (Carry next observation backward)")
    print("5. Seasonal Imputation (Fill with monthly average)")
    print("6. K-Nearest Neighbors (Find similar rows)")
    print("7. Leave as it is")

    cols_with_nans = cleaner.df.columns[cleaner.df.isna().any()].tolist()
    
    for col in cols_with_nans:
        method = input(f"Method for '{col}' (1-7): ").strip()
        cleaner.impute_column(col, method)

    save_path = loader.data_dir / f"cleaned_{filename}"
    cleaner.df.to_csv(save_path)
    print(f"\n[*] Cleaned dataset saved to '{save_path}'")

if __name__ == "__main__":
    run_dq_pipeline()