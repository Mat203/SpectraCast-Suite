import json
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path

class VisualStandardizer:
    def __init__(self, config_filename: str = "style_config.json"):
        current_file = Path(__file__).resolve()
        
        backend_dir = current_file.parents[3]
        
        self.output_dir = backend_dir / "outputs"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.config_path = backend_dir / "style_config" / config_filename
        
        self._apply_style_from_config()

    def _apply_style_from_config(self):
        if not self.config_path.exists():
            print(f"Warning: Файл конфігурації '{self.config_path}' не знайдено. Використовуються стандартні стилі.")
            return

        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                style_config = json.load(f)
            
            plt.rcParams.update(style_config)
            
        except Exception as e:
            print(f"Error reading style config: {e}")

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