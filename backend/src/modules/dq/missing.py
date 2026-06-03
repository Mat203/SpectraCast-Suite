import numpy as np
import pandas as pd
from backend.src.modules.dq.cleaner import DataCleaner


def apply_missing_strategy(df: pd.DataFrame, column: str, strategy: str) -> pd.DataFrame:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Column '{column}' is not numeric")

    cleaner = DataCleaner(df.copy())
    cleaner.impute_column(column, strategy)
    return cleaner.df


def preview_missing_strategy(
    df: pd.DataFrame,
    column: str,
    strategy: str,
    max_points: int = 300,
) -> dict:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")
    if not pd.api.types.is_numeric_dtype(df[column]):
        raise ValueError(f"Column '{column}' is not numeric")

    before_series = df[column].astype(float)
    after_df = apply_missing_strategy(df.copy(), column, strategy)
    after_series = after_df[column].astype(float)

    if isinstance(df.index, pd.DatetimeIndex):
        x_values = [ts.isoformat() for ts in df.index]
    else:
        x_values = [str(idx) for idx in range(len(df))]

    before_values = [None if pd.isna(v) else float(v) for v in before_series.tolist()]
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
