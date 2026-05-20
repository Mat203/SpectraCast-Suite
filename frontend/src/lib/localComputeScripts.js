export const LOCAL_DQ_SCAN_CODE = `
import pandas as pd
import numpy as np

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

        if sample.str.fullmatch(r"\d+").all():
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

    series = pd.to_datetime(frame[datetime_column], errors="coerce").dropna()
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

has_datetime_axis = isinstance(df.index, pd.DatetimeIndex) or _get_datetime_column(df) is not None

time_check = _detect_frequency_and_gaps(_resolve_datetime_index(df)) if has_datetime_axis else {
    "frequency": "Unknown",
    "display_frequency": "Unknown (Irregular)",
    "missing_dates_count": 0,
    "missing_dates": [],
}

missing_values = df.isna().sum().to_dict()

outliers = {}
for col in df.select_dtypes(include=[np.number]).columns:
    series = df[col].dropna()
    if series.empty:
        continue
    std = series.std(ddof=0)
    if std == 0:
        continue
    z = (series - series.mean()) / std
    count = int((np.abs(z) > 3).sum())
    if count > 0:
        outliers[col] = count

preview_df = df.reset_index() if isinstance(df.index, pd.DatetimeIndex) else df.copy()
preview_df = preview_df.replace({float("nan"): None})

result = {
    "rows": int(len(df)),
    "columns": list(df.columns),
    "outliers": outliers,
    "outlier_strategy_recommendations": {},
    "missing_values": missing_values,
    "missing_value_strategy_recommendations": {},
    "dataset_preview": preview_df.to_dict(orient="records"),
    "has_datetime_axis": has_datetime_axis,
    "has_previous_state": False,
    "is_modified": False,
}
result.update(time_check)
`;

export const LOCAL_DQ_HANDLE_OUTLIERS_CODE = `
import numpy as np
import pandas as pd

column = payload.get("column")
strategy = payload.get("strategy")

if df is None:
    raise ValueError("No dataset provided")
if column not in df.columns:
    raise ValueError(f"Column '{column}' not found")

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

x_values = [str(idx) for idx in range(len(df))]

before_values = [None if pd.isna(v) else float(v) for v in series.tolist()]
after_values = [None if pd.isna(v) else float(v) for v in after_series.tolist()]

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

series = df[column].astype(float)

if strategy == "1":
    series = series.interpolate(method="linear")
elif strategy == "2":
    try:
        series = series.interpolate(method="spline", order=3)
    except Exception:
        series = series.interpolate(method="linear")
elif strategy == "3":
    series = series.ffill()
elif strategy == "4":
    series = series
elif strategy == "5":
    if isinstance(df.index, pd.DatetimeIndex):
        series = series.groupby(df.index.month).transform(lambda x: x.fillna(x.mean()))
    else:
        series = series
elif strategy == "6":
    series = series.interpolate(method="linear")
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

before_series = df[column].astype(float)

series = before_series.copy()
if strategy == "1":
    series = series.interpolate(method="linear")
elif strategy == "2":
    try:
        series = series.interpolate(method="spline", order=3)
    except Exception:
        series = series.interpolate(method="linear")
elif strategy == "3":
    series = series.ffill()
elif strategy == "4":
    series = series
elif strategy == "5":
    if isinstance(df.index, pd.DatetimeIndex):
        series = series.groupby(df.index.month).transform(lambda x: x.fillna(x.mean()))
    else:
        series = series
elif strategy == "6":
    series = series.interpolate(method="linear")
elif strategy == "7":
    series = series
else:
    raise ValueError("Invalid strategy")

after_series = series

x_values = [str(idx) for idx in range(len(df))]

before_values = [None if pd.isna(v) else float(v) for v in before_series.tolist()]
after_values = [None if pd.isna(v) else float(v) for v in after_series.tolist()]

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
        name_hint = str(column).lower()
        has_hint = any(token in name_hint for token in ("date", "time", "timestamp", "datetime"))
        has_separator = sample.str.contains(r"[-/:T ]").any()
        parsed = pd.to_datetime(sample, errors="coerce")
        if parsed.notna().mean() >= 0.8 and (has_hint or has_separator):
            return column
    return None

def _infer_frequency(idx):
    if idx is None or len(idx) < 2:
        return "Unknown"
    sorted_index = idx.sort_values().drop_duplicates()
    if len(sorted_index) < 2:
        return "Unknown"
    deltas = sorted_index.to_series().diff().dropna()
    if deltas.empty:
        return "Unknown"
    dominant_delta = deltas.mode().iloc[0]
    dominant_delta_days = dominant_delta.days
    if dominant_delta_days <= 0:
        return "Unknown"
    if 28 <= dominant_delta_days <= 31:
        most_frequent_day = pd.Series(sorted_index.day).mode()[0]
        return "MS" if most_frequent_day == 1 else "ME"
    if 89 <= dominant_delta_days <= 93:
        return "QS"
    if dominant_delta_days == 7:
        return "W"
    if dominant_delta_days == 1:
        has_weekends = (sorted_index.dayofweek >= 5).any()
        return "B" if not has_weekends else "D"
    return f"{dominant_delta_days}D"

if isinstance(df.index, pd.DatetimeIndex):
    datetime_index = df.index
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

frequency = _infer_frequency(datetime_index)
if frequency == "Unknown":
    raise ValueError("Frequency could not be inferred")

working_df = working_df.sort_index()
new_index = pd.date_range(start=working_df.index.min(), end=working_df.index.max(), freq=frequency)
updated_df = working_df.reindex(new_index)

inserted_rows = int(len(new_index) - len(working_df.index.unique()))

date_column_name = updated_df.index.name or "Date"
updated_df[date_column_name] = updated_df.index

preview_df = updated_df.reset_index(drop=True).replace({float("nan"): None})

result = {
    "status": "success",
    "inserted_rows": inserted_rows,
    "dataset_preview": preview_df.to_dict(orient="records"),
    "csv": updated_df.to_csv(index=False),
}
`;

export const LOCAL_LI_RUN_CODE = `
import pandas as pd
import numpy as np

if df is None:
    raise ValueError("No dataset provided")

target_col = payload.get("target_col")
if target_col not in df.columns:
    raise ValueError(f"Column '{target_col}' not found in dataset.")

numeric_cols = df.select_dtypes(include=[np.number]).columns
queries = [col for col in numeric_cols if col != target_col]

results = []
for col in queries:
    series = df[[target_col, col]].dropna()
    if series.empty:
        continue
    corr = series[target_col].corr(series[col])
    corr_val = 0.0 if pd.isna(corr) else float(round(corr, 3))
    result_label = "Noise" if abs(corr_val) < 0.4 else "Synchronous"
    results.append({
        "Search Query": col,
        "Correlation (Lag 0)": corr_val,
        "Result": result_label,
    })

results_df = pd.DataFrame(results)

raw_trends = df[queries].copy() if queries else pd.DataFrame()

result = {
    "status": "success",
    "queries_generated": queries,
    "trends_csv": raw_trends.to_csv(index=False),
    "correlations_csv": results_df.to_csv(index=False),
    "top_results": results_df.head(10).replace({float("nan"): None}).to_dict(orient="records"),
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
    x_data = df[x_col]
else:
    x_data = df.index

all_cols = primary_cols + secondary_cols
if not all_cols:
    all_cols = ["y"]

if chart_type == "2":
    indices = range(len(x_data))
    total = max(len(all_cols), 1)
    bar_width = 0.8 / total
    offset = -((total - 1) / 2) * bar_width
    for col in primary_cols:
        ax.bar([i + offset for i in indices], df[col], width=bar_width, label=col)
        offset += bar_width
    if ax2:
        for col in secondary_cols:
            ax2.bar([i + offset for i in indices], df[col], width=bar_width, label=f"{col} (secondary)", alpha=0.8)
            offset += bar_width
elif chart_type == "3":
    for col in primary_cols:
        ax.scatter(x_data, df[col], label=col)
    if ax2:
        for col in secondary_cols:
            ax2.scatter(x_data, df[col], label=f"{col} (secondary)")
else:
    for col in primary_cols:
        ax.plot(x_data, df[col], label=col)
    if ax2:
        for col in secondary_cols:
            ax2.plot(x_data, df[col], label=f"{col} (secondary)")

ax.set_title(", ".join(all_cols) + " vs " + (x_col or "Date"))
ax.set_xlabel(x_col or "Date")
ax.set_ylabel("Primary Values" if primary_cols else "Values")
if ax2 and secondary_cols:
    ax2.set_ylabel("Secondary Values")

handles, labels = ax.get_legend_handles_labels()
if ax2:
    handles2, labels2 = ax2.get_legend_handles_labels()
    handles += handles2
    labels += labels2
ax.legend(handles, labels, frameon=False)

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
