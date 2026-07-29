from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context

from database import SCHEMAS, Base
from settings import get_settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import models  # noqa: F401

target_metadata = Base.metadata

# Tables live in six namespaces (Phase 2 of the schema refactor). Autogenerate
# must be told to look beyond `public`, and must be scoped to the schemas we own
# so it never proposes changes for anything else in the database.
#
# `public` is deliberately NOT in this set. Every mapped table now declares an
# explicit schema, so nothing in the metadata lives in `public` -- which means
# any table found there reads as "in the database but not in the models" and
# autogenerate would emit a DROP for it. That is not hypothetical: the vector
# store `knowledge_chunks` (repositories/vector/knowledge.py) is created out of
# band in `public` and belongs to no migration, and a Supabase project also
# accumulates objects there. Excluding the schema keeps autogenerate honest
# about the tables we own and blind to the ones we don't.
OWNED_SCHEMAS = frozenset(SCHEMAS)


def include_name(name, type_, parent_names) -> bool:
    if type_ == "schema":
        return name in OWNED_SCHEMAS
    return True


def get_url() -> str:
    return get_settings().database_url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(get_url(), poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            include_name=include_name,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()