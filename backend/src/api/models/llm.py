from typing import Optional

from pydantic import BaseModel, Field


class LlmProxyRequest(BaseModel):
    provider: str = Field(..., description="openai|anthropic|google")
    model: str
    prompt: str = "Ping"
    max_tokens: int = 1
    temperature: Optional[float] = 0.0
