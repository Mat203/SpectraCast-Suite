import unittest
import ast
import pandas as pd
from unittest.mock import patch, MagicMock

from backend.src.modules.vs.visualizer import VisualStandardizer
from backend.src.modules.vs.code_cleaner import StyleRemover

class TestVisualStandardizer(unittest.TestCase):

    def setUp(self):
        self.vs = VisualStandardizer()

    def test_style_remover_strips_styling_kwargs(self):
        raw_code = "plt.plot(x, y, color='red', lw=2, label='Trend', fontsize=12)"
        tree = ast.parse(raw_code)
        
        cleaned_tree = StyleRemover().visit(tree)
        cleaned_code = ast.unparse(cleaned_tree)
        
        self.assertNotIn("color=", cleaned_code)
        self.assertNotIn("lw=", cleaned_code)
        self.assertNotIn("fontsize=", cleaned_code)
        self.assertIn("label='Trend'", cleaned_code)

    def test_standardize_user_code_valid(self):
        user_code = "ax.set_title('My Chart', color='blue', fontweight='bold')"
        
        result = self.vs.standardize_user_code(user_code)
        
        self.assertIn("import matplotlib.pyplot as plt", result)
        self.assertIn("plt.rcParams.update(", result)
        
        self.assertNotIn("color=", result)
        self.assertNotIn("fontweight=", result)
        self.assertIn("ax.set_title('My Chart')", result)

    def test_standardize_user_code_syntax_error(self):
        invalid_code = "plt.plot(x, y, color='red'"

        with patch('builtins.print') as mock_print:
            result = self.vs.standardize_user_code(invalid_code)
            mock_print.assert_called_once()
        
        self.assertEqual(result, invalid_code)

    @patch('matplotlib.pyplot.subplots')
    def test_generate_custom_plot_line(self, mock_subplots):
        df = pd.DataFrame({'Price': [100, 105]}, index=['2021', '2022'])
        
        mock_fig = MagicMock()
        mock_ax = MagicMock()
        mock_subplots.return_value = (mock_fig, mock_ax)
        
        self.vs.engine.generate_plot(df, x_col='', y_cols=['Price'], chart_type='1', filename='test_line.png')
        
        mock_ax.plot.assert_called_once()
        mock_fig.savefig.assert_called_once()

    @patch('matplotlib.pyplot.subplots')
    def test_generate_custom_plot_bar(self, mock_subplots):
        df = pd.DataFrame({'Price': [100, 105], 'Cost': [50, 55]}, index=['2021', '2022'])
        
        mock_fig = MagicMock()
        mock_ax = MagicMock()
        mock_subplots.return_value = (mock_fig, mock_ax)
        
        self.vs.engine.generate_plot(df, x_col='', y_cols=['Price', 'Cost'], chart_type='2', filename='test_bar.png')
        
        self.assertEqual(mock_ax.bar.call_count, 2)
        mock_fig.savefig.assert_called_once()
        
    @patch('matplotlib.pyplot.subplots')
    def test_generate_custom_plot_scatter(self, mock_subplots):
        df = pd.DataFrame({'Price': [100, 105], 'Volume': [10, 12]}, index=['2021', '2022'])
        
        mock_fig = MagicMock()
        mock_ax = MagicMock()
        mock_subplots.return_value = (mock_fig, mock_ax)
        
        self.vs.engine.generate_plot(df, x_col='Volume', y_cols=['Price'], chart_type='3', filename='test_scatter.png')
        
        mock_ax.scatter.assert_called_once()
        mock_fig.savefig.assert_called_once()

if __name__ == '__main__':
    unittest.main()