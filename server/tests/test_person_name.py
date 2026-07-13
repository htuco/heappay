import pytest
from pydantic import BaseModel, ValidationError

from utils.person_name import PersonNameStr, validate_person_name


class _NameModel(BaseModel):
    name: PersonNameStr


def test_accepts_international_names() -> None:
    cases = {
        "José": "José",
        "Müller": "Müller",
        "北京": "北京",
        "Mary-Jane": "Mary-Jane",
        "O'Brien": "O'Brien",
        "van der Berg": "van der Berg",
    }
    for raw, expected in cases.items():
        assert validate_person_name(raw) == expected


def test_normalizes_whitespace() -> None:
    assert validate_person_name("  Ana   Maria  ") == "Ana Maria"


@pytest.mark.parametrize(
    "value",
    [
        "",
        "   ",
        "John3",
        "123",
        "@john",
        "John!",
        "😀",
        "--John",
        "John--Doe",
        "'John",
        "John-",
        "John@Doe",
    ],
)
def test_rejects_invalid_names(value: str) -> None:
    with pytest.raises(Exception):
        validate_person_name(value)


def test_pydantic_model_rejects_garbage() -> None:
    with pytest.raises(ValidationError):
        _NameModel(name="bad$name")
