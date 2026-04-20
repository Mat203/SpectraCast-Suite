from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from backend.src.api.models.li import RunIndicatorsRequest, RunIndicatorsResponse
from backend.src.core.loader import DataLoader
import numpy as np

from backend.src.modules.li.li import LeadingIndicatorsModule 

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

@router.post("/run", response_model=RunIndicatorsResponse)
def run_leading_indicators(request: RunIndicatorsRequest):
    try:
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
            geo=request.geo,
            extra=request.extra_info,
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