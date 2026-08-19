"""FX rate resolution for the display-currency switcher.

The live source (frankfurter) publishes the ECB reference set, which excludes
currencies with a fixed euro parity -- BAM among them. These tests stub
`_fetch_live` to behave exactly like that: it answers ordinary pairs and knows
nothing about BAM, so the peg path is what has to produce the rate.

No DB and no network; the fake-source style mirrors `test_spending_limit_rules.py`.
"""
from decimal import Decimal

import pytest

from services.fx.fx import FxError, FxService

# What the real source would return: EUR/USD both directions, no BAM at all.
_LIVE = {
    ("USD", "EUR"): Decimal("0.92"),
    ("EUR", "USD"): Decimal("1.0870"),
}


def _service() -> FxService:
    svc = FxService()
    svc._fetch_live = lambda src, dst: _LIVE.get((src, dst))
    svc._cache_ttl = 0  # so each assertion resolves fresh rather than reading a cache
    return svc


def test_identity_pair_needs_no_source() -> None:
    result = _service().rate(from_currency="USD", to_currency="USD")
    assert result["rate"] == "1"
    assert result["source"] == "identity"


def test_ordinary_pair_uses_the_live_source() -> None:
    result = _service().rate(from_currency="USD", to_currency="EUR")
    assert result["rate"] == "0.92"
    assert result["source"] == "live"


def test_eur_to_pegged_currency_uses_official_parity() -> None:
    result = _service().rate(from_currency="EUR", to_currency="BAM")
    assert Decimal(result["rate"]) == Decimal("1.955830")
    assert result["source"] == "fixed-parity"


def test_pegged_to_eur_is_the_inverse_parity() -> None:
    result = _service().rate(from_currency="BAM", to_currency="EUR")
    assert Decimal(result["rate"]).quantize(Decimal("0.0001")) == Decimal("0.5113")
    assert result["source"] == "fixed-parity"


def test_pegged_currency_crosses_through_eur() -> None:
    """USD->BAM has no direct quote anywhere: it is USD->EUR live, then the
    fixed EUR->BAM parity."""
    result = _service().rate(from_currency="USD", to_currency="BAM")
    expected = Decimal("0.92") * Decimal("1.95583")
    assert Decimal(result["rate"]).quantize(Decimal("0.0001")) == expected.quantize(
        Decimal("0.0001")
    )
    assert result["source"] == "fixed-parity"


def test_reverse_cross_is_consistent_with_forward() -> None:
    svc = _service()
    forward = Decimal(svc.rate(from_currency="USD", to_currency="BAM")["rate"])
    back = Decimal(svc.rate(from_currency="BAM", to_currency="USD")["rate"])
    assert (forward * back).quantize(Decimal("0.01")) == Decimal("1.00")


def test_unknown_currency_raises_rather_than_inventing_a_rate() -> None:
    """A pair the sources genuinely cannot price must fail loudly -- the client
    falls back to the base currency with a note, never a wrong number."""
    svc = _service()
    svc._fallback = {}
    with pytest.raises(FxError):
        svc.rate(from_currency="XYZ", to_currency="USD")


def test_supported_currencies_includes_pegs_and_base() -> None:
    svc = _service()
    svc._fetch_currency_codes = lambda: ("EUR", "GBP", "USD")
    result = svc.supported_currencies()
    assert "BAM" in result["codes"], "pegged currencies are priceable, so they belong in the list"
    assert result["base"] in result["codes"]
    assert result["codes"] == sorted(result["codes"])


def test_supported_currencies_survives_an_unreachable_list() -> None:
    svc = _service()
    svc._fetch_currency_codes = lambda: None
    codes = svc.supported_currencies()["codes"]
    assert {"USD", "EUR", "BAM"} <= set(codes)


def test_rate_is_flagged_indicative() -> None:
    result = _service().rate(from_currency="USD", to_currency="EUR")
    assert result["indicative"] is True
    assert result["disclaimer"]
