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

router = APIRouter()
storage = StorageService()

from pydantic import BaseModel
from typing import List

class StylesResponse(BaseModel):
    styles: List[str]


def build_plot_source_code(
    x_col: str,
    primary_cols: List[str],
    secondary_cols: List[str],
    chart_type: str,
    style_name: str,
) -> str:
    safe_secondary = secondary_cols
    safe_primary = primary_cols or ([] if safe_secondary else ["y"])
    primary_literal = ", ".join(f"'{col}'" for col in safe_primary)
    secondary_literal = ", ".join(f"'{col}'" for col in safe_secondary)
    all_cols = safe_primary + safe_secondary
    if not all_cols:
        all_cols = ["y"]
    lines: List[str] = [
        "import json",
        "import pandas as pd",
        "import matplotlib.pyplot as plt",
        "",
        "df = pd.read_csv('your_data.csv')",
        "",
    ]

    if style_name:
        style_file = style_name if style_name.endswith('.json') else f"{style_name}.json"
        lines.extend([
            f"with open('{style_file}', 'r') as f:",
            "    style = json.load(f)",
            "plt.rcParams.update(style)",
            "",
        ])

    if x_col:
        lines.append(f"x = df['{x_col}']")
    else:
        lines.append("x = df.index")

    lines.append("")
    lines.append("fig, ax = plt.subplots()")
    if safe_secondary:
        lines.append("ax2 = ax.twinx()")

    if chart_type == '2':
        lines.extend([
            "import numpy as np",
            "indices = np.arange(len(x))",
            f"total = max({len(all_cols)}, 1)",
            "bar_width = 0.8 / total",
            "offset = -((total - 1) / 2) * bar_width",
            f"for y_col in [{primary_literal}]:",
            "    ax.bar(indices + offset, df[y_col], width=bar_width, label=y_col)",
            "    offset += bar_width",
        ])
        if safe_secondary:
            lines.extend([
                f"for y_col in [{secondary_literal}]:",
                "    ax2.bar(indices + offset, df[y_col], width=bar_width, label=f'{y_col} (secondary)', alpha=0.8)",
                "    offset += bar_width",
            ])
        lines.append("ax.set_xticks(indices)")
        lines.append("ax.set_xticklabels(x, rotation=270, ha='right')")
    elif chart_type == '3':
        lines.extend([
            f"for y_col in [{primary_literal}]:",
            "    ax.scatter(x, df[y_col], label=y_col)",
        ])
        if safe_secondary:
            lines.extend([
                f"for y_col in [{secondary_literal}]:",
                "    ax2.scatter(x, df[y_col], label=f'{y_col} (secondary)')",
            ])
    else:
        lines.extend([
            f"for y_col in [{primary_literal}]:",
            "    ax.plot(x, df[y_col], label=y_col)",
        ])
        if safe_secondary:
            lines.extend([
                f"for y_col in [{secondary_literal}]:",
                "    ax2.plot(x, df[y_col], label=f'{y_col} (secondary)')",
            ])

    lines.extend([
        "ax.set_title('" + ", ".join(all_cols) + " vs " + (x_col or "Date") + "')",
        "ax.set_xlabel('" + (x_col or "Date") + "')",
        "ax.set_ylabel('Primary Values' if " + str(bool(primary_cols)) + " else 'Values')",
    ])
    if safe_secondary:
        lines.append("ax2.set_ylabel('Secondary Values')")

    lines.extend([
        "handles, labels = ax.get_legend_handles_labels()",
    ])
    if safe_secondary:
        lines.extend([
            "handles2, labels2 = ax2.get_legend_handles_labels()",
            "handles += handles2",
            "labels += labels2",
        ])
    lines.extend([
        "ax.legend(handles, labels, frameon=False)",
        "plt.tight_layout()",
        "plt.show()",
    ])

    return "\n".join(lines)

@router.get("/styles", response_model=StylesResponse)
def get_styles(current_user: User = Depends(get_current_user)):
    from backend.src.modules.vs.style_manager import StyleManager
    manager = StyleManager()
    styles = []
    if manager.config_dir.exists():
        for file in manager.config_dir.glob("*.json"):
            styles.append(file.stem)
    return StylesResponse(styles=styles)


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
