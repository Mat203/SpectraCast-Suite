from typing import Any, Dict

import numpy as np
import pandas as pd

from backend.src.modules.dq.scanner import DataScanner

from backend.src.core.utils import convert_numpy_types


def build_scan_report(
    df: pd.DataFrame,
    has_previous_state: bool,
    is_modified: bool,
) -> Dict[str, Any]:
    scanner = DataScanner(df)
    report = scanner.run_health_check()
    clean_report = convert_numpy_types(report)

    if isinstance(df.index, pd.DatetimeIndex):
        preview_df = df.reset_index().replace({float("nan"): None})
    else:
        preview_df = df.copy().replace({float("nan"): None})

    clean_report["dataset_preview"] = preview_df.to_dict(orient="records")
    clean_report["has_previous_state"] = has_previous_state
    clean_report["is_modified"] = bool(is_modified)

    return clean_report
