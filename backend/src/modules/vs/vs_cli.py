from backend.src.core.loader import DataLoader

class PlotCLI:
    @staticmethod
    def get_user_inputs(df, available_styles):
        print("\nAvailable columns:", list(df.columns))
        
        y_cols_raw = input("Enter columns for Y-axis (comma-separated): ").strip()
        y_cols = [c.strip() for c in y_cols_raw.split(',') if c.strip() in df.columns]
        
        if not y_cols: return None

        x_col = input("Enter column for X-axis (Enter for Date Index): ").strip()
        if x_col and x_col not in df.columns: x_col = None

        print("\n1. Line | 2. Bar | 3. Scatter")
        choice = input("Choice (1/2/3): ").strip()
        
        out_name = input("Output filename (chart.png): ").strip() or "chart.png"
        if not out_name.endswith('.png'): out_name += '.png'
        
        return {"x": x_col, "y": y_cols, "type": choice, "file": out_name}

    @staticmethod
    def select_style(styles):
        if not styles: return None
        print("\nAvailable Styles:")
        for i, s in enumerate(styles, 1): print(f"{i}. {s}")
        choice = input("Select style # (Enter for default): ").strip()
        return styles[int(choice)-1] if choice.isdigit() and 0 < int(choice) <= len(styles) else None