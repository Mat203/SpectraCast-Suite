import pytest


def test_llm_proxy_requires_header(auth_client):
    payload = {"provider": "openai", "model": "gpt", "prompt": "hi", "max_tokens": 10, "temperature": 0.1}

    response = auth_client.post("/api/llm/proxy", json=payload)

    assert response.status_code == 400


def test_llm_proxy_success(auth_client, monkeypatch):
    payload = {"provider": "openai", "model": "gpt", "prompt": "hi", "max_tokens": 10, "temperature": 0.1}

    class FakeResponse:
        def __init__(self):
            self.content = b"{}"
            self.status_code = 200
            self.headers = {"content-type": "application/json"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr("backend.src.api.routes.llm.httpx.AsyncClient", lambda: FakeClient())

    response = auth_client.post(
        "/api/llm/proxy",
        json=payload,
        headers={"x-llm-api-key": "key"},
    )

    assert response.status_code == 200
    assert response.content == b"{}"
