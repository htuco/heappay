from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.transaction_type import TransactionTypeRepository
from schemas.transaction_type import TransactionTypeResponse

router = APIRouter(prefix="/transaction-types", tags=["transaction-types"])


def get_repo(db: Session = Depends(get_db)) -> TransactionTypeRepository:
    return TransactionTypeRepository(db)


@router.get("", response_model=list[TransactionTypeResponse])
def list_transaction_types(
    repo: TransactionTypeRepository = Depends(get_repo),
) -> list[TransactionTypeResponse]:
    return [TransactionTypeResponse.model_validate(r) for r in repo.list_all()]


@router.get("/{transaction_type_id}", response_model=TransactionTypeResponse)
def get_transaction_type(
    transaction_type_id: int,
    repo: TransactionTypeRepository = Depends(get_repo),
) -> TransactionTypeResponse:
    row = repo.get_by_id(transaction_type_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction type not found.",
        )
    return TransactionTypeResponse.model_validate(row)
