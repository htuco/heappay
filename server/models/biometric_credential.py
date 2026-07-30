from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class BiometricCredential(Base):
    __tablename__ = "biometric_credentials"
    __table_args__ = (Index("idx_biometric_credentials_user_id", "user_id"),
        {"schema": "security"},
    )

    credential_row_id: Mapped[int] = mapped_column("biometric_credential_id", primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("identity.users.user_id", ondelete="CASCADE"),
        nullable=False,
    )
    credential_id: Mapped[str] = mapped_column("webauthn_credential_id", String(512), unique=True, nullable=False)
    public_key: Mapped[bytes] = mapped_column(LargeBinary(), nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer(), nullable=False, default=0)
    aaguid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    backed_up: Mapped[bool] = mapped_column("is_backed_up", Boolean(), nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="biometric_credentials")
