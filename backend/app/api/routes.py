"""Versioned API endpoints for financial-agent use cases."""

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy.exc import IntegrityError

from backend.app.api.schemas import (
    AlertCheckResponse,
    BibliographyCreateRequest,
    BibliographyItemResponse,
    ConfiguredResponse,
    CurrencyValuationResponse,
    MarketAnalysisResponse,
    MutationResponse,
    PortfolioAlertRequest,
    PortfolioPositionResponse,
    PositionAlertCheckRequest,
    SplitProjectionRequest,
    SplitProjectionResponse,
    TransactionRequest,
    TransactionSummaryResponse,
    UpdatedResponse,
    WishlistAlertRequest,
    WishlistCreateRequest,
    WishlistItemResponse,
    WishlistTargetRequest,
)
from backend.app.domain.portfolio import PortfolioPosition

router = APIRouter(prefix="/api/v1")


def _services(request: Request):
    """Return the configured application services from the ASGI state."""
    return request.app.state.services


@router.get(
    "/portfolio",
    response_model=list[PortfolioPositionResponse],
    tags=["portfolio"],
)
def list_portfolio(request: Request) -> list[PortfolioPosition]:
    """Return current portfolio positions without presentation-layer coupling."""
    return _services(request).portfolio.list_positions()


@router.post(
    "/transactions",
    response_model=PortfolioPositionResponse | None,
    status_code=status.HTTP_201_CREATED,
    tags=["transactions"],
)
def record_transaction(
    payload: TransactionRequest, request: Request
) -> PortfolioPosition | None:
    """Record a purchase or sale and return the resulting position."""
    services = _services(request)
    values = payload.model_dump(exclude={"operation_type"})
    try:
        if payload.operation_type == "BUY":
            return services.portfolio.record_purchase(**values)
        return services.portfolio.record_sale(**values)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get(
    "/transactions",
    response_model=list[TransactionSummaryResponse],
    tags=["transactions"],
)
def list_transactions(
    request: Request,
    ticker: str = Query(min_length=1, max_length=32),
    broker: str = Query(min_length=1, max_length=120),
) -> list:
    """Return chronological transaction history for a ticker and broker."""
    return _services(request).portfolio.list_history(ticker, broker)


@router.delete(
    "/transactions/{transaction_id}",
    response_model=MutationResponse,
    tags=["transactions"],
)
def delete_transaction(transaction_id: int, request: Request) -> dict[str, bool]:
    """Delete an operation and rebuild the affected position."""
    deleted = _services(request).portfolio.delete_transaction(transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="transaction not found")
    return {"deleted": True}


@router.get(
    "/valuations",
    response_model=dict[str, CurrencyValuationResponse],
    tags=["portfolio"],
)
def value_portfolio(request: Request) -> dict[str, object]:
    """Return currency-grouped valuation totals."""
    return _services(request).analytics.value_portfolio()


@router.get(
    "/analysis/{ticker}",
    response_model=MarketAnalysisResponse,
    tags=["market"],
)
def analyze_ticker(
    ticker: str,
    request: Request,
    period: str = Query(default="1y", pattern=r"^(1mo|3mo|6mo|1y|2y|5y)$"),
):
    """Return market signals and explicit unknown states for unavailable data."""
    result = _services(request).analytics.analyze_ticker(ticker, period)
    return result


@router.put(
    "/portfolio/{ticker}/alert",
    response_model=ConfiguredResponse,
    tags=["alerts"],
)
def configure_portfolio_alert(
    ticker: str, payload: PortfolioAlertRequest, request: Request
) -> dict[str, bool]:
    """Configure a target intent on a portfolio holding."""
    services = _services(request)
    try:
        services.alerts.configure_portfolio_alert(
            ticker,
            payload.broker,
            payload.category,
            payload.target_price,
            payload.intent,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"configured": True}


@router.post(
    "/portfolio/{ticker}/alert/check",
    response_model=AlertCheckResponse,
    tags=["alerts"],
)
def check_portfolio_alert(
    ticker: str, payload: PositionAlertCheckRequest, request: Request
) -> dict[str, object]:
    """Evaluate a stored portfolio alert against the current quote."""
    services = _services(request)
    current_price = services.analytics.get_current_price(ticker)
    if current_price is None:
        raise HTTPException(status_code=503, detail="market price unavailable")
    event = services.alerts.evaluate_portfolio_alert(
        ticker, payload.broker, payload.category, current_price
    )
    return {"current_price": current_price, "event": event}


@router.get(
    "/wishlist",
    response_model=list[WishlistItemResponse],
    tags=["wishlist"],
)
def list_wishlist(request: Request) -> list:
    """Return current wishlist entries."""
    return _services(request).resources.list_wishlist()


@router.post(
    "/wishlist",
    response_model=WishlistItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["wishlist"],
)
def add_wishlist_item(
    payload: WishlistCreateRequest, request: Request
):
    """Add a ticker to the wishlist."""
    try:
        return _services(request).resources.add_wishlist_item(payload.ticker)
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail="wishlist item already exists") from error


@router.put(
    "/wishlist/{ticker}/target",
    response_model=UpdatedResponse,
    tags=["wishlist"],
)
def update_wishlist_target(
    ticker: str, payload: WishlistTargetRequest, request: Request
) -> dict[str, bool]:
    """Set or clear a wishlist target price."""
    updated = _services(request).resources.update_wishlist_target(
        ticker, payload.target_price
    )
    if not updated:
        raise HTTPException(status_code=404, detail="wishlist item not found")
    return {"updated": True}


@router.delete(
    "/wishlist/{ticker}",
    response_model=MutationResponse,
    tags=["wishlist"],
)
def remove_wishlist_item(ticker: str, request: Request) -> dict[str, bool]:
    """Remove a ticker from the wishlist."""
    removed = _services(request).resources.remove_wishlist_item(ticker)
    if not removed:
        raise HTTPException(status_code=404, detail="wishlist item not found")
    return {"deleted": True}


@router.put(
    "/wishlist/{ticker}/alert",
    response_model=ConfiguredResponse,
    tags=["alerts"],
)
def configure_wishlist_alert(
    ticker: str, payload: WishlistAlertRequest, request: Request
) -> dict[str, bool]:
    """Configure a target intent on a wishlist entry."""
    try:
        _services(request).alerts.configure_wishlist_alert(
            ticker, payload.target_price, payload.intent
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return {"configured": True}


@router.post(
    "/wishlist/{ticker}/alert/check",
    response_model=AlertCheckResponse,
    tags=["alerts"],
)
def check_wishlist_alert(ticker: str, request: Request) -> dict[str, object]:
    """Evaluate a stored wishlist alert against the current quote."""
    services = _services(request)
    current_price = services.analytics.get_current_price(ticker)
    if current_price is None:
        raise HTTPException(status_code=503, detail="market price unavailable")
    event = services.alerts.evaluate_wishlist_alert(ticker, current_price)
    return {"current_price": current_price, "event": event}


@router.get(
    "/bibliography",
    response_model=list[BibliographyItemResponse],
    tags=["bibliography"],
)
def list_bibliography(request: Request) -> list:
    """Return bibliography resources."""
    return _services(request).resources.list_bibliography()


@router.post(
    "/bibliography",
    response_model=BibliographyItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["bibliography"],
)
def add_bibliography_item(
    payload: BibliographyCreateRequest, request: Request
):
    """Create a bibliography resource."""
    return _services(request).resources.add_bibliography_item(**payload.model_dump())


@router.delete(
    "/bibliography/{item_id}",
    response_model=MutationResponse,
    tags=["bibliography"],
)
def delete_bibliography_item(item_id: int, request: Request) -> dict[str, bool]:
    """Delete a bibliography resource."""
    deleted = _services(request).resources.delete_bibliography_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="bibliography item not found")
    return {"deleted": True}


@router.post(
    "/splits",
    response_model=SplitProjectionResponse,
    tags=["portfolio"],
)
def calculate_split(
    payload: SplitProjectionRequest, request: Request
) -> dict[str, Decimal]:
    """Return a forward or reverse split projection."""
    quantity, average_price, ratio = _services(request).resources.calculate_split(
        payload.quantity,
        payload.average_price,
        new_shares=payload.new_shares,
        old_shares=payload.old_shares,
    )
    return {"quantity": quantity, "average_price": average_price, "ratio": ratio}
