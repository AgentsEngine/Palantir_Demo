"""LLM provider adapters."""

from __future__ import annotations

import base64
import hashlib
import mimetypes
from abc import ABC, abstractmethod
from urllib.parse import urljoin

import httpx

from .schemas import AIProviderConfig, ChatMessage, ChatOptions, ChatResult, EmbeddingResult, VisionExtractResult


EXTERNAL_PROVIDERS = {"openai-compatible", "openai", "azure-openai", "deepseek", "qwen", "glm"}


class ProviderConfigurationError(RuntimeError):
    """Raised when a provider is selected but required configuration is missing."""


def _http_error_detail(response: httpx.Response) -> str:
    try:
        return response.content.decode("utf-8", errors="replace")[:500]
    except Exception:  # pragma: no cover - httpx response content should decode
        return response.text[:500]


class LLMProvider(ABC):
    def __init__(self, config: AIProviderConfig):
        self.config = config

    @abstractmethod
    async def chat(self, messages: list[ChatMessage], options: ChatOptions | None = None) -> ChatResult:
        raise NotImplementedError

    @abstractmethod
    async def embed(self, texts: list[str], model: str | None = None) -> EmbeddingResult:
        raise NotImplementedError

    @abstractmethod
    async def vision_extract(self, file_name: str, content: bytes, model: str | None = None) -> VisionExtractResult:
        raise NotImplementedError


def _stable_embedding(text: str, dimensions: int = 16) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8", errors="ignore")).digest()
    values = []
    for index in range(dimensions):
        raw = digest[index] / 255
        values.append(round((raw * 2) - 1, 6))
    return values


class LocalMockProvider(LLMProvider):
    async def chat(self, messages: list[ChatMessage], options: ChatOptions | None = None) -> ChatResult:
        model = options.model if options and options.model else self.config.chat_model
        last_user = next((item.content for item in reversed(messages) if item.role == "user"), "")
        return ChatResult(
            provider=self.config.provider,
            model=model,
            content=f"Mock AI response for: {last_user}".strip(),
            usage={"mode": "local_mock"},
        )

    async def embed(self, texts: list[str], model: str | None = None) -> EmbeddingResult:
        return EmbeddingResult(
            provider=self.config.provider,
            model=model or self.config.embedding_model,
            embeddings=[_stable_embedding(text) for text in texts],
        )

    async def vision_extract(self, file_name: str, content: bytes, model: str | None = None) -> VisionExtractResult:
        if not self.config.api_key:
            raise ProviderConfigurationError(f"{self.config.provider} API key is not configured")
        if self.config.api_key == "test-key":
            return await super().vision_extract(file_name, content, model)

        selected_model = model or self.config.vision_model
        mime_type = mimetypes.guess_type(file_name)[0] or "image/png"
        image_url = f"data:{mime_type};base64,{base64.b64encode(content).decode('ascii')}"
        payload = {
            "model": selected_model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract all readable document text from this image. "
                                "Return clean Markdown only, preserving tables, dates, part codes, and low-confidence notes."
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            "temperature": 0.0,
            "max_tokens": 4096,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                response = await client.post(self._chat_completions_url(), json=payload, headers=headers)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = _http_error_detail(exc.response)
            raise ProviderConfigurationError(f"{self.config.provider} vision request failed: HTTP {exc.response.status_code} {detail}") from exc
        except httpx.HTTPError as exc:
            raise ProviderConfigurationError(f"{self.config.provider} vision request failed: {exc}") from exc

        data = response.json()
        markdown = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not markdown:
            raise ProviderConfigurationError(f"{self.config.provider} returned an empty vision response")
        return VisionExtractResult(
            provider=self.config.provider,
            model=data.get("model") or selected_model,
            markdown=markdown,
            confidence=0.8,
        )


class OpenAICompatibleProvider(LocalMockProvider):
    """OpenAI-compatible adapter shell used by GLM, Qwen, DeepSeek, and others.

    GLM, Qwen, DeepSeek, and many self-hosted gateways expose an OpenAI-style
    `/chat/completions` contract. Tests can still use the special `test-key`
    sentinel to avoid network calls.
    """

    def _chat_completions_url(self) -> str:
        base_url = (self.config.base_url or "").strip()
        if not base_url:
            if self.config.provider == "glm":
                base_url = "https://open.bigmodel.cn/api/paas/v4"
            else:
                raise ProviderConfigurationError(f"{self.config.provider} base URL is not configured")
        if base_url.endswith("/chat/completions"):
            return base_url
        return urljoin(f"{base_url.rstrip('/')}/", "chat/completions")

    async def chat(self, messages: list[ChatMessage], options: ChatOptions | None = None) -> ChatResult:
        if not self.config.api_key:
            raise ProviderConfigurationError(f"{self.config.provider} API key is not configured")
        if self.config.api_key == "test-key":
            return await super().chat(messages, options)

        model = options.model if options and options.model else self.config.chat_model
        payload = {
            "model": model,
            "messages": [message.model_dump() for message in messages],
            "temperature": options.temperature if options else 0.2,
            "max_tokens": options.max_tokens if options else 2048,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        if self.config.organization:
            headers["OpenAI-Organization"] = self.config.organization
        if self.config.project:
            headers["OpenAI-Project"] = self.config.project

        try:
            async with httpx.AsyncClient(timeout=self.config.timeout_seconds) as client:
                response = await client.post(self._chat_completions_url(), json=payload, headers=headers)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = _http_error_detail(exc.response)
            raise ProviderConfigurationError(f"{self.config.provider} request failed: HTTP {exc.response.status_code} {detail}") from exc
        except httpx.HTTPError as exc:
            raise ProviderConfigurationError(f"{self.config.provider} request failed: {exc}") from exc

        data = response.json()
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        if not content:
            raise ProviderConfigurationError(f"{self.config.provider} returned an empty chat response")
        return ChatResult(
            provider=self.config.provider,
            model=data.get("model") or model,
            content=content,
            usage=data.get("usage") or {},
        )

    async def embed(self, texts: list[str], model: str | None = None) -> EmbeddingResult:
        if not self.config.api_key:
            raise ProviderConfigurationError(f"{self.config.provider} API key is not configured")
        return await super().embed(texts, model)


def make_provider(config: AIProviderConfig) -> LLMProvider:
    if config.provider in {"local", "mock"}:
        return LocalMockProvider(config)
    if config.provider in EXTERNAL_PROVIDERS:
        return OpenAICompatibleProvider(config)
    raise ProviderConfigurationError(f"Unsupported AI provider: {config.provider}")
