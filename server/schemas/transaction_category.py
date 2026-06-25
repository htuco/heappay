from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TransactionCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction_category_id: int
    name: str
    created_at: datetime
