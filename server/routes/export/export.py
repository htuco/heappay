from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from database import get_db
from ratelimit import limiter, user_id_key_func
from repositories.card.card import CardRepository
from repositories.transaction.transaction import TransactionRepository
from repositories.user.auth import UserAuthRepository
from repositories.user.user import UserRepository
from routes.dependencies import get_current_user_id
from services.card.card import CardService
from services.export.pdf_export import (
    build_monthly_report_pdf,
    build_transactions_pdf,
    build_wallet_summary_pdf,
)
from services.transaction.transaction import (
    TransactionCategoryNotFoundError,
    TransactionService,
    TransactionStatusNotFoundError,
    TransactionTypeNotFoundError,
)

router = APIRouter(prefix="/export", tags=["export"])

_EXPORT_RATE_LIMIT = "5/minute"
_EXPORT_RATE_LIMIT_MESSAGE = "Too many export requests. Please wait a moment and try again."
_TRANSACTIONS_EXPORT_LIMIT = 500


def get_card_service(db: Session = Depends(get_db)) -> CardService:
    return CardService(CardRepository(db))


def get_transaction_service(db: Session = Depends(get_db)) -> TransactionService:
    return TransactionService(TransactionRepository(db), auth_repo=UserAuthRepository(db))


def get_user_repo(db: Session = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _require_user(user_repo: UserRepository, user_id: int):
    user = user_repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


@router.get("/wallet-summary.pdf")
@limiter.limit(_EXPORT_RATE_LIMIT, key_func=user_id_key_func, error_message=_EXPORT_RATE_LIMIT_MESSAGE)
def export_wallet_summary(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    user_repo: UserRepository = Depends(get_user_repo),
    card_service: CardService = Depends(get_card_service),
) -> Response:
    user = _require_user(user_repo, user_id)
    cards = card_service.list_all(user_id=user_id, limit=200)
    pdf_bytes = build_wallet_summary_pdf(user, cards)
    return _pdf_response(pdf_bytes, "wallet-summary.pdf")


@router.get("/transactions.pdf")
@limiter.limit(_EXPORT_RATE_LIMIT, key_func=user_id_key_func, error_message=_EXPORT_RATE_LIMIT_MESSAGE)
def export_transactions(
    request: Request,
    status_id: int | None = Query(default=None, ge=1),
    transaction_type_id: int | None = Query(default=None, ge=1),
    category_id: int | None = Query(default=None, ge=1),
    sort: str = Query(default="newest", pattern="^(newest|oldest|amount_desc|amount_asc)$"),
    user_id: int = Depends(get_current_user_id),
    user_repo: UserRepository = Depends(get_user_repo),
    service: TransactionService = Depends(get_transaction_service),
) -> Response:
    user = _require_user(user_repo, user_id)
    try:
        transactions, total = service.list_for_user(
            user_id=user_id,
            limit=_TRANSACTIONS_EXPORT_LIMIT,
            offset=0,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            sort=sort,
        )
    except TransactionStatusNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction status not found.") from None
    except TransactionTypeNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction type not found.") from None
    except TransactionCategoryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction category not found.") from None
    pdf_bytes = build_transactions_pdf(
        user, transactions, total_count=total, shown_count=len(transactions)
    )
    return _pdf_response(pdf_bytes, "transactions.pdf")


@router.get("/monthly-report.pdf")
@limiter.limit(_EXPORT_RATE_LIMIT, key_func=user_id_key_func, error_message=_EXPORT_RATE_LIMIT_MESSAGE)
def export_monthly_report(
    request: Request,
    months: int = Query(default=1, ge=1, le=24),
    user_id: int = Depends(get_current_user_id),
    user_repo: UserRepository = Depends(get_user_repo),
    service: TransactionService = Depends(get_transaction_service),
) -> Response:
    user = _require_user(user_repo, user_id)
    summary_points = service.get_summary_for_user(user_id=user_id, months=months)
    category_breakdown = service.get_category_breakdown_for_user(user_id=user_id, months=months)
    pdf_bytes = build_monthly_report_pdf(user, summary_points, category_breakdown, months)
    return _pdf_response(pdf_bytes, "monthly-report.pdf")
