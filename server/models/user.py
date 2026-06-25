from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status_id: Mapped[int] = mapped_column(ForeignKey("user_statuses.id"), nullable=False)
    user_role_id: Mapped[int] = mapped_column(ForeignKey("user_roles.role_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    modified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    refresh_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    billing_reminders_enabled: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default=true()
    )
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    totp_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")

    status = relationship("UserStatus", back_populates="users")
    role = relationship("UserRole", back_populates="users")
    cards = relationship("Card", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    biometric_credentials = relationship("BiometricCredential", back_populates="user")
    biometric_registration_challenges = relationship(
        "BiometricRegistrationChallenge",
        back_populates="user",
    )
    biometric_authentication_challenges = relationship(
        "BiometricAuthenticationChallenge",
        back_populates="user",
    )
