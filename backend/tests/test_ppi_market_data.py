"""Unit tests for PpiMarketDataProvider with mocked HTML fixtures."""

import json
from datetime import date, timedelta
from decimal import Decimal

import pytest

from backend.app.domain.analysis import QuoteSnapshot
from backend.app.adapters.ppi_market_data import PpiMarketDataProvider, PPI_BONOS_URL, PPI_FCI_URL


# Minimal valid __NEXT_DATA__ payloads for Bonos and FCI
BONOS_NEXT_DATA = {
    "props": {
        "pageProps": {
            "instruments": [
                {
                    "ticker": "AE38",
                    "lastPrice": 109480,
                    "currency": {"id": 10000},
                },
                {
                    "ticker": "AL30",
                    "lastPrice": 83870,
                    "currency": {"id": 10000},
                },
                {
                    "ticker": "AL30D",
                    "lastPrice": 53.52,
                    "currency": {"id": 22013},
                },
            ]
        }
    }
}

FCI_NEXT_DATA = {
    "props": {
        "pageProps": {
            "instruments": [
                {
                    "ticker": "Allaria Diversificado Clase A",
                    "name": "Allaria Diversificado Clase A",
                    "lastPrice": 0.182601916,
                    "currency": {"id": 10000},
                },
                {
                    "ticker": "Adcap Acciones Clase A",
                    "name": "Adcap Acciones Clase A",
                    "lastPrice": 0.161489,
                    "currency": {"id": 10000},
                },
            ]
        }
    }
}

def make_html(next_data: dict) -> str:
    """Wrap __NEXT_DATA__ in a minimal HTML page."""
    return f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(next_data)}</script></html>'


class TestPpiMarketDataProvider:
    def test_parses_bonos_and_fci_from_next_data(self, monkeypatch):
        provider = PpiMarketDataProvider()

        def mock_fetch(url: str) -> str:
            if url == PPI_BONOS_URL:
                return make_html(BONOS_NEXT_DATA)
            if url == PPI_FCI_URL:
                return make_html(FCI_NEXT_DATA)
            raise AssertionError(f"Unexpected URL: {url}")

        monkeypatch.setattr(provider, "_fetch_page", mock_fetch)
        monkeypatch.setattr(provider, "_cache_date", date.today() - timedelta(days=1))

        assert provider._refresh_cache()
        assert provider._cache is not None

        # Bond by ticker
        ae38 = provider.get_quote("AE38")
        assert ae38 is not None
        assert ae38.price == Decimal("109480")
        assert ae38.currency == "ARS"

        al30 = provider.get_quote("AL30")
        assert al30 is not None
        assert al30.price == Decimal("83870")
        assert al30.currency == "ARS"

        al30d = provider.get_quote("AL30D")
        assert al30d is not None
        assert al30d.price == Decimal("53.52")
        assert al30d.currency == "USD"

        # FCI by official name
        allaria = provider.get_quote("Allaria Diversificado Clase A")
        assert allaria is not None
        assert allaria.price == Decimal("0.182601916")
        assert allaria.currency == "ARS"

    def test_alias_resolution_for_fci(self, monkeypatch):
        provider = PpiMarketDataProvider(fci_aliases={"AL.DIVER.A": "Allaria Diversificado Clase A"})

        def mock_fetch(url: str) -> str:
            if url == PPI_BONOS_URL:
                return make_html({"props": {"pageProps": {"instruments": []}}})
            if url == PPI_FCI_URL:
                return make_html(FCI_NEXT_DATA)
            raise AssertionError(f"Unexpected URL: {url}")

        monkeypatch.setattr(provider, "_fetch_page", mock_fetch)
        monkeypatch.setattr(provider, "_cache_date", date.today() - timedelta(days=1))

        assert provider._refresh_cache()

        # Query by alias
        quote = provider.get_quote("AL.DIVER.A")
        assert quote is not None
        assert quote.price == Decimal("0.182601916")
        assert quote.currency == "ARS"

    def test_cache_validity_same_day(self, monkeypatch):
        provider = PpiMarketDataProvider()

        call_count = 0

        def mock_fetch(url: str) -> str:
            nonlocal call_count
            call_count += 1
            if url == PPI_BONOS_URL:
                return make_html(BONOS_NEXT_DATA)
            if url == PPI_FCI_URL:
                return make_html({"props": {"pageProps": {"instruments": []}}})
            raise AssertionError(f"Unexpected URL: {url}")

        monkeypatch.setattr(provider, "_fetch_page", mock_fetch)

        # First call - should fetch
        provider._cache_date = date.today() - timedelta(days=1)
        assert provider._ensure_cache()
        assert call_count == 2  # Bonos + FCI

        # Second call same day - should use cache
        provider._ensure_cache()
        assert call_count == 2  # No new fetches

    def test_network_failure_keeps_stale_cache(self, monkeypatch):
        provider = PpiMarketDataProvider()

        def mock_fetch(url: str) -> str:
            raise ConnectionError("network down")

        monkeypatch.setattr(provider, "_fetch_page", mock_fetch)
        provider._cache = {"AE38": QuoteSnapshot(price=Decimal("100000"), currency="ARS")}
        provider._cache_date = date.today() - timedelta(days=1)

        # Should return stale data when fetch fails
        quote = provider.get_quote("AE38")
        assert quote is not None
        assert quote.price == Decimal("100000")

    def test_empty_on_complete_failure(self, monkeypatch):
        provider = PpiMarketDataProvider()

        def mock_fetch(url: str) -> str:
            raise ConnectionError("network down")

        monkeypatch.setattr(provider, "_fetch_page", mock_fetch)
        provider._cache = None
        provider._cache_date = None

        quote = provider.get_quote("AE38")
        assert quote is None

    def test_search_symbols_finds_bonos_and_fci(self, monkeypatch):
        provider = PpiMarketDataProvider()

        def mock_fetch(url: str) -> str:
            if url == PPI_BONOS_URL:
                return make_html(BONOS_NEXT_DATA)
            if url == PPI_FCI_URL:
                return make_html(FCI_NEXT_DATA)
            raise AssertionError(f"Unexpected URL: {url}")

        monkeypatch.setattr(provider, "_fetch_page", mock_fetch)
        monkeypatch.setattr(provider, "_cache_date", date.today() - timedelta(days=1))

        results = provider.search_symbols("AE38", limit=5)
        assert len(results) == 1
        assert results[0].symbol == "AE38"
        assert results[0].quote_type == "Bond"

        fci_results = provider.search_symbols("Allaria", limit=5)
        # Both official name and alias match
        assert len(fci_results) == 2
        assert all(r.quote_type == "Mutual Fund" for r in fci_results)

        alias_results = provider.search_symbols("AL.DIVER", limit=5)
        assert len(alias_results) == 1
        assert alias_results[0].symbol == "AL.DIVER.A"

        # Empty query returns nothing
        assert provider.search_symbols("", limit=5) == ()

        # No match returns empty
        assert provider.search_symbols("ZZZZZ", limit=5) == ()

    def test_historical_series_returns_empty(self, monkeypatch):
        provider = PpiMarketDataProvider()
        series = provider.get_historical_series("AE38", "1mo")
        assert series == ()