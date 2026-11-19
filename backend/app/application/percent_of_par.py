"""Application use cases for user-flagged percent-of-par instruments.

Some instruments quote as a percentage of par (per 100 nominal units) but the
provider does not say so: Yahoo Finance reports Argentine ONs such as
``YFCOO.BA`` as ``EQUITY`` with no bond marker. The user flags those tickers
explicitly here, and the market-data adapters divide their quotes by 100.

The flag lives in the existing ``app_settings`` key/value store, so it needs no
schema migration. PPI-served instruments are unaffected because PPI already
reports per-100 prices divided by 100.
"""

from backend.app.application.ports import PortfolioUnitOfWorkFactory

SETTING_KEY = "percent_of_par_tickers"
MAX_TICKERS = 40
MAX_TICKER_LENGTH = 20


def _normalize_ticker(raw: object) -> str:
    """Return the upper-cased ticker or raise for an invalid value.

    Args:
        raw: One user-supplied ticker.

    Returns:
        The trimmed, upper-cased ticker.

    Raises:
        ValueError: When the ticker is empty, too long, or has invalid characters.
    """
    if not isinstance(raw, str):
        raise ValueError("ticker must be a string")
    candidate = raw.strip().upper()
    if not candidate:
        raise ValueError("ticker must not be empty")
    if len(candidate) > MAX_TICKER_LENGTH:
        raise ValueError("ticker is too long")
    if not all(char.isalnum() or char in ".-^" for char in candidate):
        raise ValueError(f"invalid ticker: {raw!r}")
    return candidate


def parse_tickers(raw: str | None) -> list[str]:
    """Parse the stored comma-separated value into a ticker list.

    Args:
        raw: The persisted setting value, or ``None`` when unset.

    Returns:
        The tickers in stored order; an empty list when unset or blank.
    """
    if not raw:
        return []
    return [part for part in (piece.strip().upper() for piece in raw.split(",")) if part]


class PercentOfParUseCases:
    """Read and replace the user-flagged per-100-nominal ticker list."""

    def __init__(self, unit_of_work_factory: PortfolioUnitOfWorkFactory) -> None:
        """Initialize with a caller-supplied unit of work factory."""
        self._unit_of_work_factory = unit_of_work_factory

    def list_tickers(self) -> list[str]:
        """Return the flagged tickers in stored order."""
        with self._unit_of_work_factory() as unit_of_work:
            return parse_tickers(unit_of_work.settings.get_setting(SETTING_KEY))

    def set_tickers(self, tickers: list[str]) -> list[str]:
        """Replace the flagged ticker list after normalizing and validating it.

        Args:
            tickers: The complete new list; duplicates collapse in first-seen order.

        Returns:
            The normalized list that was persisted.

        Raises:
            ValueError: When the list exceeds ``MAX_TICKERS`` or any entry is invalid.
        """
        if not isinstance(tickers, list):
            raise ValueError("tickers must be a list")
        if len(tickers) > MAX_TICKERS:
            raise ValueError("too many tickers")
        normalized: list[str] = []
        for raw in tickers:
            candidate = _normalize_ticker(raw)
            if candidate not in normalized:
                normalized.append(candidate)
        with self._unit_of_work_factory() as unit_of_work:
            unit_of_work.settings.set_setting(
                key=SETTING_KEY, value=",".join(normalized)
            )
            unit_of_work.commit()
        return normalized
