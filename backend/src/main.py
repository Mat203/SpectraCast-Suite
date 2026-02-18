import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.core.loader import DataLoader

def main():
    loader = DataLoader()
    
    filename = "test_data.csv"
    print(f"Спроба читання: {filename}...")
    
    df = loader.load_csv(filename)
    
    if df is not None:
        print("Перші 5 рядків:")
        print(df.head())

if __name__ == "__main__":
    main()