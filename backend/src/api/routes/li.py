from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from sqlalchemy.orm import Session
from backend.src.api.models.li import RunIndicatorsRequest, RunIndicatorsResponse
from backend.src.api.db import get_db
from backend.src.api.db_models import User
from backend.src.api.deps import get_current_user
from backend.src.api.services.datasets import require_dataset_owner, require_dataset_owner_for_filename
from backend.src.core.loader import DataLoader
from fastapi.responses import FileResponse
from pathlib import Path
import numpy as np

from backend.src.modules.li.li import LeadingIndicatorsModule 

router = APIRouter()

BACKEND_DIR = Path(__file__).resolve().parents[3]
OUTPUTS_DIR = BACKEND_DIR / "outputs"

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

@router.post("/run", response_model=RunIndicatorsResponse)
def run_leading_indicators(
    request: RunIndicatorsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        require_dataset_owner(db, current_user.id, request.file_id)
        loader = DataLoader(data_folder_name="uploads")
        
        file_path_clean = f"{request.file_id}_cleaned.csv"
        file_path_raw = f"{request.file_id}_raw.csv"
        
        df = loader.load_csv(file_path_clean)
        if df is None:
            df = loader.load_csv(file_path_raw)
            
        if df is None:
            raise HTTPException(status_code=404, detail="Dataset not found. Please upload a file first.")

        if request.target_col not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{request.target_col}' not found in dataset.")

        module = LeadingIndicatorsModule()
        queries, trends_path, corr_path, results_df = module.run_api(
            primary_df=df,
            target_col=request.target_col,
            region=request.region,
            geo=request.geo or "UA",
            extra=request.extra_info or "",
            file_id=request.file_id
        )

        top_results_df = results_df.head(10).replace({float('nan'): None})
        top_results_list = top_results_df.to_dict(orient="records")
        safe_results = convert_numpy_types(top_results_list)

        return RunIndicatorsResponse(
            status="success",
            queries_generated=queries,
            trends_file=trends_path,
            correlations_file=corr_path,
            top_results=safe_results
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Leading Indicators module failed: {str(e)}")


@router.get("/download/{filename}")
def download_output_file(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner_for_filename(db, current_user.id, filename)
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not safe_name.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV downloads are supported")

    file_path = OUTPUTS_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Requested file was not found")

    return FileResponse(
        path=file_path,
        media_type="text/csv",
        filename=safe_name,
    )