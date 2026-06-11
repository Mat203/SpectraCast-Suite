import sys
import os
from pathlib import Path

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.src.core.loader import DataLoader
from backend.src.modules.vs.vs import PlotEngine


class PlotCLI:
    @staticmethod
    def get_user_inputs(df, available_styles):
        print("\nAvailable columns:", list(df.columns))

        y_cols_raw = input("Enter columns for Y-axis (comma-separated): ").strip()
        y_cols = [c.strip() for c in y_cols_raw.split(',') if c.strip() in df.columns]

        if not y_cols:
            return None

        x_col = input("Enter column for X-axis (Enter for Date Index): ").strip()
        if x_col and x_col not in df.columns:
            x_col = None

        print("\n1. Line | 2. Bar | 3. Scatter")
        choice = input("Choice (1/2/3): ").strip()

        out_name = input("Output filename (chart.png): ").strip() or "chart.png"
        if not out_name.endswith('.png'):
            out_name += '.png'

        return {"x": x_col, "y": y_cols, "type": choice, "file": out_name}

    @staticmethod
    def select_style(styles):
        if not styles:
            return None
        print("\nAvailable Styles:")
        for i, s in enumerate(styles, 1):
            print(f"{i}. {s}")
        choice = input("Select style # (Enter for default): ").strip()
        return styles[int(choice) - 1] if choice.isdigit() and 0 < int(choice) <= len(styles) else None


def run_interactive_plotter():
    from backend.src.api.services.storage import StorageService
    storage = StorageService()
    loader = DataLoader(storage=storage)

    filename = input("Enter dataset filename: ").strip()
    df = loader.load_csv(filename)
    if df is None:
        return

    backend_dir = Path(__file__).resolve().parents[2]
    engine = PlotEngine(
        output_dir=backend_dir / "outputs",
        config_dir=backend_dir / "style_config",
    )

    styles = [f.name for f in engine.config_dir.glob("*.json")]
    selected_style = PlotCLI.select_style(styles)
    if selected_style:
        engine.apply_style(selected_style)

    params = PlotCLI.get_user_inputs(df, styles)
    if params:
        path = engine.generate_plot(df, params['x'], params['y'], params['type'], params['file'])
        print(f"[*] Saved to {path}")


if __name__ == "__main__":
    run_interactive_plotter()