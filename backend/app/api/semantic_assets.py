"""Semantic asset APIs backed by database metadata and persisted records."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_tenant_id, get_current_user, get_db
from app.models.relational import (
    Application,
    AuditLog,
    Defect,
    DynamicRecord,
    Equipment,
    Form,
    FormAction,
    FormField,
    KnowledgeObjectLink,
    Material,
    ProductionLine,
    Role,
    RolePermission,
    Supplier,
    WorkOrder,
)

router = APIRouter()


DATABASE_MODELS = [Equipment, WorkOrder, Supplier, Material, Defect, ProductionLine]

# Backward-compatible exports for AI context routing. The semantic asset API now
# resolves these structures from database metadata at request time.
ONTOLOGY_OBJECTS: list[dict[str, Any]] = []
ONTOLOGY_RELATIONS: list[dict[str, Any]] = []
PAGE_CONTRACTS: dict[str, dict[str, Any]] = {}


def _column_quality(column) -> str:
    if column.primary_key or not column.nullable:
        return "good"
    return "unknown"


def _field_payload(column) -> dict[str, Any]:
    return {
        "name": column.name,
        "label": column.name,
        "type": column.type.__class__.__name__.lower(),
        "primary_key": bool(column.primary_key),
        "searchable": column.type.__class__.__name__.lower() in {"string", "text"},
        "visible": not column.name.endswith("_id") or column.primary_key,
        "quality": _column_quality(column),
    }


async def _count_table(db: AsyncSession, model, tenant_id: int) -> int:
    stmt = select(func.count()).select_from(model)
    if "tenant_id" in model.__table__.columns:
        stmt = stmt.where(model.tenant_id == tenant_id)
    return int(await db.scalar(stmt) or 0)


async def _data_asset_tables(db: AsyncSession, tenant_id: int) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    for index, model in enumerate(DATABASE_MODELS, start=1):
        table = model.__table__
        row_count = await _count_table(db, model, tenant_id)
        tables.append({
            "id": table.name,
            "name": table.name,
            "label": table.name,
            "rows": row_count,
            "quality_score": 100 if row_count else 0,
            "fields": [_field_payload(column) for column in table.columns],
        })
    return tables


@router.get("/data-assets")
async def list_data_assets(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    tenant_id = current_tenant_id(user)
    tables = await _data_asset_tables(db, tenant_id)
    return {
        "data": [{
            "id": 1,
            "name": "application_database",
            "type": "database",
            "status": "connected",
            "owner": "database",
            "freshness": None,
            "tables": tables,
        }],
        "source": "database",
    }


@router.get("/ontology-objects")
async def list_ontology_objects(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    tenant_id = current_tenant_id(user)
    form_rows = (
        await db.execute(
            select(Form)
            .where(Form.tenant_id == tenant_id)
            .order_by(Form.id)
        )
    ).scalars().all()

    objects: list[dict[str, Any]] = []
    for form in form_rows:
        field_rows = (
            await db.execute(
                select(FormField)
                .where(FormField.form_id == form.id, FormField.archived.is_(False))
                .order_by(FormField.sort_order, FormField.id)
            )
        ).scalars().all()
        objects.append({
            "id": form.code,
            "name": form.name,
            "code": form.code,
            "source": form.table_name or f"dynamic_records:{form.id}",
            "description": form.description or "",
            "fields": [
                {
                    "name": field.field_name,
                    "label": field.label,
                    "type": field.field_type,
                    "source_field": field.field_name,
                    "list": field.visible_in_list,
                    "form": field.visible_in_form,
                    "search": field.searchable,
                }
                for field in field_rows
            ],
        })

    if objects:
        return {"data": objects, "source": "database"}

    tables = await _data_asset_tables(db, tenant_id)
    return {
        "data": [
            {
                "id": table["name"],
                "name": table["label"],
                "code": table["name"],
                "source": table["name"],
                "description": "",
                "fields": [
                    {
                        "name": field["name"],
                        "label": field["label"],
                        "type": field["type"],
                        "source_field": field["name"],
                        "list": field["visible"],
                        "form": field["visible"],
                        "search": field["searchable"],
                    }
                    for field in table["fields"]
                ],
            }
            for table in tables
        ],
        "source": "database",
    }


@router.get("/ontology-relations")
async def list_ontology_relations(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    tenant_id = current_tenant_id(user)
    relations: list[dict[str, Any]] = []
    for model in DATABASE_MODELS:
        table = model.__table__
        for column in table.columns:
            for fk in column.foreign_keys:
                relations.append({
                    "id": f"{table.name}.{column.name}->{fk.column.table.name}.{fk.column.name}",
                    "source": table.name,
                    "type": "FOREIGN_KEY",
                    "label": column.name,
                    "target": fk.column.table.name,
                    "graph": True,
                    "description": f"{table.name}.{column.name} -> {fk.column.table.name}.{fk.column.name}",
                })

    form_rows = (
        await db.execute(select(Form).where(Form.tenant_id == tenant_id).order_by(Form.id))
    ).scalars().all()
    for form in form_rows:
        fields = (
            await db.execute(
                select(FormField)
                .where(FormField.form_id == form.id, FormField.archived.is_(False))
                .order_by(FormField.sort_order, FormField.id)
            )
        ).scalars().all()
        for field in fields:
            relation_model = (field.ui_config or {}).get("relationModel") if isinstance(field.ui_config, dict) else None
            if relation_model:
                relations.append({
                    "id": f"{form.code}.{field.field_name}->{relation_model}",
                    "source": form.code,
                    "type": "RELATION_FIELD",
                    "label": field.label,
                    "target": relation_model,
                    "graph": True,
                    "description": "",
                })
    return {"data": relations, "source": "database"}


@router.get("/page-contracts")
async def list_page_contracts(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    tenant_id = current_tenant_id(user)
    forms = (
        await db.execute(
            select(Form)
            .where(Form.tenant_id == tenant_id)
            .order_by(Form.id)
        )
    ).scalars().all()
    apps = (
        await db.execute(
            select(Application)
            .where(Application.tenant_id == tenant_id)
            .order_by(Application.sort_order, Application.id)
        )
    ).scalars().all()
    contracts = [
        {
            "route": (
                f"/form-settings/{form.code}?tab=dashboard"
                if str((form.config or {}).get("assemblyKind") or (form.config or {}).get("kind") or (form.config or {}).get("type") or "").lower()
                in {"analysis", "analytics", "dashboard", "report", "bi_report", "metric_dashboard", "list_analysis"}
                else f"/dynamic/{form.code}"
            ),
            "title": form.name,
            "entity": form.code,
            "description": form.description or "",
            "components": [],
            "actions": [],
        }
        for form in forms
    ]
    contracts.extend([
        {
            "route": app.default_route,
            "title": app.name,
            "entity": app.code,
            "description": app.description or "",
            "components": [],
            "actions": [],
        }
        for app in apps
    ])
    return {"data": contracts, "source": "database"}


@router.get("/page-contracts/by-route")
async def get_page_contract_by_route(
    route: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    contracts = (await list_page_contracts(db=db, user=user))["data"]
    contract = next((item for item in contracts if item["route"] == route), None)
    if not contract:
        raise HTTPException(status_code=404, detail="Page contract not found")
    objects = (await list_ontology_objects(db=db, user=user))["data"]
    relations = (await list_ontology_relations(db=db, user=user))["data"]
    entity = next((item for item in objects if item["id"] == contract["entity"]), None)
    related = [
        item for item in relations
        if item["source"] == contract["entity"] or item["target"] == contract["entity"]
    ]
    return {"data": {**contract, "entity_detail": entity, "relations": related}, "source": "database"}


@router.get("/closed-loop-config")
async def get_closed_loop_config(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    tenant_id = current_tenant_id(user)

    forms = (
        await db.execute(select(Form).where(Form.tenant_id == tenant_id).order_by(Form.id))
    ).scalars().all()
    applications = (
        await db.execute(select(Application).where(Application.tenant_id == tenant_id).order_by(Application.id))
    ).scalars().all()
    roles = (
        await db.execute(select(Role).where(Role.tenant_id == tenant_id).order_by(Role.id))
    ).scalars().all()
    links = (
        await db.execute(select(KnowledgeObjectLink).where(KnowledgeObjectLink.tenant_id == tenant_id).limit(200))
    ).scalars().all()

    nodes: list[dict[str, Any]] = []
    for form in forms:
        fields = (
            await db.execute(
                select(FormField.field_name)
                .where(FormField.form_id == form.id, FormField.archived.is_(False))
                .order_by(FormField.sort_order, FormField.id)
            )
        ).scalars().all()
        actions = (
            await db.execute(
                select(FormAction.label)
                .where(FormAction.form_id == form.id, FormAction.enabled.is_(True))
                .order_by(FormAction.sort_order, FormAction.id)
            )
        ).scalars().all()
        record_count = await db.scalar(
            select(func.count()).select_from(DynamicRecord).where(
                DynamicRecord.tenant_id == tenant_id,
                DynamicRecord.form_id == form.id,
                DynamicRecord.deleted_at.is_(None),
            )
        )
        nodes.append({
            "id": f"form:{form.id}",
            "name": form.name,
            "type": "Form",
            "domain": form.storage_mode,
            "status": form.status if form.status in {"published", "draft", "review"} else "draft",
            "riskLevel": "medium" if record_count else "low",
            "module": "forms",
            "roles": [],
            "fields": list(fields),
            "actions": list(actions),
            "description": form.description or "",
        })

    for app in applications:
        nodes.append({
            "id": f"app:{app.id}",
            "name": app.name,
            "type": "Application",
            "domain": "application",
            "status": app.status if app.status in {"published", "draft", "review"} else "draft",
            "riskLevel": "low",
            "module": app.default_route,
            "roles": [],
            "fields": ["code", "default_route", "status"],
            "actions": ["view"],
            "description": app.description or "",
        })

    for role in roles:
        permissions = (
            await db.execute(
                select(RolePermission)
                .where(RolePermission.role_id == role.id)
                .order_by(RolePermission.id)
            )
        ).scalars().all()
        nodes.append({
            "id": f"role:{role.id}",
            "name": role.label or role.name,
            "type": "RolePolicy",
            "domain": "identity",
            "status": "published",
            "riskLevel": "low",
            "module": "identity-access",
            "roles": [role.name],
            "fields": [p.resource_type for p in permissions],
            "actions": [p.action for p in permissions],
            "description": role.description or "",
        })

    object_types = sorted({link.object_type for link in links if link.object_type})
    for object_type in object_types:
        related = [link for link in links if link.object_type == object_type]
        nodes.append({
            "id": f"knowledge:{object_type}",
            "name": object_type,
            "type": "KnowledgeObject",
            "domain": "knowledge",
            "status": "published",
            "riskLevel": "low",
            "module": "knowledge-base",
            "roles": [],
            "fields": sorted({str(link.object_id) for link in related if link.object_id})[:20],
            "actions": ["review", "publish"],
            "description": "",
        })

    edges: list[dict[str, Any]] = []
    for role in roles:
        permissions = (
            await db.execute(select(RolePermission).where(RolePermission.role_id == role.id).order_by(RolePermission.id))
        ).scalars().all()
        for permission in permissions:
            target = next(
                (
                    node["id"]
                    for node in nodes
                    if permission.resource_type in {node["type"], node["module"], node["domain"]}
                    or permission.resource_key in {node["id"], node["name"]}
                ),
                None,
            )
            if target:
                edges.append({
                    "id": f"permission:{permission.id}",
                    "source": f"role:{role.id}",
                    "target": target,
                    "type": "CAN_ACCESS",
                    "label": permission.action,
                    "condition": permission.resource_key,
                    "status": "published",
                    "riskLevel": "low",
                    "evidence": "role_permissions",
                    "frontendVisible": False,
                })

    audit_count = await db.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.tenant_id == tenant_id)
    ) or 0
    policies = [
        {
            "key": "audit-coverage",
            "policy": "Audit log coverage",
            "scope": "admin and runtime operations",
            "guard": "audit_logs table",
            "coverage": 100 if audit_count else 0,
        },
        {
            "key": "role-permission",
            "policy": "Role permission boundary",
            "scope": "role_permissions table",
            "guard": "RBAC evaluation",
            "coverage": 100 if roles else 0,
        },
    ]

    return {"data": {"nodes": nodes, "edges": edges, "policies": policies}, "source": "database"}
