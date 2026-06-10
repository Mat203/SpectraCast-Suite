import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np
import pandas as pd
from pathlib import Path

class PlotEngine:
    def __init__(self, output_dir: Path, config_dir: Path):
        self.output_dir = output_dir
        self.config_dir = config_dir
        self.style_dict = {}

    def apply_style(self, style_filename: str):
        if not style_filename.endswith('.json'):
            style_filename += '.json'
        config_path = self.config_dir / style_filename
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.style_dict = json.load(f)
            plt.style.use('default')
            matplotlib_params = {k: v for k, v in self.style_dict.items() if not k.startswith("custom.")}
            plt.rcParams.update(matplotlib_params)
        except Exception as e:
            print(f"Error applying style: {e}")

    def generate_plot(
        self,
        df: pd.DataFrame,
        x_col: str,
        y_cols: list,
        chart_type: str,
        filename: str,
        secondary_cols: list | None = None,
        title: str = None,
        x_label: str = None,
        y_label: str = None,
        y2_label: str = None,
    ):
        fig, ax = plt.subplots()

        if x_col and x_col in df.columns:
            x_data = df[x_col]
        else:
            x_data = df.index

        primary_cols = y_cols or []
        secondary_cols = secondary_cols or []
        all_cols = primary_cols + secondary_cols
        ax2 = ax.twinx() if secondary_cols else None

        primary_colors = self.style_dict.get("custom.primary_colors", ["#1f77b4", "#2ca02c", "#9467bd", "#00bcd4", "#4caf50"])
        secondary_colors = self.style_dict.get("custom.secondary_colors", ["#ff7f0e", "#d62728", "#8c564b", "#e377c2", "#ff9800"])

        if chart_type == '2':
            indices = np.arange(len(x_data))
            total = max(len(all_cols), 1)
            bar_width = 0.8 / total
            offset = -((total - 1) / 2) * bar_width

            for i, y_col in enumerate(primary_cols):
                color = primary_colors[i % len(primary_colors)]
                ax.bar(indices + offset, df[y_col], width=bar_width, label=y_col, color=color)
                offset += bar_width

            if ax2:
                for i, y_col in enumerate(secondary_cols):
                    color = secondary_colors[i % len(secondary_colors)]
                    ax2.bar(indices + offset, df[y_col], width=bar_width, label=f"{y_col} (secondary)", alpha=0.8, color=color)
                    offset += bar_width

            ax.set_xticks(indices)
            labels = [d.strftime('%Y-%m') if hasattr(d, 'strftime') else str(d) for d in x_data]
        else:
            for i, y_col in enumerate(primary_cols):
                color = primary_colors[i % len(primary_colors)]
                if chart_type == '3':
                    ax.scatter(x_data, df[y_col], label=y_col, color=color)
                else:
                    ax.plot(x_data, df[y_col], label=y_col, color=color)

            if ax2:
                for i, y_col in enumerate(secondary_cols):
                    color = secondary_colors[i % len(secondary_colors)]
                    if chart_type == '3':
                        ax2.scatter(x_data, df[y_col], label=f"{y_col} (secondary)", color=color)
                    else:
                        ax2.plot(x_data, df[y_col], label=f"{y_col} (secondary)", color=color)


        title_cols = ", ".join(all_cols) if all_cols else "y"
        ax.set_title(title if title else f"{title_cols} vs {x_col or 'Date'}", pad=15)
        ax.set_xlabel(x_label if x_label else (x_col or "Date"))
        ax.set_ylabel(y_label if y_label else ("Primary Values" if primary_cols else "Values"))
        if ax2:
            ax2.set_ylabel(y2_label if y2_label else "Secondary Values")

        handles, labels = ax.get_legend_handles_labels()
        if ax2:
            handles2, labels2 = ax2.get_legend_handles_labels()
            handles += handles2
            labels += labels2
        ax.legend(handles, labels, frameon=False)

        ax.xaxis.set_major_locator(ticker.MaxNLocator(nbins=15))
        fig.autofmt_xdate(rotation=45, ha='right')
        
        output_path = self.output_dir / filename
        fig.tight_layout()
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path)
        plt.close(fig)
        return output_path