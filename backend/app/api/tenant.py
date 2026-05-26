"""Public tenant profile APIs used by frontend branding and AI identity."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import current_tenant_id, get_current_user
from app.core.db import db_session
from app.services.ai.tenant_profile import load_tenant_profile

router = APIRouter()


@router.get("/profile/public")
async def get_public_tenant_profile(user: dict = Depends(get_current_user)):
    tenant_id = current_tenant_id(user)
    async with db_session() as session:
        profile = await load_tenant_profile(tenant_id, session=session)
    return {
        "data": {
            "tenantId": profile.tenant_id,
            "tenantName": profile.display_name,
            "productName": profile.product_name,
            "assistantName": profile.assistant_name,
            "industry": profile.industry,
            "locale": profile.locale,
        }
    }
