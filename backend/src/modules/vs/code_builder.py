from typing import List


def build_plot_source_code(
    x_col: str,
    primary_cols: List[str],
    secondary_cols: List[str],
    chart_type: str,
    style_name: str,
    title: str = "",
    x_label: str = "",
    y_label: str = "",
    y2_label: str = "",
) -> str:
    safe_secondary = secondary_cols
    safe_primary = primary_cols or ([] if safe_secondary else ["y"])
    primary_literal = ", ".join(f"'{col}'" for col in safe_primary)
    secondary_literal = ", ".join(f"'{col}'" for col in safe_secondary)
    all_cols = safe_primary + safe_secondary
    if not all_cols:
        all_cols = ["y"]
    lines: List[str] = [
        "import json",
        "import pandas as pd",
        "import matplotlib.pyplot as plt",
        "",
        "df = pd.read_csv('your_data.csv')",
        "",
    ]

    if style_name:
        style_file = style_name if style_name.endswith('.json') else f"{style_name}.json"
        lines.extend([
            f"with open('{style_file}', 'r') as f:",
            "    style = json.load(f)",
            "plt.rcParams.update(style)",
            "",
        ])

    if x_col:
        lines.append(f"x = df['{x_col}']")
    else:
        lines.append("x = df.index")

    lines.append("")
    lines.append("fig, ax = plt.subplots()")
    if safe_secondary:
        lines.append("ax2 = ax.twinx()")

    if chart_type == '2':
        lines.extend([
            "import numpy as np",
            "indices = np.arange(len(x))",
            f"total = max({len(all_cols)}, 1)",
            "bar_width = 0.8 / total",
            "offset = -((total - 1) / 2) * bar_width",
            f"for y_col in [{primary_literal}]:",
            "    ax.bar(indices + offset, df[y_col], width=bar_width, label=y_col)",
            "    offset += bar_width",
        ])
        if safe_secondary:
            lines.extend([
                f"for y_col in [{secondary_literal}]:",
                "    ax2.bar(indices + offset, df[y_col], width=bar_width, label=f'{y_col} (secondary)', alpha=0.8)",
                "    offset += bar_width",
            ])
        lines.append("ax.set_xticks(indices)")
        lines.append("ax.set_xticklabels(x, rotation=270, ha='right')")
    elif chart_type == '3':
        lines.extend([
            f"for y_col in [{primary_literal}]:",
            "    ax.scatter(x, df[y_col], label=y_col)",
        ])
        if safe_secondary:
            lines.extend([
                f"for y_col in [{secondary_literal}]:",
                "    ax2.scatter(x, df[y_col], label=f'{y_col} (secondary)')",
            ])
    else:
        lines.extend([
            f"for y_col in [{primary_literal}]:",
            "    ax.plot(x, df[y_col], label=y_col)",
        ])
        if safe_secondary:
            lines.extend([
                f"for y_col in [{secondary_literal}]:",
                "    ax2.plot(x, df[y_col], label=f'{y_col} (secondary)')",
            ])

    default_title = ", ".join(all_cols) + " vs " + (x_col or "Date")
    lines.append("ax.set_title('" + (title if title else default_title) + "')")
    lines.append("ax.set_xlabel('" + (x_label if x_label else (x_col or "Date")) + "')")
    
    default_ylabel = "Primary Values" if primary_cols else "Values"
    lines.append("ax.set_ylabel('" + (y_label if y_label else default_ylabel) + "')")
    if safe_secondary:
        lines.append("ax2.set_ylabel('" + (y2_label if y2_label else "Secondary Values") + "')")

    lines.extend([
        "handles, labels = ax.get_legend_handles_labels()",
    ])
    if safe_secondary:
        lines.extend([
            "handles2, labels2 = ax2.get_legend_handles_labels()",
            "handles += handles2",
            "labels += labels2",
        ])
    lines.extend([
        "ax.legend(handles, labels, frameon=False)",
        "plt.tight_layout()",
        "plt.show()",
    ])

    return "\n".join(lines)
