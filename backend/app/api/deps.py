"""FastAPI dependencies: auth, DB session injection."""
from __future__ import annotations

from typing import AsyncIterator, Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.db import db_session
from app.core.logging import get_logger
from app.core.security import decode_access_token

logger = get_logger(__name__)

# Demo mode: when True, missing/invalid tokens fall back to a guest principal
# instead of returning 401. Toggle via env var DEMO_AUTH_OPTIONAL.
DEMO_AUTH_OPTIONAL = getattr(settings, "DEMO_AUTH_OPTIONAL", True)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with db_session() as session:
        yield session


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    token: Optional[str] = None,  # legacy query-string fallback
) -> dict:
    """Resolve the current user from Authorization: Bearer <token>.

    Behavior:
    - Header preferred over query-string `?token=...` (kept for back-compat).
    - In DEMO_AUTH_OPTIONAL mode, missing/invalid tokens yield a guest
      principal so legacy demo flows continue to work.
    - Otherwise raises 401.
    """
    raw = _extract_bearer(authorization) or token

    if not raw:
        if DEMO_AUTH_OPTIONAL:
            return {"sub": "guest", "uid": 0, "is_admin": False, "_anonymous": True}
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    payload = decode_access_token(raw)
    if not payload:
        if DEMO_AUTH_OPTIONAL:
            return {"sub": "guest", "uid": 0, "is_admin": False, "_anonymous": True}
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")

    return payload


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin privilege required")
    return user
