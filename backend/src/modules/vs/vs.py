import json
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path
import ast

class _StyleRemover(ast.NodeTransformer):
    def __init__(self):
        self.style_args = {
            'color', 'c', 'linewidth', 'lw', 'linestyle', 'ls', 
            'fontsize', 'fontweight', 'figsize', 'marker', 
            'markersize', 'alpha', 'facecolor', 'edgecolor', 
            'palette', 'cmap'
        }

    def visit_Call(self, node):
        self.generic_visit(node)
        
        new_keywords = []
        for kw in node.keywords:
            if kw.arg not in self.style_args:
                new_keywords.append(kw)
                
        node.keywords = new_keywords
        return node
    

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
            print(f"Warning: Config file '{self.config_path}' нnot found. Using regular style.")
            return

        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                style_config = json.load(f)
            
            plt.rcParams.update(style_config)
            
        except Exception as e:
            print(f"Error reading style config: {e}")

    def plot_time_series(self, df: pd.DataFrame, column: str, title: str, filename: str):
        if column not in df.columns:
            print(f"Error: Column '{column}' not found in dataset.")
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
        
        print(f"Visualizer: Chart saved '{output_path}'")

    def standardize_user_code(self, raw_code: str) -> str:
        try:
            tree = ast.parse(raw_code)
            
            transformer = _StyleRemover()
            cleaned_tree = transformer.visit(tree)
            
            cleaned_code = ast.unparse(cleaned_tree)
            
            style_injection = f"""
import json
import matplotlib.pyplot as plt
try:
    with open('{self.config_path.as_posix()}', 'r', encoding='utf-8') as f:
        plt.rcParams.update(json.load(f))
except Exception as e:
    print("Style config not loaded in user code:", e)

# --- USER CODE BELOW ---
"""
            return style_injection + cleaned_code

        except SyntaxError as e:
            print(f"Code mistake in user input: {e}")
            return raw_code
        except Exception as e:
            print(f"Syntax Error: {e}")
            return raw_code