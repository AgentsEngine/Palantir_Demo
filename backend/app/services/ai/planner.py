"""Conversation-level planning for enterprise AI Agent turns.

The planner is intentionally separated from context routing and tool execution.
It can start with deterministic local rules, then be replaced or augmented by a
model-based planner without changing the permission and execution layers.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal


PlanIntent = Literal["qa", "action"]


@dataclass
class AgentPlan:
    intent: PlanIntent = "qa"
    skill: str | None = None
    source_message: str = ""
    confidence: float = 0.0
    reason: str = ""
    extracted_context: dict[str, Any] = field(default_factory=dict)


FORM_OBJECT_TERMS = [
    "form",
    "low-code",
    "low code",
    "table",
    "page",
    "表单",
    "页面",
    "台账",
    "主数据",
    "申请单",
    "审批单",
    "登记",
]
BUILD_INTENT_TERMS = [
    "create",
    "new",
    "build",
    "generate",
    "design",
    "新建",
    "创建",
    "建立",
    "建设",
    "生成",
    "设计",
    "配置",
    "搭建",
    "搭一个",
    "做一个",
    "做个",
    "帮我建",
    "帮我做",
    "建一个",
    "建个",
]
CONFIRM_TERMS = [
    "ok",
    "yes",
    "confirm",
    "confirmed",
    "好的",
    "可以",
    "确认",
    "就这样",
    "按这个",
    "没问题",
    "执行",
]


def _compact(text: str) -> str:
    return re.sub(r"\s+", "", text.strip().lower())


def _contains_any(text: str, tokens: list[str]) -> bool:
    lowered = text.lower()
    compacted = _compact(text)
    return any(token.lower() in lowered or _compact(token) in compacted for token in tokens)


def _is_confirmation(message: str) -> bool:
    compacted = _compact(message)
    if not compacted:
        return False
    return any(_compact(term) in compacted for term in CONFIRM_TERMS) and len(compacted) <= 24


def _is_low_code_form_request(message: str) -> bool:
    return _contains_any(message, FORM_OBJECT_TERMS) and _contains_any(message, BUILD_INTENT_TERMS)


def _recent_user_messages(context: dict[str, Any]) -> list[str]:
    rows = context.get("recentMessages") or context.get("recent_messages") or []
    if not isinstance(rows, list):
        return []
    output: list[str] = []
    for row in rows:
        if not isinstance(row, dict) or row.get("role") != "user":
            continue
        content = str(row.get("content") or "").strip()
        if content:
            output.append(content)
    return output


def _extract_form_name(message: str) -> str | None:
    text = message.strip()
    patterns = [
        r"(?:关于|有关|为|给)(?P<name>[\u4e00-\u9fa5A-Za-z0-9_\-\s]{2,40}?)(?:的)?表单",
        r"(?P<name>[\u4e00-\u9fa5A-Za-z0-9_\-\s]{2,40}?)(?:的)?表单",
        r"form\s+(?:for|named|called)\s+(?P<name>[A-Za-z0-9_\-\s]{2,60})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        name = match.group("name").strip()
        name = re.sub(r"^(请你|请|麻烦|帮我|给我|为我|建立|新建|创建|设计|生成|做|一个|个|关于|有关|\s)+", "", name)
        name = re.sub(r"(就好|即可|就行|吧)$", "", name).strip()
        if name:
            return name[:80]
    return None


def plan_agent_turn(message: str, context: dict[str, Any] | None = None) -> AgentPlan:
    context = context or {}
    source_message = message
    reason = "direct_request"

    if _is_confirmation(message):
        for prior in reversed(_recent_user_messages(context)):
            if _is_low_code_form_request(prior):
                source_message = prior
                reason = "confirmation_followup"
                break

    if not _is_low_code_form_request(source_message):
        return AgentPlan(intent="qa", source_message=message, confidence=0.2, reason="no_action_plan")

    extracted: dict[str, Any] = {"planner_reason": reason}
    form_name = _extract_form_name(source_message)
    if form_name:
        extracted["formName"] = form_name
    return AgentPlan(
        intent="action",
        skill="low_code.create_form_definition",
        source_message=source_message,
        confidence=0.82 if reason == "direct_request" else 0.76,
        reason=reason,
        extracted_context=extracted,
    )
