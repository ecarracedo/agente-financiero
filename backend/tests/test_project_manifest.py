"""Tests for the installable backend package manifest."""

import tomllib
from pathlib import Path


def test_manifest_includes_nested_backend_packages():
    """Installed distributions include app, domain, and persistence packages."""
    manifest_path = Path(__file__).parents[1] / "pyproject.toml"
    project = tomllib.loads(manifest_path.read_text())
    packages = project["tool"]["setuptools"]["packages"]

    assert "backend" in packages
    assert "backend.app" in packages
    assert "backend.app.domain" in packages
    assert "backend.app.application" in packages
    assert "backend.app.api" in packages
    assert "backend.app.adapters" in packages
    assert "backend.app.adapters.migration" in packages
    assert "backend.app.adapters.persistence" in packages
