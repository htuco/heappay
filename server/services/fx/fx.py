import logging
import threading
import time
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

import httpx

from settings import get_settings

logger = logging.getLogger(__name__)

_CENTS = Decimal("0.01")
_RATE_QUANT = Decimal("0.000001")
_PCT_QUANT = Decimal("0.01")

# Currencies with an official fixed parity to the euro (currency board / peg).
# The value is how many units equal 1 EUR — a genuine fixed rate, not an estimate.
_EUR_FIXED_PEGS = {
    "BAM": Decimal("1.95583"),  # Bosnia and Herzegovina convertible mark
}

# Popular currencies shown as reference cards, priced against the euro.
_OVERVIEW_BASE = "EUR"
_OVERVIEW_LIVE_SYMBOLS = ("TRY", "USD", "GBP")


def _fmt_rate(value: Decimal) -> str:
    quant = Decimal("0.00001") if abs(value) < Decimal("0.1") else Decimal("0.0001")
    return format(value.quantize(quant, rounding=ROUND_HALF_UP), "f")


def _fmt_signed_pct(pct: Decimal) -> str:
    rounded = pct.quantize(_PCT_QUANT, rounding=ROUND_HALF_UP)
    sign = "+" if rounded >= 0 else ""
    return f"{sign}{format(rounded, 'f')}%"


def _trend(pct: Decimal) -> str:
    rounded = pct.quantize(_PCT_QUANT, rounding=ROUND_HALF_UP)
    if rounded > 0:
        return "up"
    if rounded < 0:
        return "down"
    return "flat"


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

    def _fetch_timeseries(
        self, base: str, symbols: list[str], start: str, end: str
    ) -> dict[str, dict[str, Decimal]]:
        """Return {date: {symbol: base->symbol rate}} for [start, end].

        Live source only; returns an empty dict if the source is unavailable or
        covers none of the requested symbols. Weekend/holiday gaps are simply
        absent from the result (the API omits non-business days).
        """
        if not self._api_url or not symbols:
            return {}
        try:
            with httpx.Client(timeout=6.0, follow_redirects=True) as client:
                resp = client.get(
                    f"{self._api_url}/{start}..{end}",
                    params={"from": base, "to": ",".join(symbols)},
                )
            resp.raise_for_status()
            data = resp.json()
            out: dict[str, dict[str, Decimal]] = {}
            for day, row in (data.get("rates") or {}).items():
                parsed: dict[str, Decimal] = {}
                for code, value in (row or {}).items():
                    try:
                        rate = Decimal(str(value))
                    except InvalidOperation:
                        continue
                    if rate > 0:
                        parsed[_normalize_code(code)] = rate
                if parsed:
                    out[day] = parsed
            return out
        except (httpx.HTTPError, ValueError, InvalidOperation) as exc:
            logger.warning("FX timeseries failed for %s %s: %s", base, symbols, exc)
            return {}

    def rate_overview(self) -> dict:
        """Reference cards: value of 1 unit of each currency in euro, with the
        real change versus the previous business day. Fixed-peg currencies are
        reported at their official parity."""
        base = _OVERVIEW_BASE
        symbols = list(_OVERVIEW_LIVE_SYMBOLS)
        end = date.today()
        start = end - timedelta(days=10)
        series = self._fetch_timeseries(base, symbols, start.isoformat(), end.isoformat())
        dates = sorted(series.keys())

        cards: list[dict] = []
        for symbol in symbols:
            points = [(d, series[d][symbol]) for d in dates if symbol in series[d]]
            if not points:
                continue
            # base->symbol; the card shows the inverse (1 symbol in euro).
            latest_day, latest_rate = points[-1]
            value_in_eur = Decimal("1") / latest_rate
            change_pct: Decimal | None = None
            if len(points) >= 2:
                prev_value = Decimal("1") / points[-2][1]
                if prev_value > 0:
                    change_pct = (value_in_eur - prev_value) / prev_value * 100
            cards.append(
                {
                    "pair": f"{symbol} → {base}",
                    "code": symbol,
                    "rate": _fmt_rate(value_in_eur),
                    "change": _fmt_signed_pct(change_pct) if change_pct is not None else "—",
                    "trend": _trend(change_pct) if change_pct is not None else "flat",
                    "note": f"As of {latest_day}",
                }
            )

        for symbol, peg in _EUR_FIXED_PEGS.items():
            cards.append(
                {
                    "pair": f"{symbol} → {base}",
                    "code": symbol,
                    "rate": _fmt_rate(Decimal("1") / peg),
                    "change": "Fixed",
                    "trend": "flat",
                    "note": "Central parity",
                }
            )

        return {"base": base, "cards": cards}

    def pair_insight(self, *, from_currency: str, to_currency: str, days: int = 7) -> dict:
        """Real recent history for a pair: sparkline points, 24h movement, and
        the range over the window. Returns available=False if the live source
        has no history for the pair (e.g. an unsupported currency)."""
        src = _normalize_code(from_currency)
        dst = _normalize_code(to_currency)
        empty = {
            "from_currency": src,
            "to_currency": dst,
            "available": False,
            "points": [],
            "latest": None,
            "change_pct": None,
            "range_pct": None,
            "summary": f"Recent history is unavailable for {src} → {dst}.",
        }
        if not src or not dst or src == dst:
            return empty

        end = date.today()
        start = end - timedelta(days=days + 6)  # buffer so weekends don't starve the window
        series = self._fetch_timeseries(src, [dst], start.isoformat(), end.isoformat())
        rows = [(d, series[d][dst]) for d in sorted(series) if dst in series[d]]
        rows = rows[-days:]
        if len(rows) < 2:
            return empty

        values = [rate for _, rate in rows]
        latest = values[-1]
        change_pct = (latest - values[-2]) / values[-2] * 100
        low, high = min(values), max(values)
        range_pct = (high - low) / low * 100 if low > 0 else Decimal("0")

        if change_pct > 0:
            summary = f"{dst} is weaker against {src} over the last week."
        elif change_pct < 0:
            summary = f"{dst} is stronger against {src} over the last week."
        else:
            summary = f"{src} is steady against {dst} over the last week."

        return {
            "from_currency": src,
            "to_currency": dst,
            "available": True,
            "points": [{"date": d, "rate": _fmt_rate(rate)} for d, rate in rows],
            "latest": _fmt_rate(latest),
            "change_pct": _fmt_signed_pct(change_pct),
            "range_pct": format(range_pct.quantize(_PCT_QUANT, rounding=ROUND_HALF_UP), "f") + "%",
            "summary": summary,
        }
