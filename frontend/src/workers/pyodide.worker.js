import { loadPyodide } from 'pyodide';

let pyodideReadyPromise;
const PYODIDE_INDEX_URL = import.meta.env.VITE_PYODIDE_INDEX_URL
  || 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

const initPyodide = async () => {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = (async () => {
      const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
      await pyodide.loadPackage(['pandas', 'numpy']);
      return pyodide;
    })();
  }
  return pyodideReadyPromise;
};

const serializeResult = async (pyodide) => {
  const serializer = `
import json
import numpy as np
import pandas as pd

result = globals().get("result")

def _serialize(value):
    if value is None:
        return {"type": "none", "value": None}
    if isinstance(value, pd.DataFrame):
        return {"type": "dataframe", "value": value.to_dict(orient="records")}
    if isinstance(value, pd.Series):
        return {"type": "series", "value": value.to_dict()}
    if isinstance(value, np.ndarray):
        return {"type": "ndarray", "value": value.tolist()}
    if isinstance(value, (list, dict, str, int, float, bool)):
        return {"type": "primitive", "value": value}
    return {"type": "repr", "value": repr(value)}

json.dumps(_serialize(result))
`;

  return pyodide.runPythonAsync(serializer);
};

self.onmessage = async (event) => {
  const { id, pythonCode, csvData, context, packages } = event.data || {};
  try {
    const pyodide = await initPyodide();
    if (Array.isArray(packages) && packages.length) {
      await pyodide.loadPackage(packages);
    }
    let stdout = '';
    let stderr = '';

    pyodide.setStdout({
      batched: (msg) => {
        stdout += msg;
      },
    });
    pyodide.setStderr({
      batched: (msg) => {
        stderr += msg;
      },
    });

    const safeContext = context || {};
    pyodide.globals.set('payload', pyodide.toPy(safeContext));
    pyodide.globals.set('csv_data', csvData || '');

    const bootstrap = `
import io
import pandas as pd
import numpy as np

csv_text = globals().get("csv_data")
if csv_text:
    df = pd.read_csv(io.StringIO(csv_text))
    df = df.replace(r'(?i)^\\s*(nan|none|null|na)?\\s*$', np.nan, regex=True)
    for col in df.columns:
        if df[col].dtype == 'object' or pd.api.types.is_string_dtype(df[col]):
            try:
                cleaned_series = df[col].replace(r'[%]', '', regex=True)
                df[col] = pd.to_numeric(cleaned_series)
            except (ValueError, TypeError):
                pass
else:
    df = None
`;
    await pyodide.runPythonAsync(bootstrap);

    await pyodide.runPythonAsync(pythonCode || '');

    const resultJson = await serializeResult(pyodide);
    const data = resultJson ? JSON.parse(resultJson) : null;

    self.postMessage({
      id,
      type: 'result',
      data,
      stdout,
      stderr,
    });
  } catch (err) {
    const message = err?.message || String(err);
    const kind = /out of memory|memory|oom/i.test(message) ? 'memory' : 'runtime';
    self.postMessage({
      id,
      type: 'error',
      error: {
        message,
        kind,
      },
    });
  }
};
