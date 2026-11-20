"""FastAPI application entry point."""

import asyncio
from contextlib import asynccontextmanager, suppress
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.database import (
    check_database_connection,
    create_database_engine,
)
from backend.app.adapters.market_data import YFinanceMarketDataProvider
from backend.app.adapters.composite_market_data import CompositeMarketDataProvider
from backend.app.adapters.ppi_market_data import PpiMarketDataProvider
from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.adapters.notifications.smtp import build_alert_notifier
from backend.app.api.auth import auth_router, require_user
from backend.app.api.routes import router as api_router
from backend.app.api.services import ApplicationServices
from backend.app.application.alert_monitor import AlertMonitorUseCases
from backend.app.application.alert_notifications import AlertNotificationUseCases
from backend.app.application.alert_scheduler import TargetAlertScheduler
from backend.app.application.alerts import TargetAlertUseCases
from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.application.percent_of_par import (
    SETTING_KEY,
    PercentOfParUseCases,
    parse_tickers,
)
from backend.app.application.portfolio import PortfolioUseCases
from backend.app.application.ports import PortfolioUnitOfWorkPort
from backend.app.application.resources import ResourceUseCases
from backend.app.application.snapshot_scheduler import PortfolioSnapshotScheduler
from backend.app.application.snapshots import PortfolioSnapshotUseCases


@lru_cache(maxsize=1)
def _default_database_engine() -> Engine:
    """Create and cache the process-wide database engine on first readiness check."""
    return create_database_engine()


def create_app(
    database_engine: Engine | None = None,
    market_data_provider=None,
    auth_enabled: bool = True,
    snapshot_scheduler_enabled: bool = True,
    alert_scheduler_enabled: bool = True,
) -> FastAPI:
    """Create the financial agent API application.

    Returns:
        A configured FastAPI application with process health reporting.
    """
    def engine_provider() -> Engine:
        """Return the injected engine or lazily create the default one."""
        return (
            database_engine
            if database_engine is not None
            else _default_database_engine()
        )

    def unit_of_work_factory() -> PortfolioUnitOfWorkPort:
        """Create a unit of work bound to this app's database engine."""
        return SqlAlchemyPortfolioUnitOfWork(
            sessionmaker(bind=engine_provider())
        )

    def _load_ppi_aliases() -> dict[str, str]:
        """Load user-defined FCI aliases from the database."""
        from backend.app.adapters.persistence.database import create_database_engine
        from sqlalchemy.orm import sessionmaker
        from backend.app.adapters.persistence.repositories import SqlAlchemyResourceRepository
        engine = database_engine if database_engine is not None else _default_database_engine()
        session = sessionmaker(bind=engine)()
        try:
            repo = SqlAlchemyResourceRepository(session)
            aliases = {}
            for record in repo.list_ticker_aliases():
                aliases[record.broker_ticker] = record.official_name
            return aliases
        finally:
            session.close()

    def _load_percent_of_par_tickers() -> list[str]:
        """Load the user-flagged per-100-nominal tickers from app settings."""
        from backend.app.adapters.persistence.repositories import (
            SqlAlchemyAppSettingRepository,
        )
        engine = database_engine if database_engine is not None else _default_database_engine()
        session = sessionmaker(bind=engine)()
        try:
            raw = SqlAlchemyAppSettingRepository(session).get_setting(SETTING_KEY)
            return parse_tickers(raw)
        finally:
            session.close()

    yfinance = YFinanceMarketDataProvider(percent_of_par=_load_percent_of_par_tickers)
    ppi = PpiMarketDataProvider(aliases_provider=_load_ppi_aliases)
    provider = market_data_provider or CompositeMarketDataProvider(
        ppi_provider=ppi,
        yfinance_factory=yfinance._create_ticker,
        search_factory=yfinance._create_search,
        percent_of_par=_load_percent_of_par_tickers,
    )
    portfolio_use_cases = PortfolioUseCases(unit_of_work_factory)
    snapshot_use_cases = PortfolioSnapshotUseCases(unit_of_work_factory, provider)
    alert_use_cases = TargetAlertUseCases(unit_of_work_factory)
    alert_monitor = AlertMonitorUseCases(alert_use_cases, provider)
    snapshot_scheduler = (
        PortfolioSnapshotScheduler(snapshot_use_cases)
        if snapshot_scheduler_enabled
        else None
    )
    alert_notifier = build_alert_notifier()
    alert_notifications = AlertNotificationUseCases(
        unit_of_work_factory, alert_notifier
    )
    alert_scheduler = (
        TargetAlertScheduler(alert_monitor, notifications=alert_notifications)
        if alert_scheduler_enabled
        else None
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        """Keep the snapshot and alert schedulers running while the API serves."""
        tasks = [
            asyncio.create_task(scheduler.run(), name=name)
            for scheduler, name in (
                (snapshot_scheduler, "portfolio-snapshot-scheduler"),
                (alert_scheduler, "target-alert-scheduler"),
            )
            if scheduler is not None
        ]
        try:
            yield
        finally:
            for task in tasks:
                task.cancel()
            for task in tasks:
                with suppress(asyncio.CancelledError):
                    await task

    application = FastAPI(
        title="Financial Agent API", version="0.1.0", lifespan=lifespan
    )
    application.state.services = ApplicationServices(
        portfolio=portfolio_use_cases,
        analytics=PortfolioAnalyticsUseCases(portfolio_use_cases, provider),
        alerts=alert_use_cases,
        monitor=alert_monitor,
        resources=ResourceUseCases(unit_of_work_factory),
        snapshots=snapshot_use_cases,
        percent_of_par=PercentOfParUseCases(unit_of_work_factory),
    )
    application.state.database_engine_provider = engine_provider
    application.state.snapshot_scheduler = snapshot_scheduler
    application.state.alert_scheduler = alert_scheduler
    application.include_router(auth_router)
    if auth_enabled:
        application.include_router(
            api_router, dependencies=[Depends(require_user)]
        )
    else:
        application.include_router(api_router)

    @application.get("/health", tags=["health"])
    def health_check() -> dict[str, str]:
        """Return the liveness status of the API process."""
        return {"status": "ok"}

    @application.get("/ready", tags=["health"])
    def readiness_check() -> dict[str, str]:
        """Report ready only when the configured database accepts a query."""
        try:
            check_database_connection(database_engine or _default_database_engine())
        except Exception as error:
            raise HTTPException(
                status_code=503, detail="database unavailable"
            ) from error
        return {"status": "ready"}

    return application


app = create_app()
