import pandas as pd
from pathlib import Path
from typing import Optional


class DataLoader:
    def __init__(self, data_folder_name: str = "data"):
        current_file = Path(__file__).resolve()
        
        project_root = current_file.parents[2]
        
        self.data_dir = project_root / data_folder_name
        
        
    def load_csv(self, filename: str) -> Optional[pd.DataFrame]:
        file_path = self.data_dir / filename
        
        if not file_path.exists():
            print(f"Файл '{filename}' не знайдено у '{self.data_dir.absolute()}'.")
            return None
            
        try:
            df = pd.read_csv(file_path)
            
            if df.empty:
                print(f"Файл '{filename}' порожній.")
                return None
                
            print(f"Завантажено '{filename}'. Розмір: {df.shape}")
            return df
            
        except Exception as e:
            print(f"Помилка читання файлу: {e}")
            return None