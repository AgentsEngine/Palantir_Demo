"""Shared AI settings helpers.

The demo still keeps settings in memory, but all AI entrypoints should read
through this module so runtime, knowledge chat, and provider tests do not
import API modules from each other.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from .schemas import AIProviderConfig


DEFAULT_ROLE_POLICIES: list[dict[str, Any]] = [
    {
        "role": "admin",
        "enabled": True,
        "capabilities": ["qa", "rag", "business_query", "report", "draft", "save_draft", "workflow", "config"],
        "domains": ["production", "quality", "maintenance", "supply-chain", "workflow", "low-code"],
        "agentMode": "save_after_confirm",
    },
    {
        "role": "production_manager",
        "enabled": True,
        "capabilities": ["qa", "rag", "business_query", "report", "draft", "save_draft", "workflow"],
        "domains": ["production", "maintenance", "workflow"],
        "agentMode": "save_after_confirm",
    },
    {
        "role": "quality_engineer",
        "enabled": True,
        "capabilities": ["qa", "rag", "business_query", "report", "draft", "save_draft"],
        "domains": ["quality"],
        "agentMode": "save_after_confirm",
    },
    {
        "role": "maintenance_manager",
        "enabled": True,
        "capabilities": ["qa", "rag", "business_query", "report", "draft", "save_draft"],
        "domains": ["maintenance"],
        "agentMode": "save_after_confirm",
    },
    {
        "role": "supply_chain_manager",
        "enabled": True,
        "capabilities": ["qa", "rag", "business_query", "report", "draft", "save_draft"],
        "domains": ["supply-chain"],
        "agentMode": "save_after_confirm",
    },
    {
        "role": "viewer",
        "enabled": True,
        "capabilities": ["qa", "rag", "report"],
        "domains": ["production", "quality", "maintenance", "supply-chain"],
        "agentMode": "readonly",
    },
]


AI_SYSTEM_SETTINGS: dict[str, Any] = {
    "aiEnabled": True,
    "provider": "glm",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "apiKey": "",
    "chatModel": "glm-5.1",
    "reasoningModel": "glm-5.1",
    "embeddingModel": "embedding-3",
    "visionModel": "glm-4v-plus",
    "agentMode": "draft",
    "ragEnabled": True,
    "guestAccess": "disabled",
    "rolePolicies": DEFAULT_ROLE_POLICIES,
    "riskPolicy": {
        "low": "allow",
        "medium": "confirm",
        "high": "confirm_and_audit",
        "critical": "blocked",
    },
    "forbiddenActions": ["auto_order", "delete_data", "change_permission"],
}


def get_ai_settings() -> dict[str, Any]:
    """Return a mutable in-memory settings object for the current demo runtime."""

    return AI_SYSTEM_SETTINGS


def settings_snapshot() -> dict[str, Any]:
    """Return a defensive copy for prompt/runtime use."""

    return deepcopy(AI_SYSTEM_SETTINGS)


def settings_to_provider_config(settings_data: dict[str, Any] | None = None) -> AIProviderConfig:
    data = settings_data or AI_SYSTEM_SETTINGS
    return AIProviderConfig(
        provider=data.get("provider") or "glm",
        base_url=data.get("baseUrl") or data.get("base_url") or "",
        api_key=data.get("apiKey") or data.get("api_key") or "",
        organization=data.get("organization") or "",
        project=data.get("project") or "",
        chat_model=data.get("chatModel") or data.get("chat_model") or "glm-5.1",
        reasoning_model=data.get("reasoningModel") or data.get("reasoning_model") or "glm-5.1",
        embedding_model=data.get("embeddingModel") or data.get("embedding_model") or "embedding-3",
        vision_model=data.get("visionModel") or data.get("vision_model") or "glm-4v-plus",
        timeout_seconds=int(data.get("timeoutSeconds") or data.get("timeout_seconds") or 30),
    )


def mask_settings(settings_data: dict[str, Any]) -> dict[str, Any]:
    masked = {**settings_data}
    if masked.get("apiKey"):
        masked["apiKey"] = "********"
    return masked
