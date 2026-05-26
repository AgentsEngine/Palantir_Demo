from fastapi.testclient import TestClient


def test_release_current_endpoint_returns_version_manifest():
    from app.main import app

    client = TestClient(app)
    response = client.get("/api/v1/release/current")

    assert response.status_code == 200
    data = response.json()
    assert data["version"]
    assert isinstance(data["highlights"], list)
    assert isinstance(data["details"], list)
