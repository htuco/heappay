import logging
import threading
import time
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

import httpx

from settings import get_settings

logger = logging.getLogger(__name__)

_CENTS = Decimal("0.01")
_RATE_QUANT = Decimal("0.000001")


class FxError(Exception):
    """A currency conversion could not be produced."""


def _normalize_code(code: str) -> str:
    return str(code or "").strip().upper()


def _parse_fallback_rates(raw: str, base: str) -> dict[str, Decimal]:
    """Parse "EUR:1.08,GBP:1.27" into {code: units_of_base_per_unit}.

    Each value is how many units of the base currency one unit of the listed
    currency is worth (e.g. with base USD, "EUR:1.08" => 1 EUR = 1.08 USD). The
    base currency itself is always present at rate 1.
    """
    rates: dict[str, Decimal] = {base: Decimal("1")}
    for pair in (raw or "").split(","):
        pair = pair.strip()
        if not pair or ":" not in pair:
            continue
        code, _, value = pair.partition(":")
        code = _normalize_code(code)
        try:
            rate = Decimal(value.strip())
        except InvalidOperation:
            logger.warning("Ignoring invalid FX fallback rate: %r", pair)
            continue
        if code and rate > 0:
            rates[code] = rate
    return rates


class FxService:
    """Indicative currency conversion for the AI assistant.

    Live rates come from a keyless FX API (frankfurter.app) with a short-lived
    in-memory cache; if the live source is unavailable or does not cover a
    currency, statically configured fallback rates are used. Conversions are
    informational only — they never move money.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._api_url = settings.fx_api_url.strip().rstrip("/")
        self._base = _normalize_code(settings.fx_base_currency) or "USD"
        self._cache_ttl = max(0, settings.fx_cache_ttl_seconds)
        self._fallback = _parse_fallback_rates(settings.fx_rates, self._base)
        self._cache: dict[tuple[str, str], tuple[float, Decimal]] = {}
        self._lock = threading.Lock()

    def convert(self, *, amount: Decimal, from_currency: str, to_currency: str) -> dict:
        src = _normalize_code(from_currency)
        dst = _normalize_code(to_currency)
        if not src or not dst:
            raise FxError("Both a source and target currency are required.")
        if amount <= 0:
            raise FxError("Amount must be greater than zero.")

        if src == dst:
            rate, source = Decimal("1"), "identity"
        else:
            rate, source = self._resolve_rate(src, dst)

        converted = (amount * rate).quantize(_CENTS, rounding=ROUND_HALF_UP)
        return {
            "amount": format(amount, "f"),
            "from_currency": src,
            "to_currency": dst,
            "rate": format(rate, "f"),
            "converted": format(converted, "f"),
            "indicative": True,
            "source": source,
            "disclaimer": "Indicative rate — for information only. No money was converted.",
        }

    def _resolve_rate(self, src: str, dst: str) -> tuple[Decimal, str]:
        cached = self._get_cached(src, dst)
        if cached is not None:
            return cached, "live-cache"
        live = self._fetch_live(src, dst)
        if live is not None:
            self._put_cached(src, dst, live)
            return live, "live"
        fallback = self._fallback_rate(src, dst)
        if fallback is not None:
            return fallback, "configured"
        raise FxError(f"No exchange rate available for {src} to {dst}.")

    def _get_cached(self, src: str, dst: str) -> Decimal | None:
        if self._cache_ttl <= 0:
            return None
        with self._lock:
            entry = self._cache.get((src, dst))
        if entry is None:
            return None
        stored_at, rate = entry
        if time.time() - stored_at > self._cache_ttl:
            return None
        return rate

    def _put_cached(self, src: str, dst: str, rate: Decimal) -> None:
        with self._lock:
            self._cache[(src, dst)] = (time.time(), rate)

    def _fetch_live(self, src: str, dst: str) -> Decimal | None:
        if not self._api_url:
            return None
        try:
            with httpx.Client(timeout=5.0, follow_redirects=True) as client:
                resp = client.get(
                    f"{self._api_url}/latest",
                    params={"from": src, "to": dst},
                )
            resp.raise_for_status()
            data = resp.json()
            raw = (data.get("rates") or {}).get(dst)
            if raw is None:
                return None
            rate = Decimal(str(raw))
            return rate.quantize(_RATE_QUANT) if rate > 0 else None
        except (httpx.HTTPError, ValueError, InvalidOperation) as exc:
            logger.warning("Live FX lookup failed for %s->%s: %s", src, dst, exc)
            return None

    def _fallback_rate(self, src: str, dst: str) -> Decimal | None:
        src_to_base = self._fallback.get(src)
        dst_to_base = self._fallback.get(dst)
        if src_to_base is None or dst_to_base is None or dst_to_base == 0:
            return None
        return (src_to_base / dst_to_base).quantize(_RATE_QUANT)
