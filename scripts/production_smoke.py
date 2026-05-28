"""Production readiness smoke checks for the SaaS multi-tenant path.

This script intentionally uses public HTTP APIs only. It logs in as the
platform administrator, checks readiness, creates a tenant with an invite,
and verifies platform-only endpoints are reachable by the platform admin.
"""
from __future__ import annotations

import argparse
import sys
from typing import Any

import requests


def _request(method: str, url: str, **kwargs: Any) -> dict[str, Any]:
    response = requests.request(method, url, timeout=20, **kwargs)
    if response.status_code >= 400:
        raise RuntimeError(f"{method} {url} failed: {response.status_code} {response.text[:500]}")
    if response.text:
        return response.json()
    return {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--username", default="admin@manufoundry.local")
    parser.add_argument("--password", default="admin123")
    parser.add_argument("--tenant-slug", default="smoke-tenant")
    parser.add_argument("--tenant-domain", default="smoke.local")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    readiness = _request("GET", f"{base_url}/api/v1/system/readiness")
    print(f"readiness={readiness.get('status')}")

    login = _request(
        "POST",
        f"{base_url}/api/v1/auth/login",
        json={"username": args.username, "password": args.password},
    )
    token = login.get("access_token") or login.get("data", {}).get("access_token")
    if not token:
        raise RuntimeError("login did not return an access token")
    headers = {"Authorization": f"Bearer {token}"}

    tenant_payload = {
        "name": "Smoke Tenant",
        "slug": args.tenant_slug,
        "domains": [args.tenant_domain],
        "admin_email": f"admin@{args.tenant_domain}",
    }
    tenant = _request("POST", f"{base_url}/api/v1/platform/tenants", json=tenant_payload, headers=headers)
    tenant_id = tenant.get("data", {}).get("tenant", {}).get("id") or tenant.get("data", {}).get("id")
    if not tenant_id:
        raise RuntimeError("tenant creation did not return tenant id")
    print(f"tenant_id={tenant_id}")

    exports = _request("POST", f"{base_url}/api/v1/platform/tenants/{tenant_id}/exports", headers=headers)
    if not exports.get("ok"):
        raise RuntimeError(f"tenant export failed: {exports}")
    print(f"export_id={exports['data']['id']}")

    metrics = _request("GET", f"{base_url}/api/v1/system/metrics")
    print(f"requests_total={metrics.get('data', {}).get('requests_total')}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"smoke failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
