from fastapi import HTTPException
import pytest


def test_totp_verification_accepts_current_code(monkeypatch):
    from app.services import iam

    secret = "JBSWY3DPEHPK3PXP"
    monkeypatch.setattr(iam.time, "time", lambda: 1_700_000_000)
    code = iam._hotp(secret, int(1_700_000_000 // 30))

    assert iam.verify_totp(secret, code)
    assert not iam.verify_totp(secret, "000000")


def test_condition_matches_supported_json_dsl():
    from app.services.iam import condition_matches

    user = {"uid": 42, "tenant_id": 1, "org_unit_ids": [7, 8]}
    condition = {
        "rules": [
            {"field": "owner_id", "op": "equals", "value": "$current_user_id"},
            {"field": "status", "op": "in", "value": ["open", "pending"]},
            {"field": "title", "op": "contains", "value": "quality"},
            {"field": "score", "op": "between", "value": [80, 99]},
        ]
    }

    assert condition_matches(condition, {"owner_id": 42, "status": "open", "title": "Quality alert", "score": 88}, user)
    assert not condition_matches(condition, {"owner_id": 99, "status": "open", "title": "Quality alert", "score": 88}, user)


def test_field_rules_drive_read_and_write_decisions():
    from app.core.permissions import _field_rule_allows

    rules = {
        "fields": {
            "cost": {"visible": False, "editable": False},
            "status": {"visible": True, "editable": True},
            "secret": {"deny": True},
        }
    }

    assert _field_rule_allows(rules, "cost", "view") is False
    assert _field_rule_allows(rules, "cost", "edit") is False
    assert _field_rule_allows(rules, "status", "view") is True
    assert _field_rule_allows(rules, "status", "edit") is True
    assert _field_rule_allows(rules, "secret", "view") is False
    assert _field_rule_allows(rules, "unknown", "view") is None


def test_password_policy_rejects_short_or_weak_password(monkeypatch):
    from app.config import settings
    from app.services.iam import validate_password_policy

    monkeypatch.setattr(settings, "PASSWORD_MIN_LENGTH", 10)
    monkeypatch.setattr(settings, "PASSWORD_REQUIRE_COMPLEXITY", True)

    with pytest.raises(HTTPException):
        validate_password_policy("short")
    with pytest.raises(HTTPException):
        validate_password_policy("lowercaseonly")

    validate_password_policy("StrongPass1!")
