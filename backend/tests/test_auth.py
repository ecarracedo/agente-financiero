"""Authentication: login, session protection, and seeded single user."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.adapters.persistence.models import Base
from backend.app.main import create_app


def make_client(monkeypatch):
    """Build a test client with an in-memory database and seeded user."""
    monkeypatch.setenv("AUTH_USERNAME", "ecarracedo")
    monkeypatch.setenv("AUTH_EMAIL", "ecarracedo@gmail.com")
    monkeypatch.setenv("AUTH_PASSWORD", "CorrectHorseBatteryStaple1!")
    monkeypatch.setenv("AUTH_SECRET", "test-secret-for-auth-tests-only")
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    application = create_app(database_engine=engine)
    return TestClient(application, raise_server_exceptions=False)


def test_protected_route_requires_login(monkeypatch):
    """Unauthenticated requests to the API are rejected with 401."""
    client = make_client(monkeypatch)
    response = client.get("/api/v1/portfolio")
    assert response.status_code == 401


def test_health_and_ready_stay_public(monkeypatch):
    """Health probes must keep working without a session."""
    client = make_client(monkeypatch)
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 200


def test_login_with_wrong_password_is_rejected(monkeypatch):
    """Wrong credentials never create a session."""
    client = make_client(monkeypatch)
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "ecarracedo", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_login_then_me_and_protected_route(monkeypatch):
    """Seeded user logs in, /me returns identity, protected route opens."""
    client = make_client(monkeypatch)
    login = client.post(
        "/api/v1/auth/login",
        json={
            "username": "ecarracedo",
            "password": "CorrectHorseBatteryStaple1!",
        },
    )
    assert login.status_code == 200
    assert login.json()["username"] == "ecarracedo"

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ecarracedo@gmail.com"

    portfolio = client.get("/api/v1/portfolio")
    assert portfolio.status_code == 200


def test_password_is_stored_hashed_never_plain():
    """The scrypt hash format never contains the plaintext password."""
    from backend.app.api.auth import hash_password, verify_password

    stored = hash_password("CorrectHorseBatteryStaple1!")
    assert "CorrectHorseBatteryStaple1!" not in stored
    assert stored.startswith("scrypt$")
    assert verify_password("CorrectHorseBatteryStaple1!", stored)
    assert not verify_password("wrong-password", stored)


def _login(client, password="CorrectHorseBatteryStaple1!"):
    """Log in with the seeded credentials and return the response."""
    return client.post(
        "/api/v1/auth/login",
        json={"username": "ecarracedo", "password": password},
    )


def test_totp_setup_confirm_then_login_requires_code(monkeypatch):
    """After TOTP enrollment, password login alone is not enough."""
    import pyotp

    client = make_client(monkeypatch)
    assert _login(client).status_code == 200

    setup = client.post("/api/v1/auth/totp/setup")
    assert setup.status_code == 200
    secret = setup.json()["secret"]
    assert setup.json()["otpauth_url"].startswith("otpauth://totp/")

    code = pyotp.TOTP(secret).now()
    confirm = client.post("/api/v1/auth/totp/confirm", json={"code": code})
    assert confirm.status_code == 200
    assert confirm.json()["totp_enabled"] is True

    client.post("/api/v1/auth/logout")
    login = _login(client)
    assert login.status_code == 200
    assert login.json()["status"] == "totp_required"

    # Protected routes stay closed until the second factor succeeds.
    assert client.get("/api/v1/portfolio").status_code == 401

    verify = client.post("/api/v1/auth/verify-totp", json={"code": pyotp.TOTP(secret).now()})
    assert verify.status_code == 200
    assert client.get("/api/v1/portfolio").status_code == 200


def test_totp_wrong_code_is_rejected(monkeypatch):
    """An incorrect TOTP code does not complete the login."""
    import pyotp

    client = make_client(monkeypatch)
    _login(client)
    secret = client.post("/api/v1/auth/totp/setup").json()["secret"]
    client.post("/api/v1/auth/totp/confirm", json={"code": pyotp.TOTP(secret).now()})
    client.post("/api/v1/auth/logout")
    _login(client)

    response = client.post("/api/v1/auth/verify-totp", json={"code": "000000"})
    assert response.status_code == 401
    assert client.get("/api/v1/portfolio").status_code == 401


def test_totp_disable_requires_password(monkeypatch):
    """Disabling TOTP requires re-entering the password."""
    import pyotp

    client = make_client(monkeypatch)
    _login(client)
    secret = client.post("/api/v1/auth/totp/setup").json()["secret"]
    client.post("/api/v1/auth/totp/confirm", json={"code": pyotp.TOTP(secret).now()})

    wrong = client.post("/api/v1/auth/totp/disable", json={"password": "wrong"})
    assert wrong.status_code == 401

    disabled = client.post(
        "/api/v1/auth/totp/disable",
        json={"password": "CorrectHorseBatteryStaple1!"},
    )
    assert disabled.status_code == 200
    assert disabled.json()["totp_enabled"] is False
