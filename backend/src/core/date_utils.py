import pandas as pd
from typing import Optional, Tuple

def infer_numeric_date_format(sample: pd.Series) -> Optional[str]:
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


def parse_datetime_series(series: pd.Series, numeric_format: Optional[str]) -> pd.Series:
    if numeric_format:
        return pd.to_datetime(series.astype("string"), format=numeric_format, errors="coerce")
    return pd.to_datetime(series, errors="coerce")


def is_valid_datetime_series(parsed: pd.Series) -> bool:
    valid_ratio = parsed.notna().mean()
    if valid_ratio < 0.8:
        return False

    non_null = parsed.dropna()
    if non_null.empty:
        return False

    year_ratio = non_null.dt.year.between(1900, 2100).mean()
    return year_ratio >= 0.8


def detect_datetime_column(df: pd.DataFrame) -> Optional[str]:
    for column in df.columns:
        series = df[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            return column

        sample = series.dropna().astype(str)
        if sample.empty:
            continue

        numeric_format = infer_numeric_date_format(sample)
        is_candidate = numeric_format is not None or pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)
        if not is_candidate:
            continue

        name_hint = str(column).lower()
        has_name_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
        has_separator = sample.str.contains(r"[-/:T ]").any()
        parsed = parse_datetime_series(series, numeric_format)
        if is_valid_datetime_series(parsed) and (has_name_hint or has_separator or numeric_format):
            return column

    return None


def get_fallback_datetime_column(df: pd.DataFrame) -> Optional[str]:
    if df.empty:
        return None

    first_col = df.columns[0]
    series = df[first_col]
    sample = series.dropna().astype(str)
    if sample.empty:
        return None

    numeric_format = infer_numeric_date_format(sample)
    is_candidate = numeric_format is not None or pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)
    if not is_candidate:
        return None

    parsed = parse_datetime_series(series, numeric_format)
    return first_col if is_valid_datetime_series(parsed) else None


def infer_frequency_from_index(index: pd.DatetimeIndex) -> Tuple[str, str]:
    sorted_index = index.sort_values().drop_duplicates()
    if len(sorted_index) < 2:
        return "Unknown", "Unknown (Irregular)"

    deltas = sorted_index.to_series().diff().dropna()
    if deltas.empty:
        return "Unknown", "Unknown (Irregular)"

    try:
        dominant_delta = deltas.mode().iloc[0]
    except (IndexError, ValueError):
        return "Unknown", "Unknown (Irregular)"

    dominant_delta_days = dominant_delta.days
    if dominant_delta_days <= 0:
        return "Unknown", "Unknown (Irregular)"

    if 28 <= dominant_delta_days <= 31:
        try:
            most_frequent_day = pd.Series(sorted_index.day).mode().iloc[0]
        except (IndexError, ValueError):
            most_frequent_day = 1
        freq_str = 'MS' if most_frequent_day == 1 else 'ME'
        display_freq = "Monthly"
    elif 89 <= dominant_delta_days <= 93:
        freq_str = 'QS'
        display_freq = "Quarterly"
    elif dominant_delta_days == 7:
        freq_str = 'W'
        display_freq = "Weekly"
    elif dominant_delta_days == 1:
        has_weekends = (sorted_index.dayofweek >= 5).any()
        if not has_weekends:
            freq_str = 'B'
            display_freq = "Business Daily (Mon-Fri)"
        else:
            freq_str = 'D'
            display_freq = "Daily"
    else:
        freq_str = f"{dominant_delta_days}D"
        display_freq = f"Every {dominant_delta_days} days"

    return freq_str, display_freq
