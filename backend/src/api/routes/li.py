from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.src.api.models.li import RunIndicatorsRequest, RunIndicatorsResponse
from backend.src.api.db import get_db
from backend.src.api.db_models import User
from backend.src.api.deps import get_current_user
from backend.src.api.services.datasets import require_dataset_owner, require_dataset_owner_for_filename
from backend.src.core.loader import DataLoader
from backend.src.api.services.storage import StorageService
from fastapi.responses import StreamingResponse
from pathlib import Path
import numpy as np
import anyio
import json

from backend.src.modules.li.li import LeadingIndicatorsModule 

router = APIRouter()
stream_router = APIRouter()

storage = StorageService()

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

def sse_event(payload: Dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

@router.post("/run", response_model=RunIndicatorsResponse)
def run_leading_indicators(
    request: RunIndicatorsRequest,
    x_llm_api_key: Optional[str] = Header(default=None, alias="x-llm-api-key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        require_dataset_owner(db, current_user.id, request.file_id)
        loader = DataLoader(data_folder_name="uploads", storage=storage)
        
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
            file_id=request.file_id,
            user_api_key=x_llm_api_key,
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

    key = storage.join_key("outputs", safe_name)
    if not storage.exists(key):
        raise HTTPException(status_code=404, detail="Requested file was not found")

    return StreamingResponse(
        storage.stream_object(key),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={safe_name}"},
    )


@stream_router.post("/leading-indicators")
async def stream_leading_indicators(
    request: RunIndicatorsRequest,
    x_llm_api_key: Optional[str] = Header(default=None, alias="x-llm-api-key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    loader = DataLoader(data_folder_name="uploads", storage=storage)

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

    async def event_stream():
        try:
            yield sse_event({"status": "progress", "stage": "Sending request to LLM..."})
            generator = module.generator
            if x_llm_api_key:
                generator = module.generator.__class__(api_key=x_llm_api_key)

            queries = await anyio.to_thread.run_sync(
                generator.generate,
                request.target_col,
                request.region,
                request.extra_info or "",
            )

            if not queries:
                raise ValueError("Failed to generate queries.")

            yield sse_event({"status": "progress", "stage": "Fetching data from Google Trends..."})
            trends_df = await anyio.to_thread.run_sync(module.fetcher.fetch_data, queries, request.geo or "UA")

            if trends_df.empty:
                raise ValueError("Google Trends data is missing.")

            trends_key = storage.join_key("outputs", f"raw_trends_{request.file_id}.csv")
            await anyio.to_thread.run_sync(storage.write_csv, trends_key, trends_df, True)

            yield sse_event({"status": "progress", "stage": "Finalizing calculations..."})
            results_df = await anyio.to_thread.run_sync(
                module.analyzer.calculate_lags,
                df,
                request.target_col,
                trends_df,
            )

            final_key = storage.join_key("outputs", f"correlations_{request.file_id}.csv")
            await anyio.to_thread.run_sync(storage.write_csv, final_key, results_df, False)

            top_results_df = results_df.head(10).replace({float('nan'): None})
            top_results_list = top_results_df.to_dict(orient="records")
            safe_results = convert_numpy_types(top_results_list)

            final_payload = {
                "status": "done",
                "data": {
                    "status": "success",
                    "queries_generated": queries,
                    "trends_file": trends_key,
                    "correlations_file": final_key,
                    "top_results": safe_results,
                },
            }
            yield sse_event(final_payload)
        except Exception as exc:
            yield sse_event({"status": "error", "message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )