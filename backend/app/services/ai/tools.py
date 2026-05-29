"""Business skill registry for the first AI Agent MVP."""

from __future__ import annotations

from typing import Any

from .low_code_tools import build_low_code_form_payload
from .policies import apply_policy
from .schemas import SkillAction


def create_work_order_draft(evidence: list[dict[str, Any]] | None = None) -> SkillAction:
    return apply_policy(SkillAction(
        skill="maintenance.create_work_order_draft",
        title="Maintenance work order draft",
        payload={
            "asset": "To be confirmed",
            "priority": "To be confirmed",
            "suggested_window": "To be confirmed",
            "risk_signal": "To be confirmed",
        },
        evidence=evidence or [],
    ))


def create_purchase_request_draft(evidence: list[dict[str, Any]] | None = None) -> SkillAction:
    return apply_policy(SkillAction(
        skill="supply.create_purchase_request_draft",
        title="Purchase request draft",
        payload={
            "item": "To be confirmed",
            "quantity": "To be confirmed",
            "reason": "To be confirmed",
            "recommended_supplier": "To be confirmed",
        },
        evidence=evidence or [],
    ))


def create_material_application_draft(evidence: list[dict[str, Any]] | None = None) -> SkillAction:
    return apply_policy(SkillAction(
        skill="material.create_material_application_draft",
        title="Material application draft",
        payload={
            "business_unit": "To be confirmed",
            "item_code": "To be confirmed",
            "quantity": "To be confirmed",
            "usage": "To be confirmed",
        },
        evidence=evidence or [],
    ))


def create_capa_draft(evidence: list[dict[str, Any]] | None = None) -> SkillAction:
    return apply_policy(SkillAction(
        skill="quality.create_capa_draft",
        title="CAPA draft",
        payload={
            "problem": "To be confirmed",
            "containment": "To be confirmed",
            "suspected_root_cause": "To be confirmed",
        },
        evidence=evidence or [],
    ))


def create_low_code_form_definition_action(
    message: str,
    evidence: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> SkillAction:
    return apply_policy(SkillAction(
        skill="low_code.create_form_definition",
        title="Low-code form creation plan",
        mode="confirmed_write",
        risk_level="high",
        payload=build_low_code_form_payload(message, context),
        evidence=evidence or [],
    ))


def choose_draft_actions(
    message: str,
    evidence: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> list[SkillAction]:
    text = message.lower()
    wants_low_code_form = (
        any(token in text for token in ["form", "low-code", "low code", "table", "\u8868\u5355"])
        and any(token in text for token in ["create", "new", "build", "\u65b0\u5efa", "\u521b\u5efa", "\u751f\u6210"])
    )
    wants_draft = wants_low_code_form or any(
        token in text
        for token in ["draft", "\u8349\u7a3f", "\u751f\u6210", "\u7533\u8bf7", "\u5de5\u5355", "capa"]
    )
    if not wants_draft:
        return []

    actions: list[SkillAction] = []
    if wants_low_code_form:
        actions.append(create_low_code_form_definition_action(message, evidence, context))
    if any(token in text for token in ["maintenance", "work order", "\u7ef4\u4fee", "\u5de5\u5355", "\u8bbe\u5907"]):
        actions.append(create_work_order_draft(evidence))
    if any(token in text for token in ["purchase", "\u91c7\u8d2d"]):
        actions.append(create_purchase_request_draft(evidence))
    if any(token in text for token in ["material", "\u7269\u6599", "\u6599\u53f7", "\u9886\u6599"]):
        actions.append(create_material_application_draft(evidence))
    if any(token in text for token in ["quality", "capa", "\u8d28\u91cf", "\u7f3a\u9677"]):
        actions.append(create_capa_draft(evidence))
    return actions
