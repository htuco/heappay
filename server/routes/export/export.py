from datetime import date

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
    humanize,
)
from services.transaction.transaction import (
    CardNotFoundError,
    ForbiddenError,
    TransactionCategoryNotFoundError,
    TransactionService,
    TransactionStatusNotFoundError,
    TransactionTypeNotFoundError,
)

router = APIRouter(prefix="/export", tags=["export"])

_EXPORT_RATE_LIMIT = "5/minute"
_EXPORT_RATE_LIMIT_MESSAGE = "Too many export requests. Please wait a moment and try again."
_TRANSACTIONS_EXPORT_LIMIT = 500

_SORT_LABELS = {
    "newest": "Newest first",
    "oldest": "Oldest first",
    "amount_desc": "Amount: high to low",
    "amount_asc": "Amount: low to high",
}


def _format_date_range(transactions: list) -> str | None:
    """Human-readable range spanning the exported set, e.g. 'Jun 01 - Aug 06, 2026'."""
    dates = [t.created_at for t in transactions if getattr(t, "created_at", None) is not None]
    if not dates:
        return None
    lo, hi = min(dates), max(dates)
    if lo.date() == hi.date():
        return lo.strftime("%b %d, %Y")
    if lo.year == hi.year:
        return f"{lo.strftime('%b %d')} \u2013 {hi.strftime('%b %d, %Y')}"
    return f"{lo.strftime('%b %d, %Y')} \u2013 {hi.strftime('%b %d, %Y')}"


def _format_requested_dates(from_date: date | None, to_date: date | None) -> str | None:
    """The dates the user actually asked for -- shown in preference to the range
    derived from the rows, which would silently read empty on a no-match export."""
    if from_date and to_date:
        if from_date == to_date:
            return from_date.strftime("%b %d, %Y")
        return f"{from_date.strftime('%b %d, %Y')} \u2013 {to_date.strftime('%b %d, %Y')}"
    if from_date:
        return f"From {from_date.strftime('%b %d, %Y')}"
    if to_date:
        return f"Until {to_date.strftime('%b %d, %Y')}"
    return None


def _build_transactions_context_line(
    labels: dict,
    sort: str,
    transactions: list | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    search: str | None = None,
) -> str:
    parts: list[str] = []
    if labels.get("status"):
        parts.append(f"Status: {humanize(labels['status'])}")
    if labels.get("type"):
        parts.append(f"Type: {humanize(labels['type'])}")
    if labels.get("category"):
        parts.append(f"Category: {humanize(labels['category'])}")
    if labels.get("card"):
        parts.append(f"Card: {labels['card']}")
    if search and search.strip():
        parts.append(f'Search: "{search.strip()}"')
    if not parts:
        parts.append("All transactions")
    date_range = _format_requested_dates(from_date, to_date) or _format_date_range(
        transactions or []
    )
    if date_range:
        parts.append(date_range)
    parts.append(_SORT_LABELS.get(sort, "Newest first"))
    return "Filters: " + " \u00b7 ".join(parts)


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
    card_id: int | None = Query(default=None, ge=1),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    q: str | None = Query(default=None, max_length=100),
    sort: str = Query(default="newest", pattern="^(newest|oldest|amount_desc|amount_asc)$"),
    user_id: int = Depends(get_current_user_id),
    user_repo: UserRepository = Depends(get_user_repo),
    service: TransactionService = Depends(get_transaction_service),
) -> Response:
    user = _require_user(user_repo, user_id)
    try:
        # Same service call the transactions list uses, with the same filter set,
        # so the exported rows can't drift from what the page shows.
        transactions, total = service.list_for_user(
            user_id=user_id,
            limit=_TRANSACTIONS_EXPORT_LIMIT,
            offset=0,
            status_id=status_id,
            transaction_type_id=transaction_type_id,
            category_id=category_id,
            card_id=card_id,
            from_date=from_date,
            to_date=to_date,
            search=q,
            sort=sort,
        )
    except CardNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.") from None
    except ForbiddenError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this card.") from None
    except TransactionStatusNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction status not found.") from None
    except TransactionTypeNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction type not found.") from None
    except TransactionCategoryNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction category not found.") from None
    filter_labels = service.get_applied_filter_labels(
        status_id=status_id,
        transaction_type_id=transaction_type_id,
        category_id=category_id,
        card_id=card_id,
    )
    context_line = _build_transactions_context_line(
        filter_labels,
        sort,
        transactions,
        from_date=from_date,
        to_date=to_date,
        search=q,
    )
    pdf_bytes = build_transactions_pdf(
        user,
        transactions,
        total_count=total,
        shown_count=len(transactions),
        context_line=context_line,
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
