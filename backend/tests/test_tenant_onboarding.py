from __future__ import annotations

import uuid

from fastapi.testclient import TestClient


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _ok(response, context: str) -> dict:
    assert response.status_code < 400, f"{context}: {response.status_code} {response.text}"
    return response.json()


def test_tenant_onboarding_invite_email_login_reset_and_cross_tenant_guard():
    from app.main import app

    suffix = uuid.uuid4().hex[:8]
    with TestClient(app) as client:
        platform_login = _ok(
            client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"}),
            "platform login",
        )
        platform_headers = _headers(platform_login["token"])

        tenant_a = _ok(
            client.post(
                "/api/v1/platform/tenants",
                headers=platform_headers,
                json={
                    "name": f"Tenant A {suffix}",
                    "slug": f"tenant-a-{suffix}",
                    "domains": [f"a-{suffix}.example.com"],
                    "admin_email": f"admin@a-{suffix}.example.com",
                    "limits": {"users": 5, "applications": 5, "dynamicRecords": 5},
                },
            ),
            "create tenant a",
        )["data"]
        tenant_b = _ok(
            client.post(
                "/api/v1/platform/tenants",
                headers=platform_headers,
                json={
                    "name": f"Tenant B {suffix}",
                    "slug": f"tenant-b-{suffix}",
                    "domains": [f"b-{suffix}.example.com"],
                    "admin_email": f"admin@b-{suffix}.example.com",
                },
            ),
            "create tenant b",
        )["data"]

        accept_a = _ok(
            client.post(
                "/api/v1/auth/invite/accept",
                json={
                    "token": tenant_a["adminInvite"]["inviteUrl"].split("token=", 1)[1],
                    "password": "TenantA123!",
                    "display_name": "Tenant A Admin",
                },
            ),
            "accept tenant a invite",
        )
        accept_b = _ok(
            client.post(
                "/api/v1/auth/invite/accept",
                json={
                    "token": tenant_b["adminInvite"]["inviteUrl"].split("token=", 1)[1],
                    "password": "TenantB123!",
                    "display_name": "Tenant B Admin",
                },
            ),
            "accept tenant b invite",
        )

        login_a = _ok(
            client.post(
                "/api/v1/auth/login",
                json={"username": f"admin@a-{suffix}.example.com", "password": "TenantA123!"},
            ),
            "tenant a email login",
        )
        assert login_a["user"]["tenant_id"] == tenant_a["id"]
        me_a = _ok(client.get("/api/v1/auth/me", headers=_headers(login_a["token"])), "tenant a me")
        assert me_a["tenant_id"] == tenant_a["id"]
        assert me_a["tenant_status"] == "active"

        form = _ok(
            client.post(
                "/api/v1/forms",
                headers=_headers(accept_a["token"]),
                json={"name": f"Cross Tenant {suffix}", "code": f"cross_{suffix}", "status": "published"},
            ),
            "create tenant a form",
        )["data"]
        denied = client.get(f"/api/v1/forms/{form['id']}", headers=_headers(accept_b["token"]))
        assert denied.status_code == 404

        reset = _ok(
            client.post("/api/v1/auth/password-reset/request", json={"email": f"admin@a-{suffix}.example.com"}),
            "request reset",
        )
        assert reset["data"]["resetUrl"]
        _ok(
            client.post(
                "/api/v1/auth/password-reset/confirm",
                json={"token": reset["data"]["resetUrl"].split("token=", 1)[1], "new_password": "TenantA456!"},
            ),
            "confirm reset",
        )
        _ok(
            client.post(
                "/api/v1/auth/login",
                json={"username": f"admin@a-{suffix}.example.com", "password": "TenantA456!"},
            ),
            "login with reset password",
        )


def test_tenant_domain_status_and_quota_guards():
    from app.main import app

    suffix = uuid.uuid4().hex[:8]
    with TestClient(app) as client:
        token = _ok(
            client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"}),
            "platform login",
        )["token"]
        headers = _headers(token)
        tenant = _ok(
            client.post(
                "/api/v1/platform/tenants",
                headers=headers,
                json={
                    "name": f"Quota Tenant {suffix}",
                    "slug": f"quota-{suffix}",
                    "domains": [f"quota-{suffix}.example.com"],
                    "admin_email": f"owner@quota-{suffix}.example.com",
                    "limits": {"users": 1, "applications": 1, "dynamicRecords": 1},
                },
            ),
            "create quota tenant",
        )["data"]
        owner = _ok(
            client.post(
                "/api/v1/auth/invite/accept",
                json={
                    "token": tenant["adminInvite"]["inviteUrl"].split("token=", 1)[1],
                    "password": "Quota123!!",
                },
            ),
            "accept quota tenant invite",
        )
        first_app = _ok(
            client.post(
                "/api/v1/admin/applications",
                headers=_headers(owner["token"]),
                json={"name": f"App {suffix}", "code": f"app_{suffix}", "status": "published"},
            ),
            "create first app",
        )
        assert first_app["data"]["id"]
        second_app = client.post(
            "/api/v1/admin/applications",
            headers=_headers(owner["token"]),
            json={"name": f"App 2 {suffix}", "code": f"app2_{suffix}", "status": "published"},
        )
        assert second_app.status_code == 403

        _ok(
            client.put(
                f"/api/v1/platform/tenants/{tenant['id']}",
                headers=headers,
                json={"status": "suspended", "suspended_reason": "test"},
            ),
            "suspend tenant",
        )
        suspended_login = client.post(
            "/api/v1/auth/login",
            json={"username": f"owner@quota-{suffix}.example.com", "password": "Quota123!!"},
        )
        assert suspended_login.status_code == 403
