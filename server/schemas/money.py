from decimal import Decimal
from typing import Annotated

from pydantic import BeforeValidator, Field

from utils.money import InvalidMoneyAmountError, parse_money_amount


def _coerce_money_amount(value: object) -> Decimal:
    try:
        return parse_money_amount(value)
    except InvalidMoneyAmountError as exc:
        raise ValueError(str(exc)) from exc


MoneyAmount = Annotated[
    Decimal,
    BeforeValidator(_coerce_money_amount),
    Field(gt=0, max_digits=12, decimal_places=2),
]
