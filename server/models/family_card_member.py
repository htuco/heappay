from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class FamilyCardMember(Base):
    """Authorizes a dependent to spend from a card they don't own.

    The card keeps its single owner (the guardian, via `Card.user_id`) --
    membership is what makes it "shared". Adding a member requires an
    accepted `FamilyLink` between that dependent and the card's owner
    (enforced in the service layer, not here).
    """

    __tablename__ = "family_card_members"
    __table_args__ = (
        UniqueConstraint("card_id", "dependent_user_id", name="uq_family_card_members_card_dependent"),
        # Named explicitly rather than via index=True: under a schema SQLAlchemy
        # auto-names these ix_identity_family_card_members_*, which would not
        # match what the migration created.
        Index("ix_family_card_members_card_id", "card_id"),
        Index("ix_family_card_members_dependent_user_id", "dependent_user_id"),
        {"schema": "identity"},
    )

    family_card_member_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("money.cards.card_id", ondelete="CASCADE"), nullable=False
    )
    dependent_user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False
    )
    added_by_user_id: Mapped[int] = mapped_column(ForeignKey("identity.users.user_id"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    card = relationship("Card")
    dependent = relationship("User", foreign_keys=[dependent_user_id])
