import json
import ast
import logging
from pathlib import Path

from backend.src.modules.vs.vs import PlotEngine
from backend.src.modules.vs.code_cleaner import StyleRemover

logger = logging.getLogger(__name__)


class VisualStandardizer:
    def __init__(self):
        backend_dir = Path(__file__).resolve().parents[3]
        self.engine = PlotEngine(
            output_dir=backend_dir / "outputs",
            config_dir=backend_dir / "style_config"
        )

    def standardize_user_code(self, raw_code: str) -> str:
        try:
            tree = ast.parse(raw_code)
            remover = StyleRemover()
            modified_tree = remover.visit(tree)
            ast.fix_missing_locations(modified_tree)
            cleaned_code = ast.unparse(modified_tree)

            required_imports = {"import matplotlib.pyplot as plt", "import pandas as pd", "import numpy as np"}
            final_imports = sorted(list(required_imports.union(remover.collected_imports)))
            imports_str = "\n".join(final_imports)

            style_str = json.dumps(self.engine.style_dict, indent=4)
            style_str = style_str.replace("true", "True").replace("false", "False").replace("null", "None")

            return f"{imports_str}\n\nplt.rcParams.update({style_str})\n\n{cleaned_code}"
        except Exception as e:
            logger.exception("Error standardizing user code")
            return raw_code