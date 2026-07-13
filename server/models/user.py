from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func, true
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
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    wallet_balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default="0", default=Decimal("0.00")
    )
    billing_reminders_enabled: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default=true()
    )
    email_payment_sent_enabled: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default=true()
    )
    email_payment_received_enabled: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default=true()
    )
    email_topup_enabled: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default=true()
    )
    email_refund_status_enabled: Mapped[bool] = mapped_column(
        Boolean(), nullable=False, server_default=true()
    )
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    totp_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")
    app_pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    app_pin_failed_attempts: Mapped[int] = mapped_column(
        Integer(),
        nullable=False,
        server_default="0",
    )
    app_pin_locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    app_pin_set_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_confirm_enabled: Mapped[bool] = mapped_column(
        Boolean(),
        nullable=False,
        server_default=true(),
    )
    payment_confirm_above_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        server_default="0",
    )
    recovery_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recovery_email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    recovery_email_verification_token: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    recovery_email_verification_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    status = relationship("UserStatus", back_populates="users")
    role = relationship("UserRole", back_populates="users")
    cards = relationship("Card", back_populates="user")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    email_verification_tokens = relationship("EmailVerificationToken", back_populates="user")
    password_history = relationship("PasswordHistory", back_populates="user")
    biometric_credentials = relationship("BiometricCredential", back_populates="user")
    biometric_registration_challenges = relationship(
        "BiometricRegistrationChallenge",
        back_populates="user",
    )
    biometric_authentication_challenges = relationship(
        "BiometricAuthenticationChallenge",
        back_populates="user",
    )
    security_audit_events = relationship("UserSecurityAuditEvent", back_populates="user")
