from sqlalchemy.exc import IntegrityError

from repositories.family.family_card_member import FamilyCardMemberRepository, FamilyCardMemberRow
from repositories.family.family_link import FamilyLinkRepository
from schemas.family_card_member import FamilyCardMemberResponse
from services.storage.avatar_display_url import resolve_avatar_url_for_client
from settings import get_settings


class FamilyCardMemberError(Exception):
    """A shared-card-membership operation could not be completed."""


class FamilyCardMemberNotFoundError(FamilyCardMemberError):
    """The dependent is not a member of this card."""


class NotGuardianOfDependentError(FamilyCardMemberError):
    """The card owner is not this dependent's accepted guardian."""


class FamilyCardMemberAlreadyExistsError(FamilyCardMemberError):
    """This dependent is already a member of this card."""


class FamilyCardMemberService:
    def __init__(
        self, repo: FamilyCardMemberRepository, family_link_repo: FamilyLinkRepository
    ) -> None:
        self._repo = repo
        self._family_link_repo = family_link_repo

    def add(
        self, *, card_id: int, guardian_user_id: int, dependent_user_id: int
    ) -> FamilyCardMemberResponse:
        family_link = self._family_link_repo.get_accepted_for_dependent(dependent_user_id)
        if family_link is None or family_link.guardian_user_id != guardian_user_id:
            raise NotGuardianOfDependentError(
                "You are not this person's accepted guardian."
            )
        if self._repo.get(card_id=card_id, dependent_user_id=dependent_user_id) is not None:
            raise FamilyCardMemberAlreadyExistsError("This person is already a member of this card.")

        try:
            row = self._repo.add(
                card_id=card_id, dependent_user_id=dependent_user_id, added_by_user_id=guardian_user_id
            )
        except IntegrityError as exc:
            raise FamilyCardMemberAlreadyExistsError(
                "This person is already a member of this card."
            ) from exc
        return self._to_response(row, family_link.dependent)

    def remove(self, *, card_id: int, dependent_user_id: int) -> None:
        row = self._repo.get(card_id=card_id, dependent_user_id=dependent_user_id)
        if row is None:
            raise FamilyCardMemberNotFoundError("This person is not a member of this card.")
        self._repo.remove(row)

    def list_for_card(self, card_id: int) -> list[FamilyCardMemberResponse]:
        rows: list[FamilyCardMemberRow] = self._repo.list_for_card(card_id)
        return [self._to_response(member, user) for member, user in rows]

    def is_member(self, *, card_id: int, dependent_user_id: int) -> bool:
        return self._repo.is_member(card_id=card_id, dependent_user_id=dependent_user_id)

    def _to_response(self, row, user) -> FamilyCardMemberResponse:
        settings = get_settings()
        return FamilyCardMemberResponse(
            family_card_member_id=row.family_card_member_id,
            card_id=row.card_id,
            dependent_user_id=row.dependent_user_id,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            avatar_url=resolve_avatar_url_for_client(user.avatar_url, settings),
            added_by_user_id=row.added_by_user_id,
            added_at=row.added_at,
        )
