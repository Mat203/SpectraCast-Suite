import pandas as pd
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

            print(f"\n[v] Виявлено колонки у '{filename}':")
            for i, col in enumerate(df.columns, 1):
                print(f"    {i}. {col}")

            print(f"Success: Завантажено '{filename}'. Розмір: {df.shape}")
            return df

        except Exception as e:
            print(f"Critical Error: {e}")
            return None