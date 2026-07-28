from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError

from models.family_link import FamilyLink
from models.user import User
from repositories.family.family_link import FamilyLinkRepository
from repositories.user.user import UserRepository
from schemas.family_link import FamilyLinkPartySummary, FamilyLinkResponse
from services.storage.avatar_display_url import resolve_avatar_url_for_client
from settings import get_settings


class FamilyLinkError(Exception):
    """A family-link operation could not be completed."""


class FamilyLinkNotFoundError(FamilyLinkError):
    """The family link does not exist, or does not belong to this user."""


class FamilyLinkDependentNotFoundError(FamilyLinkError):
    """No existing account matches the invited email."""


class FamilyLinkSelfLinkError(FamilyLinkError):
    """A user cannot be their own guardian."""


class FamilyLinkAlreadyGuardedError(FamilyLinkError):
    """The dependent already has an active guardian."""


class FamilyLinkAlreadyPendingError(FamilyLinkError):
    """This guardian already has a pending invite out to this dependent."""


class FamilyLinkForbiddenError(FamilyLinkError):
    """The current user is not a party to this family link."""


class FamilyLinkNotPendingError(FamilyLinkError):
    """The family link is not in a state that allows this action."""


class FamilyLinkService:
    def __init__(self, repo: FamilyLinkRepository, user_repo: UserRepository) -> None:
        self._repo = repo
        self._user_repo = user_repo

    def invite(self, *, guardian_user_id: int, dependent_email: str) -> FamilyLinkResponse:
        dependent = self._user_repo.get_by_email(dependent_email.strip().lower())
        if dependent is None or dependent.deleted_at is not None:
            raise FamilyLinkDependentNotFoundError("No account found for that email.")
        if dependent.user_id == guardian_user_id:
            raise FamilyLinkSelfLinkError("You cannot be your own guardian.")

        if self._repo.get_accepted_for_dependent(dependent.user_id) is not None:
            raise FamilyLinkAlreadyGuardedError("This person already has an active guardian.")
        if self._repo.get_pending_invite(guardian_user_id, dependent.user_id) is not None:
            raise FamilyLinkAlreadyPendingError("You already have a pending invite to this person.")

        try:
            row = self._repo.create_invite(
                guardian_user_id=guardian_user_id, dependent_user_id=dependent.user_id
            )
        except IntegrityError as exc:
            raise FamilyLinkAlreadyGuardedError(
                "This person already has an active guardian."
            ) from exc

        guardian = self._user_repo.get_by_id(guardian_user_id)
        assert guardian is not None
        self._notify_invited(row)
        return self._to_response(row, guardian, dependent)

    def accept(self, *, family_link_id: int, dependent_user_id: int) -> FamilyLinkResponse:
        row = self._require_pending_for_dependent(family_link_id, dependent_user_id)
        try:
            row.status = "accepted"
            row.responded_at = datetime.now(timezone.utc)
            self._repo.save(row)
        except IntegrityError as exc:
            raise FamilyLinkAlreadyGuardedError(
                "This person already has an active guardian."
            ) from exc
        self._notify_accepted(row)
        return self._to_response_for_row(row)

    def decline(self, *, family_link_id: int, dependent_user_id: int) -> FamilyLinkResponse:
        row = self._require_pending_for_dependent(family_link_id, dependent_user_id)
        row.status = "declined"
        row.responded_at = datetime.now(timezone.utc)
        self._repo.save(row)
        return self._to_response_for_row(row)

    def revoke(self, *, family_link_id: int, actor_user_id: int) -> FamilyLinkResponse:
        row = self._repo.get_by_id(family_link_id)
        if row is None:
            raise FamilyLinkNotFoundError("Family link not found.")
        if actor_user_id not in (row.guardian_user_id, row.dependent_user_id):
            raise FamilyLinkForbiddenError("You are not a party to this family link.")
        if row.status != "accepted":
            raise FamilyLinkNotPendingError("This family link is not currently active.")
        row.status = "revoked"
        row.revoked_by_user_id = actor_user_id
        self._repo.save(row)
        return self._to_response_for_row(row)

    def list_my_dependents(self, guardian_user_id: int) -> list[FamilyLinkResponse]:
        rows = self._repo.list_dependents_for_guardian(guardian_user_id)
        guardian = self._user_repo.get_by_id(guardian_user_id)
        assert guardian is not None
        return [self._to_response(link, guardian, dependent) for link, dependent in rows]

    def list_my_incoming_invites(self, dependent_user_id: int) -> list[FamilyLinkResponse]:
        rows = self._repo.list_incoming_invites_for_user(dependent_user_id)
        dependent = self._user_repo.get_by_id(dependent_user_id)
        assert dependent is not None
        return [self._to_response(link, guardian, dependent) for link, guardian in rows]

    def _notify_invited(self, row: FamilyLink) -> None:
        from services.family.family_notification import FamilyNotificationService

        FamilyNotificationService(self._repo._db).notify_family_link_invited(
            family_link_id=row.family_link_id,
            dependent_user_id=row.dependent_user_id,
            guardian_user_id=row.guardian_user_id,
        )

    def _notify_accepted(self, row: FamilyLink) -> None:
        from services.family.family_notification import FamilyNotificationService

        FamilyNotificationService(self._repo._db).notify_family_link_accepted(
            family_link_id=row.family_link_id,
            dependent_user_id=row.dependent_user_id,
            guardian_user_id=row.guardian_user_id,
        )

    def _require_pending_for_dependent(self, family_link_id: int, dependent_user_id: int) -> FamilyLink:
        row = self._repo.get_by_id(family_link_id)
        if row is None or row.dependent_user_id != dependent_user_id:
            raise FamilyLinkNotFoundError("Family link not found.")
        if row.status != "pending":
            raise FamilyLinkNotPendingError("This invite is no longer pending.")
        return row

    def _to_response_for_row(self, row: FamilyLink) -> FamilyLinkResponse:
        guardian = self._user_repo.get_by_id(row.guardian_user_id)
        dependent = self._user_repo.get_by_id(row.dependent_user_id)
        assert guardian is not None and dependent is not None
        return self._to_response(row, guardian, dependent)

    def _to_response(self, row: FamilyLink, guardian: User, dependent: User) -> FamilyLinkResponse:
        settings = get_settings()
        return FamilyLinkResponse(
            family_link_id=row.family_link_id,
            status=row.status,
            guardian=FamilyLinkPartySummary(
                user_id=guardian.user_id,
                first_name=guardian.first_name,
                last_name=guardian.last_name,
                email=guardian.email,
                avatar_url=resolve_avatar_url_for_client(guardian.avatar_url, settings),
            ),
            dependent=FamilyLinkPartySummary(
                user_id=dependent.user_id,
                first_name=dependent.first_name,
                last_name=dependent.last_name,
                email=dependent.email,
                avatar_url=resolve_avatar_url_for_client(dependent.avatar_url, settings),
            ),
            invited_at=row.invited_at,
            responded_at=row.responded_at,
        )
