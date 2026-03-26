import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer

class DataCleaner:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()

    def align_datetime_index(self, frequency: str):
        if not isinstance(self.df.index, pd.DatetimeIndex) or "Unknown" in frequency:
            return
        
        full_range = pd.date_range(start=self.df.index.min(), end=self.df.index.max(), freq=frequency)
        self.df = self.df.reindex(full_range)
        self.df.index.name = "Date"
        print(f"[*] Time series aligned. Reindexed to {len(self.df)} rows.")

    def impute_column(self, column: str, method: str):
        if column not in self.df.columns or self.df[column].isna().sum() == 0:
            return

        print(f"[*] Applying method '{method}' to '{column}'...")

        if method == '1':
            self.df[column] = self.df[column].interpolate(method='linear')
        elif method == '2':
            self.df[column] = self.df[column].interpolate(method='spline', order=3)
        elif method == '3':
            self.df[column] = self.df[column].ffill()
        elif method == '4':
            self.df[column] = self.df[column].bfill()
        elif method == '5':
            if isinstance(self.df.index, pd.DatetimeIndex):
                self.df[column] = self.df.groupby(self.df.index.month)[column].transform(lambda x: x.fillna(x.mean()))
            else:
                print("Error: Seasonal imputation requires DatetimeIndex.")
        elif method == '6':
            numeric_cols = self.df.select_dtypes(include=[np.number]).columns
            imputer = KNNImputer(n_neighbors=5)
            self.df[numeric_cols] = imputer.fit_transform(self.df[numeric_cols])
        elif method == '7':
            pass