import json
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path
import ast

class StyleRemover(ast.NodeTransformer):
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
    