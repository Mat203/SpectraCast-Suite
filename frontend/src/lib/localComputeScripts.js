export const LOCAL_DQ_SCAN_CODE = `
import pandas as pd
import numpy as np

if df is None:
    raise ValueError("No dataset provided")

def _clean_hidden_missing_values(frame):
    frame = frame.replace(r'(?i)^\\s*(nan|none|null|na)?\\s*$', np.nan, regex=True)
    for col in frame.columns:
        if frame[col].dtype == 'object' or pd.api.types.is_string_dtype(frame[col]):
            try:
                frame[col] = pd.to_numeric(frame[col])
            except (ValueError, TypeError):
                pass
    return frame

def _get_datetime_column(frame):
    for column in frame.columns:
        series = frame[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            return column
        if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
            continue

        sample = series.dropna().astype(str)
        if sample.empty:
            continue

        if sample.str.fullmatch(r"\\d+").all():
            continue

        name_hint = str(column).lower()
        has_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
        has_separator = sample.str.contains(r"[-/:T ]").any()
        parsed = pd.to_datetime(sample, errors="coerce")
        if parsed.notna().mean() >= 0.8 and (has_hint or has_separator):
            return column
    return None

def _resolve_datetime_index(frame):
    if isinstance(frame.index, pd.DatetimeIndex):
        return frame.index

    datetime_column = _get_datetime_column(frame)
    if not datetime_column:
        return None

    series = pd.to_datetime(frame[datetime_column], errors="coerce")
    series = series.dropna()
    if len(series) < 2:
        return None

    return pd.DatetimeIndex(series)

def _detect_frequency_and_gaps(datetime_index):
    result = {
        "frequency": "Unknown",
        "display_frequency": "Unknown (Irregular)",
        "missing_dates_count": 0,
        "missing_dates": [],
    }

    if datetime_index is None or len(datetime_index) < 2:
        return result

    sorted_index = datetime_index.sort_values().drop_duplicates()
    if len(sorted_index) < 2:
        return result

    deltas = sorted_index.to_series().diff().dropna()
    if deltas.empty:
        return result

    dominant_delta = deltas.mode().iloc[0]
    dominant_delta_days = dominant_delta.days
    if dominant_delta_days <= 0:
        return result

    if 28 <= dominant_delta_days <= 31:
        most_frequent_day = pd.Series(sorted_index.day).mode()[0]
        freq_str = "MS" if most_frequent_day == 1 else "ME"
        display_freq = "Monthly"
    elif 89 <= dominant_delta_days <= 93:
        freq_str = "QS"
        display_freq = "Quarterly"
    elif dominant_delta_days == 7:
        freq_str = "W"
        display_freq = "Weekly"
    elif dominant_delta_days == 1:
        has_weekends = (sorted_index.dayofweek >= 5).any()
        if not has_weekends:
            freq_str = "B"
            display_freq = "Business Daily (Mon-Fri)"
        else:
            freq_str = "D"
            display_freq = "Daily"
    else:
        freq_str = f"{dominant_delta_days}D"
        display_freq = f"Every {dominant_delta_days} days"

    result["frequency"] = freq_str
    result["display_frequency"] = display_freq

    try:
        ideal_range = pd.date_range(start=sorted_index.min(), end=sorted_index.max(), freq=freq_str)
    except Exception:
        return result

    missing_dates = ideal_range.difference(sorted_index)
    result["missing_dates_count"] = len(missing_dates)
    if len(missing_dates) > 0:
        result["missing_dates"] = [d.strftime("%Y-%m-%d") for d in missing_dates[:5]]

    return result

def _seasonal_lag_from_frequency(frequency):
    if frequency in {"MS", "ME"}:
        return 12
    if frequency == "QS":
        return 4
    if frequency == "W":
        return 52
    if frequency in {"D", "B"}:
        return 7
    if frequency.endswith("D"):
        try:
            day_stride = int(frequency[:-1])
        except ValueError:
            return None
        if day_stride > 0:
            return max(1, int(round(365 / day_stride)))
    return None

def _is_financial_asset(column_name):
    name = column_name.lower()
    tokens = (
        "price",
        "close",
        "open",
        "high",
        "low",
        "volume",
        "fx",
        "rate",
        "yield",
        "usd",
        "eur",
        "gbp",
        "jpy",
        "btc",
        "eth",
        "stock",
        "equity",
        "index",
    )
    return any(token in name for token in tokens)

def _recommend_missing_value_strategy(frame, column_name, frequency):
    if column_name not in frame.columns:
        return None

    series = frame[column_name]
    if not pd.api.types.is_numeric_dtype(series):
        return None

    total_count = len(series)
    missing_count = int(series.isna().sum())
    if missing_count == 0 or total_count == 0:
        return None

    available = series.dropna()
    if available.empty:
        return None

    mean_val = float(available.mean())
    std_val = float(available.std(ddof=0))
    cv = std_val / abs(mean_val) if mean_val != 0 else float("inf")

    autocorr_lag1 = available.autocorr(lag=1)
    autocorr_lag1 = float(autocorr_lag1) if not np.isnan(autocorr_lag1) else 0.0

    seasonal_lag = _seasonal_lag_from_frequency(frequency)
    seasonal_corr = 0.0
    if seasonal_lag and len(available) > seasonal_lag:
        seasonal_value = available.autocorr(lag=seasonal_lag)
        seasonal_corr = float(seasonal_value) if not np.isnan(seasonal_value) else 0.0

    numeric_cols = frame.select_dtypes(include=[np.number]).columns
    max_corr = 0.0
    if len(numeric_cols) > 1 and column_name in numeric_cols:
        corr_matrix = frame[numeric_cols].corr()
        if column_name in corr_matrix:
            other_corrs = corr_matrix[column_name].drop(labels=[column_name]).abs()
            if not other_corrs.empty:
                max_corr = float(other_corrs.max())

    missing_ratio = missing_count / total_count if total_count else 1.0

    if seasonal_corr > 0.6:
        strategy_code = "5"
        strategy_label = "seasonal_mean"
        reasoning = "Detected a strong seasonal pattern, so seasonal means preserve cyclical behavior."
    elif cv < 0.15 and autocorr_lag1 > 0.8:
        strategy_code = "1"
        strategy_label = "linear"
        reasoning = "Low volatility and strong trend continuity make linear interpolation reliable."
    elif cv >= 0.15 or _is_financial_asset(column_name):
        strategy_code = "3"
        strategy_label = "ffill"
        reasoning = "High volatility or financial pricing favors forward fill to avoid creating artificial trends."
    elif missing_ratio < 0.1 and max_corr > 0.6:
        strategy_code = "6"
        strategy_label = "knn"
        reasoning = "Few missing values and strong cross-column correlation support KNN imputation."
    else:
        strategy_code = "1"
        strategy_label = "linear"
        reasoning = "Defaulted to linear interpolation for a smooth, low-bias fill."

    return {
        "strategy_code": strategy_code,
        "strategy": strategy_label,
        "reasoning": reasoning,
        "metrics": {
            "cv": cv,
            "autocorr_lag1": autocorr_lag1,
            "seasonal_corr": seasonal_corr,
            "missing_ratio": missing_ratio,
            "max_corr": max_corr,
        },
    }

df = _clean_hidden_missing_values(df)

has_datetime_axis = isinstance(df.index, pd.DatetimeIndex) or _get_datetime_column(df) is not None

if has_datetime_axis:
    time_check = _detect_frequency_and_gaps(_resolve_datetime_index(df))
else:
    time_check = {
        "frequency": "Unknown",
        "display_frequency": "Unknown (Irregular)",
        "missing_dates_count": 0,
        "missing_dates": [],
        "time_series_message": "Time column not found. Time series analysis skipped.",
    }

missing_values = df.isna().sum().to_dict()

outliers = {}
outlier_strategy_recommendations = {}
missing_value_strategy_recommendations = {}

numeric_cols = df.select_dtypes(include=[np.number]).columns
for col in numeric_cols:
    series = df[col].dropna()
    if series.empty:
        continue
    std = series.std(ddof=0)
    if std != 0:
        z = (series - series.mean()) / std
        count = int((np.abs(z) > 3).sum())
        if count > 0:
            outliers[col] = count

    skew_value = float(series.skew())
    abs_skew = abs(skew_value)

    if abs_skew > 1.0:
        strategy = "iqr_clip"
        reasoning = (
            "High skewness in the time series. The IQR method minimizes the impact of extreme values without losing data points"
        )
    elif abs_skew > 0.5:
        strategy = "median"
        reasoning = (
            "Moderate skewness. Using the median provides robustness against outliers that distort the mean"
        )
    else:
        strategy = "mean"
        reasoning = (
            "Distribution is close to symmetric. Using the mean is statistically optimal for filling anomalies"
        )

    outlier_strategy_recommendations[col] = {
        "skew": skew_value,
        "strategy": strategy,
        "reasoning": reasoning,
    }

    if missing_values.get(col, 0) > 0:
        missing_rec = _recommend_missing_value_strategy(df, col, time_check.get("frequency", "Unknown"))
        if missing_rec:
            missing_value_strategy_recommendations[col] = missing_rec

if isinstance(df.index, pd.DatetimeIndex):
    preview_df = df.reset_index().replace({float("nan"): None})
else:
    preview_df = df.copy().replace({float("nan"): None})

result = {
    "rows": int(len(df)),
    "columns": list(df.columns),
    "outliers": outliers,
    "outlier_strategy_recommendations": outlier_strategy_recommendations,
    "missing_values": missing_values,
    "missing_value_strategy_recommendations": missing_value_strategy_recommendations,
    "dataset_preview": preview_df.to_dict(orient="records"),
    "has_datetime_axis": has_datetime_axis,
    "has_previous_state": False,
    "is_modified": False,
}
result.update(time_check)
`;
export const LOCAL_LI_RUN_CODE = ``;
export const LOCAL_DQ_HANDLE_OUTLIERS_CODE = `
import numpy as np
import pandas as pd

column = payload.get("column")
strategy = payload.get("strategy")

if df is None:
    raise ValueError("No dataset provided")
if column not in df.columns:
    raise ValueError(f"Column '{column}' not found")
if not pd.api.types.is_numeric_dtype(df[column]):
    raise ValueError(f"Column '{column}' is not numeric")

series = df[column].astype(float)
q1 = series.quantile(0.25)
q3 = series.quantile(0.75)
iqr = q3 - q1
lower_bound = q1 - 1.5 * iqr
upper_bound = q3 + 1.5 * iqr
outlier_mask = (series < lower_bound) | (series > upper_bound)

updated = series.copy()
if strategy == "clip_iqr":
    updated = updated.clip(lower=lower_bound, upper=upper_bound)
elif strategy == "mean":
    updated.loc[outlier_mask] = series.mean()
elif strategy == "median":
    updated.loc[outlier_mask] = series.median()
elif strategy == "drop":
    df = df.loc[~outlier_mask]
    updated = df[column].astype(float)
else:
    raise ValueError("Invalid strategy")

if strategy != "drop":
    df[column] = updated

result = {
    "status": "success",
    "message": f"Successfully applied {strategy} to {column}",
    "csv": df.to_csv(index=False),
}
`;

export const LOCAL_DQ_PREVIEW_OUTLIERS_CODE = `
import numpy as np
import pandas as pd

column = payload.get("column")
strategy = payload.get("strategy")

if df is None:
    raise ValueError("No dataset provided")
if column not in df.columns:
    raise ValueError(f"Column '{column}' not found")
if not pd.api.types.is_numeric_dtype(df[column]):
    raise ValueError(f"Column '{column}' is not numeric")

series = df[column].astype(float)
q1 = series.quantile(0.25)
q3 = series.quantile(0.75)
iqr = q3 - q1
lower_bound = q1 - 1.5 * iqr
upper_bound = q3 + 1.5 * iqr
outlier_mask = (series < lower_bound) | (series > upper_bound)

after_series = series.copy()
if strategy == "clip_iqr":
    after_series = after_series.clip(lower=lower_bound, upper=upper_bound)
elif strategy == "mean":
    after_series.loc[outlier_mask] = series.mean()
elif strategy == "median":
    after_series.loc[outlier_mask] = series.median()
elif strategy == "drop":
    after_series.loc[outlier_mask] = np.nan
else:
    raise ValueError("Invalid strategy")

if isinstance(df.index, pd.DatetimeIndex):
    x_values = [ts.isoformat() for ts in df.index]
else:
    x_values = [str(idx) for idx in range(len(df))]

before_values = [None if pd.isna(v) else float(v) for v in series.tolist()]
after_values = [None if pd.isna(v) else float(v) for v in after_series.tolist()]

max_points = 300
if len(x_values) > max_points:
    indices = np.linspace(0, len(x_values) - 1, num=max_points, dtype=int)
    indices = np.unique(indices)
    x_values = [x_values[i] for i in indices]
    before_values = [before_values[i] for i in indices]
    after_values = [after_values[i] for i in indices]

result = {
    "column": column,
    "strategy": strategy,
    "x": x_values,
    "before": before_values,
    "after": after_values,
}
`;

export const LOCAL_DQ_HANDLE_MISSING_CODE = `
import numpy as np
import pandas as pd

column = payload.get("column")
strategy = payload.get("strategy")

if df is None:
    raise ValueError("No dataset provided")
if column not in df.columns:
    raise ValueError(f"Column '{column}' not found")
if not pd.api.types.is_numeric_dtype(df[column]):
    raise ValueError(f"Column '{column}' is not numeric")

series = df[column].astype(float)

def _resolve_datetime_column(frame):
    for col in frame.columns:
        s = frame[col]
        if pd.api.types.is_datetime64_any_dtype(s):
            return col
        if not (pd.api.types.is_object_dtype(s) or pd.api.types.is_string_dtype(s)):
            continue
        sample = s.dropna().astype(str)
        if sample.empty:
            continue
        if sample.str.fullmatch(r"\d+").all():
            continue
        name_hint = str(col).lower()
        has_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
        has_separator = sample.str.contains(r"[-/:T ]").any()
        parsed = pd.to_datetime(sample, errors="coerce")
        if parsed.notna().mean() >= 0.8 and (has_hint or has_separator):
            return col
    return None

if strategy == "1":
    series = series.interpolate(method="linear")
elif strategy == "2":
    series = series.interpolate(method="spline", order=3)
elif strategy == "3":
    series = series.ffill()
elif strategy == "4":
    series = series
elif strategy == "5":
    original_index = df.index
    temp_index_set = False
    if not isinstance(df.index, pd.DatetimeIndex):
        date_col = _resolve_datetime_column(df)
        if date_col:
            try:
                df.index = pd.DatetimeIndex(pd.to_datetime(df[date_col], errors="coerce"))
                temp_index_set = True
            except Exception:
                pass
    if not isinstance(df.index, pd.DatetimeIndex):
        raise ValueError("Seasonal imputation requires DatetimeIndex")
    freq = df.index.inferred_freq or pd.infer_freq(df.index)
    if not freq:
        sorted_idx = df.index.sort_values().drop_duplicates()
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
            df.index = original_index
        raise ValueError("Seasonal imputation requires a regular DatetimeIndex")

    def _season_key_from_frequency_local(idx, f):
        if f.startswith("W"):
            return idx.isocalendar().week
        if f.startswith("Q"):
            return idx.quarter
        if f.startswith("M"):
            return idx.month
        if f in {"D", "B"} or (f.endswith("D") and f[:-1].isdigit()):
            return idx.dayofweek
        return None

    season_key = _season_key_from_frequency_local(df.index, freq)
    if season_key is None:
        if temp_index_set:
            df.index = original_index
        raise ValueError("Seasonal imputation requires daily, weekly, monthly, or quarterly index")
    series = series.groupby(season_key).transform(lambda x: x.fillna(x.mean()))
    if temp_index_set:
        df.index = original_index
elif strategy == "6":
    from sklearn.impute import KNNImputer
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if column not in numeric_cols:
        raise ValueError(f"Column '{column}' is not numeric")
    imputer = KNNImputer(n_neighbors=5)
    imputed_matrix = imputer.fit_transform(df[numeric_cols])
    col_idx = list(numeric_cols).index(column)
    series = pd.Series(imputed_matrix[:, col_idx], index=df.index)
elif strategy == "7":
    series = series
else:
    raise ValueError("Invalid strategy")

df[column] = series
result = {
    "status": "success",
    "message": f"Successfully applied strategy {strategy} for missing values in {column}",
    "csv": df.to_csv(index=False),
}
`;

export const LOCAL_DQ_PREVIEW_MISSING_CODE = `
import numpy as np
import pandas as pd

column = payload.get("column")
strategy = payload.get("strategy")

if df is None:
    raise ValueError("No dataset provided")
if column not in df.columns:
    raise ValueError(f"Column '{column}' not found")
if not pd.api.types.is_numeric_dtype(df[column]):
    raise ValueError(f"Column '{column}' is not numeric")

before_series = df[column].astype(float)

series = before_series.copy()

def _resolve_datetime_column(frame):
    for col in frame.columns:
        s = frame[col]
        if pd.api.types.is_datetime64_any_dtype(s):
            return col
        if not (pd.api.types.is_object_dtype(s) or pd.api.types.is_string_dtype(s)):
            continue
        sample = s.dropna().astype(str)
        if sample.empty:
            continue
        if sample.str.fullmatch(r"\d+").all():
            continue
        name_hint = str(col).lower()
        has_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
        has_separator = sample.str.contains(r"[-/:T ]").any()
        parsed = pd.to_datetime(sample, errors="coerce")
        if parsed.notna().mean() >= 0.8 and (has_hint or has_separator):
            return col
    return None

if strategy == "1":
    series = series.interpolate(method="linear")
elif strategy == "2":
    series = series.interpolate(method="spline", order=3)
elif strategy == "3":
    series = series.ffill()
elif strategy == "4":
    series = series
elif strategy == "5":
    original_index = df.index
    temp_index_set = False
    if not isinstance(df.index, pd.DatetimeIndex):
        date_col = _resolve_datetime_column(df)
        if date_col:
            try:
                df.index = pd.DatetimeIndex(pd.to_datetime(df[date_col], errors="coerce"))
                temp_index_set = True
            except Exception:
                pass
    if not isinstance(df.index, pd.DatetimeIndex):
        raise ValueError("Seasonal imputation requires DatetimeIndex")
    freq = df.index.inferred_freq or pd.infer_freq(df.index)
    if not freq:
        sorted_idx = df.index.sort_values().drop_duplicates()
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
            df.index = original_index
        raise ValueError("Seasonal imputation requires a regular DatetimeIndex")

    def _season_key_from_frequency_local(idx, f):
        if f.startswith("W"):
            return idx.isocalendar().week
        if f.startswith("Q"):
            return idx.quarter
        if f.startswith("M"):
            return idx.month
        if f in {"D", "B"} or (f.endswith("D") and f[:-1].isdigit()):
            return idx.dayofweek
        return None

    season_key = _season_key_from_frequency_local(df.index, freq)
    if season_key is None:
        if temp_index_set:
            df.index = original_index
        raise ValueError("Seasonal imputation requires daily, weekly, monthly, or quarterly index")
    series = series.groupby(season_key).transform(lambda x: x.fillna(x.mean()))
    if temp_index_set:
        df.index = original_index
elif strategy == "6":
    from sklearn.impute import KNNImputer
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if column not in numeric_cols:
        raise ValueError(f"Column '{column}' is not numeric")
    imputer = KNNImputer(n_neighbors=5)
    imputed_matrix = imputer.fit_transform(df[numeric_cols])
    col_idx = list(numeric_cols).index(column)
    series = pd.Series(imputed_matrix[:, col_idx], index=df.index)
elif strategy == "7":
    series = series
else:
    raise ValueError("Invalid strategy")

after_series = series

if isinstance(df.index, pd.DatetimeIndex):
    x_values = [ts.isoformat() for ts in df.index]
else:
    x_values = [str(idx) for idx in range(len(df))]

before_values = [None if pd.isna(v) else float(v) for v in before_series.tolist()]
after_values = [None if pd.isna(v) else float(v) for v in after_series.tolist()]

max_points = 300
if len(x_values) > max_points:
    indices = np.linspace(0, len(x_values) - 1, num=max_points, dtype=int)
    indices = np.unique(indices)
    x_values = [x_values[i] for i in indices]
    before_values = [before_values[i] for i in indices]
    after_values = [after_values[i] for i in indices]

result = {
    "column": column,
    "strategy": strategy,
    "x": x_values,
    "before": before_values,
    "after": after_values,
}
`;

export const LOCAL_DQ_FIX_TIMESTAMPS_CODE = `
import pandas as pd

if df is None:
    raise ValueError("No dataset provided")

def _get_datetime_column(frame):
    for column in frame.columns:
        series = frame[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            return column
        if not (pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)):
            continue
        sample = series.dropna().astype(str)
        if sample.empty:
            continue
        if sample.str.fullmatch(r"\\d+").all():
            continue
        name_hint = str(column).lower()
        has_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
        has_separator = sample.str.contains(r"[-/:T ]").any()
        parsed = pd.to_datetime(sample, errors="coerce")
        if parsed.notna().mean() >= 0.8 and (has_hint or has_separator):
            return column
    return None

def _resolve_datetime_index(frame):
    if isinstance(frame.index, pd.DatetimeIndex):
        return frame.index

    datetime_column = _get_datetime_column(frame)
    if not datetime_column:
        return None

    series = pd.to_datetime(frame[datetime_column], errors="coerce")
    series = series.dropna()
    if len(series) < 2:
        return None

    return pd.DatetimeIndex(series)

def _detect_frequency_and_gaps(datetime_index):
    result = {
        "frequency": "Unknown",
        "display_frequency": "Unknown (Irregular)",
    }

    if datetime_index is None or len(datetime_index) < 2:
        return result

    sorted_index = datetime_index.sort_values().drop_duplicates()
    if len(sorted_index) < 2:
        return result

    deltas = sorted_index.to_series().diff().dropna()
    if deltas.empty:
        return result

    dominant_delta = deltas.mode().iloc[0]
    dominant_delta_days = dominant_delta.days
    if dominant_delta_days <= 0:
        return result

    if 28 <= dominant_delta_days <= 31:
        most_frequent_day = pd.Series(sorted_index.day).mode()[0]
        freq_str = "MS" if most_frequent_day == 1 else "ME"
    elif 89 <= dominant_delta_days <= 93:
        freq_str = "QS"
    elif dominant_delta_days == 7:
        freq_str = "W"
    elif dominant_delta_days == 1:
        has_weekends = (sorted_index.dayofweek >= 5).any()
        freq_str = "B" if not has_weekends else "D"
    else:
        freq_str = f"{dominant_delta_days}D"

    result["frequency"] = freq_str
    return result

datetime_index = _resolve_datetime_index(df)
if datetime_index is None:
    raise ValueError("Datetime column not found")

time_check = _detect_frequency_and_gaps(datetime_index)
frequency = time_check.get("frequency", "Unknown")
if frequency == "Unknown":
    raise ValueError("Frequency could not be inferred")

datetime_column = None
if isinstance(df.index, pd.DatetimeIndex):
    working_df = df.copy()
else:
    datetime_column = _get_datetime_column(df)
    if not datetime_column:
        raise ValueError("Datetime column not found")
    datetime_index = pd.to_datetime(df[datetime_column], errors="coerce")
    working_df = df.copy()
    working_df[datetime_column] = datetime_index
    working_df = working_df.dropna(subset=[datetime_column])
    working_df = working_df.set_index(datetime_column, drop=False)

working_df = working_df.sort_index()
new_index = pd.date_range(start=working_df.index.min(), end=working_df.index.max(), freq=frequency)
updated_df = working_df.reindex(new_index)

inserted_rows = int(len(new_index) - len(working_df.index.unique()))

date_column_name = datetime_column or updated_df.index.name or "Date"
updated_df[date_column_name] = updated_df.index

preview_df = updated_df.reset_index(drop=True).replace({float("nan"): None})

result = {
    "status": "success",
    "inserted_rows": inserted_rows,
    "dataset_preview": preview_df.to_dict(orient="records"),
    "csv": updated_df.to_csv(index=False),
}
`;

export const LOCAL_VS_STANDARDIZE_CODE = `
import ast

raw_code = payload.get("raw_code") or ""

style_args = {
    "color", "c", "linewidth", "lw", "linestyle", "ls",
    "fontsize", "fontweight", "figsize", "marker",
    "markersize", "alpha", "facecolor", "edgecolor",
    "palette", "cmap",
}

class StyleRemover(ast.NodeTransformer):
    def visit_Call(self, node):
        self.generic_visit(node)
        node.keywords = [kw for kw in node.keywords if kw.arg not in style_args]
        return node

try:
    tree = ast.parse(raw_code)
    cleaned = ast.unparse(StyleRemover().visit(tree))
    result = {
        "status": "success",
        "cleaned_code": cleaned,
    }
except Exception as exc:
    result = {
        "status": "error",
        "message": str(exc),
        "cleaned_code": raw_code,
    }
`;

export const LOCAL_VS_PLOT_CODE = `
import base64
import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

if df is None:
    raise ValueError("No dataset provided")

x_col = payload.get("x_col") or payload.get("x")
chart_type = payload.get("chart_type") or payload.get("plot_type")
title = payload.get("title")
x_label = payload.get("x_label")
y_label = payload.get("y_label")
y2_label = payload.get("y2_label")
style_config = payload.get("style_config") or {}

plt.style.use("default")
if style_config:
    matplotlib_params = {k: v for k, v in style_config.items() if not k.startswith("custom.")}
    plt.rcParams.update(matplotlib_params)

primary_colors = style_config.get("custom.primary_colors", ["#1f77b4", "#2ca02c", "#9467bd", "#00bcd4", "#4caf50"])
secondary_colors = style_config.get("custom.secondary_colors", ["#ff7f0e", "#d62728", "#8c564b", "#e377c2", "#ff9800"])

y_axes = payload.get("y_axes") or []
primary_cols = []
secondary_cols = []

if isinstance(y_axes, list):
    for item in y_axes:
        if isinstance(item, dict):
            column = item.get("column")
            axis = item.get("axis", "primary")
        else:
            column = item
            axis = "primary"
        if not column:
            continue
        if axis == "secondary":
            secondary_cols.append(column)
        else:
            primary_cols.append(column)

if not primary_cols and payload.get("y_cols"):
    primary_cols = payload.get("y_cols")
if not primary_cols and payload.get("y"):
    primary_cols = [payload.get("y")]

fig, ax = plt.subplots()
ax2 = ax.twinx() if secondary_cols else None

if x_col and x_col in df.columns:
    x_data = df[x_col].copy()
    if not pd.api.types.is_numeric_dtype(x_data):
        parsed = pd.to_datetime(x_data, errors="coerce")
        if parsed.notna().mean() >= 0.5:
            x_data = parsed
        else:
            x_data = x_data.fillna("")
else:
    x_data = df.index

plot_mask = pd.Series(True, index=df.index)
if hasattr(x_data, "isna"):
    plot_mask = plot_mask & (~x_data.isna())

all_cols = primary_cols + secondary_cols
if not all_cols:
    all_cols = ["y"]

for col in all_cols:
    if col in df.columns:
        plot_mask = plot_mask & (~df[col].isna())

plot_df = df.loc[plot_mask].reset_index(drop=True)
if hasattr(x_data, "loc"):
    x_data = x_data.loc[plot_mask].reset_index(drop=True)


if chart_type == "2":
    indices = range(len(x_data))
    total = max(len(all_cols), 1)
    bar_width = 0.8 / total
    offset = -((total - 1) / 2) * bar_width
    for i, col in enumerate(primary_cols):
        color = primary_colors[i % len(primary_colors)]
        ax.bar([idx + offset for idx in indices], plot_df[col], width=bar_width, label=col, color=color)
        offset += bar_width
    if ax2:
        for i, col in enumerate(secondary_cols):
            color = secondary_colors[i % len(secondary_colors)]
            ax2.bar([idx + offset for idx in indices], plot_df[col], width=bar_width, label=f"{col} (secondary)", alpha=0.8, color=color)
            offset += bar_width
elif chart_type == "3":
    for i, col in enumerate(primary_cols):
        color = primary_colors[i % len(primary_colors)]
        ax.scatter(x_data, plot_df[col], label=col, color=color)
    if ax2:
        for i, col in enumerate(secondary_cols):
            color = secondary_colors[i % len(secondary_colors)]
            ax2.scatter(x_data, plot_df[col], label=f"{col} (secondary)", color=color)
else:
    for i, col in enumerate(primary_cols):
        color = primary_colors[i % len(primary_colors)]
        ax.plot(x_data, plot_df[col], label=col, color=color)
    if ax2:
        for i, col in enumerate(secondary_cols):
            color = secondary_colors[i % len(secondary_colors)]
            ax2.plot(x_data, plot_df[col], label=f"{col} (secondary)", color=color)

ax.set_title(title if title else (", ".join(all_cols) + " vs " + (x_col or "Date")))
ax.set_xlabel(x_label if x_label else (x_col or "Date"))
ax.set_ylabel(y_label if y_label else ("Primary Values" if primary_cols else "Values"))
if ax2 and secondary_cols:
    ax2.set_ylabel(y2_label if y2_label else "Secondary Values")

handles, labels = ax.get_legend_handles_labels()
if ax2:
    handles2, labels2 = ax2.get_legend_handles_labels()
    handles += handles2
    labels += labels2
ax.legend(handles, labels, frameon=False)

if ax2:
    y1_min, y1_max = ax.get_ylim()
    y2_min, y2_max = ax2.get_ylim()
    if (y1_min < 0 < y1_max) or (y2_min < 0 < y2_max):
        max_abs1 = max(abs(y1_min), abs(y1_max))
        ax.set_ylim(-max_abs1, max_abs1)
        max_abs2 = max(abs(y2_min), abs(y2_max))
        ax2.set_ylim(-max_abs2, max_abs2)

buffer = io.BytesIO()
fig.tight_layout()
fig.savefig(buffer, format="png")
plt.close(fig)

buffer.seek(0)
image_base64 = base64.b64encode(buffer.read()).decode("ascii")

result = {
    "status": "success",
    "image_base64": image_base64,
}
`;
