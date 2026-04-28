from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from backend.src.api.models.dq import ScanRequest, CleanRequest, CleanResponse
from backend.src.core.loader import DataLoader
from backend.src.modules.dq.scanner import DataScanner
from backend.src.modules.dq.cleaner import DataCleaner
from pathlib import Path
import numpy as np
from scipy import stats
import os

router = APIRouter()

def convert_numpy_types(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(i) for i in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj

@router.post("/scan", response_model=Dict[str, Any])
def scan_data(request: ScanRequest):
    try:
        print(f"[SCAN] Starting scan for file_id: {request.file_id}")
        loader = DataLoader(data_folder_name="uploads")
        
        file_path = f"{request.file_id}_raw.csv"
        print(f"[SCAN] Loading CSV: {file_path}")
        df = loader.load_csv(file_path)

        if df is None:
            raise HTTPException(status_code=404, detail="File not found or empty")

        print(f"[SCAN] DataFrame loaded: {df.shape[0]} rows, {df.shape[1]} columns")
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        clean_report = convert_numpy_types(report)

        preview_df = df.reset_index().replace({float('nan'): None})
        clean_report["dataset_preview"] = preview_df.to_dict(orient="records")
        print(f"[SCAN] Scan completed successfully")
        return clean_report
    except HTTPException:
        raise
    except Exception as e:
        print(f"[SCAN] Error during scan: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Scan failed: {str(e)}")

@router.post("/clean", response_model=CleanResponse)
def clean_data(request: CleanRequest):
    loader = DataLoader(data_folder_name="uploads")
    df = loader.load_csv(f"{request.file_id}_raw.csv")

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    scanner = DataScanner(df)
    report = scanner.run_health_check()

    cleaner = DataCleaner(df)

    if request.align_index and report.get('frequency', 'Unknown') != 'Unknown':
        cleaner.align_datetime_index(report['frequency'])

    for col, method in request.imputation_methods.items():
        if method not in [str(i) for i in range(1, 8)]:
            raise HTTPException(status_code=400, detail=f"Invalid imputation method for column {col}")
        cleaner.impute_column(col, method)

    for col, method in request.outlier_methods.items():
        if method not in ['1', '2', '3']:
            raise HTTPException(status_code=400, detail=f"Invalid outlier handling method for column {col}")

        cleaner.detect_and_handle_outliers(col, method)

    outputs_dir = loader.data_dir.parent / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)

    file_id_safe = os.path.basename(request.file_id)
    save_path = outputs_dir / f"{file_id_safe}_cleaned.csv"
    cleaner.df.to_csv(save_path)

    return CleanResponse(
        status="success",
        message="Data cleaned successfully",
        saved_path=str(save_path)
    )