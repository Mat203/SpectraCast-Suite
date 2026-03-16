import json
from pathlib import Path
from typing import Dict, Any

class StyleManager:
    def __init__(self):
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parents[3]
        
        self.config_dir = backend_dir / "style_config"
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def get_style_schema(self) -> Dict[str, Any]:
        return {
            "palette": "List of hex colors (e.g., ['#primary', '#secondary1', '#secondary2'])",
            "background": {
                "axes.facecolor": "Plot background",
                "figure.facecolor": "Figure background"
            },
            "text": {
                "text.color": "Main text color",
                "axes.labelcolor": "Axis labels",
                "xtick.color": "X ticks",
                "ytick.color": "Y ticks"
            },
            "lines": {
                "lines.linewidth": "Thickness"
            }
        }

    def save_custom_style(self, style_name: str, user_params: Dict[str, Any]) -> bool:
        if not style_name or not user_params:
            print("Error: Invalid style name or parameters.")
            return False

        safe_name = style_name.strip().lower().replace(" ", "_")
        file_path = self.config_dir / f"{safe_name}.json"

        if "palette" in user_params:
            colors = user_params.pop("palette")
            if isinstance(colors, list) and colors:
                color_str = "', '".join(colors)
                user_params["axes.prop_cycle"] = f"cycler('color', ['{color_str}'])"
            else:
                print("Warning: 'palette' must be a non-empty list of hex strings.")

        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(user_params, f, indent=4)
            print(f"[*] Style saved to {file_path}")
            return True
        except Exception as e:
            print(f"Error saving style: {e}")
            return False