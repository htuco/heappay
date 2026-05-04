from typing import Any


class AppException(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Any = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class CardStatusNotFound(AppException):
    def __init__(self) -> None:
        super().__init__(
            status_code=404,
            code="CARD_STATUS_NOT_FOUND",
            message="Card status not found.",
        )


class CardStatusDuplicate(AppException):
    def __init__(self) -> None:
        super().__init__(
            status_code=409,
            code="CARD_STATUS_DUPLICATE",
            message="A card status with this name already exists.",
        )


class CardStatusInUse(AppException):
    def __init__(self) -> None:
        super().__init__(
            status_code=409,
            code="CARD_STATUS_IN_USE",
            message="Cannot delete this status: one or more cards are still assigned to it.",
        )


class Unauthorized(AppException):
    def __init__(self, message: str = "Authentication required.") -> None:
        super().__init__(
            status_code=401,
            code="UNAUTHORIZED",
            message=message,
        )


class InvalidInput(AppException):
    def __init__(self, message: str) -> None:
        super().__init__(
            status_code=400,
            code="INVALID_INPUT",
            message=message,
        )
