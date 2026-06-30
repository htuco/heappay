from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.biometric_authentication_challenge import BiometricAuthenticationChallenge
from models.biometric_credential import BiometricCredential
from models.biometric_registration_challenge import BiometricRegistrationChallenge
from models.user_role import UserRole
from models.user_status import UserStatus
from models.password_reset_token import PasswordResetToken
from models.user import User
from schemas.user.auth import ProfileUpdateRequest, RegisterRequest

_ACTIVE_STATUS_NAME = "active"
_INVITED_STATUS_NAME = "invited"
_DEFAULT_USER_ROLE_NAME = "user"


class UserAuthRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_user_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self._db.scalars(stmt).first()

    def _get_status_id_by_name(self, status_name: str) -> int:
        status_id = self._db.execute(
            select(UserStatus.id).where(UserStatus.status_name == status_name)
        ).scalar_one_or_none()
        if status_id is None:
            raise ValueError(f"Missing required user status: {status_name}")
        return status_id

    def _get_role_id_by_name(self, role_name: str) -> int:
        role_id = self._db.execute(
            select(UserRole.role_id).where(UserRole.role_name == role_name)
        ).scalar_one_or_none()
        if role_id is None:
            raise ValueError(f"Missing required user role: {role_name}")
        return role_id

    def create_user(self, user_data: RegisterRequest, hashed_password: str) -> User:
        active_status_id = self._get_status_id_by_name(_ACTIVE_STATUS_NAME)
        default_role_id = self._get_role_id_by_name(_DEFAULT_USER_ROLE_NAME)

        user = User(
            email=str(user_data.email),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            password_hash=hashed_password,
            address=None,
            status_id=active_status_id,
            user_role_id=default_role_id,
        )
        try:
            self._db.add(user)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(user)
        return user

    def get_user_by_id(self, user_id: int) -> User | None:
        stmt = select(User).where(User.user_id == user_id)
        return self._db.scalars(stmt).first()

    def get_role_name_for_user(self, user_role_id: int) -> str:
        role_name = self._db.execute(
            select(UserRole.role_name).where(UserRole.role_id == user_role_id)
        ).scalar_one_or_none()
        return role_name or "user"

    def get_user_by_refresh_token(self, refresh_token: str) -> User | None:
        stmt = select(User).where(
            User.refresh_token == refresh_token,
            User.deleted_at.is_(None),
        )
        return self._db.scalars(stmt).first()

    def save_refresh_token(self, user_id: int, refresh_token: str) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(refresh_token=refresh_token)
        )
        self._db.commit()

    def clear_refresh_token(self, user_id: int) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(refresh_token=None)
        )
        self._db.commit()

    def create_password_reset_token(
        self,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
    ) -> PasswordResetToken:
        row = PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def get_password_reset_token(self, token_hash: str) -> PasswordResetToken | None:
        stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        return self._db.scalars(stmt).first()

    def mark_password_reset_token_used(self, token_id: int) -> None:
        self._db.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.token_id == token_id)
            .values(used_at=datetime.now(timezone.utc))
        )
        self._db.commit()

    def mark_password_reset_tokens_used_for_user(self, user_id: int) -> None:
        self._db.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=datetime.now(timezone.utc))
        )
        self._db.commit()

    def update_profile(self, user_id: int, payload: ProfileUpdateRequest) -> User | None:
        values = payload.model_dump(exclude_unset=True)
        if not values:
            return self.get_user_by_id(user_id)

        values["modified_at"] = datetime.now(timezone.utc)

        try:
            self._db.execute(
                update(User)
                .where(User.user_id == user_id)
                .values(**values)
            )
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise

        return self.get_user_by_id(user_id)

    def update_password(self, user_id: int, hashed_password: str) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(password_hash=hashed_password)
        )
        self._db.commit()

    def update_password_and_clear_refresh_token(
        self,
        user_id: int,
        hashed_password: str,
    ) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(password_hash=hashed_password, refresh_token=None)
        )
        self._db.commit()

    def update_app_pin(self, user_id: int, pin_hash: str) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(
                app_pin_hash=pin_hash,
                app_pin_failed_attempts=0,
                app_pin_locked_until=None,
                app_pin_set_at=datetime.now(timezone.utc),
                modified_at=datetime.now(timezone.utc),
            )
        )
        self._db.commit()

    def record_app_pin_failure(
        self,
        user_id: int,
        *,
        failed_attempts: int,
        locked_until: datetime | None,
    ) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(
                app_pin_failed_attempts=failed_attempts,
                app_pin_locked_until=locked_until,
                modified_at=datetime.now(timezone.utc),
            )
        )
        self._db.commit()

    def reset_app_pin_failures(self, user_id: int) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(
                app_pin_failed_attempts=0,
                app_pin_locked_until=None,
                modified_at=datetime.now(timezone.utc),
            )
        )
        self._db.commit()

    def clear_app_pin(self, user_id: int) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(
                app_pin_hash=None,
                app_pin_failed_attempts=0,
                app_pin_locked_until=None,
                app_pin_set_at=None,
                modified_at=datetime.now(timezone.utc),
            )
        )
        self._db.commit()

    def complete_invitation(self, user_id: int, hashed_password: str) -> User | None:
        invited_status_id = self._get_status_id_by_name(_INVITED_STATUS_NAME)
        active_status_id = self._get_status_id_by_name(_ACTIVE_STATUS_NAME)
        user = self.get_user_by_id(user_id)
        if user is None or user.deleted_at is not None:
            return None
        if user.status_id != invited_status_id:
            raise ValueError("NOT_INVITED")

        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(
                password_hash=hashed_password,
                status_id=active_status_id,
                modified_at=datetime.now(timezone.utc),
            )
        )
        self._db.commit()
        return self.get_user_by_id(user_id)

    def soft_delete_user(self, user_id: int) -> None:
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(deleted_at=datetime.now(timezone.utc), refresh_token=None)
        )
        self._db.commit()

    def update_notification_preferences(
        self,
        user_id: int,
        *,
        billing_reminders_enabled: bool | None = None,
        email_payment_sent_enabled: bool | None = None,
        email_payment_received_enabled: bool | None = None,
        email_topup_enabled: bool | None = None,
        email_refund_status_enabled: bool | None = None,
    ) -> None:
        values: dict = {"modified_at": datetime.now(timezone.utc)}
        if billing_reminders_enabled is not None:
            values["billing_reminders_enabled"] = billing_reminders_enabled
        if email_payment_sent_enabled is not None:
            values["email_payment_sent_enabled"] = email_payment_sent_enabled
        if email_payment_received_enabled is not None:
            values["email_payment_received_enabled"] = email_payment_received_enabled
        if email_topup_enabled is not None:
            values["email_topup_enabled"] = email_topup_enabled
        if email_refund_status_enabled is not None:
            values["email_refund_status_enabled"] = email_refund_status_enabled
        self._db.execute(
            update(User).where(User.user_id == user_id).values(**values)
        )
        self._db.commit()

    def update_payment_security_preferences(
        self,
        user_id: int,
        *,
        payment_confirm_enabled: bool | None = None,
        payment_confirm_above_amount: Decimal | None = None,
    ) -> None:
        values: dict = {"modified_at": datetime.now(timezone.utc)}
        if payment_confirm_enabled is not None:
            values["payment_confirm_enabled"] = payment_confirm_enabled
        if payment_confirm_above_amount is not None:
            values["payment_confirm_above_amount"] = payment_confirm_above_amount
        self._db.execute(
            update(User).where(User.user_id == user_id).values(**values)
        )
        self._db.commit()

    def list_biometric_credentials(self, user_id: int) -> list[BiometricCredential]:
        stmt = (
            select(BiometricCredential)
            .where(BiometricCredential.user_id == user_id)
            .order_by(BiometricCredential.created_at.asc())
        )
        return list(self._db.scalars(stmt).all())

    def get_biometric_credential(
        self,
        user_id: int,
        credential_id: str,
    ) -> BiometricCredential | None:
        stmt = select(BiometricCredential).where(
            BiometricCredential.user_id == user_id,
            BiometricCredential.credential_id == credential_id,
        )
        return self._db.scalars(stmt).first()

    def create_biometric_registration_challenge(
        self,
        user_id: int,
        challenge: str,
        expires_at: datetime,
    ) -> BiometricRegistrationChallenge:
        row = BiometricRegistrationChallenge(
            user_id=user_id,
            challenge=challenge,
            expires_at=expires_at,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def get_biometric_registration_challenge(
        self,
        user_id: int,
        challenge_id: int,
    ) -> BiometricRegistrationChallenge | None:
        stmt = select(BiometricRegistrationChallenge).where(
            BiometricRegistrationChallenge.challenge_id == challenge_id,
            BiometricRegistrationChallenge.user_id == user_id,
        )
        return self._db.scalars(stmt).first()

    def mark_biometric_registration_challenge_used(self, challenge_id: int) -> None:
        self._db.execute(
            update(BiometricRegistrationChallenge)
            .where(BiometricRegistrationChallenge.challenge_id == challenge_id)
            .values(used_at=datetime.now(timezone.utc))
        )
        self._db.commit()

    def create_biometric_credential(
        self,
        *,
        user_id: int,
        credential_id: str,
        public_key: bytes,
        sign_count: int,
        aaguid: str | None,
        device_type: str | None,
        backed_up: bool,
    ) -> BiometricCredential:
        row = BiometricCredential(
            user_id=user_id,
            credential_id=credential_id,
            public_key=public_key,
            sign_count=sign_count,
            aaguid=aaguid,
            device_type=device_type,
            backed_up=backed_up,
        )
        try:
            self._db.add(row)
            self._db.commit()
        except IntegrityError:
            self._db.rollback()
            raise
        self._db.refresh(row)
        return row

    def delete_biometric_credentials(self, user_id: int) -> int:
        result = self._db.execute(
            delete(BiometricCredential).where(BiometricCredential.user_id == user_id)
        )
        self._db.commit()
        return result.rowcount or 0

    def create_biometric_authentication_challenge(
        self,
        *,
        user_id: int,
        transaction_id: int | None,
        challenge: str,
        expires_at: datetime,
    ) -> BiometricAuthenticationChallenge:
        row = BiometricAuthenticationChallenge(
            user_id=user_id,
            transaction_id=transaction_id,
            challenge=challenge,
            expires_at=expires_at,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def get_biometric_authentication_challenge(
        self,
        *,
        user_id: int,
        transaction_id: int | None,
        challenge_id: int,
    ) -> BiometricAuthenticationChallenge | None:
        stmt = select(BiometricAuthenticationChallenge).where(
            BiometricAuthenticationChallenge.challenge_id == challenge_id,
            BiometricAuthenticationChallenge.user_id == user_id,
            BiometricAuthenticationChallenge.transaction_id == transaction_id,
        )
        return self._db.scalars(stmt).first()

    def mark_biometric_authentication_challenge_used(self, challenge_id: int) -> None:
        self._db.execute(
            update(BiometricAuthenticationChallenge)
            .where(BiometricAuthenticationChallenge.challenge_id == challenge_id)
            .values(used_at=datetime.now(timezone.utc))
        )

    def update_biometric_credential_usage(
        self,
        *,
        credential_row_id: int,
        sign_count: int,
    ) -> None:
        self._db.execute(
            update(BiometricCredential)
            .where(BiometricCredential.credential_row_id == credential_row_id)
            .values(sign_count=sign_count, last_used_at=datetime.now(timezone.utc))
        )

    def save_totp_secret(self, user_id: int, encrypted_secret: str) -> None:
        """Store the encrypted TOTP secret without enabling 2FA yet."""
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(totp_secret=encrypted_secret, modified_at=datetime.now(timezone.utc))
        )
        self._db.commit()

    def enable_totp(self, user_id: int) -> None:
        """Activate 2FA after the user confirms their authenticator app works."""
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(totp_enabled=True, modified_at=datetime.now(timezone.utc))
        )
        self._db.commit()

    def disable_totp(self, user_id: int) -> None:
        """Deactivate 2FA and wipe the stored secret."""
        self._db.execute(
            update(User)
            .where(User.user_id == user_id)
            .values(totp_secret=None, totp_enabled=False, modified_at=datetime.now(timezone.utc))
        )
        self._db.commit()
