from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class FamilyLink(Base):
    """A guardian-dependent relationship between two existing user accounts.

    Not a new global role — both parties are still just `users` with role
    `user`. `status` tracks an invite lifecycle (guardian invites an existing
    account by email, the invitee must explicitly accept). A dependent can
    have at most one `accepted` link at a time (single guardian per
    dependent in v1), enforced by a partial unique index in the migration.
    """

    __tablename__ = "family_links"
    __table_args__ = (
        CheckConstraint(
            "guardian_user_id != dependent_user_id", name="ck_family_links_no_self_link"
        ),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'revoked')",
            name="ck_family_links_status_valid",
        ),
    )

    family_link_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    guardian_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    dependent_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )

    guardian = relationship("User", foreign_keys=[guardian_user_id])
    dependent = relationship("User", foreign_keys=[dependent_user_id])
