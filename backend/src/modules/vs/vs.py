import json
import matplotlib.pyplot as plt
import pandas as pd
import os
import sys
from pathlib import Path
import ast

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.src.core.loader import DataLoader
from backend.src.modules.vs.code_cleaner import StyleRemover

class VisualStandardizer:
    def __init__(self, config_filename: str = "style_config.json"):
        current_file = Path(__file__).resolve()
        
        backend_dir = current_file.parents[3]
        
        self.output_dir = backend_dir / "outputs"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.config_path = backend_dir / "style_config" / config_filename
        
        self.style_dict = {} 
        
        self._apply_style_from_config()

    def _apply_style_from_config(self):
        if not self.config_path.exists():
            print(f"Warning: Config file '{self.config_path}' not found. Using regular style.")
            return

        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.style_dict = json.load(f)
            
            plt.rcParams.update(self.style_dict)
            
        except Exception as e:
            print(f"Error reading style config: {e}")

    def _generate_custom_plot(self, df: pd.DataFrame, x_col: str, y_col: str, chart_choice: str, filename: str):
        fig, ax = plt.subplots()

        x_data = df[x_col] if x_col else df.index
        y_data = df[y_col]

        if chart_choice == '2':
            ax.bar(x_data, y_data, label=y_col)
            chart_type_name = "Bar Chart"
        elif chart_choice == '3':
            ax.scatter(x_data, y_data, label=y_col)
            chart_type_name = "Scatter Plot"
        else:
            ax.plot(x_data, y_data, label=y_col)
            chart_type_name = "Line Chart"

        title = f"{y_col} vs {x_col if x_col else 'Date'}"
        ax.set_title(title, pad=15)
        ax.set_xlabel(x_col if x_col else "Date", labelpad=10)
        ax.set_ylabel(y_col, labelpad=10)
        ax.legend(frameon=False)

        output_path = self.output_dir / filename
        fig.tight_layout()
        fig.savefig(output_path)
        plt.close(fig)

        print(f"\n[*] {chart_type_name} successfully saved to '{output_path}'")

    def run_interactive_plotter(self):
        print("\n" + "="*40)
        print(" MODULE 3: VISUAL STANDARDIZER")
        print(" Interactive Plot Generation")
        print("="*40)

        filename = input("Enter dataset filename (e.g., test.csv): ").strip()
        loader = DataLoader()
        df = loader.load_csv(filename)

        if df is None:
            return

        print("\nAvailable columns:", list(df.columns))

        y_col = input("Enter column for Y-axis (Target variable): ").strip()
        if y_col not in df.columns:
            print(f"Error: Column '{y_col}' not found.")
            return

        x_col = input("Enter column for X-axis (Press Enter to use Date Index): ").strip()
        if x_col and x_col not in df.columns:
            print(f"Error: Column '{x_col}' not found.")
            return

        print("\nSelect Chart Type:")
        print("1. Line Chart (Trend)")
        print("2. Bar Chart (Comparison)")
        print("3. Scatter Plot (Correlation)")
        chart_choice = input("Enter number (1/2/3): ").strip()

        output_filename = input("Enter output filename (e.g., chart.png): ").strip()
        if not output_filename.endswith('.png'):
            output_filename += '.png'

        self._generate_custom_plot(df, x_col, y_col, chart_choice, output_filename)

    def standardize_user_code(self, raw_code: str) -> str:
        try:
            tree = ast.parse(raw_code)
            
            transformer = StyleRemover()
            cleaned_tree = transformer.visit(tree)
            
            cleaned_code = ast.unparse(cleaned_tree)
            
            style_str = json.dumps(self.style_dict, indent=4) if self.style_dict else "{}"
            
            style_injection = f"""import matplotlib.pyplot as plt

spectra_style = {style_str}
plt.rcParams.update(spectra_style)

"""
            return style_injection + cleaned_code

        except SyntaxError as e:
            print(f"Code mistake in user input: {e}")
            return raw_code
        except Exception as e:
            print(f"Syntax Error: {e}")
            return raw_code

if __name__ == "__main__":
    vs_module = VisualStandardizer()
    vs_module.run_interactive_plotter()