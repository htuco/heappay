import pytest
from pydantic import ValidationError
from pydantic_core import PydanticCustomError

from schemas.user.auth import (
    AcceptInvitationRequest,
    ChangePasswordRequest,
    PasswordResetConfirmRequest,
    RegisterRequest,
)
from utils.password_policy import (
    PASSWORD_CONTAINS_EMAIL_MESSAGE,
    PASSWORD_REPEATED_PATTERN_MESSAGE,
    PASSWORD_REQUIRES_LOWERCASE_MESSAGE,
    PASSWORD_REQUIRES_NUMBER_MESSAGE,
    PASSWORD_REQUIRES_SPECIAL_MESSAGE,
    PASSWORD_REQUIRES_UPPERCASE_MESSAGE,
    PASSWORD_SAME_AS_CURRENT_MESSAGE,
    PASSWORD_TOO_COMMON_MESSAGE,
    PASSWORD_TOO_SHORT_MESSAGE,
    email_local_part,
    has_repeated_character_run,
    has_repeated_word_pattern,
    is_common_password,
    password_contains_email_local_part,
    validate_password_strength,
)


def _register_payload(**overrides):
    base = {
        "email": "user@example.com",
        "first_name": "Jane",
        "last_name": "Doe",
        "password": "StrongPass1!",
    }
    base.update(overrides)
    return base


def test_validate_password_strength_requires_minimum_length() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("Ab1!")
    assert exc.value.message() == PASSWORD_TOO_SHORT_MESSAGE


def test_validate_password_strength_requires_uppercase() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("lowercase1!")
    assert exc.value.message() == PASSWORD_REQUIRES_UPPERCASE_MESSAGE


def test_validate_password_strength_requires_lowercase() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("UPPERCASE1!")
    assert exc.value.message() == PASSWORD_REQUIRES_LOWERCASE_MESSAGE


def test_validate_password_strength_requires_number() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("NoNumbers!")
    assert exc.value.message() == PASSWORD_REQUIRES_NUMBER_MESSAGE


def test_validate_password_strength_requires_special_character() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("NoSpecial1")
    assert exc.value.message() == PASSWORD_REQUIRES_SPECIAL_MESSAGE


def test_validate_password_strength_rejects_common_password() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("Password1!")
    assert exc.value.message() == PASSWORD_TOO_COMMON_MESSAGE


def test_validate_password_strength_rejects_repeated_characters() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("Abc11111!")
    assert exc.value.message() == PASSWORD_REPEATED_PATTERN_MESSAGE


def test_validate_password_strength_rejects_repeated_word() -> None:
    with pytest.raises(PydanticCustomError) as exc:
        validate_password_strength("PasswordPassword1!")
    assert exc.value.message() == PASSWORD_REPEATED_PATTERN_MESSAGE


def test_password_contains_email_local_part() -> None:
    assert password_contains_email_local_part("MyUser123!", "user@example.com") is True
    assert password_contains_email_local_part("SafePass1!", "user@example.com") is False


def test_email_local_part_helper() -> None:
    assert email_local_part("  User.Name@Example.COM ") == "user.name"


def test_repeated_pattern_helpers() -> None:
    assert has_repeated_character_run("abcAAAAdef") is True
    assert has_repeated_word_pattern("passwordpassword") is True
    assert is_common_password("password") is True


def test_register_rejects_password_containing_email_local_part() -> None:
    with pytest.raises(ValidationError) as exc:
        RegisterRequest.model_validate(_register_payload(password="UserPass1!", email="user@example.com"))
    assert exc.value.errors()[0]["msg"] == PASSWORD_CONTAINS_EMAIL_MESSAGE


def test_change_password_rejects_same_as_current() -> None:
    with pytest.raises(ValidationError) as exc:
        ChangePasswordRequest.model_validate(
            {
                "current_password": "OldPassword1!",
                "new_password": "OldPassword1!",
                "confirm_password": "OldPassword1!",
            }
        )
    assert exc.value.errors()[0]["msg"] == PASSWORD_SAME_AS_CURRENT_MESSAGE


def test_accept_invitation_uses_strong_password_rules() -> None:
    with pytest.raises(ValidationError) as exc:
        AcceptInvitationRequest.model_validate(
            {"new_password": "weakpwd", "confirm_password": "weakpwd"}
        )
    assert exc.value.errors()[0]["msg"] == PASSWORD_TOO_SHORT_MESSAGE


def test_password_reset_confirm_uses_specific_strength_messages() -> None:
    with pytest.raises(ValidationError) as exc:
        PasswordResetConfirmRequest.model_validate(
            {
                "token": "a" * 32,
                "new_password": "password123",
                "confirm_password": "password123",
            }
        )
    assert exc.value.errors()[0]["msg"] == PASSWORD_REQUIRES_UPPERCASE_MESSAGE
