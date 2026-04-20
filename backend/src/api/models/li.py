from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class RunIndicatorsRequest(BaseModel):
    file_id: str
    target_col: str
    region: str
    geo: Optional[str] = "UA"
    extra_info: Optional[str] = ""

class RunIndicatorsResponse(BaseModel):
    status: str
    queries_generated: List[str]
    trends_file: str
    correlations_file: str
    top_results: List[Dict[str, Any]]