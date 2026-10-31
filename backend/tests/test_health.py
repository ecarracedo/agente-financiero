"""Tests for the backend health endpoint."""

from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_health_endpoint_returns_ok_status():
    """The health endpoint returns a successful status payload."""
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_endpoint_is_in_openapi_schema():
    """The health endpoint is discoverable through the OpenAPI schema."""
    client = TestClient(create_app())

    response = client.get("/openapi.json")

    assert response.status_code == 200
    assert "/health" in response.json()["paths"]
