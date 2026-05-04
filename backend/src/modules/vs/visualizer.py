import json
import ast
import os
import sys
from pathlib import Path

current_dir = os.path.dirname(os.path.abspath(__file__))

project_root = os.path.abspath(os.path.join(current_dir, '../../../../'))

if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.src.modules.vs.vs_cli import PlotCLI
from backend.src.core.loader import DataLoader
from backend.src.modules.vs.vs import PlotEngine
from backend.src.modules.vs.code_cleaner import StyleRemover

class VisualStandardizer:
    def __init__(self):
        backend_dir = Path(__file__).resolve().parents[3]
        self.engine = PlotEngine(
            output_dir=backend_dir / "outputs",
            config_dir=backend_dir / "style_config"
        )
        self.loader = DataLoader()

    def run_interactive_plotter(self):
        filename = input("Enter dataset filename: ").strip()
        df = self.loader.load_csv(filename)
        if df is None: return

        styles = [f.name for f in self.engine.config_dir.glob("*.json")]
        selected_style = PlotCLI.select_style(styles)
        if selected_style:
            self.engine.apply_style(selected_style)

        params = PlotCLI.get_user_inputs(df, styles)
        if params:
            path = self.engine.generate_plot(df, params['x'], params['y'], params['type'], params['file'])
            print(f"[*] Saved to {path}")

    def standardize_user_code(self, raw_code: str) -> str:
        try:
            tree = ast.parse(raw_code)
            cleaned_code = ast.unparse(StyleRemover().visit(tree))
            style_str = json.dumps(self.engine.style_dict, indent=4)
            style_str = style_str.replace("true", "True").replace("false", "False").replace("null", "None")
            return f"import matplotlib.pyplot as plt\n\nplt.rcParams.update({style_str})\n\n{cleaned_code}"
        except Exception as e:
            print(f"Error standardizing code: {e}")
            return raw_code

if __name__ == "__main__":
    VisualStandardizer().run_interactive_plotter()