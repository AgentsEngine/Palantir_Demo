"""Platform-level tenant administration APIs."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, get_db, require_admin
from app.core.audit import write_audit_log
from app.core.security import hash_password
from app.services.tenant_onboarding import (
    DEFAULT_TENANT_CONFIG,
    DEFAULT_TENANT_LIMITS,
    create_invite,
    normalize_domain,
)

router = APIRouter(dependencies=[Depends(require_admin)])


class TenantCreate(BaseModel):
    name: str
    slug: str
    domains: list[str] = Field(default_factory=list)
    admin_email: Optional[str] = None
    config: dict = Field(default_factory=dict)
    limits: dict = Field(default_factory=dict)


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    domains: Optional[list[str]] = None
    config: Optional[dict] = None
    limits: Optional[dict] = None
    suspended_reason: Optional[str] = None


class TenantInviteRequest(BaseModel):
    email: str
    role: str = "member"


def _slug(value: str) -> str:
    normalized = (value or "").strip().lower()
    if not normalized or not all(ch.isalnum() or ch == "-" for ch in normalized):
        raise HTTPException(422, "Tenant slug may contain lowercase letters, numbers, and hyphens")
    return normalized


async def _tenant_payload(db: AsyncSession, tenant) -> dict:
    from app.models.relational import Application, DynamicRecord, TenantDomain, User

    domains = (await db.execute(
        select(TenantDomain).where(TenantDomain.tenant_id == tenant.id).order_by(TenantDomain.is_primary.desc(), TenantDomain.id)
    )).scalars().all()
    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "status": tenant.status,
        "config": tenant.config or {},
        "limits": tenant.limits or {},
        "domains": [{"id": item.id, "domain": item.domain, "status": item.status, "isPrimary": item.is_primary} for item in domains],
        "usage": {
            "users": await db.scalar(select(func.count(User.id)).where(User.tenant_id == tenant.id)) or 0,
            "applications": await db.scalar(select(func.count(Application.id)).where(Application.tenant_id == tenant.id)) or 0,
            "dynamicRecords": await db.scalar(select(func.count(DynamicRecord.id)).where(DynamicRecord.tenant_id == tenant.id)) or 0,
        },
        "suspendedReason": tenant.suspended_reason,
    }


async def _ensure_role(db: AsyncSession, tenant_id: int, name: str, label: str):
    from app.models.relational import Role

    role = await db.scalar(select(Role).where(Role.tenant_id == tenant_id, Role.name == name))
    if role:
        return role
    legacy_global_role = await db.scalar(select(Role).where(Role.name == name))
    if legacy_global_role and legacy_global_role.tenant_id != tenant_id:
        return None
    role = Role(tenant_id=tenant_id, name=name, label=label)
    db.add(role)
    await db.flush()
    return role


@router.get("/tenants")
async def list_tenants(db: AsyncSession = Depends(get_db)):
    from app.models.relational import Tenant

    rows = (await db.execute(select(Tenant).order_by(Tenant.id))).scalars().all()
    return {"data": [await _tenant_payload(db, tenant) for tenant in rows]}


@router.post("/tenants")
async def create_tenant(body: TenantCreate, user: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from app.models.relational import Tenant, TenantDomain, User, UserRole

    slug = _slug(body.slug)
    if await db.scalar(select(Tenant.id).where(Tenant.slug == slug)):
        raise HTTPException(409, "Tenant slug already exists")
    domains = [normalize_domain(item) for item in body.domains]
    if len(set(domains)) != len(domains):
        raise HTTPException(409, "Duplicate tenant domain")
    if domains:
        existing = (await db.execute(select(TenantDomain.domain).where(TenantDomain.domain.in_(domains)))).scalars().all()
        if existing:
            raise HTTPException(409, f"Tenant domain already exists: {existing[0]}")

    tenant = Tenant(
        name=body.name,
        slug=slug,
        status="active",
        config={**DEFAULT_TENANT_CONFIG, **body.config},
        limits={**DEFAULT_TENANT_LIMITS, **body.limits},
        opened_by=current_user_id(user),
    )
    db.add(tenant)
    await db.flush()
    for idx, domain in enumerate(domains):
        db.add(TenantDomain(tenant_id=tenant.id, domain=domain, is_primary=idx == 0))
    admin_role = await _ensure_role(db, tenant.id, "admin", "Tenant Admin")
    await _ensure_role(db, tenant.id, "member", "Member")

    invite_payload = None
    if body.admin_email:
        email = body.admin_email.strip().lower()
        if domains and normalize_domain(email.rsplit("@", 1)[1]) not in domains:
            raise HTTPException(422, "Admin email domain must belong to the tenant")
        pending = User(
            tenant_id=tenant.id,
            username=email,
            email=email,
            display_name=email,
            hashed_password=hash_password("pending-invite"),
            is_active=False,
            is_admin=True,
            force_password_change=True,
        )
        db.add(pending)
        await db.flush()
        if admin_role:
            db.add(UserRole(tenant_id=tenant.id, user_id=pending.id, role_id=admin_role.id))
        invite_payload = await create_invite(db, tenant_id=tenant.id, email=email, role="admin", invited_by=current_user_id(user))
    await db.commit()
    await write_audit_log(
        tenant_id=tenant.id,
        user_id=current_user_id(user),
        action="create_tenant",
        resource_type="tenant",
        resource_id=tenant.id,
        new_values={"slug": tenant.slug, "domains": domains, "admin_email": body.admin_email},
    )
    payload = await _tenant_payload(db, tenant)
    if invite_payload:
        payload["adminInvite"] = invite_payload
    return {"data": payload}


@router.put("/tenants/{tenant_id}")
async def update_tenant(tenant_id: int, body: TenantUpdate, user: dict = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    from app.models.relational import Tenant, TenantDomain

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    if body.status is not None and body.status not in {"active", "suspended", "archived"}:
        raise HTTPException(422, "Invalid tenant status")
    if body.name is not None:
        tenant.name = body.name
    if body.status is not None:
        tenant.status = body.status
    if body.config is not None:
        tenant.config = {**(tenant.config or {}), **body.config}
    if body.limits is not None:
        tenant.limits = {**(tenant.limits or {}), **body.limits}
    if body.suspended_reason is not None:
        tenant.suspended_reason = body.suspended_reason
    if body.domains is not None:
        domains = [normalize_domain(item) for item in body.domains]
        existing = (await db.execute(
            select(TenantDomain).where(TenantDomain.domain.in_(domains), TenantDomain.tenant_id != tenant_id)
        )).scalars().first()
        if existing:
            raise HTTPException(409, f"Tenant domain already exists: {existing.domain}")
        old = (await db.execute(select(TenantDomain).where(TenantDomain.tenant_id == tenant_id))).scalars().all()
        for item in old:
            await db.delete(item)
        for idx, domain in enumerate(domains):
            db.add(TenantDomain(tenant_id=tenant_id, domain=domain, is_primary=idx == 0))
    await db.commit()
    await write_audit_log(
        tenant_id=tenant.id,
        user_id=current_user_id(user),
        action="update_tenant",
        resource_type="tenant",
        resource_id=tenant.id,
        new_values=body.dict(exclude_unset=True),
    )
    return {"data": await _tenant_payload(db, tenant)}


@router.post("/tenants/{tenant_id}/invites")
async def invite_tenant_user(
    tenant_id: int,
    body: TenantInviteRequest,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.models.relational import Role, Tenant, User, UserRole

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    if tenant.status != "active":
        raise HTTPException(403, "Tenant is not active")
    role_name = "admin" if body.role in {"admin", "tenant_admin"} else "member"
    role = await db.scalar(select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name))
    if not role:
        role = await _ensure_role(db, tenant_id, role_name, "Tenant Admin" if role_name == "admin" else "Member")
    email = body.email.strip().lower()
    user_row = await db.scalar(select(User).where(User.tenant_id == tenant_id, User.email == email))
    if user_row and user_row.is_active:
        raise HTTPException(409, "User already exists")
    if not user_row:
        user_row = User(
            tenant_id=tenant_id,
            username=email,
            email=email,
            display_name=email,
            hashed_password=hash_password("pending-invite"),
            is_active=False,
            is_admin=role_name == "admin",
            force_password_change=True,
        )
        db.add(user_row)
        await db.flush()
        if role:
            db.add(UserRole(tenant_id=tenant_id, user_id=user_row.id, role_id=role.id))
    payload = await create_invite(db, tenant_id=tenant_id, email=email, role=role_name, invited_by=current_user_id(user))
    await db.commit()
    await write_audit_log(
        tenant_id=tenant_id,
        user_id=current_user_id(user),
        action="create_invite",
        resource_type="tenant_invite",
        resource_id=payload["id"],
        new_values={"email": email, "role": role_name},
    )
    return {"data": payload}
