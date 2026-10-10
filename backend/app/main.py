"""FastAPI application entry point."""

from functools import lru_cache

from fastapi import FastAPI, HTTPException
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

from backend.app.adapters.persistence.database import (
    check_database_connection,
    create_database_engine,
)
from backend.app.adapters.market_data import YFinanceMarketDataProvider
from backend.app.adapters.persistence.unit_of_work import SqlAlchemyPortfolioUnitOfWork
from backend.app.api.routes import router as api_router
from backend.app.api.services import ApplicationServices
from backend.app.application.alerts import TargetAlertUseCases
from backend.app.application.analytics import PortfolioAnalyticsUseCases
from backend.app.application.portfolio import PortfolioUseCases
from backend.app.application.ports import PortfolioUnitOfWorkPort
from backend.app.application.resources import ResourceUseCases


@lru_cache(maxsize=1)
def _default_database_engine() -> Engine:
    """Create and cache the process-wide database engine on first readiness check."""
    return create_database_engine()


def create_app(
    database_engine: Engine | None = None,
    market_data_provider=None,
) -> FastAPI:
    """Create the financial agent API application.

    Returns:
        A configured FastAPI application with process health reporting.
    """
    application = FastAPI(title="Financial Agent API", version="0.1.0")
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

    provider = market_data_provider or YFinanceMarketDataProvider()
    portfolio_use_cases = PortfolioUseCases(unit_of_work_factory)
    application.state.services = ApplicationServices(
        portfolio=portfolio_use_cases,
        analytics=PortfolioAnalyticsUseCases(portfolio_use_cases, provider),
        alerts=TargetAlertUseCases(unit_of_work_factory),
        resources=ResourceUseCases(unit_of_work_factory),
    )
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
