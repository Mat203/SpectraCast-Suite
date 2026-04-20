from pydantic import BaseModel
from typing import List

class StyleListResponse(BaseModel):
    styles: List[str]

class GeneratePlotRequest(BaseModel):
    file_id: str
    style_name: str
    x: str
    y: str
    plot_type: str
    output_filename: str

class GeneratePlotResponse(BaseModel):
    status: str
    plot_path: str

class StandardizeCodeRequest(BaseModel):
    raw_code: str
    style_name: str

class StandardizeCodeResponse(BaseModel):
    status: str
    cleaned_code: str