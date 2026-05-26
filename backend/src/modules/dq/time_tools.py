import pandas as pd
from backend.src.modules.dq.scanner import DataScanner


def fix_time_axis(df: pd.DataFrame) -> tuple[pd.DataFrame, int, list[dict]]:
    if df is None or df.empty:
        raise ValueError("File not found or empty")

    scanner = DataScanner(df)
    report = scanner.run_health_check()
    datetime_column = scanner._get_datetime_column()
    frequency = report.get("frequency", "Unknown")
    if frequency == "Unknown":
        raise ValueError("Frequency could not be inferred")

    if isinstance(df.index, pd.DatetimeIndex):
        working_df = df.copy()
    elif datetime_column:
        datetime_index = pd.to_datetime(df[datetime_column], errors="coerce")
        working_df = df.copy()
        working_df[datetime_column] = datetime_index
        working_df = working_df.dropna(subset=[datetime_column])
        working_df = working_df.set_index(datetime_column, drop=False)
    else:
        raise ValueError("Datetime column not found")

    working_df = working_df.sort_index()
    new_index = pd.date_range(start=working_df.index.min(), end=working_df.index.max(), freq=frequency)
    updated_df = working_df.reindex(new_index)
    date_column_name = datetime_column or updated_df.index.name or "Date"
    updated_df[date_column_name] = updated_df.index

    inserted_rows = int(len(new_index) - len(working_df.index.unique()))

    preview_df = updated_df.reset_index(drop=True).replace({float('nan'): None})
    preview_records = preview_df.to_dict(orient="records")

    return updated_df, inserted_rows, preview_records
