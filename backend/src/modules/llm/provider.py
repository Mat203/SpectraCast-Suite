from typing import Optional
from fastapi import HTTPException

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
