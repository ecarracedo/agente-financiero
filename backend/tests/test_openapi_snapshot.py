"""Guard the committed OpenAPI snapshot against drift from the live application.

``frontend/openapi.json`` is the input for the generated frontend API types, so it
must describe the surface the backend actually serves. Without this guard nothing
detects a hand-edited or stale snapshot.
"""

import json
from pathlib import Path

from backend.app.main import create_app

SNAPSHOT_PATH = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def load_snapshot() -> dict:
    """Return the committed OpenAPI snapshot parsed from disk."""
    return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))


def test_snapshot_is_present_and_parsable() -> None:
    """Fail with a useful message when the committed snapshot is missing or malformed."""
    assert SNAPSHOT_PATH.is_file(), f"missing OpenAPI snapshot at {SNAPSHOT_PATH}"
    snapshot = load_snapshot()
    assert snapshot.get("openapi"), "snapshot is missing its openapi version"
    assert snapshot.get("paths") is not None, "snapshot is missing its paths"
    assert snapshot.get("components", {}).get("schemas") is not None, (
        "snapshot is missing its component schemas"
    )


def test_snapshot_matches_live_application_surface() -> None:
    """Fail when the committed snapshot drifts from the live application schema."""
    live = create_app().openapi()
    snapshot = load_snapshot()

    assert snapshot["openapi"] == live["openapi"]
    assert snapshot["info"]["version"] == live["info"]["version"]
    assert sorted(snapshot["paths"]) == sorted(live["paths"]), (
        "OpenAPI paths drifted; regenerate frontend/openapi.json"
    )
    assert sorted(snapshot["components"]["schemas"]) == sorted(
        live["components"]["schemas"]
    ), "OpenAPI schemas drifted; regenerate frontend/openapi.json"
