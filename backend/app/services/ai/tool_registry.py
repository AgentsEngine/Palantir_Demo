"""Typed tool registry loaded from .agent configuration."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .agent_definition import load_tool_registry
from .skills import get_skill


RiskLevel = Literal["low", "medium", "high", "critical"]
SideEffect = Literal["read", "draft_write", "workflow_action", "external_write", "configuration_write"]


class ToolDefinition(BaseModel):
    name: str
    title: str
    description: str
    side_effect: SideEffect = "read"
    risk_level: RiskLevel = "low"
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    permission_check: str = "qa"
    dry_run_supported: bool = True
    audit_required: bool = False


def _load_tools() -> dict[str, ToolDefinition]:
    return {
        name: ToolDefinition(**{**payload, "name": payload.get("name") or name})
        for name, payload in load_tool_registry().items()
    }


def tool_registry() -> dict[str, ToolDefinition]:
    return _load_tools()


def list_tools() -> list[dict[str, Any]]:
    return [definition.model_dump() for definition in tool_registry().values()]


def get_tool(name: str) -> ToolDefinition | None:
    return tool_registry().get(name)


def validate_tool_call(skill_name: str, tool_name: str) -> tuple[bool, str]:
    skill = get_skill(skill_name)
    tools = tool_registry()
    if not skill:
        return False, "Skill is not registered"
    if tool_name not in tools:
        return False, "Tool is not registered"
    if tool_name not in skill.allowed_tools:
        return False, "Tool is outside the skill allowlist"
    return True, "Allowed"
