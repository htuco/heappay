import re
import unicodedata
from typing import Annotated

from pydantic import AfterValidator, Field
from pydantic_core import PydanticCustomError

PERSON_NAME_MIN_LENGTH = 1
PERSON_NAME_MAX_LENGTH = 100

PERSON_NAME_RULES_MESSAGE = (
    "Use letters only. Spaces, hyphens, and apostrophes are allowed."
)
PERSON_NAME_TOO_SHORT_MESSAGE = "Name is required."
PERSON_NAME_TOO_LONG_MESSAGE = "Name must be at most 100 characters."
PERSON_NAME_INVALID_CHARS_MESSAGE = "Name contains invalid characters."
PERSON_NAME_DIGITS_MESSAGE = "Name cannot contain numbers."

_SEPARATORS = frozenset({" ", "-", "'", "\u2019", "."})


def _is_letter_or_mark(char: str) -> bool:
    category = unicodedata.category(char)
    return category.startswith("L") or category.startswith("M")


def normalize_person_name(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def validate_person_name(value: str) -> str:
    normalized = normalize_person_name(value)

    if len(normalized) < PERSON_NAME_MIN_LENGTH:
        raise PydanticCustomError("person_name", PERSON_NAME_TOO_SHORT_MESSAGE)

    if len(normalized) > PERSON_NAME_MAX_LENGTH:
        raise PydanticCustomError("person_name", PERSON_NAME_TOO_LONG_MESSAGE)

    if any(char.isdigit() for char in normalized):
        raise PydanticCustomError("person_name", PERSON_NAME_DIGITS_MESSAGE)

    if not any(_is_letter_or_mark(char) for char in normalized):
        raise PydanticCustomError("person_name", PERSON_NAME_INVALID_CHARS_MESSAGE)

    for char in normalized:
        if _is_letter_or_mark(char):
            continue
        if char in _SEPARATORS:
            continue
        raise PydanticCustomError("person_name", PERSON_NAME_INVALID_CHARS_MESSAGE)

    if not _is_letter_or_mark(normalized[0]):
        raise PydanticCustomError("person_name", PERSON_NAME_INVALID_CHARS_MESSAGE)

    last = normalized[-1]
    if not (_is_letter_or_mark(last) or last == "."):
        raise PydanticCustomError("person_name", PERSON_NAME_INVALID_CHARS_MESSAGE)

    prev_was_separator = False
    for char in normalized:
        if char in _SEPARATORS:
            if prev_was_separator:
                raise PydanticCustomError("person_name", PERSON_NAME_INVALID_CHARS_MESSAGE)
            prev_was_separator = True
        else:
            prev_was_separator = False

    if normalized[-1] in {" ", "-", "'", "\u2019"}:
        raise PydanticCustomError("person_name", PERSON_NAME_INVALID_CHARS_MESSAGE)

    return normalized


PersonNameStr = Annotated[
    str,
    Field(min_length=PERSON_NAME_MIN_LENGTH, max_length=PERSON_NAME_MAX_LENGTH),
    AfterValidator(validate_person_name),
]
