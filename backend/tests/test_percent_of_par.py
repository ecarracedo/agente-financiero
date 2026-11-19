"""Tests for the user-flagged percent-of-par instrument use cases."""

from types import SimpleNamespace

from backend.app.application.percent_of_par import PercentOfParUseCases


class FakeSettingsRepository:
    """In-memory key/value settings repository."""

    def __init__(self):
        self._settings: dict[str, str] = {}

    def get_setting(self, key):
        """Return the stored value for key, if any."""
        return self._settings.get(key)

    def set_setting(self, *, key, value):
        """Store the value for key."""
        self._settings[key] = value


class FakeUnitOfWork:
    """Minimal unit of work exposing only settings and a no-op commit."""

    def __init__(self, settings):
        self.settings = settings

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def commit(self):
        return None


class FakeUnitOfWorkFactory:
    """Build fake unit of work instances around one settings repository."""

    def __init__(self):
        self.settings = FakeSettingsRepository()

    def __call__(self):
        return FakeUnitOfWork(self.settings)


def test_list_tickers_is_empty_by_default():
    """A fresh settings store reports no flagged tickers."""
    factory = FakeUnitOfWorkFactory()

    use_cases = PercentOfParUseCases(factory)

    assert use_cases.list_tickers() == []


def test_set_tickers_round_trips_and_normalizes():
    """Tickers are stored upper-cased, deduplicated and re-read verbatim."""
    factory = FakeUnitOfWorkFactory()

    use_cases = PercentOfParUseCases(factory)
    result = use_cases.set_tickers([" yfcoo.ba ", "YFCOO.BA", "s13n6.ba"])

    assert result == ["YFCOO.BA", "S13N6.BA"]
    assert use_cases.list_tickers() == ["YFCOO.BA", "S13N6.BA"]


def test_set_tickers_rejects_invalid_values():
    """Empty, oversized or malformed tickers are rejected and nothing is stored."""
    factory = FakeUnitOfWorkFactory()

    use_cases = PercentOfParUseCases(factory)
    for bad in ([""], ["   "], ["x" * 21], ["bad ticker"], ["a,b"], ["junk!"]):
        try:
            use_cases.set_tickers(bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f"expected ValueError for {bad!r}")

    assert use_cases.list_tickers() == []


def test_set_tickers_replaces_the_whole_list():
    """A subsequent set wins over the previous one."""
    factory = FakeUnitOfWorkFactory()

    use_cases = PercentOfParUseCases(factory)
    use_cases.set_tickers(["YFCOO.BA"])
    use_cases.set_tickers(["S13N6.BA"])

    assert use_cases.list_tickers() == ["S13N6.BA"]
