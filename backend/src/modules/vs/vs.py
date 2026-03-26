import json
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pathlib import Path

class PlotEngine:
    def __init__(self, output_dir: Path, config_dir: Path):
        self.output_dir = output_dir
        self.config_dir = config_dir
        self.style_dict = {}

    def apply_style(self, style_filename: str):
        config_path = self.config_dir / style_filename
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.style_dict = json.load(f)
            plt.style.use('default')
            plt.rcParams.update(self.style_dict)
        except Exception as e:
            print(f"Error applying style: {e}")

    def generate_plot(self, df: pd.DataFrame, x_col: str, y_cols: list, chart_type: str, filename: str):
        fig, ax = plt.subplots()
        x_data = df[x_col] if x_col else df.index

        if chart_type == '2':
            indices = np.arange(len(x_data))
            total_width = 0.8
            bar_width = total_width / len(y_cols)
            
            for i, y_col in enumerate(y_cols):
                offset = (i - len(y_cols) / 2) * bar_width + bar_width / 2
                ax.bar(indices + offset, df[y_col], width=bar_width, label=y_col)

            ax.set_xticks(indices)
            labels = [d.strftime('%Y-%m') if hasattr(d, 'strftime') else str(d) for d in x_data]
            ax.set_xticklabels(labels, rotation=270, ha='right')
        else:
            for y_col in y_cols:
                if chart_type == '3': ax.scatter(x_data, df[y_col], label=y_col)
                else: ax.plot(x_data, df[y_col], label=y_col)
            
            if pd.api.types.is_datetime64_any_dtype(x_data):
                plt.setp(ax.get_xticklabels(), rotation=270, ha="right")

        ax.set_title(f"{', '.join(y_cols)} vs {x_col or 'Date'}", pad=15)
        ax.set_xlabel(x_col or "Date")
        ax.set_ylabel("Values")
        ax.legend(frameon=False)
        
        output_path = self.output_dir / filename
        fig.tight_layout()
        fig.savefig(output_path)
        plt.close(fig)
        return output_path