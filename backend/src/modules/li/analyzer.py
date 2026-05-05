import pandas as pd

class CorrelationAnalyzer:
    def _infer_numeric_date_format(self, sample: pd.Series) -> str | None:
        if sample.empty or not sample.str.fullmatch(r"\d+").all():
            return None

        length_counts = sample.str.len().value_counts()
        length = int(length_counts.idxmax())
        length_ratio = length_counts.max() / len(sample)
        if length_ratio < 0.8:
            return None

        if length == 6:
            return "%Y%m"
        if length == 8:
            return "%Y%m%d"
        if length == 14:
            return "%Y%m%d%H%M%S"
        return None

    def _parse_datetime_series(self, series: pd.Series, numeric_format: str | None) -> pd.Series:
        if numeric_format:
            return pd.to_datetime(series.astype("string"), format=numeric_format, errors="coerce")
        return pd.to_datetime(series, errors="coerce")

    def _is_valid_datetime_series(self, parsed: pd.Series) -> bool:
        valid_ratio = parsed.notna().mean()
        if valid_ratio < 0.8:
            return False

        non_null = parsed.dropna()
        if non_null.empty:
            return False

        year_ratio = non_null.dt.year.between(1900, 2100).mean()
        return year_ratio >= 0.8

    def _get_datetime_column(self, df: pd.DataFrame) -> str | None:
        for column in df.columns:
            series = df[column]
            if pd.api.types.is_datetime64_any_dtype(series):
                return column

            sample = series.dropna().astype(str)
            if sample.empty:
                continue

            numeric_format = self._infer_numeric_date_format(sample)
            is_candidate = numeric_format is not None or pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)
            if not is_candidate:
                continue

            name_hint = str(column).lower()
            has_name_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
            has_separator = sample.str.contains(r"[-/:T ]").any()
            parsed = self._parse_datetime_series(series, numeric_format)
            if self._is_valid_datetime_series(parsed) and (has_name_hint or has_separator or numeric_format):
                return column

        return None

    def _get_fallback_datetime_column(self, df: pd.DataFrame) -> str | None:
        if df.empty:
            return None

        first_col = df.columns[0]
        series = df[first_col]
        sample = series.dropna().astype(str)
        if sample.empty:
            return None

        numeric_format = self._infer_numeric_date_format(sample)
        is_candidate = numeric_format is not None or pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)
        if not is_candidate:
            return None

        parsed = self._parse_datetime_series(series, numeric_format)
        return first_col if self._is_valid_datetime_series(parsed) else None

    def _ensure_datetime_index(self, df: pd.DataFrame, label: str) -> pd.DataFrame:
        if isinstance(df.index, pd.DatetimeIndex):
            return df

        datetime_column = self._get_datetime_column(df)
        if not datetime_column:
            datetime_column = self._get_fallback_datetime_column(df)
        if not datetime_column:
            raise ValueError(f"Datetime column not found in {label} dataset.")

        sample = df[datetime_column].dropna().astype(str)
        numeric_format = self._infer_numeric_date_format(sample)
        series = self._parse_datetime_series(df[datetime_column], numeric_format)
        valid_mask = series.notna()
        if valid_mask.sum() < 2:
            raise ValueError(f"Not enough datetime values in {label} dataset.")

        df = df.loc[valid_mask].copy()
        df.index = pd.DatetimeIndex(series[valid_mask])
        return df

    def calculate_lags(self, primary_df: pd.DataFrame, target_col: str, trends_df: pd.DataFrame, max_lag: int = 3) -> pd.DataFrame:
        primary_df = self._ensure_datetime_index(primary_df, "primary")
        trends_df = self._ensure_datetime_index(trends_df, "trends")
        p_monthly = primary_df[[target_col]].resample('MS').mean()
        t_monthly = trends_df.resample('MS').mean()
        
        merged = p_monthly.join(t_monthly, how='inner').dropna(subset=[target_col])
        results = []

        for query in t_monthly.columns:
            valid_pair = merged[[target_col, query]].dropna()
            if len(valid_pair) < 5: continue

            row = {'Search Query': query}
            corr_0 = valid_pair[target_col].corr(valid_pair[query])
            row['Correlation (Lag 0)'] = round(corr_0, 3) if not pd.isna(corr_0) else 0.0

            best_lag, best_val = 0, abs(row['Correlation (Lag 0)'])

            for lag in range(1, max_lag + 1):
                l_corr = valid_pair[target_col].shift(-lag).corr(valid_pair[query])
                l_corr = round(l_corr, 3) if not pd.isna(l_corr) else 0.0
                row[f'Correlation (Lag -{lag})'] = l_corr
                
                if abs(l_corr) > best_val:
                    best_val, best_lag = abs(l_corr), lag

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