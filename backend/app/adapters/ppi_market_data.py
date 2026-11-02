"""PPI (Portfolio Personal Inversiones) adapter for Argentine Bonds and FCI quotes.

Fetches daily public quote tables from PPI's Next.js pages, extracts structured
JSON from __NEXT_DATA__, and caches results per calendar day.
"""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import json
import logging
import re
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from backend.app.domain.analysis import PricePoint, QuoteSnapshot
from backend.app.domain.tickers import (
    DEFAULT_SEARCH_RESULTS,
    TickerMatch,
    normalize_ticker,
)

logger = logging.getLogger(__name__)

# PPI public quote pages
PPI_BONOS_URL = "https://portfoliopersonal.com/Cotizaciones/Bonos"
PPI_FCI_URL = "https://portfoliopersonal.com/Cotizaciones/SupermercadoFCI"

# Currency ID mapping from PPI to ISO codes
PPI_CURRENCY_MAP = {
    10000: "ARS",   # Pesos Argentinos
    22013: "USD",   # Dólares (dólar MEP / cable)
    10001: "USD",   # Dólares (otra variante)
}

# Default FCI alias mapping: broker symbol -> official PPI fund name
DEFAULT_FCI_ALIASES: dict[str, str] = {
    "AL.DIVER.A": "Allaria Diversificado Clase A",
    "DEL.RR.NAT.A": "Delta Recursos Naturales Clase A",
}


def _to_currency(value: Any) -> str | None:
    """Normalize PPI currency ID to ISO 4217 code."""
    if isinstance(value, dict):
        cid = value.get("id")
        if isinstance(cid, int) and cid in PPI_CURRENCY_MAP:
            return PPI_CURRENCY_MAP[cid]
    if isinstance(value, int) and value in PPI_CURRENCY_MAP:
        return PPI_CURRENCY_MAP[value]
    return None


class PpiMarketDataProvider:
    """Fetch Argentine Bonds and FCI quotes from PPI public pages with daily cache."""

    def __init__(
        self,
        fci_aliases: dict[str, str] | None = None,
        aliases_provider=None,
        timeout_seconds: int = 15,
    ) -> None:
        self._default_aliases = {k.upper(): v for k, v in (fci_aliases or DEFAULT_FCI_ALIASES).items()}
        self._aliases_provider = aliases_provider
        self._timeout = timeout_seconds
        self._cache: dict[str, QuoteSnapshot] | None = None
        self._cache_date: date | None = None
        self._search_index: list[TickerMatch] | None = None

    def _get_aliases(self) -> dict[str, str]:
        """Return the current alias map, merging defaults with DB-stored aliases."""
        aliases = dict(self._default_aliases)
        if self._aliases_provider is not None:
            try:
                db_aliases = self._aliases_provider()
                for broker_ticker, official_name in db_aliases.items():
                    aliases[broker_ticker.upper()] = official_name
            except Exception:
                pass
        return aliases

    def _is_cache_valid(self) -> bool:
        """Return True if cache exists and is from today."""
        return self._cache is not None and self._cache_date == date.today()

    def _fetch_page(self, url: str) -> str | None:
        """Fetch HTML page content with standard browser headers."""
        try:
            req = Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                                  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
                },
            )
            with urlopen(req, timeout=self._timeout) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except (URLError, TimeoutError, OSError) as exc:
            logger.warning("PPI fetch failed for %s: %s", url, exc)
            return None

    def _extract_next_data(self, html: str) -> dict | None:
        """Extract and parse the __NEXT_DATA__ script tag JSON."""
        match = re.search(
            r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            html,
            flags=re.DOTALL,
        )
        if not match:
            return None
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            logger.warning("Failed to parse __NEXT_DATA__ JSON")
            return None

    def _refresh_cache(self) -> bool:
        """Fetch both PPI pages and rebuild the internal quote cache.

        Returns True if cache was refreshed successfully, False otherwise.
        On network failure, keeps stale cache if available.
        """
        new_cache: dict[str, QuoteSnapshot] = {}
        new_search_index: list[TickerMatch] = []
        success = True

        try:
            # Fetch Bonos
            bonos_html = self._fetch_page(PPI_BONOS_URL)
            if bonos_html:
                bonos_data = self._extract_next_data(bonos_html)
                if bonos_data:
                    instruments = (
                        bonos_data.get("props", {})
                        .get("pageProps", {})
                        .get("instruments", [])
                    )
                    for inst in instruments:
                        ticker = inst.get("ticker")
                        price_raw = inst.get("lastPrice")
                        currency_raw = inst.get("currency")
                        if ticker and price_raw is not None:
                            try:
                                price = Decimal(str(price_raw))
                                if price.is_finite() and price > 0:
                                    # PPI reports bond prices per 100 nominal units
                                    # (e.g. 109390 means 1093.90 per unit). Divide by 100
                                    # to get the real per-unit price.
                                    price = price / Decimal("100")
                                    currency = _to_currency(currency_raw)
                                    new_cache[normalize_ticker(ticker)] = QuoteSnapshot(
                                        price=price,
                                        currency=currency,
                                    )
                                    new_search_index.append(
                                        TickerMatch(
                                            symbol=normalize_ticker(ticker),
                                            name=f"Bono {inst.get('description', ticker)}",
                                            exchange="BYMA",
                                            quote_type="Bond",
                                        )
                                    )
                            except (InvalidOperation, ValueError):
                                pass

            # Fetch FCI
            fci_html = self._fetch_page(PPI_FCI_URL)
            if fci_html:
                fci_data = self._extract_next_data(fci_html)
                if fci_data:
                    instruments = (
                        fci_data.get("props", {})
                        .get("pageProps", {})
                        .get("instruments", [])
                    )
                    for inst in instruments:
                        name = inst.get("name") or inst.get("ticker")
                        price_raw = inst.get("lastPrice")
                        currency_raw = inst.get("currency")
                        if name and price_raw is not None:
                            try:
                                price = Decimal(str(price_raw))
                                if price.is_finite() and price > 0:
                                    # PPI reports FCI prices per 1000 cuotapartes
                                    # (e.g. 0.1826 means 182.60 per cuotaparte).
                                    # Multiply by 1000 to get the real cuotaparte value.
                                    price = price * Decimal("1000")
                                    currency = _to_currency(currency_raw)
                                    key = normalize_ticker(name)
                                    new_cache[key] = QuoteSnapshot(price=price, currency=currency)
                                    new_search_index.append(
                                        TickerMatch(
                                            symbol=normalize_ticker(name),
                                            name=f"FCI {inst.get('description', name)}",
                                            exchange="CAFCI",
                                            quote_type="Mutual Fund",
                                        )
                                    )
                                    aliases = self._get_aliases()
                                    for alias, canonical in aliases.items():
                                        if canonical == name:
                                            new_cache[normalize_ticker(alias)] = QuoteSnapshot(
                                                price=price, currency=currency
                                            )
                                            new_search_index.append(
                                                TickerMatch(
                                                    symbol=normalize_ticker(alias),
                                                    name=f"FCI {inst.get('description', name)}",
                                                    exchange="CAFCI",
                                                    quote_type="Mutual Fund",
                                                )
                                            )
                            except (InvalidOperation, ValueError):
                                pass

            if new_cache:
                self._cache = new_cache
                self._cache_date = date.today()
                self._search_index = new_search_index
                logger.info("PPI cache refreshed: %d instruments", len(new_cache))
            else:
                success = False
                logger.warning("PPI refresh produced empty cache")
        except Exception as exc:
            logger.warning("PPI cache refresh failed: %s", exc)
            success = False

        return success

    def _ensure_cache(self) -> bool:
        """Ensure cache is populated for today; refresh if needed.

        Returns True if cache is available (fresh or stale after failed refresh),
        False only if no cache exists at all.
        """
        if self._is_cache_valid():
            return True
        if self._cache is not None:
            logger.info("PPI cache expired (was %s, today %s)", self._cache_date, date.today())
            self._refresh_cache()
            return True
        return self._refresh_cache()

    def invalidate_cache(self) -> None:
        """Force the cache to be rebuilt on next access.

        Call this when aliases change so the new mappings take effect immediately.
        """
        self._cache = None
        self._cache_date = None
        self._search_index = None

    def get_quote(self, ticker: str) -> QuoteSnapshot | None:
        """Return current price for a bond ticker or mapped FCI alias."""
        normalized = normalize_ticker(ticker)
        if not self._ensure_cache():
            return None
        if self._cache is None:
            return None
        return self._cache.get(normalized)

    def get_historical_series(self, ticker: str, period: str) -> tuple[PricePoint, ...]:
        """PPI public pages do not expose historical series; return empty."""
        return ()

    def search_symbols(
        self, query: str, limit: int = DEFAULT_SEARCH_RESULTS
    ) -> tuple[TickerMatch, ...]:
        """Search PPI bonds and FCIs by ticker or name."""
        if not self._ensure_cache():
            return ()
        if self._search_index is None:
            return ()

        q = query.strip().upper()
        if not q:
            return ()

        matches: list[TickerMatch] = []
        seen: set[str] = set()
        for match in self._search_index:
            if q in match.symbol.upper() or q in match.name.upper():
                if match.symbol not in seen:
                    seen.add(match.symbol)
                    matches.append(match)
                    if len(matches) >= limit:
                        break

        return tuple(matches)

    def list_instruments(self) -> list[TickerMatch]:
        """Return all PPI bonds and FCIs available for aliasing."""
        if not self._ensure_cache():
            return []
        if self._search_index is None:
            return []
        # Deduplicate by symbol
        seen: set[str] = set()
        result: list[TickerMatch] = []
        for match in self._search_index:
            if match.symbol not in seen:
                seen.add(match.symbol)
                result.append(match)
        return sorted(result, key=lambda m: m.name)