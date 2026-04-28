from pydantic import BaseModel
from typing import List

class StyleListResponse(BaseModel):
    styles: List[str]

class GeneratePlotRequest(BaseModel):
    file_id: str
    style_name: str = ""
    style_filename: str = ""
    x: str = ""
    x_col: str = ""
    y: str = ""
    y_cols: List[str] = []
    plot_type: str = "1"
    chart_type: str = "1"
    output_filename: str = ""
    is_cleaned: bool = False

class GeneratePlotResponse(BaseModel):
    status: str
    plot_filename: str

class StandardizeCodeRequest(BaseModel):
    raw_code: str
    style_name: str

class StandardizeCodeResponse(BaseModel):
    status: str
    cleaned_code: str