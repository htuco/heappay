from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = {"schema": "identity"}

    role_id: Mapped[int] = mapped_column("user_role_id", primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column("name", String(100), unique=True, nullable=False)

    users = relationship("User", back_populates="role")
