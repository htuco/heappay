from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database import get_db
from repositories.contact.contact import ContactRepository
from repositories.user.user import UserRepository
from routes.dependencies import get_current_user_id
from schemas.contact import ContactCreate, ContactResponse, ContactUpdate
from schemas.response import ApiResponse
from services.contact.contact import (
    ContactExistsError,
    ContactNotFoundError,
    ContactService,
    InvalidContactError,
)

router = APIRouter(prefix="/contacts", tags=["contacts"])


def get_contact_service(db: Session = Depends(get_db)) -> ContactService:
    return ContactService(ContactRepository(db), UserRepository(db))


@router.get("", response_model=ApiResponse[list[ContactResponse]])
def list_contacts(
    q: str | None = Query(default=None, description="Filter by name, alias, or email."),
    user_id: int = Depends(get_current_user_id),
    service: ContactService = Depends(get_contact_service),
) -> ApiResponse[list[ContactResponse]]:
    contacts = service.list_contacts(user_id, q=q)
    return ApiResponse[list[ContactResponse]](
        success=True,
        message="Contacts retrieved.",
        data=contacts,
    )


@router.post("", response_model=ApiResponse[ContactResponse], status_code=status.HTTP_201_CREATED)
def add_contact(
    payload: ContactCreate,
    user_id: int = Depends(get_current_user_id),
    service: ContactService = Depends(get_contact_service),
) -> ApiResponse[ContactResponse]:
    try:
        contact = service.add_contact(user_id, payload)
    except InvalidContactError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except ContactExistsError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return ApiResponse[ContactResponse](
        success=True,
        message="Contact added.",
        data=contact,
    )


@router.patch("/{contact_id}", response_model=ApiResponse[ContactResponse])
def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    user_id: int = Depends(get_current_user_id),
    service: ContactService = Depends(get_contact_service),
) -> ApiResponse[ContactResponse]:
    try:
        contact = service.update_contact(user_id, contact_id, payload)
    except ContactNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    return ApiResponse[ContactResponse](
        success=True,
        message="Contact updated.",
        data=contact,
    )


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: int,
    user_id: int = Depends(get_current_user_id),
    service: ContactService = Depends(get_contact_service),
) -> None:
    try:
        service.remove_contact(user_id, contact_id)
    except ContactNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
