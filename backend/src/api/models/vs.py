from pydantic import BaseModel
from typing import List, Optional

class GeneratePlotRequest(BaseModel):
    file_id: str
    is_cleaned: bool = False
    x_col: Optional[str] = None
    y_cols: List[str]
    chart_type: str
    style_filename: Optional[str] = None

class GeneratePlotResponse(BaseModel):
    status: str
    plot_base64: str