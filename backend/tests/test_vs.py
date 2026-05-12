import ast
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd

from backend.src.modules.vs.code_cleaner import StyleRemover
from backend.src.modules.vs.visualizer import VisualStandardizer
from backend.src.modules.vs.vs import PlotEngine


def test_style_remover_strips_style_kwargs():
    raw_code = "plt.plot(x, y, color='red', lw=2, label='Trend', fontsize=12)"
    tree = ast.parse(raw_code)

    cleaned_tree = StyleRemover().visit(tree)
    cleaned_code = ast.unparse(cleaned_tree)

    assert "color=" not in cleaned_code
    assert "lw=" not in cleaned_code
    assert "fontsize=" not in cleaned_code
    assert "label='Trend'" in cleaned_code


def test_standardize_user_code_valid():
    user_code = "ax.set_title('My Chart', color='blue', fontweight='bold')"

    result = VisualStandardizer().standardize_user_code(user_code)

    assert "import matplotlib.pyplot as plt" in result
    assert "plt.rcParams.update(" in result
    assert "color=" not in result
    assert "fontweight=" not in result
    assert "ax.set_title('My Chart')" in result


def test_standardize_user_code_syntax_error_returns_input():
    invalid_code = "plt.plot(x, y, color='red'"

    result = VisualStandardizer().standardize_user_code(invalid_code)

    assert result == invalid_code


def test_generate_plot_line_calls_plot(tmp_path: Path):
    engine = PlotEngine(output_dir=tmp_path / "outputs", config_dir=tmp_path / "styles")
    df = pd.DataFrame({"Price": [100, 105]}, index=["2021", "2022"])

    with patch("backend.src.modules.vs.vs.plt.subplots") as mock_subplots:
        mock_fig = MagicMock()
        mock_ax = MagicMock()
        mock_subplots.return_value = (mock_fig, mock_ax)

        engine.generate_plot(df, x_col="", y_cols=["Price"], chart_type="1", filename="test_line.png")

        mock_ax.plot.assert_called_once()
        mock_fig.savefig.assert_called_once()


def test_generate_plot_bar_calls_bar_for_each_series(tmp_path: Path):
    engine = PlotEngine(output_dir=tmp_path / "outputs", config_dir=tmp_path / "styles")
    df = pd.DataFrame({"Price": [100, 105], "Cost": [50, 55]}, index=["2021", "2022"])

    with patch("backend.src.modules.vs.vs.plt.subplots") as mock_subplots:
        mock_fig = MagicMock()
        mock_ax = MagicMock()
        mock_subplots.return_value = (mock_fig, mock_ax)

        engine.generate_plot(df, x_col="", y_cols=["Price", "Cost"], chart_type="2", filename="test_bar.png")

        assert mock_ax.bar.call_count == 2
        mock_fig.savefig.assert_called_once()


def test_generate_plot_scatter_calls_scatter(tmp_path: Path):
    engine = PlotEngine(output_dir=tmp_path / "outputs", config_dir=tmp_path / "styles")
    df = pd.DataFrame({"Price": [100, 105], "Volume": [10, 12]}, index=["2021", "2022"])

    with patch("backend.src.modules.vs.vs.plt.subplots") as mock_subplots:
        mock_fig = MagicMock()
        mock_ax = MagicMock()
        mock_subplots.return_value = (mock_fig, mock_ax)

        engine.generate_plot(df, x_col="Volume", y_cols=["Price"], chart_type="3", filename="test_scatter.png")

        mock_ax.scatter.assert_called_once()
        mock_fig.savefig.assert_called_once()
