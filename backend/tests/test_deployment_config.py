"""Tests for the Docker Compose deployment configuration.

These tests read the deployment files as text and assert the contracts that
keep this single-user stack safe: PostgreSQL is never published, the backend
waits for a healthy database and migrates before serving, the frontend image
serves the SPA and proxies the API on a single origin, the development override
keeps hot reload over isolated data, and no secret reaches an image.

They are structural on purpose. They import no application code and need no
Docker daemon, so they run in CI on every push like the rest of the suite.
"""

from __future__ import annotations

import re
import shlex
from pathlib import Path
from typing import Any

import yaml

REPOSITORY_ROOT = Path(__file__).parents[2]
COMPOSE_PATH = REPOSITORY_ROOT / "compose.yaml"
DEV_COMPOSE_PATH = REPOSITORY_ROOT / "compose.dev.yaml"
ENV_EXAMPLE_PATH = REPOSITORY_ROOT / ".env.example"
DOCKERIGNORE_PATH = REPOSITORY_ROOT / ".dockerignore"
FRONTEND_DOCKERFILE_PATH = REPOSITORY_ROOT / "Dockerfile.frontend"
BACKEND_DOCKERFILE_PATH = REPOSITORY_ROOT / "Dockerfile.backend"
NGINX_CONFIG_PATH = REPOSITORY_ROOT / "frontend" / "nginx.conf"
VITE_CONFIG_PATH = REPOSITORY_ROOT / "frontend" / "vite.config.ts"
BACKEND_MAIN_PATH = REPOSITORY_ROOT / "backend" / "app" / "main.py"

# Matches `${VAR}` and `${VAR:...}` while skipping the escaped `$${VAR}` form
# Docker Compose uses to pass a literal dollar sign to a container shell.
INTERPOLATION_PATTERN = re.compile(r"(?<!\$)\$\{([A-Z0-9_]+)(?::[-?][^}]*)?\}")
REQUIRED_INTERPOLATION_PATTERN = re.compile(r"(?<!\$)\$\{([A-Z0-9_]+):\?")
# Nginx configuration uses no nested blocks, so a non-greedy match per location
# captures the whole block.
LOCATION_PATTERN = re.compile(r"location\s+([^{]+)\{([^}]*)\}", re.DOTALL)


class ComposeLoader(yaml.SafeLoader):
    """Safe loader that understands the Compose merge tags.

    `!reset` clears the value a service inherited from the base file, so a key
    carrying that tag is dropped here, which is the merged result Compose
    computes. `!override` replaces a value instead of merging it, and is read as
    the plain value it tags.
    """

    def construct_mapping(self, node: yaml.MappingNode, deep: bool = False) -> Any:
        """Build a mapping, skipping every key reset by the Compose `!reset` tag."""
        self.flatten_mapping(node)
        mapping = {}
        for key_node, value_node in node.value:
            if getattr(value_node, "tag", None) == "!reset":
                continue
            key = self.construct_object(key_node, deep=deep)
            mapping[key] = self.construct_object(value_node, deep=deep)
        return mapping


def _passthrough(loader: ComposeLoader, node: yaml.Node) -> Any:
    """Return the tagged node as plain data, ignoring the merge directive."""
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    return loader.construct_mapping(node, deep=True)


ComposeLoader.add_constructor("!reset", _passthrough)
ComposeLoader.add_constructor("!override", _passthrough)


def load_compose(path: Path) -> dict[str, Any]:
    """Load a Compose file as plain data."""
    return yaml.load(path.read_text(encoding="utf-8"), Loader=ComposeLoader)


def services(path: Path) -> dict[str, Any]:
    """Return the services mapping of a Compose file."""
    return load_compose(path)["services"]


def appears_before(text: str, first: str, second: str) -> bool:
    """Report whether both tokens appear with `first` before `second`."""
    return first in text and second in text and text.index(first) < text.index(second)


def command_text(service: dict[str, Any]) -> str:
    """Flatten a service command, whether it is a string or an argument list."""
    command = service.get("command", "")
    if isinstance(command, list):
        return " ".join(str(part) for part in command)
    return str(command)


def command_tokens(service: dict[str, Any]) -> list[str]:
    """Split a service command into argv tokens.

    A substring check cannot tell `--reload` from `--reload-dir`, so a flag that
    governs behaviour is asserted as its own token instead.
    """
    return shlex.split(command_text(service))


def declared_variables() -> set[str]:
    """Return the variable names declared by the example environment file."""
    names: set[str] = set()
    for line in ENV_EXAMPLE_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        names.add(stripped.split("=", 1)[0].strip())
    return names


def test_postgres_is_never_published_and_keeps_its_volume():
    """PostgreSQL stays reachable only on the Compose network."""
    postgres = services(COMPOSE_PATH)["postgres"]

    assert "ports" not in postgres
    assert postgres["expose"] == ["5432"]
    assert postgres["volumes"] == ["postgres_data:/var/lib/postgresql/data"]
    assert "postgres_data" in load_compose(COMPOSE_PATH)["volumes"]
    healthcheck = " ".join(postgres["healthcheck"]["test"])
    assert "pg_isready" in healthcheck


def test_backend_migrates_before_serving_and_waits_for_a_healthy_database():
    """The backend never serves against an unmigrated or absent database."""
    backend = services(COMPOSE_PATH)["backend"]

    assert backend["depends_on"]["postgres"]["condition"] == "service_healthy"

    # The base stack runs the image entrypoint, so that contract lives there.
    image_entrypoint = BACKEND_DOCKERFILE_PATH.read_text(encoding="utf-8")
    assert appears_before(image_entrypoint, "alembic", "uvicorn")

    dev_backend = services(DEV_COMPOSE_PATH)["backend"]
    dev_command = command_text(dev_backend)
    assert "--reload" in command_tokens(dev_backend)
    assert appears_before(dev_command, "alembic", "uvicorn")


def test_frontend_service_serves_the_spa_with_the_api_proxied():
    """The frontend service builds its image and waits for a healthy backend."""
    compose = load_compose(COMPOSE_PATH)
    frontend = compose["services"]["frontend"]

    assert frontend["build"]["dockerfile"] == "Dockerfile.frontend"
    assert "VITE_API_BASE_URL" in frontend["build"]["args"]
    assert frontend["depends_on"]["backend"]["condition"] == "service_healthy"
    assert frontend["ports"] == ["${WEB_PORT:-3000}:80"]
    assert "healthcheck" in frontend


def test_service_credentials_come_from_the_environment_never_from_a_file():
    """No service reads a secret file and no password is written literally."""
    compose = load_compose(COMPOSE_PATH)
    postgres = compose["services"]["postgres"]
    backend = compose["services"]["backend"]

    assert "env_file" not in postgres and "env_file" not in backend
    assert postgres["environment"]["POSTGRES_PASSWORD"].startswith("${")
    assert backend["environment"]["DB_PASSWORD"].startswith("${")
    assert backend["environment"]["DB_HOST"] == "postgres"


def test_frontend_image_builds_the_spa_and_serves_it_with_nginx():
    """The frontend image is a multi-stage build with an injected API base URL."""
    dockerfile = FRONTEND_DOCKERFILE_PATH.read_text(encoding="utf-8")
    stages = [line for line in dockerfile.splitlines() if line.startswith("FROM ")]

    assert len(stages) >= 2
    assert "node" in stages[0]
    assert "nginx" in stages[-1]
    assert "ARG VITE_API_BASE_URL" in dockerfile
    assert "frontend/nginx.conf" in dockerfile
    assert "npm run build" in dockerfile


def nginx_locations() -> dict[str, str]:
    """Map every Nginx location header to the body of its block."""
    configuration = NGINX_CONFIG_PATH.read_text(encoding="utf-8")
    return {
        header.strip(): body for header, body in LOCATION_PATTERN.findall(configuration)
    }


def proxied_locations() -> dict[str, str]:
    """Map the Nginx locations that forward to the backend to their body."""
    return {
        header: body
        for header, body in nginx_locations().items()
        if "proxy_pass" in body
    }


def proxied_matcher() -> re.Pattern[str]:
    """Compile the single regex location that forwards requests to the backend.

    The proxied endpoints share one block so their headers cannot drift apart,
    so more than one matcher means the consolidation was undone.
    """
    headers = [
        header
        for header, body in proxied_locations().items()
        if header.startswith("~ ") and "proxy_pass" in body
    ]

    assert len(headers) == 1, f"expected one proxied regex location, got {headers}"
    return re.compile(headers[0].removeprefix("~ ").strip())


def test_nginx_serves_client_routes_and_forwards_the_api_unchanged():
    """Nginx falls back to the SPA entry point and proxies `/api` verbatim."""
    locations = nginx_locations()

    assert "try_files $uri $uri/ /index.html" in locations["/"]

    matcher = proxied_matcher()
    assert matcher.match("/api/v1/portfolio")
    # The target carries no path suffix, so `/api/v1/...` is not duplicated.
    for body in proxied_locations().values():
        assert "proxy_pass http://$backend_upstream;" in body


def test_nginx_proxies_health_and_readiness_instead_of_serving_the_spa():
    """A probe on the public origin reports the database, not the SPA."""
    matcher = proxied_matcher()

    assert matcher.match("/health")
    assert matcher.match("/ready")
    # Every client-side route still falls through to the SPA entry point.
    assert not matcher.match("/portfolio")
    assert not matcher.match("/healthz")


def test_nginx_keeps_near_miss_paths_on_the_spa_fallback():
    """Paths that only resemble a proxied one stay on the SPA, not the backend."""
    matcher = proxied_matcher()

    for path in ("/apix", "/healthy", "/readiness", "/"):
        assert not matcher.match(path)


def test_nginx_re_resolves_the_backend_instead_of_caching_it_at_startup():
    """A backend recreated with a new address stays reachable without a restart."""
    configuration = NGINX_CONFIG_PATH.read_text(encoding="utf-8")

    # Docker's embedded DNS, so the name resolves through the container network.
    assert "resolver 127.0.0.11" in configuration
    # The upstream is a variable, because a literal name would be resolved once
    # at startup and then cached for the lifetime of this container.
    assert "set $backend_upstream backend:8000;" in configuration
    assert "proxy_pass http://$backend_upstream;" in configuration
    assert "proxy_pass http://backend:8000;" not in configuration


def test_dev_override_adds_hot_reload_over_isolated_data():
    """The override reloads both applications and keeps its own database volume."""
    dev = services(DEV_COMPOSE_PATH)

    assert "--reload" in command_tokens(dev["backend"])
    assert "./backend:/app/backend" in dev["backend"]["volumes"]
    frontend_command = command_text(dev["frontend"])
    assert "npm run dev" in frontend_command
    assert "./frontend:/app" in dev["frontend"]["volumes"]
    assert "postgres_dev_data:/var/lib/postgresql/data" in dev["postgres"]["volumes"]
    assert "postgres_dev_data" in load_compose(DEV_COMPOSE_PATH)["volumes"]
    assert "ports" not in dev["postgres"]


def test_dev_frontend_serves_the_vite_app_instead_of_the_built_bundle():
    """The dev override replaces the built image with the Vite dev server."""
    dev = services(DEV_COMPOSE_PATH)["frontend"]

    assert "build" not in dev
    assert dev["image"] == "node:22-slim"
    assert "healthcheck" not in dev
    assert dev["ports"] == ["${WEB_DEV_PORT:-5173}:5173"]


def test_dev_flow_avoids_cross_origin_calls_without_adding_cors():
    """Development stays single-origin through the Vite proxy, not through CORS."""
    vite_configuration = VITE_CONFIG_PATH.read_text(encoding="utf-8")
    main_module = BACKEND_MAIN_PATH.read_text(encoding="utf-8")

    assert "server:" in vite_configuration
    assert "proxy:" in vite_configuration
    assert "'/api'" in vite_configuration
    assert "VITE_PROXY_TARGET" in vite_configuration
    assert "CORSMiddleware" not in main_module


def test_dockerignore_keeps_secrets_and_local_state_out_of_the_images():
    """The build context never carries credentials, data or local tooling.

    Patterns are matched against the path relative to the context root, so a
    bare name only excludes that name at the root. The nested paths that matter
    are asserted in the `**/` form that matches them at any depth.
    """
    ignored = {
        line.strip()
        for line in DOCKERIGNORE_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#") and line.strip() != "!"
    }

    assert {"**/.env", "**/.env.*", "**/node_modules/"} <= ignored
    assert {"**/dist/", "**/__pycache__/", "**/*.py[cod]"} <= ignored
    assert {".git", "verify/", "backend/tests/"} <= ignored
    assert "finance.db" in ignored


def test_env_example_declares_every_interpolated_variable():
    """A fresh clone can run both flows with explicit values for each variable."""
    declared = declared_variables()

    assert {
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "API_PORT",
        "WEB_PORT",
        "WEB_DEV_PORT",
        "VITE_API_BASE_URL",
    } <= declared

    interpolated: set[str] = set()
    required: set[str] = set()
    for path in (COMPOSE_PATH, DEV_COMPOSE_PATH):
        text = path.read_text(encoding="utf-8")
        interpolated |= set(INTERPOLATION_PATTERN.findall(text))
        required |= set(REQUIRED_INTERPOLATION_PATTERN.findall(text))

    assert required, "no required interpolation found; the check would be vacuous"
    assert interpolated <= declared
