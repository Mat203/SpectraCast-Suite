import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path

class VisualStandardizer:
    def __init__(self):
        current_file = Path(__file__).resolve()
        self.output_dir = current_file.parents[2] / "outputs"
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self._set_corporate_style()

    def _set_corporate_style(self):
        plt.rcParams.update({
            "font.family": "sans-serif",
            "font.size": 10,
            "axes.titlesize": 14,
            "axes.titleweight": "bold",
            "axes.labelsize": 11,
            "axes.labelweight": "bold",
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "grid.alpha": 0.3,
            "grid.linestyle": "--",
            "grid.color": "#B0BEC5",
            "figure.figsize": (10, 5),
            "figure.dpi": 300,
            "lines.linewidth": 2,
            "lines.markersize": 5
        })

    def plot_time_series(self, df: pd.DataFrame, column: str, title: str, filename: str):
        if column not in df.columns:
            print(f"Error: Колонку '{column}' не знайдено в датасеті.")
            return

        fig, ax = plt.subplots()
        
        ax.plot(df.index, df[column], color="#1F4E79", marker="o", label=column)
        
        ax.set_title(title, pad=15)
        ax.set_xlabel("Date", labelpad=10)
        ax.set_ylabel(column, labelpad=10)
        
        ax.legend(frameon=False)
        
        output_path = self.output_dir / filename
        fig.tight_layout()
        fig.savefig(output_path)
        
        plt.close(fig)
        
        print(f"Visualizer: Графік збережено у '{output_path}'")