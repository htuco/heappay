from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Contact(Base):
    """A user's saved contact (address-book entry) pointing at another user.

    One-directional: `owner` saved `contact_user`. The pair is unique so the
    same person can't be added twice.
    """

    __tablename__ = "contacts"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "contact_user_id", name="uq_contacts_owner_contact"),
        # Named explicitly to match the database. `index=True` on the columns
        # generated `ix_contacts_*`, while the migration created `idx_contacts_*`,
        # so every autogenerate run churned both (audit F-20).
        Index("idx_contacts_contact_user_id", "contact_user_id"),
        {"schema": "identity"},
    )

    contact_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False
    )
    contact_user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"), nullable=False
    )
    alias: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    owner = relationship("User", foreign_keys=[owner_user_id], back_populates="contacts")
    contact_user = relationship("User", foreign_keys=[contact_user_id])
