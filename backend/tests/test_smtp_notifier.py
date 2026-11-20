"""Tests for the SMTP notifier that delivers alert crossings as email."""

from datetime import datetime, timezone
from decimal import Decimal

from backend.app.adapters.notifications.smtp import (
    NoOpAlertNotifier,
    SmtpAlertNotifier,
    SmtpSettings,
    build_alert_notifier,
    format_alert_amount,
)
from backend.app.domain.alerts import AlertIntent, AlertScope, TriggeredAlert


def crossing() -> TriggeredAlert:
    """Build a persisted crossing with portfolio attributes for email tests."""
    return TriggeredAlert(
        id=7,
        scope=AlertScope.PORTFOLIO,
        ticker="YPF",
        target_price=Decimal("150"),
        intent=AlertIntent.SELL,
        observed_price=Decimal("152.50"),
        message="Precio objetivo de venta alcanzado.",
        triggered_at=datetime(2026, 11, 20, 15, 30, tzinfo=timezone.utc),
        currency="ARS",
    )


def test_no_smtp_host_builds_a_no_op_notifier():
    """With no SMTP host the notifier is inert and never touches the network."""
    environment = {"AUTH_EMAIL": "owner@example.com"}

    settings = SmtpSettings.from_environment(environment)
    notifier = build_alert_notifier(environment)

    assert settings is None
    assert isinstance(notifier, NoOpAlertNotifier)
    assert notifier.send(crossing()) is None


def test_settings_prefer_the_alert_recipient_override():
    """ALERT_EMAIL_TO overrides AUTH_EMAIL as the destination when both exist."""
    environment = {
        "SMTP_HOST": "smtp.example.com",
        "AUTH_EMAIL": "owner@example.com",
        "ALERT_EMAIL_TO": "alerts@example.com",
    }

    settings = SmtpSettings.from_environment(environment)

    assert settings is not None
    assert settings.to_address == "alerts@example.com"
    assert settings.from_address == "owner@example.com"
    assert settings.port == 587
    assert settings.use_tls is True


def test_settings_fall_back_to_the_account_email():
    """Without an override, the account email receives the alerts."""
    environment = {
        "SMTP_HOST": "smtp.example.com",
        "AUTH_EMAIL": "owner@example.com",
    }

    settings = SmtpSettings.from_environment(environment)

    assert settings is not None
    assert settings.to_address == "owner@example.com"
    assert settings.from_address == "owner@example.com"


def test_format_alert_amount_uses_the_global_currency_shape():
    """Amounts follow the global '$ 1.000,00' format with the code on the right."""
    assert format_alert_amount(Decimal("152.5"), "ARS") == "$ 152,50 ARS"
    assert format_alert_amount(Decimal("1234567.8"), "USD") == "$ 1.234.567,80 USD"
    assert format_alert_amount(Decimal("10"), None) == "$ 10,00"


def test_send_builds_one_email_with_the_crossing_details():
    """A send delivers a single message carrying the asset and both prices."""
    sent = []

    def transport(settings, message):
        sent.append((settings, message))

    settings = SmtpSettings(
        host="smtp.example.com",
        to_address="alerts@example.com",
        from_address="owner@example.com",
    )
    notifier = SmtpAlertNotifier(settings, transport=transport)

    notifier.send(crossing())

    assert len(sent) == 1
    effective_settings, message = sent[0]
    assert effective_settings is settings
    assert message["To"] == "alerts@example.com"
    assert message["From"] == "owner@example.com"
    assert "YPF" in message["Subject"]
    body = message.get_content()
    assert "YPF" in body
    assert "$ 150,00 ARS" in body
    assert "$ 152,50 ARS" in body
    assert "venta" in body


def test_a_transport_failure_is_propagated_to_the_caller():
    """The adapter does not swallow SMTP errors so the use case can retry."""

    def transport(settings, message):
        raise OSError("smtp down")

    notifier = SmtpAlertNotifier(
        SmtpSettings("smtp.example.com", "to@example.com", "from@example.com"),
        transport=transport,
    )

    try:
        notifier.send(crossing())
    except OSError:
        return
    raise AssertionError("a transport failure must propagate")
