from fastapi import APIRouter, Depends, HTTPException, Request, Response
from typing import Optional
import requests
import httpx

from backend.src.api.deps import get_current_user
from backend.src.api.db_models import User
from backend.src.api.models.llm import LlmProxyRequest

router = APIRouter()

PROVIDER_ENDPOINTS = {
    "openai": "https://api.openai.com/v1/chat/completions",
    "anthropic": "https://api.anthropic.com/v1/messages",
    "google": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
}


def build_provider_request(
    provider: str,
    model: str,
    prompt: str,
    max_tokens: int,
    temperature: Optional[float],
    api_key: str,
):
    prompt_text = prompt.strip() if prompt and prompt.strip() else "Ping"
    max_output_tokens = max(1, max_tokens)

    if provider == "openai":
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt_text}],
            "max_tokens": max_output_tokens,
        }
        if temperature is not None:
            payload["temperature"] = temperature
        return PROVIDER_ENDPOINTS[provider], headers, payload

    if provider == "anthropic":
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt_text}],
            "max_tokens": max_output_tokens,
        }
        if temperature is not None:
            payload["temperature"] = temperature
        return PROVIDER_ENDPOINTS[provider], headers, payload

    if provider == "google":
        headers = {
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt_text}],
                }
            ],
            "generationConfig": {
                "maxOutputTokens": max_output_tokens,
            },
        }
        if temperature is not None:
            payload["generationConfig"]["temperature"] = temperature
        return PROVIDER_ENDPOINTS[provider].format(model=model), headers, payload

    raise HTTPException(status_code=400, detail="Unsupported provider")


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