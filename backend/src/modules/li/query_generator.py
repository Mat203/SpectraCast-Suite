import logging
import os
from typing import Any, Dict, List, Optional
import requests
from dotenv import load_dotenv

from backend.src.api.routes.llm import build_provider_request

class QueryGenerator:
    def __init__(
        self,
        api_key: Optional[str] = None,
        provider: str = "google",
        model: str = "gemini-2.5-flash-lite",
    ):
        load_dotenv()
        self.logger = logging.getLogger(__name__)
        resolved_provider = (provider or os.getenv("LLM_PROVIDER") or "google").strip().lower()
        resolved_model = model.strip() if model and model.strip() else os.getenv("LLM_MODEL", model)

        resolved_key = api_key.strip() if api_key else None
        if not resolved_key:
            resolved_key = os.getenv("LLM_API_KEY")
        if not resolved_key:
            if resolved_provider == "google":
                resolved_key = os.getenv("GEMINI_API_KEY")
            elif resolved_provider == "openai":
                resolved_key = os.getenv("OPENAI_API_KEY")
            elif resolved_provider == "anthropic":
                resolved_key = os.getenv("ANTHROPIC_API_KEY")

        if not resolved_key:
            raise ValueError("LLM API key not found.")

        self.provider = resolved_provider
        self.model = resolved_model
        self.api_key = resolved_key

    def generate(self, target_variable: str, region: str, extra_info: str = "") -> List[str]:
        prompt = f"""
        You are an expert economic data analyst. 
        Generate exactly 15 search queries for Google Trends that may precede or correlate with the dynamics of '{target_variable}' in the '{region}' region. 
        Additional context: {extra_info}
        
        Consider synonyms, slang, related products, and leading indicators in the primary language of that region.
        
        CRITICAL RULE: Return ONLY a comma-separated list of the 15 queries. 
        Do NOT include bullet points, numbers, quotes, markdown formatting (like ```), or any introductory/concluding text. 
        Example output format: query one, query two, query three
        """
        url, headers, payload = build_provider_request(
            provider=self.provider,
            model=self.model,
            prompt=prompt,
            max_tokens=200,
            temperature=0.3,
            api_key=self.api_key,
        )

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=20)
        except requests.RequestException as exc:
            self.logger.exception("LLM request failed: %s", exc)
            raise

        if not response.ok:
            self.logger.error("LLM request failed (HTTP %s): %s", response.status_code, response.text)
            raise RuntimeError(f"LLM request failed (HTTP {response.status_code})")

        try:
            response_json = response.json()
        except ValueError as exc:
            self.logger.error("LLM response was not valid JSON: %s", response.text)
            raise RuntimeError("LLM response was not valid JSON") from exc

        raw_text = self._extract_text(response_json)
        queries = [q.strip() for q in raw_text.split(',') if q.strip()]

        if len(queries) < 5 and "\n" in raw_text:
            queries = [q.strip().lstrip('-*0123456789. ') for q in raw_text.split("\n") if q.strip()]

        return queries[:15]

    def _extract_text(self, response_json: Dict[str, Any]) -> str:
        try:
            if self.provider == "openai":
                text = response_json["choices"][0]["message"]["content"]
            elif self.provider == "anthropic":
                text = response_json["content"][0]["text"]
            elif self.provider == "google":
                text = response_json["candidates"][0]["content"]["parts"][0]["text"]
            else:
                raise RuntimeError("Unsupported provider")
        except (KeyError, IndexError, TypeError) as exc:
            self.logger.error("Unexpected LLM response shape: %s", response_json)
            raise RuntimeError("Unexpected LLM response shape") from exc

        if not text or not text.strip():
            raise RuntimeError("LLM response text was empty")

        return text.strip()