import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.core.loader import DataLoader
from src.modules.dq.dq import DataScanner
from src.modules.vs.vs import VisualStandardizer

def main():
    print("--- SpectraCast Suite ---")
    
    loader = DataLoader(data_folder_name="data")
    filename = "dirty_data.csv"
    
    print(f"Спроба читання: {filename}...")
    df = loader.load_csv(filename)
    
    if df is not None:
        print("\nRunning Data Health Check...")
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        scanner.print_report(report)
        
        print("\nRunning Visual Standardizer...")
        visualizer = VisualStandardizer()
        
        visualizer.plot_time_series(
            df=df, 
            column="Price", 
            title="Price Dynamics (Standardized)", 
            filename="price_trend.png"
        )

    print("\n--- Testing Code Standardizer ---")
    visualizer = VisualStandardizer()
    
    user_code = """
plt.plot(df['Date'], df['Price'], color='red', linewidth=5, linestyle=':')
plt.title('My Title', fontsize=25, fontweight='bold', color='purple')
    """
    
    clean_code = visualizer.standardize_user_code(user_code)
    print(clean_code)

if __name__ == "__main__":
    main()