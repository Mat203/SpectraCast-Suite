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

    def _resolve_datetime_column(self) -> str | None:
        for column in self.df.columns:
            series = self.df[column]
            if pd.api.types.is_datetime64_any_dtype(series):
                return column
            if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
                continue
            sample = series.dropna().astype(str)
            if sample.empty:
                continue
            if sample.str.fullmatch(r"\d+").all():
                continue
            name_hint = str(column).lower()
            has_name_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
            has_separator = sample.str.contains(r"[-/:T ]").any()
            parsed = pd.to_datetime(sample, errors="coerce")
            if parsed.notna().mean() >= 0.8 and (has_name_hint or has_separator):
                return column
        return None

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
            return
        elif method == '5':
            original_index = self.df.index
            temp_index_set = False

            if not isinstance(self.df.index, pd.DatetimeIndex):
                date_col = self._resolve_datetime_column()
                if date_col:
                    try:
                        self.df.index = pd.DatetimeIndex(pd.to_datetime(self.df[date_col], errors="coerce"))
                        temp_index_set = True
                    except Exception:
                        pass

            if not isinstance(self.df.index, pd.DatetimeIndex):
                print("Error: Seasonal imputation requires DatetimeIndex.")
                return

            freq = self.df.index.inferred_freq or pd.infer_freq(self.df.index)
            if not freq:
                sorted_idx = self.df.index.sort_values().drop_duplicates()
                if len(sorted_idx) >= 2:
                    deltas = sorted_idx.to_series().diff().dropna()
                    if not deltas.empty:
                        dominant_delta_days = deltas.mode().iloc[0].days
                        if 28 <= dominant_delta_days <= 31:
                            freq = "MS"
                        elif 89 <= dominant_delta_days <= 93:
                            freq = "QS"
                        elif dominant_delta_days == 7:
                            freq = "W"
                        elif dominant_delta_days == 1:
                            freq = "D"
                        else:
                            freq = f"{dominant_delta_days}D"

            if not freq:
                if temp_index_set:
                    self.df.index = original_index
                print("Error: Seasonal imputation requires a regular DatetimeIndex.")
                return

            if freq.startswith("W"):
                season_key = self.df.index.isocalendar().week
            elif freq.startswith("Q"):
                season_key = self.df.index.quarter
            elif freq.startswith("M"):
                season_key = self.df.index.month
            elif freq in {"D", "B"} or (freq.endswith("D") and freq[:-1].isdigit()):
                season_key = self.df.index.dayofweek
            else:
                if temp_index_set:
                    self.df.index = original_index
                print("Error: Seasonal imputation requires daily, weekly, monthly, or quarterly data.")
                return

            self.df[column] = self.df.groupby(season_key)[column].transform(lambda x: x.fillna(x.mean()))

            if temp_index_set:
                self.df.index = original_index
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