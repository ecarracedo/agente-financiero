"""SMTP delivery for target-alert crossings.

This adapter turns a persisted crossing into one plain-text email and sends it
through ``smtplib`` from the standard library. It reads everything it needs
from the environment, so no new runtime dependency is introduced. When no SMTP
host is configured it builds a no-op notifier: the app still records and shows
crossings, it simply has no external channel.

Transport is injected as a callable so tests can capture messages without a
real mail server; production uses :func:`_smtp_transport`, which opens a fresh
connection per message and lets any failure propagate to the caller.
"""

from __future__ import annotations

import os
import smtplib
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from email.message import EmailMessage

from backend.app.domain.alerts import TriggeredAlert

SMTP_HOST_ENVIRONMENT_VARIABLE = "SMTP_HOST"
SMTP_PORT_ENVIRONMENT_VARIABLE = "SMTP_PORT"
SMTP_USER_ENVIRONMENT_VARIABLE = "SMTP_USER"
SMTP_PASSWORD_ENVIRONMENT_VARIABLE = "SMTP_PASSWORD"
SMTP_USE_TLS_ENVIRONMENT_VARIABLE = "SMTP_USE_TLS"
SMTP_TIMEOUT_ENVIRONMENT_VARIABLE = "SMTP_TIMEOUT"
ALERT_EMAIL_TO_ENVIRONMENT_VARIABLE = "ALERT_EMAIL_TO"
ACCOUNT_EMAIL_ENVIRONMENT_VARIABLE = "AUTH_EMAIL"

DEFAULT_SMTP_PORT = 587
DEFAULT_SMTP_TIMEOUT_SECONDS = 10.0

Transport = Callable[["SmtpSettings", EmailMessage], None]


@dataclass(frozen=True)
class SmtpSettings:
    """Connection and identity settings required to deliver one alert email."""

    host: str
    to_address: str
    from_address: str
    port: int = DEFAULT_SMTP_PORT
    username: str | None = None
    password: str | None = None
    use_tls: bool = True
    timeout: float = DEFAULT_SMTP_TIMEOUT_SECONDS

    @classmethod
    def from_environment(
        cls, environment: Mapping[str, str] | None = None
    ) -> "SmtpSettings | None":
        """Build settings from the environment, or ``None`` when SMTP is off.

        Args:
            environment: Mapping to read from. Defaults to the process
                environment.

        Returns:
            Configured settings when ``SMTP_HOST`` is present, otherwise
            ``None`` so the caller can fall back to a no-op notifier.
        """
        source = os.environ if environment is None else environment
        host = (source.get(SMTP_HOST_ENVIRONMENT_VARIABLE) or "").strip()
        if not host:
            return None
        to_address = (
            source.get(ALERT_EMAIL_TO_ENVIRONMENT_VARIABLE)
            or source.get(ACCOUNT_EMAIL_ENVIRONMENT_VARIABLE)
            or ""
        ).strip()
        from_address = (source.get(ACCOUNT_EMAIL_ENVIRONMENT_VARIABLE) or "").strip()
        if not from_address:
            from_address = to_address

        return cls(
            host=host,
            to_address=to_address,
            from_address=from_address,
            port=_read_int(source, SMTP_PORT_ENVIRONMENT_VARIABLE, DEFAULT_SMTP_PORT),
            username=(source.get(SMTP_USER_ENVIRONMENT_VARIABLE) or "").strip() or None,
            password=source.get(SMTP_PASSWORD_ENVIRONMENT_VARIABLE) or None,
            use_tls=_read_bool(
                source, SMTP_USE_TLS_ENVIRONMENT_VARIABLE, default=True
            ),
            timeout=_read_float(
                source, SMTP_TIMEOUT_ENVIRONMENT_VARIABLE, DEFAULT_SMTP_TIMEOUT_SECONDS
            ),
        )


def _read_int(source: Mapping[str, str], name: str, default: int) -> int:
    """Read a positive integer environment value, falling back to ``default``."""
    raw = (source.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def _read_float(source: Mapping[str, str], name: str, default: float) -> float:
    """Read a positive float environment value, falling back to ``default``."""
    raw = (source.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value if value > 0 else default


def _read_bool(source: Mapping[str, str], name: str, *, default: bool) -> bool:
    """Read a boolean environment value, falling back to ``default``."""
    raw = (source.get(name) or "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def format_alert_amount(value: Decimal, currency: str | None) -> str:
    """Format a monetary value as ``$ 1.000,00`` with the code on the right."""
    quantized = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    integer, _, fraction = f"{quantized:f}".partition(".")
    with_thousands = f"{int(integer):,}".replace(",", ".")
    amount = f"$ {with_thousands},{fraction}"
    return f"{amount} {currency}" if currency else amount


class AlertNotifier:
    """Interface shared by the real and no-op notifiers."""

    def send(self, event: TriggeredAlert) -> None:
        """Deliver one crossing; implementations may raise on failure."""
        raise NotImplementedError


class NoOpAlertNotifier(AlertNotifier):
    """Notifier used when no SMTP host is configured; it does nothing."""

    def send(self, event: TriggeredAlert) -> None:
        """Ignore the crossing because no external channel is configured."""
        return None


class SmtpAlertNotifier(AlertNotifier):
    """Deliver each crossing as one plain-text email via SMTP."""

    def __init__(
        self, settings: SmtpSettings, *, transport: Transport | None = None
    ) -> None:
        """Store connection settings and an optional injectable transport."""
        self._settings = settings
        self._transport = transport or _smtp_transport

    def send(self, event: TriggeredAlert) -> None:
        """Build and send one email for the crossing, propagating failures."""
        message = self._build_message(event)
        self._transport(self._settings, message)

    def _build_message(self, event: TriggeredAlert) -> EmailMessage:
        """Render the crossing as a plain-text email message."""
        message = EmailMessage()
        message["Subject"] = f"Alerta {event.ticker}: {event.message}"
        message["From"] = self._settings.from_address
        message["To"] = self._settings.to_address
        target = format_alert_amount(event.target_price, event.currency)
        observed = format_alert_amount(event.observed_price, event.currency)
        message.set_content(
            f"Alerta de precio para {event.ticker}\n\n"
            f"Direccion: {event.intent.value}\n"
            f"Mensaje: {event.message}\n"
            f"Precio objetivo: {target}\n"
            f"Precio observado: {observed}\n"
            f"Fecha: {event.triggered_at.isoformat()}\n"
        )
        return message


def _smtp_transport(settings: SmtpSettings, message: EmailMessage) -> None:
    """Open one SMTP connection, authenticate if needed, and send the message."""
    with smtplib.SMTP(settings.host, settings.port, timeout=settings.timeout) as client:
        if settings.use_tls:
            client.starttls()
        if settings.username and settings.password:
            client.login(settings.username, settings.password)
        client.send_message(message)


def build_alert_notifier(
    environment: Mapping[str, str] | None = None,
) -> AlertNotifier:
    """Build the configured notifier, or a no-op when SMTP is not configured."""
    settings = SmtpSettings.from_environment(environment)
    if settings is None:
        return NoOpAlertNotifier()
    return SmtpAlertNotifier(settings)
