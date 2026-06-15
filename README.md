# SpectraCast Suite

SpectraCast Suite is an intelligent, privacy-first analytical workspace designed for data quality inspection, leading indicator discovery, and publication-ready charting.

---

## 1. Core Architecture

SpectraCast Suite is built as a decoupled full-stack application:

*   **Frontend**: React (TypeScript) bootstrapped with Vite, utilizing Zustand for state management, TailwindCSS for styling, and Pyodide (Python in WebAssembly) for local in-browser computation.
*   **Backend**: FastAPI (Python) web framework, SQLAlchemy ORM with PostgreSQL/SQLite database support, and S3-compatible object storage for dataset persistence.
*   **Analytics Engine**: Leveraging Pandas, NumPy, SciPy, scikit-learn, and Matplotlib for heavy analytical computing, chart styling, and data transformations.

---

## 2. Key Modules & Functionality

### Data Quality Module
The Data Quality module scans, cleans, and standardizes time-series and tabular datasets.
*   **Automated Scanning**: Analyzes datasets to report row counts, column types, missing value percentages, outlier counts, and timestamp consistency.
*   **Intelligent Recommendations**: Recommends optimal outlier-handling methods (IQR clipping, mean/median replacement, row dropping) and missing value imputation strategies (linear/spline interpolation, forward fill, seasonal mean, KNN imputation) based on skewness, volatility, and seasonal autocorrelations.
*   **Datetime Alignment**: Detects dataset frequencies (daily, business daily, weekly, monthly, quarterly) and automatically inserts missing timestamp gaps.
*   **Preview & Undo**: Interactive before/after visualization of applied strategies with a single-step undo mechanism.

### Leading Indicators Module
Designed for econometric and time-series analysis, this module identifies leading variables relative to a target metric.
*   **Lag Correlation**: Computes correlation coefficients across configurable lag windows (e.g., -12 to +12 steps).
*   **Streaming Analytics**: Features a Server-Sent Events (SSE) progress manager that streams analysis stages to the UI.
*   **Discovery Dashboard**: Ranks features by correlation strength and identifies optimal lead/lag times.

### Visual Standardizer Module
The Visual Standardizer generates standardized, publication-quality visualizations.
*   **Dual-Axis Charting**: Supports plotting columns on primary and secondary Y-axes.
*   **Zero-Baseline Alignment**: Synchronizes zero baselines on dual Y-axes to ensure visual clarity.
*   **Style Managers**: Packages style configurations (Corporate, Dark) dynamically driven by style sheets, allowing line, bar, and scatter charts to adopt consistent color cycles and styling parameters.
*   **Code Exporter**: Generates the exact Python Matplotlib code required to reproduce the visualization locally.

---

## 3. Privacy & Dual-Mode Execution

SpectraCast Suite features a hybrid computation architecture to respect data privacy:
*   **Remote Mode**: Data is uploaded to the secure S3-compatible cloud storage, and transformations are executed on the backend servers.
*   **Local Mode**: Utilizes Pyodide (Python compiled to WebAssembly) to run all data quality scans, imputation, and charting locally in the user's browser. Raw datasets never leave the local machine.
*   **Telemetry Privacy**: Integrated with PostHog telemetry to track anonymized strategy choices (strategy name, recommended strategy, dataset size) to improve recommendations. Telemetry is automatically excluded for localhost development and local mode sessions.

---

## 4. Setup & Installation

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables in a `.env` file:
   ```env
   DATABASE_URL=sqlite:///./sql_app.db
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_STORAGE_BUCKET_NAME=spectracast-bucket
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn backend.src.api.main:app --reload
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables in `.env` and `.env.development`:
   ```env
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   VITE_POSTHOG_KEY=your_posthog_key
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```

---

## 5. Verification & Testing

### Running Backend Tests
Execute unit tests and coverage reports using pytest:
```bash
.venv/bin/pytest
```

### Running Frontend Tests
Run Vitest unit tests:
```bash
npm run test:run
```
To run frontend type-checking:
```bash
npx tsc --noEmit
```