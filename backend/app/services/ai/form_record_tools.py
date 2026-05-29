"""Read-only Agent tools for dynamic form records."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_tenant_id
from app.core.permissions import allowed_form_fields, has_form_permission
from app.models.relational import DynamicRecord, Form, FormField


def _record_payload(record: DynamicRecord, *, visible_fields: set[str]) -> dict[str, Any]:
    data = record.data or {}
    return {
        "id": record.id,
        "form_id": record.form_id,
        "schema_version": getattr(record, "schema_version", 1),
        "status": record.status,
        "data": {key: value for key, value in data.items() if key in visible_fields or key.startswith("_")},
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }


async def _resolve_form(session: AsyncSession, *, tenant_id: int, payload: dict[str, Any]) -> Form:
    form_id = payload.get("form_id") or payload.get("formId")
    form_code = payload.get("form_code") or payload.get("formCode")
    form = None
    if form_id:
        form = await session.get(Form, int(form_id))
        if form and form.tenant_id != tenant_id:
            form = None
    elif form_code:
        form = await session.scalar(select(Form).where(Form.tenant_id == tenant_id, Form.code == str(form_code)))
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


async def _form_fields(session: AsyncSession, *, tenant_id: int, form_id: int) -> list[FormField]:
    return (
        await session.execute(
            select(FormField)
            .where(FormField.tenant_id == tenant_id, FormField.form_id == form_id, FormField.archived.is_(False))
            .order_by(FormField.sort_order, FormField.id)
        )
    ).scalars().all()


async def query_form_records(
    session: AsyncSession,
    *,
    user: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Query dynamic records through form permissions and field visibility."""

    tenant_id = current_tenant_id(user)
    form = await _resolve_form(session, tenant_id=tenant_id, payload=payload)
    if not await has_form_permission(user, form.id, "view", session):
        raise HTTPException(status_code=403, detail="Form permission denied")
    fields = await _form_fields(session, tenant_id=tenant_id, form_id=form.id)
    visible_fields = await allowed_form_fields(user, form.id, "view", fields, session)
    limit = max(1, min(int(payload.get("limit") or 20), 100))
    query = select(DynamicRecord).where(
        DynamicRecord.tenant_id == tenant_id,
        DynamicRecord.form_id == form.id,
        DynamicRecord.deleted_at.is_(None),
    )
    status = payload.get("status")
    if status:
        query = query.where(DynamicRecord.status == str(status))
    query = query.order_by(DynamicRecord.id.desc()).limit(limit)
    rows = (await session.execute(query)).scalars().all()
    return {
        "form": {"id": form.id, "name": form.name, "code": form.code},
        "records": [_record_payload(record, visible_fields=visible_fields) for record in rows],
        "record_count": len(rows),
        "visible_fields": sorted(visible_fields),
    }


async def get_form_record(
    session: AsyncSession,
    *,
    user: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Read one dynamic record through form permissions and field visibility."""

    tenant_id = current_tenant_id(user)
    form = await _resolve_form(session, tenant_id=tenant_id, payload=payload)
    record_id = payload.get("record_id") or payload.get("recordId")
    if not record_id:
        raise HTTPException(status_code=422, detail="record_id is required")
    if not await has_form_permission(user, form.id, "view", session):
        raise HTTPException(status_code=403, detail="Form permission denied")
    record = await session.get(DynamicRecord, int(record_id))
    if not record or record.tenant_id != tenant_id or record.form_id != form.id or record.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Record not found")
    fields = await _form_fields(session, tenant_id=tenant_id, form_id=form.id)
    visible_fields = await allowed_form_fields(user, form.id, "view", fields, session)
    return {
        "form": {"id": form.id, "name": form.name, "code": form.code},
        "record": _record_payload(record, visible_fields=visible_fields),
        "visible_fields": sorted(visible_fields),
    }
