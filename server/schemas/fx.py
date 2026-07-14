from pydantic import BaseModel


class FxConvertResponse(BaseModel):
    amount: str
    from_currency: str
    to_currency: str
    rate: str
    converted: str
    indicative: bool
    source: str
    disclaimer: str


class FxRateCard(BaseModel):
    pair: str
    code: str
    rate: str
    change: str
    trend: str
    note: str


class FxRatesResponse(BaseModel):
    base: str
    cards: list[FxRateCard]


class FxInsightPoint(BaseModel):
    date: str
    rate: str


class FxInsightResponse(BaseModel):
    from_currency: str
    to_currency: str
    available: bool
    points: list[FxInsightPoint]
    latest: str | None = None
    change_pct: str | None = None
    range_pct: str | None = None
    summary: str
