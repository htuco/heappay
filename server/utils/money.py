"""Monetary amount parsing and normalization."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

_TWO_PLACES = Decimal("0.01")
_AMOUNT_INPUT_RE = re.compile(r"^\d+(?:\.\d+)?$")


class InvalidMoneyAmountError(ValueError):
    """Raised when an amount string or number cannot be normalized to money."""


def parse_money_amount(value: object) -> Decimal:
    """Normalize to two decimal places; reject more than two fractional digits."""
    if isinstance(value, Decimal):
        raw = format(value, "f")
    elif isinstance(value, bool):
        raise InvalidMoneyAmountError("Amount must be a positive number")
    elif isinstance(value, int):
        raw = str(value)
    elif isinstance(value, float):
        raw = format(value, "f")
    elif isinstance(value, str):
        raw = value.strip()
    else:
        raise InvalidMoneyAmountError("Amount must be a positive number")

    if not raw or raw == "." or not _AMOUNT_INPUT_RE.match(raw):
        raise InvalidMoneyAmountError(
            "Amount must be a positive number with at most 2 decimal places"
        )

    if "." in raw:
        _, fractional = raw.split(".", 1)
        if len(fractional) > 2:
            raise InvalidMoneyAmountError("Amount must have at most 2 decimal places")

    try:
        amount = Decimal(raw)
    except InvalidOperation as exc:
        raise InvalidMoneyAmountError("Amount must be a valid number") from exc

    amount = amount.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)
    if amount <= 0:
        raise InvalidMoneyAmountError("Amount must be greater than zero")
    return amount
