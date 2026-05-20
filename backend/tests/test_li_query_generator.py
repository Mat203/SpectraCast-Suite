from types import SimpleNamespace

import pytest

from backend.src.modules.li.query_generator import QueryGenerator


def test_extract_text_google():
    generator = QueryGenerator(api_key="x", provider="google")
    payload = {
        "candidates": [{"content": {"parts": [{"text": "q1, q2"}]}}],
    }

    assert generator._extract_text(payload) == "q1, q2"


def test_extract_text_openai():
    generator = QueryGenerator(api_key="x", provider="openai")
    payload = {"choices": [{"message": {"content": "q1, q2"}}]}

    assert generator._extract_text(payload) == "q1, q2"


def test_extract_text_unsupported_provider_raises():
    generator = QueryGenerator(api_key="x", provider="google")
    generator.provider = "unsupported"

    with pytest.raises(RuntimeError, match="Unsupported provider"):
        generator._extract_text({})


def test_generate_parses_comma_separated(monkeypatch):
    generator = QueryGenerator(api_key="x", provider="google")

    def fake_build_provider_request(**_kwargs):
        return "http://fake", {}, {}

    class FakeResponse:
        ok = True

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "a, b, c, d, e"}]}}]}

    def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr("backend.src.modules.li.query_generator.build_provider_request", fake_build_provider_request)
    monkeypatch.setattr("backend.src.modules.li.query_generator.requests.post", fake_post)

    result = generator.generate("target", "region")

    assert result == ["a", "b", "c", "d", "e"]


def test_generate_falls_back_to_newlines(monkeypatch):
    generator = QueryGenerator(api_key="x", provider="google")

    def fake_build_provider_request(**_kwargs):
        return "http://fake", {}, {}

    class FakeResponse:
        ok = True

        def json(self):
            text = "- q1\n- q2\n- q3\n- q4\n- q5"
            return {"candidates": [{"content": {"parts": [{"text": text}]}}]}

    def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr("backend.src.modules.li.query_generator.build_provider_request", fake_build_provider_request)
    monkeypatch.setattr("backend.src.modules.li.query_generator.requests.post", fake_post)

    result = generator.generate("target", "region")

    assert result == ["q1", "q2", "q3", "q4", "q5"]


def test_generate_raises_on_failed_request(monkeypatch):
    generator = QueryGenerator(api_key="x", provider="google")

    def fake_build_provider_request(**_kwargs):
        return "http://fake", {}, {}

    class FakeResponse:
        ok = False
        status_code = 500
        text = "boom"

    def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr("backend.src.modules.li.query_generator.build_provider_request", fake_build_provider_request)
    monkeypatch.setattr("backend.src.modules.li.query_generator.requests.post", fake_post)

    with pytest.raises(RuntimeError, match="LLM request failed"):
        generator.generate("target", "region")


def test_generate_raises_on_invalid_json(monkeypatch):
    generator = QueryGenerator(api_key="x", provider="google")

    def fake_build_provider_request(**_kwargs):
        return "http://fake", {}, {}

    class FakeResponse:
        ok = True
        text = "not-json"

        def json(self):
            raise ValueError("bad json")

    def fake_post(*_args, **_kwargs):
        return FakeResponse()

    monkeypatch.setattr("backend.src.modules.li.query_generator.build_provider_request", fake_build_provider_request)
    monkeypatch.setattr("backend.src.modules.li.query_generator.requests.post", fake_post)

    with pytest.raises(RuntimeError, match="LLM response was not valid JSON"):
        generator.generate("target", "region")
