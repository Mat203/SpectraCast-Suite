import numpy as np
from typing import Any, Tuple

def convert_numpy_types(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(i) for i in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def downsample_preview(
    x_values: list,
    before_values: list,
    after_values: list,
    max_points: int = 300,
) -> Tuple[list, list, list]:
    if len(x_values) > max_points:
        indices = np.linspace(0, len(x_values) - 1, num=max_points, dtype=int)
        indices = np.unique(indices)
        x_values = [x_values[i] for i in indices]
        before_values = [before_values[i] for i in indices]
        after_values = [after_values[i] for i in indices]
    return x_values, before_values, after_values
