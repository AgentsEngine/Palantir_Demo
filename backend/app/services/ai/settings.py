"""Shared AI settings helpers.

The demo still keeps settings in memory, but all AI entrypoints should read
through this module so runtime, knowledge chat, and provider tests do not
import API modules from each other.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from sqlalchemy import select, text

from app.core.logging import get_logger

from .schemas import AIProviderConfig


logger = get_logger(__name__)
AI_SETTINGS_KEY = "ai.system"
_SYSTEM_SETTINGS_TABLE_ENSURED = False

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
    try:
        from app.config import settings as runtime_settings
    except Exception:  # pragma: no cover - config import should not block local tests
        runtime_settings = None

    env_api_key = ""
    env_base_url = ""
    env_chat_model = ""
    env_reasoning_model = ""
    env_embedding_model = ""
    env_vision_model = ""
    env_timeout_seconds = 30
    if runtime_settings is not None:
        env_api_key = getattr(runtime_settings, "AI_API_KEY", "") or getattr(runtime_settings, "OPENAI_API_KEY", "")
        env_base_url = getattr(runtime_settings, "AI_BASE_URL", "")
        env_chat_model = getattr(runtime_settings, "AI_CHAT_MODEL", "") or getattr(runtime_settings, "OPENAI_MODEL", "")
        env_reasoning_model = getattr(runtime_settings, "AI_REASONING_MODEL", "")
        env_embedding_model = getattr(runtime_settings, "AI_EMBEDDING_MODEL", "")
        env_vision_model = getattr(runtime_settings, "AI_VISION_MODEL", "")
        env_timeout_seconds = int(getattr(runtime_settings, "AI_TIMEOUT_SECONDS", 30) or 30)

    return AIProviderConfig(
        provider=data.get("provider") or "glm",
        base_url=data.get("baseUrl") or data.get("base_url") or env_base_url or "",
        api_key=data.get("apiKey") or data.get("api_key") or env_api_key,
        organization=data.get("organization") or "",
        project=data.get("project") or "",
        chat_model=data.get("chatModel") or data.get("chat_model") or env_chat_model or "glm-5.1",
        reasoning_model=data.get("reasoningModel") or data.get("reasoning_model") or env_reasoning_model or "glm-5.1",
        embedding_model=data.get("embeddingModel") or data.get("embedding_model") or env_embedding_model or "embedding-3",
        vision_model=data.get("visionModel") or data.get("vision_model") or env_vision_model or "glm-4v-plus",
        timeout_seconds=int(data.get("timeoutSeconds") or data.get("timeout_seconds") or env_timeout_seconds),
    )


def mask_settings(settings_data: dict[str, Any]) -> dict[str, Any]:
    masked = {**settings_data}
    if masked.get("apiKey"):
        masked["apiKey"] = "********"
    return masked


def merge_ai_settings(incoming: dict[str, Any], *, existing: dict[str, Any] | None = None) -> dict[str, Any]:
    clean_incoming = {**incoming}
    if clean_incoming.get("apiKey") == "********" or clean_incoming.get("api_key") == "********":
        clean_incoming.pop("apiKey", None)
        clean_incoming.pop("api_key", None)

    merged = {**(existing or AI_SYSTEM_SETTINGS), **clean_incoming}
    merged.setdefault("guestAccess", "disabled")
    merged.setdefault("rolePolicies", DEFAULT_ROLE_POLICIES)
    merged.setdefault("riskPolicy", {"low": "allow", "medium": "confirm", "high": "confirm_and_audit", "critical": "blocked"})
    merged.setdefault("forbiddenActions", ["auto_order", "delete_data", "change_permission"])
    return merged


async def load_persisted_ai_settings() -> dict[str, Any] | None:
    try:
        from app.core.db import db_session
        from app.models.relational import SystemSetting

        async with db_session() as session:
            await _ensure_system_settings_table(session)
            result = await session.execute(select(SystemSetting).where(SystemSetting.key == AI_SETTINGS_KEY))
            record = result.scalar_one_or_none()
            if not record or not isinstance(record.value, dict):
                return None
            merged = merge_ai_settings(record.value)
            AI_SYSTEM_SETTINGS.clear()
            AI_SYSTEM_SETTINGS.update(merged)
            return merged
    except Exception as exc:  # noqa: BLE001 - settings should fall back to env/in-memory
        logger.warning("AI settings DB load failed; using runtime defaults: %s", exc)
        return None


async def save_persisted_ai_settings(settings_data: dict[str, Any], *, updated_by: str | None = None) -> dict[str, Any]:
    from app.core.db import db_session
    from app.models.relational import SystemSetting

    existing = await load_persisted_ai_settings()
    merged = merge_ai_settings(settings_data, existing=existing or AI_SYSTEM_SETTINGS)

    async with db_session() as session:
        await _ensure_system_settings_table(session)
        result = await session.execute(select(SystemSetting).where(SystemSetting.key == AI_SETTINGS_KEY))
        record = result.scalar_one_or_none()
        if record is None:
            record = SystemSetting(
                key=AI_SETTINGS_KEY,
                value=merged,
                description="AI provider, permission, and runtime settings",
                updated_by=updated_by,
            )
            session.add(record)
        else:
            record.value = merged
            record.updated_by = updated_by
        await session.commit()

    AI_SYSTEM_SETTINGS.clear()
    AI_SYSTEM_SETTINGS.update(merged)
    return merged


async def _ensure_system_settings_table(session) -> None:
    global _SYSTEM_SETTINGS_TABLE_ENSURED
    if _SYSTEM_SETTINGS_TABLE_ENSURED:
        return

    bind = session.get_bind()
    dialect_name = bind.dialect.name if bind is not None else ""
    if dialect_name == "postgresql":
        id_column = "id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"
        value_type = "JSONB"
        key_column = '"key"'
    else:
        id_column = "id INTEGER PRIMARY KEY AUTOINCREMENT"
        value_type = "JSON"
        key_column = "key"

    await session.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS system_settings (
                {id_column},
                {key_column} VARCHAR(120) NOT NULL UNIQUE,
                value {value_type} NOT NULL DEFAULT '{{}}',
                description TEXT,
                updated_by VARCHAR(120),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
    await session.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS ix_system_settings_key ON system_settings ({key_column})"))
    await session.commit()
    _SYSTEM_SETTINGS_TABLE_ENSURED = True
