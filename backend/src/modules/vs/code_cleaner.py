import ast

class StyleRemover(ast.NodeTransformer):
    def __init__(self):
        self.style_args = {
            'color', 'c', 'linewidth', 'lw', 'linestyle', 'ls', 
            'fontsize', 'fontweight', 'figsize', 'marker', 
            'markersize', 'alpha', 'facecolor', 'edgecolor', 
            'palette', 'cmap', 'labelcolor'
        }
        self.plot_funcs = {
            'plot', 'scatter', 'bar', 'hist', 'axhline', 'axvline', 
            'set_xlabel', 'set_ylabel', 'tick_params', 'legend', 'title'
        }
        self.collected_imports = set()

    def visit_Import(self, node):
        for alias in node.names:
            as_part = f" as {alias.asname}" if alias.asname else ""
            self.collected_imports.add(f"import {alias.name}{as_part}")
        return None

    def visit_ImportFrom(self, node):
        names = ", ".join([f"{a.name} as {a.asname}" if a.asname else a.name for a in node.names])
        self.collected_imports.add(f"from {node.module} import {names}")
        return None

    def visit_Expr(self, node):
        if isinstance(node.value, ast.Call):
            func = node.value.func
            if isinstance(func, ast.Attribute):
                if func.attr == 'update' and isinstance(func.value, ast.Attribute) and func.value.attr == 'rcParams':
                    return None
                if func.attr == 'update' and isinstance(func.value, ast.Name) and func.value.id == 'rcParams':
                    return None
                if func.attr == 'use' and isinstance(func.value, ast.Attribute) and func.value.attr == 'style':
                    return None
        
        self.generic_visit(node)
        return node

    def visit_Assign(self, node):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            var_name = node.targets[0].id
            if any(term in var_name.lower() for term in ['style', 'theme', 'cfg', 'config']):
                if isinstance(node.value, ast.Dict):
                    return None
        
        self.generic_visit(node)
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        
        func_name = ""
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        if func_name in self.plot_funcs:
            node.keywords = [kw for kw in node.keywords if kw.arg not in self.style_args]
            
            if func_name == 'plot' and len(node.args) >= 2:
                last_arg = node.args[-1]
                if isinstance(last_arg, ast.Constant) and isinstance(last_arg.value, str):
                    fmt_chars = {'-', '--', ':', '.', 'o', 'g', 'r', 'b', 'y', 'k', '^'}
                    if any(char in last_arg.value for char in fmt_chars):
                        node.args.pop()
                        
        return node