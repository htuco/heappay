from typing import Annotated

from pydantic import AfterValidator, Field
from pydantic_core import PydanticCustomError


PASSWORD_RULES_MESSAGE = (
    "Password must include at least one uppercase letter, one lowercase letter, "
    "one number, and one special character."
)


def validate_password_strength(value: str) -> str:
    has_uppercase = any(char.isupper() for char in value)
    has_lowercase = any(char.islower() for char in value)
    has_number = any(char.isdigit() for char in value)
    has_special = any(not char.isalnum() for char in value)

    if not (has_uppercase and has_lowercase and has_number and has_special):
        raise PydanticCustomError("password_strength", PASSWORD_RULES_MESSAGE)

    return value


StrongPasswordStr = Annotated[
    str,
    Field(min_length=8, max_length=255),
    AfterValidator(validate_password_strength),
]
