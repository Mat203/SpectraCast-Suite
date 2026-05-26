import logging
import pandas as pd
import numpy as np
from sklearn.impute import KNNImputer
from backend.src.modules.dq.outliers import apply_outlier_strategy

class DataCleaner:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.logger = logging.getLogger(__name__)
        self._column_precisions = {}

    def _get_target_precision(self, column: str) -> int:
        if column in self._column_precisions:
            return self._column_precisions[column]

        series = self.df[column].dropna()
        if not pd.api.types.is_numeric_dtype(series) or series.empty:
            self._column_precisions[column] = 3
            return 3

        diff = (series - series.round(5)).abs()
        
        if (diff > 1e-6).mean() > 0.05:
            precision = 7
        else:
            precision = 3

        self._column_precisions[column] = precision
        return precision

    def _apply_precision(self, column: str):
        precision = self._get_target_precision(column)
        self.df[column] = self.df[column].round(precision)
        self.logger.debug("Column '%s' rounded to %s decimal places.", column, precision)

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

        self._get_target_precision(column)

        print(f"[*] Applying method '{method}' to '{column}'...")

        if method == '1':
            self.df[column] = self.df[column].interpolate(method='linear')
        elif method == '2':
            self.df[column] = self.df[column].interpolate(method='spline', order=3)
        elif method == '3':
            self.df[column] = self.df[column].ffill()
        elif method == '4':
            self.logger.warning("Backward fill is disabled to avoid look-ahead bias.")
            return
        elif method == '5':
            if isinstance(self.df.index, pd.DatetimeIndex):
                self.df[column] = self.df.groupby(self.df.index.month)[column].transform(lambda x: x.fillna(x.mean()))
            else:
                print("Error: Seasonal imputation requires DatetimeIndex.")
        elif method == '6':
            numeric_cols = self.df.select_dtypes(include=[np.number]).columns
            imputer = KNNImputer(n_neighbors=5)
            imputed_matrix = imputer.fit_transform(self.df[numeric_cols])
            
            col_idx = numeric_cols.get_loc(column)
            self.df[column] = imputed_matrix[:, col_idx]
        elif method == '7':
            pass

        self._apply_precision(column)

    def handle_outliers(self, column: str, method: str, outlier_mask: pd.Series):
        if not outlier_mask.any():
            return

        self._get_target_precision(column)
        updated = int(outlier_mask.sum())
        self.logger.info("Outliers detected in '%s': %s values.", column, updated)

        try:
            self.df = apply_outlier_strategy(
                self.df,
                column,
                method,
                outlier_mask=outlier_mask,
            )
        except ValueError:
            return

        self.logger.info("Outlier handling updated %s values in '%s'.", updated, column)
        self._apply_precision(column)

    def detect_and_handle_outliers(self, column: str, method: str):
        series = self.df[column]
        if not pd.api.types.is_numeric_dtype(series):
            return

        if pd.api.types.is_datetime64_any_dtype(series) or pd.api.types.is_timedelta64_dtype(series):
            return

        try:
            self.df = apply_outlier_strategy(self.df, column, method)
        except ValueError:
            return

        self._apply_precision(column)