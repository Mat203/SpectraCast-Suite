from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from sqlalchemy.orm import Session
from backend.src.api.models.dq import (
    ScanRequest,
    CleanRequest,
    CleanResponse,
    OutlierActionRequest,
    MissingValueActionRequest,
    OutlierPreviewRequest,
    OutlierPreviewResponse,
    MissingPreviewRequest,
    MissingPreviewResponse,
    FixTimestampsRequest,
    FixTimestampsResponse,
    UndoRequest,
    UndoResponse,
    SaveModifiedRequest,
    SaveModifiedResponse,
)
from backend.src.api.db import get_db
from backend.src.api.db_models import User, Dataset
from backend.src.api.deps import get_current_user
from backend.src.api.services.datasets import require_dataset_owner
from backend.src.api.services.storage import StorageService
from backend.src.core.loader import DataLoader
from backend.src.modules.dq.scanner import DataScanner
from backend.src.modules.dq.cleaner import DataCleaner
from backend.src.modules.dq.outliers import apply_outlier_strategy, preview_outlier_strategy
from backend.src.modules.dq.missing import apply_missing_strategy, preview_missing_strategy
from backend.src.modules.dq.time_tools import fix_time_axis
from fastapi.responses import StreamingResponse
import numpy as np
import pandas as pd
import os

router = APIRouter()
storage = StorageService()


def get_dataset_key(file_id: str) -> str:
    return storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")


def get_previous_dataset_key(file_id: str) -> str:
    return storage.build_key(file_id, suffix="previous", ext="csv", prefix="uploads")


def cache_previous_dataset(file_id: str) -> None:
    dataset_key = get_dataset_key(file_id)
    if not storage.exists(dataset_key):
        raise HTTPException(status_code=404, detail="File not found or empty")

    storage.put_bytes(
        get_previous_dataset_key(file_id),
        storage.read_bytes(dataset_key),
        content_type="text/csv",
    )


def restore_previous_dataset(file_id: str) -> None:
    previous_key = get_previous_dataset_key(file_id)
    if not storage.exists(previous_key):
        raise HTTPException(status_code=400, detail="No previous state available to undo")

    storage.put_bytes(
        get_dataset_key(file_id),
        storage.read_bytes(previous_key),
        content_type="text/csv",
    )
    storage.delete(previous_key)

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
def scan_data(
    request: ScanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        require_dataset_owner(db, current_user.id, request.file_id)
        print(f"[SCAN] Starting scan for file_id: {request.file_id}")
        loader = DataLoader(data_folder_name="uploads", storage=storage)
        
        file_path = f"{request.file_id}_raw.csv"
        print(f"[SCAN] Loading CSV: {file_path}")
        df = loader.load_csv(file_path)

        if df is None:
            raise HTTPException(status_code=404, detail="File not found or empty")

        print(f"[SCAN] DataFrame loaded: {df.shape[0]} rows, {df.shape[1]} columns")
        scanner = DataScanner(df)
        report = scanner.run_health_check()
        clean_report = convert_numpy_types(report)

        if isinstance(df.index, pd.DatetimeIndex):
            preview_df = df.reset_index().replace({float('nan'): None})
        else:
            preview_df = df.copy().replace({float('nan'): None})
        clean_report["dataset_preview"] = preview_df.to_dict(orient="records")
        clean_report["has_previous_state"] = storage.exists(get_previous_dataset_key(request.file_id))
        
        dataset = db.query(Dataset).filter(Dataset.file_uuid == request.file_id).first()
        clean_report["is_modified"] = dataset.is_modified if dataset else False
        
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
def clean_data(
    request: CleanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    loader = DataLoader(data_folder_name="uploads", storage=storage)
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

    file_id_safe = os.path.basename(request.file_id)
    save_key = storage.join_key("outputs", f"{file_id_safe}_cleaned.csv")
    storage.write_csv(save_key, cleaner.df, include_index=True)

    return CleanResponse(
        status="success",
        message="Data cleaned successfully",
        saved_path=save_key
    )

@router.post("/handle-outliers")
def handle_outliers(
    request: OutlierActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    loader = DataLoader(data_folder_name="uploads", storage=storage)
    file_path = f"{request.file_id}_raw.csv"
    df = loader.load_csv(file_path)

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    cache_previous_dataset(request.file_id)

    try:
        df = apply_outlier_strategy(df, request.column, request.strategy)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if isinstance(df.index, pd.DatetimeIndex):
        df_to_save = df.copy()
        if df_to_save.index.name is None:
            df_to_save.index.name = "Date"
        storage.write_csv(storage.join_key("uploads", file_path), df_to_save, include_index=True)
    else:
        storage.write_csv(storage.join_key("uploads", file_path), df, include_index=False)

    return {"status": "success", "message": f"Successfully applied {request.strategy} to {request.column}"}

@router.post("/preview-outliers", response_model=OutlierPreviewResponse)
def preview_outliers(
    request: OutlierPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    loader = DataLoader(data_folder_name="uploads", storage=storage)
    file_path = f"{request.file_id}_raw.csv"
    df = loader.load_csv(file_path)

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    try:
        preview = preview_outlier_strategy(df, request.column, request.strategy)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return OutlierPreviewResponse(**preview)

@router.post("/handle-missing")
def handle_missing(
    request: MissingValueActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    loader = DataLoader(data_folder_name="uploads", storage=storage)
    file_path = f"{request.file_id}_raw.csv"
    df = loader.load_csv(file_path)

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    cache_previous_dataset(request.file_id)

    try:
        updated_df = apply_missing_strategy(df, request.column, request.strategy)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if isinstance(updated_df.index, pd.DatetimeIndex):
        df_to_save = updated_df.copy()
        if df_to_save.index.name is None:
            df_to_save.index.name = "Date"
        storage.write_csv(storage.join_key("uploads", file_path), df_to_save, include_index=True)
    else:
        storage.write_csv(storage.join_key("uploads", file_path), updated_df, include_index=False)

    return {"status": "success", "message": f"Successfully applied strategy {request.strategy} for missing values in {request.column}"}

@router.post("/fix-timestamps", response_model=FixTimestampsResponse)
def fix_timestamps(
    request: FixTimestampsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    loader = DataLoader(data_folder_name="uploads", storage=storage)
    file_path = f"{request.file_id}_raw.csv"
    df = loader.load_csv(file_path)

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    cache_previous_dataset(request.file_id)

    try:
        updated_df, inserted_rows, preview_records = fix_time_axis(df)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    storage.write_csv(storage.join_key("uploads", file_path), updated_df, include_index=False)

    return FixTimestampsResponse(
        status="success",
        inserted_rows=inserted_rows,
        dataset_preview=preview_records,
    )


@router.post("/undo", response_model=UndoResponse)
def undo_last_change(
    request: UndoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    restore_previous_dataset(request.file_id)

    return UndoResponse(
        status="success",
        message="Previous dataset state restored",
        has_previous_state=False,
    )

@router.post("/save-modified", response_model=SaveModifiedResponse)
def save_modified_dataset(
    request: SaveModifiedRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    
    dataset = db.query(Dataset).filter(Dataset.file_uuid == request.file_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    dataset.is_modified = True
    db.commit()
    
    previous_key = get_previous_dataset_key(request.file_id)
    if storage.exists(previous_key):
        storage.delete(previous_key)
    
    return SaveModifiedResponse(
        status="success",
        message="Dataset saved successfully",
        is_modified=True,
    )

@router.post("/preview-missing", response_model=MissingPreviewResponse)
def preview_missing(
    request: MissingPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    loader = DataLoader(data_folder_name="uploads", storage=storage)
    file_path = f"{request.file_id}_raw.csv"
    df = loader.load_csv(file_path)

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    try:
        preview = preview_missing_strategy(df, request.column, request.strategy)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return MissingPreviewResponse(**preview)

@router.get("/download/{file_id}")
def download_dataset(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, file_id)
    key = storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    if not storage.exists(key):
        raise HTTPException(status_code=404, detail="Dataset not found")

    return StreamingResponse(
        storage.stream_object(key),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=updated_dataset_{file_id}.csv"},
    )