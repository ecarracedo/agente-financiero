"""Pydantic request and response contracts for the versioned API."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from backend.app.api.serialization import (
    MoneyString,
    OptionalMoneyString,
    QuantityString,
)
from backend.app.domain.alerts import AlertIntent


class TransactionRequest(BaseModel):
    """Validate a portfolio purchase or sale request."""

    model_config = ConfigDict(extra="forbid")

    ticker: str = Field(min_length=1, max_length=32)
    broker: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    operation_type: Literal["BUY", "SELL"]
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(gt=0)
    currency: str = Field(pattern=r"^[A-Za-z]{3}$")
    occurred_at: datetime


class PortfolioAlertRequest(BaseModel):
    """Configure target price and intent for a portfolio position."""

    model_config = ConfigDict(extra="forbid")

    broker: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    target_price: Decimal = Field(gt=0)
    intent: AlertIntent


class PositionAlertCheckRequest(BaseModel):
    """Identify a broker/category position whose alert should be evaluated."""

    model_config = ConfigDict(extra="forbid")

    broker: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)


class WishlistCreateRequest(BaseModel):
    """Validate a ticker added to the wishlist."""

    model_config = ConfigDict(extra="forbid")

    ticker: str = Field(min_length=1, max_length=32)


class WishlistTargetRequest(BaseModel):
    """Set or clear a wishlist target price."""

    model_config = ConfigDict(extra="forbid")

    target_price: Decimal | None = Field(default=None, gt=0)


class WishlistAlertRequest(BaseModel):
    """Configure target price and intent for a wishlist entry."""

    model_config = ConfigDict(extra="forbid")

    target_price: Decimal = Field(gt=0)
    intent: AlertIntent


class BibliographyCreateRequest(BaseModel):
    """Validate a bibliography resource and optional metadata."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    author: str = Field(min_length=1, max_length=200)
    year: int | None = Field(default=None, ge=1900, le=2100)
    category: str = Field(default="General", max_length=80)
    link: str | None = Field(default=None, max_length=2000)
    description: str | None = None


class SplitProjectionRequest(BaseModel):
    """Validate a forward or reverse split projection request."""

    model_config = ConfigDict(extra="forbid")

    quantity: Decimal = Field(gt=0)
    average_price: Decimal = Field(gt=0)
    new_shares: int = Field(gt=0)
    old_shares: int = Field(gt=0)


class PortfolioPositionResponse(BaseModel):
    """Expose one portfolio position with canonical string amounts."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str
    broker: str
    category: str
    quantity: QuantityString
    average_price: MoneyString
    currency: str


class TransactionSummaryResponse(BaseModel):
    """Expose one transaction with canonical string amounts."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    ticker: str
    broker: str
    category: str
    operation_type: str
    quantity: QuantityString
    unit_price: MoneyString
    currency: str
    occurred_at: datetime


class CurrencyValuationResponse(BaseModel):
    """Expose a currency-grouped valuation with optional market-derived amounts."""

    model_config = ConfigDict(from_attributes=True)

    currency: str
    invested_value: MoneyString
    market_value: OptionalMoneyString
    gain_loss: OptionalMoneyString
    gain_loss_percent: OptionalMoneyString
    unpriced_tickers: list[str]


class PricePointResponse(BaseModel):
    """Expose one dated close with a canonical money string."""

    model_config = ConfigDict(from_attributes=True)

    date: date
    close: MoneyString


class MarketAnalysisResponse(BaseModel):
    """Expose technical analysis metrics with explicit unknown states."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str
    status: str
    reason: str | None
    current_price: OptionalMoneyString
    high_52_week: OptionalMoneyString
    low_52_week: OptionalMoneyString
    moving_average_50: OptionalMoneyString
    moving_average_200: OptionalMoneyString
    signals: list[str]
    series: list[PricePointResponse]


class WishlistItemResponse(BaseModel):
    """Expose a wishlist entry with an optional canonical target price."""

    model_config = ConfigDict(from_attributes=True)

    ticker: str
    target_price: OptionalMoneyString


class BibliographyItemResponse(BaseModel):
    """Expose a bibliography resource and its optional metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    author: str
    year: int | None
    category: str
    link: str | None
    description: str | None


class TargetAlertEventResponse(BaseModel):
    """Expose one intent-specific target crossing notification."""

    model_config = ConfigDict(from_attributes=True)

    intent: AlertIntent
    message: str


class AlertCheckResponse(BaseModel):
    """Expose an alert evaluation with its canonical observed price."""

    current_price: MoneyString
    event: TargetAlertEventResponse | None


class SplitProjectionResponse(BaseModel):
    """Expose a split projection with canonical string amounts."""

    quantity: QuantityString
    average_price: MoneyString
    ratio: QuantityString


class MutationResponse(BaseModel):
    """Acknowledge a successful delete operation."""

    deleted: bool


class ConfiguredResponse(BaseModel):
    """Acknowledge a successful alert configuration."""

    configured: bool


class UpdatedResponse(BaseModel):
    """Acknowledge a successful update operation."""

    updated: bool
