import os
import time

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Docker-compose sets DATABASE_URL to Postgres; without it a local SQLite file is used.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'cashflow.db')}")
# Always use the psycopg 3 driver (installed via requirements.txt), whatever SQLAlchemy's default is.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg://" + DATABASE_URL[len("postgresql://"):]

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def wait_for_database(attempts: int = 60) -> None:
    """Postgres may still be starting when the API container boots; retry instead of crashing."""
    for attempt in range(attempts):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except OperationalError:
            if attempt == attempts - 1:
                raise
            print("Database is not ready yet, retrying…", flush=True)
            time.sleep(1)


def add_missing_columns() -> None:
    """create_all() does not alter existing tables; add columns introduced after the first release."""
    added = {"transactions": {"verified_at": "TIMESTAMP"}}
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in added.items():
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, sql_type in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
