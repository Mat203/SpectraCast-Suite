import pandas as pd
import numpy as np
from typing import Optional

from backend.src.api.services.storage import StorageService


class DataLoader:
    def __init__(self, data_folder_name: str = "data", storage: StorageService | None = None):
        self.prefix = data_folder_name.strip("/")
        self.storage = storage or StorageService()

    def _build_key(self, filename: str) -> str:
        if self.prefix and not filename.startswith(f"{self.prefix}/"):
            return f"{self.prefix}/{filename.lstrip('/')}"
        return filename.lstrip("/")

    def load_csv(self, filename: str) -> Optional[pd.DataFrame]:
        key = self._build_key(filename)

        if not self.storage.exists(key):
            print(f"Error: Файл не знайдено: s3://{self.storage.bucket}/{key}")
            return None

        try:
            df = self.storage.read_csv(key)

            if df.empty:
                print(f"Warning: Файл '{filename}' порожній.")
                return None

            df = df.replace(r'(?i)^\s*(nan|none|null|na)?\s*$', np.nan, regex=True)
            for col in df.columns:
                if df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
                    try:
                        cleaned_series = df[col].replace(r'[%]', '', regex=True)
                        df[col] = pd.to_numeric(cleaned_series)
                    except (ValueError, TypeError):
                        pass

            print(f"\n[v] Виявлено колонки у '{filename}':")
            for i, col in enumerate(df.columns, 1):
                print(f"    {i}. {col}")

            print(f"Success: Завантажено '{filename}'. Розмір: {df.shape}")
            return df

        except Exception as e:
            print(f"Critical Error: {e}")
            return None