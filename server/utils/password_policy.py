import re
from typing import Annotated, Callable

from pydantic import AfterValidator, Field
from pydantic_core import PydanticCustomError

PASSWORD_TOO_SHORT_MESSAGE = "Password must be at least 8 characters."
PASSWORD_TOO_LONG_MESSAGE = "Password must be at most 255 characters."
PASSWORD_REQUIRES_UPPERCASE_MESSAGE = "Password must include at least one uppercase letter."
PASSWORD_REQUIRES_LOWERCASE_MESSAGE = "Password must include at least one lowercase letter."
PASSWORD_REQUIRES_NUMBER_MESSAGE = "Password must include at least one number."
PASSWORD_REQUIRES_SPECIAL_MESSAGE = "Password must include at least one special character."
PASSWORD_SAME_AS_CURRENT_MESSAGE = "New password must be different from your current password."
PASSWORD_CONTAINS_EMAIL_MESSAGE = "Password must not contain your email address."
PASSWORD_REPEATED_PATTERN_MESSAGE = "Password must not contain obvious repeated patterns."
PASSWORD_TOO_COMMON_MESSAGE = "Password is too common. Choose a more unique password."

PASSWORD_POLICY_CLIENT_MESSAGES = frozenset(
    {
        PASSWORD_TOO_SHORT_MESSAGE,
        PASSWORD_TOO_LONG_MESSAGE,
        PASSWORD_REQUIRES_UPPERCASE_MESSAGE,
        PASSWORD_REQUIRES_LOWERCASE_MESSAGE,
        PASSWORD_REQUIRES_NUMBER_MESSAGE,
        PASSWORD_REQUIRES_SPECIAL_MESSAGE,
        PASSWORD_SAME_AS_CURRENT_MESSAGE,
        PASSWORD_CONTAINS_EMAIL_MESSAGE,
        PASSWORD_REPEATED_PATTERN_MESSAGE,
        PASSWORD_TOO_COMMON_MESSAGE,
    }
)

# Backward-compatible alias used by existing tests.
PASSWORD_RULES_MESSAGE = PASSWORD_REQUIRES_UPPERCASE_MESSAGE

COMMON_PASSWORD_BLOCKLIST = frozenset(
    {
        "password",
        "123456",
        "password1!",
    }
)

_MIN_EMAIL_LOCAL_PART_LEN = 3
_MIN_REPEATED_CHAR_RUN = 4
_MIN_REPEATED_WORD_LEN = 6


def email_local_part(email: str) -> str:
    return email.strip().split("@", 1)[0].lower()


def password_contains_email_local_part(password: str, email: str) -> bool:
    local = email_local_part(email)
    if len(local) < _MIN_EMAIL_LOCAL_PART_LEN:
        return False
    return local in password.lower()


def has_repeated_character_run(value: str, *, min_run: int = _MIN_REPEATED_CHAR_RUN) -> bool:
    if len(value) < min_run:
        return False
    run = 1
    for index in range(1, len(value)):
        if value[index] == value[index - 1]:
            run += 1
            if run >= min_run:
                return True
        else:
            run = 1
    return False


def has_repeated_word_pattern(value: str) -> bool:
    lowered = value.lower()
    length = len(lowered)
    if length >= _MIN_REPEATED_WORD_LEN and length % 2 == 0:
        half = length // 2
        if lowered[:half] == lowered[half:]:
            return True
    return bool(re.search(r"(.{2,})\1", lowered))


def is_common_password(value: str) -> bool:
    lowered = value.lower()
    return any(candidate.lower() == lowered for candidate in COMMON_PASSWORD_BLOCKLIST)


def validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise PydanticCustomError("password_too_short", PASSWORD_TOO_SHORT_MESSAGE)
    if len(value) > 255:
        raise PydanticCustomError("password_too_long", PASSWORD_TOO_LONG_MESSAGE)
    if not any(char.isupper() for char in value):
        raise PydanticCustomError("password_requires_uppercase", PASSWORD_REQUIRES_UPPERCASE_MESSAGE)
    if not any(char.islower() for char in value):
        raise PydanticCustomError("password_requires_lowercase", PASSWORD_REQUIRES_LOWERCASE_MESSAGE)
    if not any(char.isdigit() for char in value):
        raise PydanticCustomError("password_requires_number", PASSWORD_REQUIRES_NUMBER_MESSAGE)
    if not any(not char.isalnum() for char in value):
        raise PydanticCustomError("password_requires_special", PASSWORD_REQUIRES_SPECIAL_MESSAGE)
    if is_common_password(value):
        raise PydanticCustomError("password_too_common", PASSWORD_TOO_COMMON_MESSAGE)
    if has_repeated_character_run(value) or has_repeated_word_pattern(value):
        raise PydanticCustomError("password_repeated_pattern", PASSWORD_REPEATED_PATTERN_MESSAGE)
    return value


def validate_password_not_contains_email(password: str, email: str | None) -> None:
    if not email:
        return
    if password_contains_email_local_part(password, email):
        raise ValueError(PASSWORD_CONTAINS_EMAIL_MESSAGE)


def validate_new_password_differs_from_hash(
    new_password: str,
    password_hash: str,
    *,
    verify_password: Callable[[str, str], bool],
) -> None:
    if verify_password(new_password, password_hash):
        raise ValueError(PASSWORD_SAME_AS_CURRENT_MESSAGE)


def is_password_policy_message(message: str) -> bool:
    return message in PASSWORD_POLICY_CLIENT_MESSAGES


StrongPasswordStr = Annotated[
    str,
    Field(min_length=1, max_length=255),
    AfterValidator(validate_password_strength),
]
