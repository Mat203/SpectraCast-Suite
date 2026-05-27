import numpy as np
import pandas as pd

VALID_OUTLIER_STRATEGIES = {
    "clip_iqr",
    "mean",
    "median",
    "drop",
}


def _validate_inputs(df: pd.DataFrame, column: str, strategy: str) -> None:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    if strategy not in VALID_OUTLIER_STRATEGIES:
        raise ValueError("Invalid strategy")

    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Column '{column}' is not numeric")


def _build_iqr_mask(series: pd.Series) -> tuple[pd.Series, float | None, float | None]:
    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    iqr = q3 - q1
    if pd.isna(iqr) or iqr == 0:
        return pd.Series(False, index=series.index), None, None

    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    mask = (series < lower_bound) | (series > upper_bound)
    return mask, float(lower_bound), float(upper_bound)


def _coerce_mask(mask: pd.Series | np.ndarray, index: pd.Index) -> pd.Series:
    if isinstance(mask, pd.Series):
        return mask.reindex(index, fill_value=False)
    return pd.Series(mask, index=index)


def apply_outlier_strategy(
    df: pd.DataFrame,
    column: str,
    strategy: str,
    outlier_mask: pd.Series | np.ndarray | None = None,
) -> pd.DataFrame:
    _validate_inputs(df, column, strategy)

    updated_df = df.copy()
    series = updated_df[column].astype(float)

    if outlier_mask is None:
        outlier_mask, lower_bound, upper_bound = _build_iqr_mask(series)
    else:
        outlier_mask = _coerce_mask(outlier_mask, series.index)
        lower_bound, upper_bound = None, None
        if strategy == "clip_iqr":
            _, lower_bound, upper_bound = _build_iqr_mask(series)

    if not outlier_mask.any():
        return updated_df

    if strategy == "clip_iqr":
        if lower_bound is None or upper_bound is None:
            return updated_df
        updated_df[column] = series.clip(lower=lower_bound, upper=upper_bound)
    elif strategy == "mean":
        mean_val = series.mean()
        updated_series = series.copy()
        updated_series.loc[outlier_mask] = mean_val
        updated_df[column] = updated_series
    elif strategy == "median":
        median_val = series.median()
        updated_series = series.copy()
        updated_series.loc[outlier_mask] = median_val
        updated_df[column] = updated_series
    elif strategy == "drop":
        updated_df = updated_df.loc[~outlier_mask]

    return updated_df


def preview_outlier_strategy(
    df: pd.DataFrame,
    column: str,
    strategy: str,
    max_points: int = 300,
) -> dict:
    _validate_inputs(df, column, strategy)

    series = df[column].astype(float)
    outlier_mask, lower_bound, upper_bound = _build_iqr_mask(series)

    after_series = series.copy()
    if strategy == "clip_iqr":
        if lower_bound is not None and upper_bound is not None:
            after_series = after_series.clip(lower=lower_bound, upper=upper_bound)
    elif strategy == "mean":
        after_series.loc[outlier_mask] = series.mean()
    elif strategy == "median":
        after_series.loc[outlier_mask] = series.median()
    elif strategy == "drop":
        after_series.loc[outlier_mask] = np.nan

    if isinstance(df.index, pd.DatetimeIndex):
        x_values = [ts.isoformat() for ts in df.index]
    else:
        x_values = [str(idx) for idx in range(len(df))]

    before_values = [None if pd.isna(v) else float(v) for v in series.tolist()]
    after_values = [None if pd.isna(v) else float(v) for v in after_series.tolist()]

    if len(x_values) > max_points:
        indices = np.linspace(0, len(x_values) - 1, num=max_points, dtype=int)
        indices = np.unique(indices)
        x_values = [x_values[i] for i in indices]
        before_values = [before_values[i] for i in indices]
        after_values = [after_values[i] for i in indices]

    return {
        "column": column,
        "strategy": strategy,
        "x": x_values,
        "before": before_values,
        "after": after_values,
    }
