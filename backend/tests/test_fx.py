"""Dollar rates (MEP/CCL) computed with RAVA methodology from market quotes."""
from decimal import Decimal

from backend.app.domain.fx import compute_ccl, compute_mep


def test_compute_mep_is_ars_bond_over_usd_bond():
    assert compute_mep(Decimal("55000"), Decimal("55")) == Decimal("1000")


def test_compute_ccl_uses_cedear_ratio():
    # AAPL Cedear 20:1: CCL = cedear_ars * 20 / adr_usd
    result = compute_ccl(Decimal("28600"), Decimal("351.36"), ratio=Decimal("20"))
    assert result is not None
    assert abs(result - Decimal("1627.96")) < Decimal("0.1")


def test_compute_returns_none_on_missing_or_zero():
    assert compute_mep(None, Decimal("55")) is None
    assert compute_mep(Decimal("55000"), Decimal("0")) is None
    assert compute_ccl(Decimal("28600"), None) is None


def test_analytics_dollar_rates_use_bond_and_cedear_pairs():
    from backend.app.application.analytics import PortfolioAnalyticsUseCases
    from backend.app.domain.analysis import QuoteSnapshot

    class FakeProvider:
        def get_quote(self, ticker):
            prices = {
                "GD30": Decimal("55000"),
                "GD30D": Decimal("55"),
                "AAPL.BA": Decimal("28600"),
                "AAPL": Decimal("351.36"),
            }
            price = prices.get(ticker)
            return None if price is None else QuoteSnapshot(price=price, currency="USD")

        def get_historical_series(self, ticker, period):
            return ()

        def search_symbols(self, query, limit):
            return ()

    use_cases = PortfolioAnalyticsUseCases(position_repository=None, market_data=FakeProvider())
    rates = use_cases.get_dollar_rates()
    assert rates["mep"] == Decimal("1000")
    assert rates["ccl"] is not None
    assert abs(rates["ccl"] - Decimal("1627.96")) < Decimal("0.1")
