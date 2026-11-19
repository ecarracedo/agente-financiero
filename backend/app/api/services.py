"""Application service container attached to the FastAPI app state."""

from dataclasses import dataclass

from backend.app.application.alerts import TargetAlertUseCases
from backend.app.application.alert_monitor import AlertMonitorUseCases
from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.application.percent_of_par import PercentOfParUseCases
from backend.app.application.portfolio import PortfolioUseCases
from backend.app.application.resources import ResourceUseCases
from backend.app.application.snapshots import PortfolioSnapshotUseCases


@dataclass(frozen=True)
class ApplicationServices:
    """Expose configured application use cases to HTTP route handlers."""

    portfolio: PortfolioUseCases
    analytics: PortfolioAnalyticsUseCases
    alerts: TargetAlertUseCases
    monitor: AlertMonitorUseCases
    resources: ResourceUseCases
    snapshots: PortfolioSnapshotUseCases
    percent_of_par: PercentOfParUseCases
