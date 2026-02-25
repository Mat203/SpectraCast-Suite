import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.core.loader import DataLoader
from src.modules.dq.dq import DataScanner  

def main():
    print("--- SpectraCast Suite ---")
    print("Data Quality Prototype\n")
    
    loader = DataLoader(data_folder_name="data")
    filename = "dirty_data.csv"
    
    print(f"Спроба читання: {filename}...")
    df = loader.load_csv(filename)
    
    if df is not None:
        print("\nRunning Data Health Check...")
        
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        
        scanner.print_report(report)

if __name__ == "__main__":
    main()