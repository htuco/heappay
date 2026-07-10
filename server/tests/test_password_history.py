"""Password history message constant."""

from utils.password_policy import PASSWORD_REUSE_MESSAGE


def test_password_reuse_message_is_clear() -> None:
    assert PASSWORD_REUSE_MESSAGE == "You cannot reuse a recent password."
