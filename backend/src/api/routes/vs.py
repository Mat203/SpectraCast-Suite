from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import os
from pathlib import Path
from sqlalchemy.orm import Session
from backend.src.api.models.vs import GeneratePlotRequest, GeneratePlotResponse, StandardizeCodeRequest, StandardizeCodeResponse
from backend.src.api.db import get_db
from backend.src.api.db_models import User
from backend.src.api.deps import get_current_user
from backend.src.api.services.datasets import require_dataset_owner, require_dataset_owner_for_filename
from backend.src.api.services.storage import StorageService
from backend.src.core.loader import DataLoader
from backend.src.modules.vs.vs import PlotEngine
from backend.src.modules.vs.visualizer import VisualStandardizer
from backend.src.modules.vs.code_builder import build_plot_source_code

router = APIRouter()
storage = StorageService()

from pydantic import BaseModel
from typing import List

class StylesResponse(BaseModel):
    styles: List[str]


@router.get("/styles", response_model=StylesResponse)
def get_styles(current_user: User = Depends(get_current_user)):
    from backend.src.modules.vs.style_manager import StyleManager
    manager = StyleManager()
    styles = []
    if manager.config_dir.exists():
        for file in manager.config_dir.glob("*.json"):
            styles.append(file.stem)
    return StylesResponse(styles=styles)


@router.get("/styles/{style_name}")
def get_style_config(
    style_name: str,
    current_user: User = Depends(get_current_user),
):
    from backend.src.modules.vs.style_manager import StyleManager
    import json
    
    manager = StyleManager()
    safe_name = style_name.strip().lower().replace(" ", "_")
    if safe_name.endswith(".json"):
        safe_name = safe_name[:-5]
        
    file_path = manager.config_dir / f"{safe_name}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Style '{style_name}' not found")
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/generate", response_model=GeneratePlotResponse)
def generate_plot(
    request: GeneratePlotRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, request.file_id)
    if request.is_cleaned:
        loader = DataLoader(data_folder_name="outputs", storage=storage)
        filename = f"{request.file_id}_cleaned.csv"
    else:
        loader = DataLoader(data_folder_name="uploads", storage=storage)
        filename = f"{request.file_id}_raw.csv"

    df = loader.load_csv(filename)

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    engine = PlotEngine(
        output_dir=Path(__file__).resolve().parents[3] / "outputs",
        config_dir=Path(__file__).resolve().parents[3] / "style_config"
    )

    if request.style_filename or request.style_name:
        engine.apply_style(request.style_filename or request.style_name)

    file_id_safe = os.path.basename(request.file_id)
    output_filename = f"plot_{file_id_safe}.png"
    
    x_col = request.x_col or request.x
    chart_type = request.chart_type or request.plot_type

    if request.y_axes:
        primary_cols = [axis.column for axis in request.y_axes if axis.axis != "secondary"]
        secondary_cols = [axis.column for axis in request.y_axes if axis.axis == "secondary"]
    else:
        y_cols = request.y_cols if request.y_cols else ([request.y] if request.y else [])
        primary_cols = y_cols
        secondary_cols = []

    output_path = engine.generate_plot(
        df=df,
        x_col=x_col,
        y_cols=primary_cols,
        chart_type=chart_type,
        filename=output_filename,
        secondary_cols=secondary_cols,
    )

    if not output_path or not output_path.exists():
        raise HTTPException(status_code=500, detail="Failed to generate plot")

    output_key = storage.join_key("outputs", output_filename)
    storage.put_bytes(output_key, output_path.read_bytes(), content_type="image/png")
    output_path.unlink(missing_ok=True)

    source_code = build_plot_source_code(
        x_col=x_col,
        primary_cols=primary_cols,
        secondary_cols=secondary_cols,
        chart_type=chart_type,
        style_name=request.style_filename or request.style_name,
    )

    return GeneratePlotResponse(
        status="success",
        plot_filename=output_filename,
        source_code=source_code,
    )

@router.get("/plot/{filename}")
def get_plot(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner_for_filename(db, current_user.id, filename)
    key = storage.join_key("outputs", filename)

    if not storage.exists(key):
        raise HTTPException(status_code=404, detail="Plot not found")

    return StreamingResponse(storage.stream_object(key), media_type="image/png")

@router.get("/download/{filename}")
def download_plot(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner_for_filename(db, current_user.id, filename)
    key = storage.join_key("outputs", filename)

    if not storage.exists(key):
        raise HTTPException(status_code=404, detail="Plot not found")

    return StreamingResponse(
        storage.stream_object(key),
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

@router.post("/standardize-code", response_model=StandardizeCodeResponse)
def standardize_code(
    request: StandardizeCodeRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        vs = VisualStandardizer()
        
        if request.style_name:
            style_filename = f"{request.style_name}.json" if not request.style_name.endswith('.json') else request.style_name
            vs.engine.apply_style(style_filename)
        
        cleaned_code = vs.standardize_user_code(request.raw_code)
        
        return StandardizeCodeResponse(
            status="success",
            cleaned_code=cleaned_code
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
