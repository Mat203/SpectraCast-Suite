from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Optional
import httpx

from backend.src.api.deps import get_current_user
from backend.src.api.db_models import User
from backend.src.api.models.llm import LlmProxyRequest
from backend.src.modules.llm.provider import PROVIDER_ENDPOINTS, build_provider_request

router = APIRouter()

@router.post("/proxy")
async def proxy_llm(
    request: LlmProxyRequest,
    incoming_request: Request,
    current_user: User = Depends(get_current_user),
):
    api_key = incoming_request.headers.get("x-llm-api-key")
    if not api_key:
        raise HTTPException(status_code=400, detail="x-llm-api-key header is required")

    provider = request.provider.strip().lower()
    if provider not in PROVIDER_ENDPOINTS:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    url, headers, payload = build_provider_request(
        provider=provider,
        model=request.model,
        prompt=request.prompt,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
        api_key=api_key,
    )

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=20.0)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail="Failed to reach LLM provider") from exc

    media_type = response.headers.get("content-type", "application/json")
    return Response(content=response.content, status_code=response.status_code, media_type=media_type)