import unittest
import ast
import pandas as pd
from unittest.mock import patch, MagicMock

from backend.src.modules.vs.vs import VisualStandardizer, _StyleRemover

class TestVisualStandardizer(unittest.TestCase):

    def test_style_remover_strips_styling_kwargs(self):
        raw_code = "plt.plot(x, y, color='red', lw=2, label='Trend', fontsize=12)"
        tree = ast.parse(raw_code)
        
        cleaned_tree = _StyleRemover().visit(tree)
        cleaned_code = ast.unparse(cleaned_tree)
        
        self.assertNotIn("color=", cleaned_code)
        self.assertNotIn("lw=", cleaned_code)
        self.assertNotIn("fontsize=", cleaned_code)
        self.assertIn("label='Trend'", cleaned_code)

    @patch('backend.src.modules.vs.vs.VisualStandardizer._apply_style_from_config')
    def test_standardize_user_code_valid(self, mock_apply):
        vs = VisualStandardizer()
        user_code = "ax.set_title('My Chart', color='blue', fontweight='bold')"
        
        result = vs.standardize_user_code(user_code)
        
        self.assertIn("import matplotlib.pyplot as plt", result)
        self.assertIn("spectra_style =", result)
        self.assertIn("plt.rcParams.update(spectra_style)", result)
        
        self.assertNotIn("color=", result)
        self.assertNotIn("fontweight=", result)
        self.assertIn("ax.set_title('My Chart')", result)

    @patch('backend.src.modules.vs.vs.VisualStandardizer._apply_style_from_config')
    def test_standardize_user_code_syntax_error(self, mock_apply):
        vs = VisualStandardizer()
        invalid_code = "plt.plot(x, y, color='red'"
        
        result = vs.standardize_user_code(invalid_code)
        
        self.assertEqual(result, invalid_code)

    @patch('backend.src.modules.vs.vs.plt.subplots')
    @patch('backend.src.modules.vs.vs.VisualStandardizer._apply_style_from_config')
    def test_plot_time_series_missing_column(self, mock_apply, mock_subplots):
        vs = VisualStandardizer()
        df = pd.DataFrame({'Date': [1, 2], 'Price': [100, 105]})
        
        vs.plot_time_series(df, column='Volume', title='Test', filename='test.png')
        
        mock_subplots.assert_not_called()

    @patch('backend.src.modules.vs.vs.plt.close')
    @patch('backend.src.modules.vs.vs.plt.subplots')
    @patch('backend.src.modules.vs.vs.VisualStandardizer._apply_style_from_config')
    def test_plot_time_series_execution(self, mock_apply, mock_subplots, mock_close):
        vs = VisualStandardizer()
        df = pd.DataFrame({'Price': [100, 105]}, index=[1, 2])
        
        mock_fig = MagicMock()
        mock_ax = MagicMock()
        mock_subplots.return_value = (mock_fig, mock_ax)
        
        vs.plot_time_series(df, column='Price', title='Test Title', filename='test.png')
        
        mock_ax.plot.assert_called_once()
        mock_fig.savefig.assert_called_once()
        mock_close.assert_called_once_with(mock_fig)

if __name__ == '__main__':
    unittest.main()