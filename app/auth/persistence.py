import os
from collections.abc import Generator
from functools import lru_cache

from fastapi import HTTPException, status
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        database_url = "sqlite+pysqlite:///./local_dev.db"

    if database_url.startswith("postgres://"):
        database_url = "postgresql+psycopg://" + database_url[len("postgres://"):]
    elif database_url.startswith("postgresql://"):
        database_url = "postgresql+psycopg://" + database_url[len("postgresql://"):]
    engine = create_engine(database_url, pool_pre_ping=True, pool_recycle=1800)
    if database_url.lower().startswith("sqlite"):
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    return engine


def _enable_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
    if dbapi_connection.__class__.__module__.startswith("sqlite3"):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


def get_db() -> Generator[Session, None, None]:
    factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    db = factory()
    try:
        yield db
    finally:
        db.close()


def initialize_sqlite_schema() -> None:
    database_url = os.environ.get("DATABASE_URL", "").strip() or "sqlite+pysqlite:///./local_dev.db"
    if not database_url.lower().startswith("sqlite"):
        return

    from app.auth.models import Base

    Base.metadata.create_all(get_engine())
