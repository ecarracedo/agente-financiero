"""Tests for database readiness and local Compose configuration."""

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
import yaml

from backend.app.main import create_app


class UnavailableEngine:
    """Database engine double that simulates an unavailable database."""

    def connect(self):
        """Raise when the readiness handler attempts to connect."""
        raise RuntimeError("database unavailable")


def test_readiness_is_healthy_when_database_accepts_queries():
    """Readiness reports ready only after a database query succeeds."""
    engine = create_engine("sqlite+pysqlite:///:memory:")
    client = TestClient(create_app(database_engine=engine))

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}
    engine.dispose()


def test_readiness_returns_service_unavailable_when_database_fails():
    """Readiness fails without marking the process liveness endpoint down."""
    client = TestClient(create_app(database_engine=UnavailableEngine()))

    response = client.get("/ready")
    liveness = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"detail": "database unavailable"}
    assert liveness.status_code == 200


def test_compose_defines_private_postgres_and_backend_readiness():
    """Compose waits for healthy PostgreSQL before starting the backend."""
    project_root = Path(__file__).parents[2]
    compose = yaml.safe_load(project_root.joinpath("compose.yaml").read_text())
    services = compose["services"]
    database = services["postgres"]
    backend = services["backend"]

    assert database["image"].startswith("postgres:")
    assert database["healthcheck"]["test"]
    assert backend["depends_on"]["postgres"]["condition"] == "service_healthy"
    assert backend["healthcheck"]["test"]
    assert backend["ports"] == ["${API_PORT:-8000}:8000"]


def test_backend_container_runs_migrations_before_uvicorn():
    """The backend container upgrades schema before serving HTTP requests."""
    project_root = Path(__file__).parents[2]
    dockerfile = project_root.joinpath("Dockerfile.backend").read_text()
    migration_command = "alembic -c /app/backend/alembic.ini upgrade head"
    server_command = "uvicorn backend.app.main:app"

    assert migration_command in dockerfile
    assert server_command in dockerfile
    assert dockerfile.index(migration_command) < dockerfile.index(server_command)
