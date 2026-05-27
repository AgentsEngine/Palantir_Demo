"""Intent routing and read-only semantic data context for AI Agent runs."""

from __future__ import annotations

from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.semantic_assets import ONTOLOGY_OBJECTS, ONTOLOGY_RELATIONS, PAGE_CONTRACTS
from app.models.relational import DynamicRecord, Form, FormField


ContextNeed = Literal[
    "none",
    "ui_page",
    "current_object",
    "visible_dataset",
    "business_query",
    "knowledge_rag",
    "semantic_graph",
    "draft_action",
]

DATA_TERMS = [
    "数据",
    "分析",
    "表单",
    "字段",
    "记录",
    "列表",
    "指标",
    "图表",
    "异常",
    "风险",
    "供应商",
    "物料",
    "工单",
    "设备",
    "质量",
    "capa",
    "spc",
    "oee",
]
KNOWLEDGE_TERMS = ["文档", "知识", "sop", "证据", "这篇", "当前文档", "发布清单", "抽取"]
PAGE_TERMS = ["当前页", "这个页面", "这里", "菜单", "配置", "权限", "页面"]
DRAFT_TERMS = ["草稿", "创建", "发起", "提交", "保存", "发布", "生成"]


def classify_context_need(message: str, context: dict[str, Any] | None = None) -> ContextNeed:
    context = context or {}
    explicit = context.get("contextNeed") or context.get("context_need")
    if explicit in {
        "none",
        "ui_page",
        "current_object",
        "visible_dataset",
        "business_query",
        "knowledge_rag",
        "semantic_graph",
        "draft_action",
    }:
        return explicit
    text = message.lower()
    if context.get("surface") == "knowledge" or any(term in text for term in KNOWLEDGE_TERMS):
        return "knowledge_rag"
    if any(term in text for term in DRAFT_TERMS) and any(term in text for term in DATA_TERMS + KNOWLEDGE_TERMS):
        return "draft_action"
    if any(term in text for term in DATA_TERMS):
        return "business_query"
    if any(term in text for term in PAGE_TERMS):
        return "ui_page"
    return "none"


class AgentContextRouter:
    def classify(self, message: str, context: dict[str, Any] | None = None) -> ContextNeed:
        return classify_context_need(message, context)

    async def build_semantic_context(
        self,
        session: AsyncSession,
        *,
        message: str,
        context: dict[str, Any],
        tenant_id: int,
        limit: int = 8,
    ) -> dict[str, Any]:
        need = self.classify(message, context)
        if need not in {"business_query", "visible_dataset", "current_object", "semantic_graph", "draft_action"}:
            return {"intent": need, "objects": [], "records": [], "relations": []}

        objects = self._match_ontology_objects(message, context)
        records = await self._query_matching_forms(session, objects, tenant_id=tenant_id, limit=limit)
        relations = self._relations_for_objects([item["id"] for item in objects])
        return {
            "intent": need,
            "objects": objects,
            "records": records,
            "relations": relations,
            "record_count": sum(len(item.get("records") or []) for item in records),
        }

    def _match_ontology_objects(self, message: str, context: dict[str, Any]) -> list[dict[str, Any]]:
        route = context.get("route") or context.get("page")
        route_contract = PAGE_CONTRACTS.get(str(route)) if route else None
        candidates: list[dict[str, Any]] = []
        if route_contract:
            entity = route_contract.get("entity")
            candidates.extend(item for item in ONTOLOGY_OBJECTS if item.get("id") == entity)

        text = message.lower()
        for item in ONTOLOGY_OBJECTS:
            haystack = " ".join(
                str(part)
                for part in [
                    item.get("id"),
                    item.get("name"),
                    item.get("code"),
                    item.get("source"),
                    item.get("description"),
                ]
            ).lower()
            if any(token and token.lower() in text for token in [item.get("id"), item.get("code"), item.get("name")]):
                candidates.append(item)
            elif any(word in haystack and word in text for word in ["supplier", "material", "device", "workorder", "qualityevent"]):
                candidates.append(item)

        unique: dict[str, dict[str, Any]] = {}
        for item in candidates:
            unique[str(item.get("id"))] = {
                "id": item.get("id"),
                "name": item.get("name"),
                "code": item.get("code"),
                "source": item.get("source"),
                "description": item.get("description"),
                "fields": item.get("fields", [])[:8],
            }
        return list(unique.values())[:5]

    def _relations_for_objects(self, object_ids: list[str]) -> list[dict[str, Any]]:
        if not object_ids:
            return []
        return [
            relation
            for relation in ONTOLOGY_RELATIONS
            if relation.get("source") in object_ids or relation.get("target") in object_ids
        ][:12]

    async def _query_matching_forms(
        self,
        session: AsyncSession,
        objects: list[dict[str, Any]],
        *,
        tenant_id: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        if not objects:
            return []
        forms = (
            await session.execute(
                select(Form).where(Form.tenant_id == tenant_id).order_by(Form.id)
            )
        ).scalars().all()
        output: list[dict[str, Any]] = []
        for obj in objects:
            source = str(obj.get("source") or obj.get("code") or obj.get("id") or "").lower()
            matched_form = next(
                (
                    form
                    for form in forms
                    if source
                    and (
                        source in str(form.name or "").lower()
                        or source in str(form.table_name or "").lower()
                        or source in str(form.code or "").lower()
                    )
                ),
                None,
            )
            if not matched_form:
                continue
            fields = (
                await session.execute(
                    select(FormField)
                    .where(FormField.form_id == matched_form.id, FormField.tenant_id == tenant_id)
                    .order_by(FormField.sort_order, FormField.id)
                )
            ).scalars().all()
            records = (
                await session.execute(
                    select(DynamicRecord)
                    .where(
                        DynamicRecord.form_id == matched_form.id,
                        DynamicRecord.tenant_id == tenant_id,
                        DynamicRecord.deleted_at.is_(None),
                    )
                    .order_by(DynamicRecord.id.desc())
                    .limit(limit)
                )
            ).scalars().all()
            output.append(
                {
                    "object": obj,
                    "form": {
                        "id": matched_form.id,
                        "name": matched_form.name,
                        "table_name": matched_form.table_name,
                    },
                    "fields": [
                        {"name": field.field_name, "label": field.label, "type": field.field_type}
                        for field in fields[:12]
                    ],
                    "records": [
                        {"id": record.id, "status": record.status, "data": record.data}
                        for record in records
                    ],
                }
            )
        return output


agent_context_router = AgentContextRouter()
