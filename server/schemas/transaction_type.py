from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TransactionTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_type_id: int
    name: str
    created_at: datetime
