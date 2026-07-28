"""FamilyLinkService tests against fake repos (no DB) -- invite/accept/decline/
revoke lifecycle, self-link rejection, already-guarded rejection (both the
service-layer pre-check and the IntegrityError-race fallback), and revoke's
either-party/forbidden/not-accepted guards.
"""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

from services.family.family_link import (
    FamilyLinkAlreadyGuardedError,
    FamilyLinkAlreadyPendingError,
    FamilyLinkDependentNotFoundError,
    FamilyLinkForbiddenError,
    FamilyLinkNotFoundError,
    FamilyLinkNotPendingError,
    FamilyLinkSelfLinkError,
    FamilyLinkService,
)


def _user(user_id, *, email, first_name="First", last_name="Last", deleted_at=None):
    return SimpleNamespace(
        user_id=user_id,
        email=email,
        first_name=first_name,
        last_name=last_name,
        avatar_url=None,
        deleted_at=deleted_at,
    )


class FakeFamilyLink:
    _next_id = 1

    def __init__(self, *, guardian_user_id, dependent_user_id, status="pending"):
        self.family_link_id = FakeFamilyLink._next_id
        FakeFamilyLink._next_id += 1
        self.guardian_user_id = guardian_user_id
        self.dependent_user_id = dependent_user_id
        self.status = status
        self.invited_at = datetime.now(timezone.utc)
        self.responded_at = None
        self.revoked_by_user_id = None


class FakeFamilyLinkRepo:
    def __init__(self):
        self._db = None
        self.rows = {}
        self.raise_integrity_on_create = False

    def get_by_id(self, family_link_id):
        return self.rows.get(family_link_id)

    def get_accepted_for_dependent(self, dependent_user_id):
        for row in self.rows.values():
            if row.dependent_user_id == dependent_user_id and row.status == "accepted":
                return row
        return None

    def get_pending_invite(self, guardian_user_id, dependent_user_id):
        for row in self.rows.values():
            if (
                row.guardian_user_id == guardian_user_id
                and row.dependent_user_id == dependent_user_id
                and row.status == "pending"
            ):
                return row
        return None

    def create_invite(self, *, guardian_user_id, dependent_user_id):
        if self.raise_integrity_on_create:
            raise IntegrityError("insert", {}, Exception("dup"))
        row = FakeFamilyLink(guardian_user_id=guardian_user_id, dependent_user_id=dependent_user_id)
        self.rows[row.family_link_id] = row
        return row

    def save(self, row):
        return row

    def list_dependents_for_guardian(self, guardian_user_id):
        return []

    def list_incoming_invites_for_user(self, dependent_user_id):
        return []


class FakeUserRepo:
    def __init__(self, users):
        self._users_by_id = {u.user_id: u for u in users}
        self._users_by_email = {u.email: u for u in users}

    def get_by_email(self, email):
        return self._users_by_email.get(email)

    def get_by_id(self, user_id):
        return self._users_by_id.get(user_id)


GUARDIAN = _user(1, email="guardian@example.com")
DEPENDENT = _user(2, email="dependent@example.com")


def _service(*, users=(GUARDIAN, DEPENDENT)):
    repo = FakeFamilyLinkRepo()
    return FamilyLinkService(repo, FakeUserRepo(list(users))), repo


def test_invite_creates_pending_link() -> None:
    svc, repo = _service()
    link = svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)
    assert link.status == "pending"
    assert link.guardian.user_id == GUARDIAN.user_id
    assert link.dependent.user_id == DEPENDENT.user_id


def test_invite_rejects_unknown_email() -> None:
    svc, _ = _service()
    with pytest.raises(FamilyLinkDependentNotFoundError):
        svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email="nobody@example.com")


def test_invite_rejects_self_link() -> None:
    svc, _ = _service()
    with pytest.raises(FamilyLinkSelfLinkError):
        svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=GUARDIAN.email)


def test_invite_rejects_already_guarded_dependent() -> None:
    svc, repo = _service()
    existing = FakeFamilyLink(guardian_user_id=99, dependent_user_id=DEPENDENT.user_id, status="accepted")
    repo.rows[existing.family_link_id] = existing
    with pytest.raises(FamilyLinkAlreadyGuardedError):
        svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)


def test_invite_rejects_duplicate_pending_invite() -> None:
    svc, repo = _service()
    existing = FakeFamilyLink(guardian_user_id=GUARDIAN.user_id, dependent_user_id=DEPENDENT.user_id)
    repo.rows[existing.family_link_id] = existing
    with pytest.raises(FamilyLinkAlreadyPendingError):
        svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)


def test_invite_integrity_error_race_maps_to_already_guarded() -> None:
    svc, repo = _service()
    repo.raise_integrity_on_create = True
    with pytest.raises(FamilyLinkAlreadyGuardedError):
        svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)


def test_accept_transitions_to_accepted() -> None:
    svc, repo = _service()
    link = svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)
    accepted = svc.accept(family_link_id=link.family_link_id, dependent_user_id=DEPENDENT.user_id)
    assert accepted.status == "accepted"
    assert accepted.responded_at is not None


def test_accept_wrong_dependent_not_found() -> None:
    svc, repo = _service()
    link = svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)
    with pytest.raises(FamilyLinkNotFoundError):
        svc.accept(family_link_id=link.family_link_id, dependent_user_id=999)


def test_decline_transitions_to_declined() -> None:
    svc, repo = _service()
    link = svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)
    declined = svc.decline(family_link_id=link.family_link_id, dependent_user_id=DEPENDENT.user_id)
    assert declined.status == "declined"


def test_revoke_by_either_party_succeeds() -> None:
    svc, repo = _service()
    link = svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)
    svc.accept(family_link_id=link.family_link_id, dependent_user_id=DEPENDENT.user_id)
    revoked = svc.revoke(family_link_id=link.family_link_id, actor_user_id=DEPENDENT.user_id)
    assert revoked.status == "revoked"


def test_revoke_by_non_party_is_forbidden() -> None:
    svc, repo = _service()
    link = svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)
    svc.accept(family_link_id=link.family_link_id, dependent_user_id=DEPENDENT.user_id)
    with pytest.raises(FamilyLinkForbiddenError):
        svc.revoke(family_link_id=link.family_link_id, actor_user_id=999)


def test_revoke_non_accepted_link_raises() -> None:
    svc, repo = _service()
    link = svc.invite(guardian_user_id=GUARDIAN.user_id, dependent_email=DEPENDENT.email)
    with pytest.raises(FamilyLinkNotPendingError):
        svc.revoke(family_link_id=link.family_link_id, actor_user_id=GUARDIAN.user_id)
