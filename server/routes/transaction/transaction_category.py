from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.transaction.transaction_category import TransactionCategoryRepository
from schemas.transaction_category import TransactionCategoryResponse

router = APIRouter(prefix="/transaction-categories", tags=["transaction-categories"])


def get_repo(db: Session = Depends(get_db)) -> TransactionCategoryRepository:
    return TransactionCategoryRepository(db)


@router.get("", response_model=list[TransactionCategoryResponse])
def list_transaction_categories(
    repo: TransactionCategoryRepository = Depends(get_repo),
) -> list[TransactionCategoryResponse]:
    return [TransactionCategoryResponse.model_validate(r) for r in repo.list_all()]


@router.get("/{transaction_category_id}", response_model=TransactionCategoryResponse)
def get_transaction_category(
    transaction_category_id: int,
    repo: TransactionCategoryRepository = Depends(get_repo),
) -> TransactionCategoryResponse:
    row = repo.get_by_id(transaction_category_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction category not found.",
        )
    return TransactionCategoryResponse.model_validate(row)
