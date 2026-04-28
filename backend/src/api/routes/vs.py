from fastapi import APIRouter, HTTPException
import base64
import os
from pathlib import Path
from backend.src.api.models.vs import GeneratePlotRequest, GeneratePlotResponse
from backend.src.core.loader import DataLoader
from backend.src.modules.vs.vs import PlotEngine

router = APIRouter()

from pydantic import BaseModel
from typing import List

class StylesResponse(BaseModel):
    styles: List[str]

@router.get("/styles", response_model=StylesResponse)
def get_styles():
    from backend.src.modules.vs.style_manager import StyleManager
    manager = StyleManager()
    styles = []
    if manager.config_dir.exists():
        for file in manager.config_dir.glob("*.json"):
            styles.append(file.stem)
    return StylesResponse(styles=styles)

@router.post("/generate", response_model=GeneratePlotResponse)
def generate_plot(request: GeneratePlotRequest):
    if request.is_cleaned:
        loader = DataLoader(data_folder_name="outputs")
        filename = f"{request.file_id}_cleaned.csv"
    else:
        loader = DataLoader(data_folder_name="uploads")
        filename = f"{request.file_id}_raw.csv"

    df = loader.load_csv(filename)

    if df is None:
        raise HTTPException(status_code=404, detail="File not found or empty")

    backend_dir = Path(__file__).resolve().parents[4]

    engine = PlotEngine(
        output_dir=backend_dir / "outputs",
        config_dir=backend_dir / "style_config"
    )

    if request.style_filename:
        engine.apply_style(request.style_filename)

    file_id_safe = os.path.basename(request.file_id)
    output_filename = f"plot_{file_id_safe}.png"

    output_path = engine.generate_plot(
        df=df,
        x_col=request.x_col,
        y_cols=request.y_cols,
        chart_type=request.chart_type,
        filename=output_filename
    )

    if not output_path or not output_path.exists():
        raise HTTPException(status_code=500, detail="Failed to generate plot")

    with open(output_path, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

    return GeneratePlotResponse(
        status="success",
        plot_base64=encoded_string
    )