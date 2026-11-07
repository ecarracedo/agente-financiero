"""Single-user authentication: hashed passwords, sessions, and TOTP.

Passwords are hashed with scrypt (stdlib) in a self-describing format.
Session tokens are opaque random values; only their SHA-256 hash is stored.
TOTP secrets are encrypted with Fernet using a key derived from ``AUTH_SECRET``.
The single user is seeded from ``AUTH_USERNAME`` / ``AUTH_EMAIL`` /
``AUTH_PASSWORD`` environment variables on first use, never from the repo.
"""

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import pyotp
from cryptography.fernet import Fernet
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, sessionmaker

from backend.app.adapters.persistence.models import AuthSessionRecord, UserRecord

SESSION_COOKIE = "agente_session"
PREAUTH_COOKIE = "agente_preauth"
SESSION_TTL = timedelta(days=7)
PREAUTH_TTL = timedelta(minutes=5)
SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1


# ---------------------------------------------------------------------------
# Password hashing (scrypt)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a password with scrypt in a self-describing string format."""
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32
    )
    return "$".join(
        [
            "scrypt",
            str(SCRYPT_N),
            str(SCRYPT_R),
            str(SCRYPT_P),
            base64.b64encode(salt).decode(),
            base64.b64encode(derived).decode(),
        ]
    )


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored scrypt hash in constant time."""
    try:
        scheme, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        candidate = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate, expected)


# ---------------------------------------------------------------------------
# Secret encryption for TOTP
# ---------------------------------------------------------------------------

def _fernet() -> Fernet:
    """Build a Fernet cipher from the AUTH_SECRET environment variable."""
    secret = os.environ.get("AUTH_SECRET", "")
    if not secret:
        raise RuntimeError("AUTH_SECRET environment variable is required")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(secret_value: str) -> str:
    """Encrypt a TOTP secret for storage."""
    return _fernet().encrypt(secret_value.encode("utf-8")).decode()


def decrypt_secret(encrypted: str) -> str:
    """Decrypt a stored TOTP secret."""
    return _fernet().decrypt(encrypted.encode("utf-8")).decode()


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def _session_factory(request: Request):
    """Return a session factory bound to the app's database engine."""
    return sessionmaker(bind=request.app.state.database_engine_provider())


def seed_user(session: Session) -> UserRecord | None:
    """Create the single user from environment variables when missing."""
    username = os.environ.get("AUTH_USERNAME", "")
    email = os.environ.get("AUTH_EMAIL", "")
    password = os.environ.get("AUTH_PASSWORD", "")
    if not username or not email or not password:
        return None
    existing = session.query(UserRecord).filter_by(username=username).first()
    if existing is not None:
        return existing
    user = UserRecord(
        username=username,
        email=email,
        password_hash=hash_password(password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _get_user_by_username(session: Session, username: str) -> UserRecord | None:
    """Return the user with the given username, or None."""
    return session.query(UserRecord).filter_by(username=username).first()


def _create_session(
    session: Session, user_id: int, kind: str, ttl: timedelta
) -> str:
    """Create a session row and return the raw token to send as a cookie."""
    token = secrets.token_urlsafe(32)
    record = AuthSessionRecord(
        user_id=user_id,
        token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        kind=kind,
        expires_at=datetime.now(timezone.utc) + ttl,
    )
    session.add(record)
    session.commit()
    return token


def _session_user(session: Session, token: str | None, kind: str) -> UserRecord | None:
    """Resolve a raw token to its user when valid and unexpired."""
    if not token:
        return None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    record = (
        session.query(AuthSessionRecord)
        .filter_by(token_hash=token_hash, kind=kind)
        .first()
    )
    if record is None:
        return None
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        session.delete(record)
        session.commit()
        return None
    return session.query(UserRecord).filter_by(id=record.user_id).first()


def _delete_session(session: Session, token: str | None, kind: str) -> None:
    """Delete the session row for a raw token, when present."""
    if not token:
        return
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    record = (
        session.query(AuthSessionRecord)
        .filter_by(token_hash=token_hash, kind=kind)
        .first()
    )
    if record is not None:
        session.delete(record)
        session.commit()


def _set_cookie(
    response: Response, name: str, value: str, max_age_seconds: int
) -> None:
    """Set an HttpOnly session cookie (secure flag via COOKIE_SECURE)."""
    response.set_cookie(
        key=name,
        value=value,
        httponly=True,
        samesite="lax",
        secure=os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes"),
        max_age=max_age_seconds,
        path="/",
    )


def _clear_cookie(response: Response, name: str) -> None:
    """Clear a session cookie."""
    response.delete_cookie(key=name, path="/")


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    """Credentials submitted to the login endpoint."""

    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class TotpVerifyRequest(BaseModel):
    """Six-digit TOTP code submitted for verification."""

    code: str = Field(min_length=6, max_length=6)


class TotpConfirmRequest(BaseModel):
    """Six-digit TOTP code submitted to confirm enrollment."""

    code: str = Field(min_length=6, max_length=6)


class TotpDisableRequest(BaseModel):
    """Password re-entry required to disable TOTP."""

    password: str = Field(min_length=1, max_length=256)


class UserResponse(BaseModel):
    """Public identity of the authenticated user."""

    username: str
    email: str
    totp_enabled: bool


class LoginResponse(BaseModel):
    """Login outcome: either a full session or a pending TOTP step."""

    status: str
    username: str | None = None
    totp_enabled: bool = False


class TotpSetupResponse(BaseModel):
    """Enrollment material returned once when setting up TOTP."""

    secret: str
    otpauth_url: str


# ---------------------------------------------------------------------------
# Dependency protecting the existing API
# ---------------------------------------------------------------------------

def require_user(
    request: Request,
    agente_session: str | None = Cookie(default=None),
) -> UserRecord:
    """Require a valid full session, or reject with 401."""
    factory = _session_factory(request)
    with factory() as session:
        seed_user(session)
        user = _session_user(session, agente_session, kind="full")
        if user is None:
            raise HTTPException(status_code=401, detail="authentication required")
        # Detach enough data to use outside the session scope.
        user_id = user.id
        username = user.username
        email = user.email
        totp_enabled = user.totp_enabled
    return UserRecord(
        id=user_id, username=username, email=email, totp_enabled=totp_enabled
    )


# ---------------------------------------------------------------------------
# Auth routes (unprotected)
# ---------------------------------------------------------------------------

auth_router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@auth_router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    agente_session: str | None = Cookie(default=None),
) -> LoginResponse:
    """Authenticate with username and password, then require TOTP when enabled."""
    factory = _session_factory(request)
    with factory() as session:
        user = seed_user(session)
        if user is None:
            raise HTTPException(status_code=401, detail="invalid credentials")
        candidate = _get_user_by_username(session, payload.username)
        if candidate is None or not verify_password(payload.password, candidate.password_hash):
            raise HTTPException(status_code=401, detail="invalid credentials")
        user = candidate
        if user.totp_enabled:
            token = _create_session(session, user.id, kind="preauth", ttl=PREAUTH_TTL)
            _set_cookie(
                response, PREAUTH_COOKIE, token, int(PREAUTH_TTL.total_seconds())
            )
            return LoginResponse(status="totp_required", totp_enabled=True)
        token = _create_session(session, user.id, kind="full", ttl=SESSION_TTL)
        _set_cookie(response, SESSION_COOKIE, token, int(SESSION_TTL.total_seconds()))
        return LoginResponse(
            status="ok", username=user.username, totp_enabled=False
        )


@auth_router.post("/verify-totp", response_model=LoginResponse)
def verify_totp(
    payload: TotpVerifyRequest,
    request: Request,
    response: Response,
    agente_preauth: str | None = Cookie(default=None),
) -> LoginResponse:
    """Complete login with a TOTP code after a successful password step."""
    factory = _session_factory(request)
    with factory() as session:
        user = _session_user(session, agente_preauth, kind="preauth")
        if user is None or not user.totp_secret_encrypted:
            raise HTTPException(status_code=401, detail="authentication required")
        totp = pyotp.TOTP(decrypt_secret(user.totp_secret_encrypted))
        if not totp.verify(payload.code, valid_window=1):
            raise HTTPException(status_code=401, detail="invalid code")
        _delete_session(session, agente_preauth, kind="preauth")
        token = _create_session(session, user.id, kind="full", ttl=SESSION_TTL)
        _set_cookie(response, SESSION_COOKIE, token, int(SESSION_TTL.total_seconds()))
        _clear_cookie(response, PREAUTH_COOKIE)
        return LoginResponse(
            status="ok", username=user.username, totp_enabled=True
        )


@auth_router.get("/me", response_model=UserResponse)
def me(user: UserRecord = Depends(require_user)) -> UserResponse:
    """Return the authenticated user's identity."""
    return UserResponse(
        username=user.username, email=user.email, totp_enabled=bool(user.totp_enabled)
    )


@auth_router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    agente_session: str | None = Cookie(default=None),
) -> None:
    """End the current session and clear its cookie."""
    factory = _session_factory(request)
    with factory() as session:
        _delete_session(session, agente_session, kind="full")
    _clear_cookie(response, SESSION_COOKIE)


@auth_router.post("/totp/setup", response_model=TotpSetupResponse)
def totp_setup(
    request: Request,
    user: UserRecord = Depends(require_user),
) -> TotpSetupResponse:
    """Generate a new TOTP secret and return enrollment material."""
    factory = _session_factory(request)
    with factory() as session:
        record = session.query(UserRecord).filter_by(id=user.id).first()
        assert record is not None
        secret_value = pyotp.random_base32()
        record.totp_secret_encrypted = encrypt_secret(secret_value)
        record.totp_enabled = False
        session.commit()
        otpauth_url = pyotp.TOTP(secret_value).provisioning_uri(
            name=record.email, issuer_name="Agente Financiero"
        )
    return TotpSetupResponse(secret=secret_value, otpauth_url=otpauth_url)


@auth_router.post("/totp/confirm", response_model=UserResponse)
def totp_confirm(
    payload: TotpConfirmRequest,
    request: Request,
    user: UserRecord = Depends(require_user),
) -> UserResponse:
    """Enable TOTP after verifying a code from the authenticator app."""
    factory = _session_factory(request)
    with factory() as session:
        record = session.query(UserRecord).filter_by(id=user.id).first()
        assert record is not None
        if not record.totp_secret_encrypted:
            raise HTTPException(status_code=400, detail="TOTP setup not started")
        totp = pyotp.TOTP(decrypt_secret(record.totp_secret_encrypted))
        if not totp.verify(payload.code, valid_window=1):
            raise HTTPException(status_code=401, detail="invalid code")
        record.totp_enabled = True
        session.commit()
        return UserResponse(
            username=record.username,
            email=record.email,
            totp_enabled=True,
        )


@auth_router.post("/totp/disable", response_model=UserResponse)
def totp_disable(
    payload: TotpDisableRequest,
    request: Request,
    user: UserRecord = Depends(require_user),
) -> UserResponse:
    """Disable TOTP after re-entering the password."""
    factory = _session_factory(request)
    with factory() as session:
        record = session.query(UserRecord).filter_by(id=user.id).first()
        assert record is not None
        if not verify_password(payload.password, record.password_hash):
            raise HTTPException(status_code=401, detail="invalid credentials")
        record.totp_enabled = False
        record.totp_secret_encrypted = None
        session.commit()
        return UserResponse(
            username=record.username,
            email=record.email,
            totp_enabled=False,
        )
