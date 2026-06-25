from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models.category_rule import CategoryRule


class CategoryRuleRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def list_applicable(self, *, user_id: int | None) -> list[CategoryRule]:
        """Return rules that could apply for this user: the user's own rules plus
        all global (user_id IS NULL) rules, ordered so the highest-precedence
        match is first.

        Ordering: user-specific rules before global ones (user_id DESC NULLS
        LAST puts the concrete user_id ahead of NULL), then by priority ascending
        (lower wins), then by rule_id for a stable tie-break.
        """
        stmt = (
            select(CategoryRule)
            .where(
                or_(
                    CategoryRule.user_id == user_id,
                    CategoryRule.user_id.is_(None),
                )
            )
            .order_by(
                CategoryRule.user_id.desc().nullslast(),
                CategoryRule.priority.asc(),
                CategoryRule.rule_id.asc(),
            )
        )
        return list(self._db.scalars(stmt).all())
