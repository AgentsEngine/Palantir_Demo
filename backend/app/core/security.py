"""Security primitives: JWT encode/decode + password hashing.

All callers MUST use `settings.SECRET_KEY` from `app.config`. Inline
`SECRET_KEY` literals in routers are no longer permitted.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

ALGORITHM = "HS256"


def create_access_token(
    subject: str,
    extra: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
) -> str:
    """Create a JWT access token.

    Falls back to a base64-encoded JSON payload only if `python-jose` is missing,
    purely for demo bootstrap; production deployments MUST install python-jose.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra:
        payload.update(extra)

    try:
        from jose import jwt
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)
    except ImportError:
        logger.warning("python-jose not installed; falling back to insecure token encoding")
        import base64
        import json

        payload["exp"] = expire.isoformat()
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate JWT. Returns payload dict or None on failure."""
    try:
        from jose import jwt, JWTError
        try:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        except JWTError as exc:
            logger.debug("JWT decode failed: %s", exc)
            return None
    except ImportError:
        # Demo fallback (matches create_access_token fallback)
        import base64
        import json

        try:
            decoded = base64.urlsafe_b64decode(token.encode()).decode()
            return json.loads(decoded)
        except Exception:
            return None


def hash_password(password: str) -> str:
    """Bcrypt by default; SHA-256 fallback only for demo bootstrap."""
    try:
        from passlib.hash import bcrypt as _bcrypt
        return _bcrypt.hash(password)
    except Exception:
        logger.warning("passlib unavailable; using insecure SHA-256 password hashing")
        return "sha256$" + hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    if hashed.startswith("sha256$"):
        return hashed == "sha256$" + hashlib.sha256(password.encode()).hexdigest()
    try:
        from passlib.hash import bcrypt as _bcrypt
        return _bcrypt.verify(password, hashed)
    except Exception:
        return False
