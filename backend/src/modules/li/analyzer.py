import pandas as pd
from backend.src.core.date_utils import (
    detect_datetime_column,
    get_fallback_datetime_column,
    infer_numeric_date_format,
    parse_datetime_series,
)

class CorrelationAnalyzer:
    def _coerce_numeric_series(self, series: pd.Series, label: str) -> pd.Series:
        coerced = pd.to_numeric(series, errors="coerce")
        if coerced.dropna().empty:
            raise ValueError(f"No numeric values found in {label} series.")
        return coerced

    def _coerce_numeric_frame(self, frame: pd.DataFrame, label: str) -> pd.DataFrame:
        if frame.empty:
            raise ValueError(f"{label} dataset is empty.")

        numeric_frame = frame.apply(pd.to_numeric, errors="coerce")
        numeric_frame = numeric_frame.dropna(axis=1, how="all")
        if numeric_frame.empty:
            raise ValueError(f"No numeric columns found in {label} dataset.")
        return numeric_frame

    def _infer_numeric_date_format(self, sample: pd.Series) -> str | None:
        return infer_numeric_date_format(sample)

    def _parse_datetime_series(self, series: pd.Series, numeric_format: str | None) -> pd.Series:
        return parse_datetime_series(series, numeric_format)

    def _is_valid_datetime_series(self, parsed: pd.Series) -> bool:
        from backend.src.core.date_utils import is_valid_datetime_series
        return is_valid_datetime_series(parsed)

    def _get_datetime_column(self, df: pd.DataFrame) -> str | None:
        return detect_datetime_column(df)

    def _get_fallback_datetime_column(self, df: pd.DataFrame) -> str | None:
        return get_fallback_datetime_column(df)

    def _ensure_datetime_index(self, df: pd.DataFrame, label: str) -> pd.DataFrame:
        if isinstance(df.index, pd.DatetimeIndex):
            return df

        datetime_column = self._get_datetime_column(df)
        if not datetime_column:
            datetime_column = self._get_fallback_datetime_column(df)
        if not datetime_column:
            raise ValueError(f"Datetime column not found in {label} dataset.")

        sample = df[datetime_column].dropna().astype(str)
        numeric_format = infer_numeric_date_format(sample)
        series = parse_datetime_series(df[datetime_column], numeric_format)
        valid_mask = series.notna()
        if valid_mask.sum() < 2:
            raise ValueError(f"Not enough datetime values in {label} dataset.")

        df = df.loc[valid_mask].copy()
        df.index = pd.DatetimeIndex(series[valid_mask])
        return df

    def calculate_lags(self, primary_df: pd.DataFrame, target_col: str, trends_df: pd.DataFrame, max_lag: int = 3) -> pd.DataFrame:
        primary_df = self._ensure_datetime_index(primary_df, "primary")
        trends_df = self._ensure_datetime_index(trends_df, "trends")

        if target_col not in primary_df.columns:
            raise ValueError(f"Target column '{target_col}' not found in primary dataset.")

        primary_numeric = primary_df[[target_col]].copy()
        primary_numeric[target_col] = self._coerce_numeric_series(primary_numeric[target_col], "primary")

        trends_numeric = self._coerce_numeric_frame(trends_df, "trends")

        p_monthly = primary_numeric.resample('MS').mean()
        t_monthly = trends_numeric.resample('MS').mean()
        
        merged = p_monthly.join(t_monthly, how='inner').dropna(subset=[target_col])
        results = []

        for query in t_monthly.columns:
            valid_pair = merged[[target_col, query]].dropna()
            if len(valid_pair) < 5: continue

            row = {'Search Query': query}
            corr_0 = valid_pair[target_col].corr(valid_pair[query])
            row['Correlation (Lag 0)'] = round(corr_0, 3) if not pd.isna(corr_0) else 0.0

            best_lag, best_val = 0, abs(row['Correlation (Lag 0)'])
            correlation_values = [row['Correlation (Lag 0)']]

            for lag in range(1, max_lag + 1):
                l_corr = valid_pair[target_col].shift(-lag).corr(valid_pair[query])
                l_corr = round(l_corr, 3) if not pd.isna(l_corr) else 0.0
                row[f'Correlation (Lag -{lag})'] = l_corr
                correlation_values.append(l_corr)
                
                if abs(l_corr) > best_val:
                    best_val, best_lag = abs(l_corr), lag

            if all(value == 0.0 for value in correlation_values):
                continue

            if best_val < 0.4: row['Result'] = "Noise"
            elif best_lag > 0: row['Result'] = f"Lead (Lag -{best_lag})"
            else: row['Result'] = "Synchronous"
            
            results.append(row)

        if not results:
            columns = ["Search Query", "Correlation (Lag 0)"]
            columns.extend([f"Correlation (Lag -{lag})" for lag in range(1, max_lag + 1)])
            columns.append("Result")
            return pd.DataFrame(columns=columns)

        return pd.DataFrame(results).sort_values(by='Correlation (Lag 0)', ascending=False)