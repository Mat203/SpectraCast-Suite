from pydantic import BaseModel
from typing import Dict, Any, List, Optional

class ScanRequest(BaseModel):
    file_id: str

class CleanRequest(BaseModel):
    file_id: str
    align_index: bool = False
    imputation_methods: Dict[str, str] = {}
    outlier_methods: Dict[str, str] = {}

class CleanResponse(BaseModel):
    status: str
    message: str
    saved_path: str

class OutlierActionRequest(BaseModel):
    file_id: str
    column: str
    strategy: str

class MissingValueActionRequest(BaseModel):
    file_id: str
    column: str
    strategy: str