"""Database connection factory — SQLite for dev, Postgres/Supabase for prod.

All DB functions use the unified connection interface:
  conn.execute(sql, params)   → cursor with .fetchone(), .fetchall(), .rowcount
  conn.executescript(sql)     → run multiple ; separated statements
  conn.commit() / .rollback()
  conn.db_type                → "sqlite" | "postgres"
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any, Sequence


def _database_url() -> str | None:
    return os.environ.get("DATABASE_URL")


def db_mode() -> str:
    """Return 'postgres' if DATABASE_URL is set, else 'sqlite'."""
    return "postgres" if _database_url() else "sqlite"


# ---------------------------------------------------------------------------
# SQLite
# ---------------------------------------------------------------------------

class _SQLiteCursor:
    def __init__(self, cur: sqlite3.Cursor) -> None:
        self._cur = cur

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount

    @property
    def lastrowid(self) -> int | None:
        return self._cur.lastrowid

    def fetchone(self) -> dict | None:
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self) -> list[dict]:
        return [dict(r) for r in self._cur.fetchall()]


class SQLiteConn:
    db_type: str = "sqlite"

    def __init__(self, path: Path) -> None:
        self._conn = sqlite3.connect(str(path))
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")

    def execute(self, sql: str, params: Sequence[Any] = ()) -> _SQLiteCursor:
        return _SQLiteCursor(self._conn.execute(sql, params))

    def executescript(self, sql: str) -> None:
        self._conn.executescript(sql)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def __enter__(self) -> "SQLiteConn":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type:
            self.rollback()
        else:
            self.commit()
        return False


# ---------------------------------------------------------------------------
# Postgres / Supabase (psycopg3)
# ---------------------------------------------------------------------------

class _PgCursor:
    def __init__(self, cur: Any) -> None:
        self._cur = cur

    @property
    def rowcount(self) -> int:
        return self._cur.rowcount

    @property
    def lastrowid(self) -> int | None:
        return None  # callers must use RETURNING id for inserts that need the id

    def fetchone(self) -> dict | None:
        row = self._cur.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self) -> list[dict]:
        return [dict(r) for r in self._cur.fetchall()]


class PgConn:
    """psycopg3 connection wrapper that matches the SQLiteConn interface."""
    db_type: str = "postgres"

    def __init__(self, conn: Any) -> None:
        self._conn = conn

    def execute(self, sql: str, params: Sequence[Any] = ()) -> _PgCursor:
        sql = sql.replace("?", "%s")
        cur = self._conn.cursor()
        cur.execute(sql, params if params else None)
        return _PgCursor(cur)

    def executescript(self, sql: str) -> None:
        """Split on ';', strip comment lines, execute each non-empty statement."""
        cur = self._conn.cursor()
        for stmt in sql.split(";"):
            lines = [ln for ln in stmt.splitlines() if not ln.strip().startswith("--")]
            clean = "\n".join(lines).strip()
            if clean:
                cur.execute(clean)

    def commit(self) -> None:
        self._conn.commit()

    def rollback(self) -> None:
        self._conn.rollback()

    def __enter__(self) -> "PgConn":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_type:
            self.rollback()
        else:
            self.commit()
        return False


# ---------------------------------------------------------------------------
# Postgres connection pool (singleton)
# ---------------------------------------------------------------------------

_pg_pool = None


def _get_pg_pool():
    """Return a shared psycopg ConnectionPool, creating it on first call."""
    global _pg_pool
    if _pg_pool is None:
        url = _database_url()
        if not url:
            return None
        try:
            from psycopg_pool import ConnectionPool  # noqa: PLC0415
            from psycopg.rows import dict_row  # noqa: PLC0415
            _pg_pool = ConnectionPool(
                url,
                min_size=2,
                max_size=10,
                # prepare_threshold=None disables psycopg3 auto-preparation.
                # Required when using Supabase Transaction Pooler (PgBouncer in
                # transaction mode): each transaction may land on a different
                # backend connection, so prepared statements made in one
                # transaction are invisible in the next → DuplicatePreparedStatement.
                kwargs={"row_factory": dict_row, "prepare_threshold": None},
            )
        except ImportError as exc:
            raise ImportError(
                "DATABASE_URL is set but psycopg[pool] is not installed. "
                "Run: uv add 'psycopg[pool]'"
            ) from exc
    return _pg_pool


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_connection(db_path: Path | str | None = None) -> SQLiteConn | "PooledPgConn":
    """Return a DB connection — pooled Postgres when DATABASE_URL is set, else SQLite."""
    pool = _get_pg_pool()
    if pool is not None:
        return PooledPgConn(pool)

    from core.paths import db_path as _default_db_path  # noqa: PLC0415
    path = Path(db_path) if db_path else _default_db_path()
    return SQLiteConn(path)


class PooledPgConn:
    """Wraps a psycopg_pool connection — checks it out on enter, returns it on exit."""
    db_type: str = "postgres"

    def __init__(self, pool) -> None:
        self._pool = pool
        self._conn = None
        self._pg = None  # underlying PgConn

    def _ensure(self):
        if self._conn is None:
            self._conn = self._pool.getconn()
            self._pg = PgConn(self._conn)

    def execute(self, sql: str, params: Sequence[Any] = ()) -> _PgCursor:
        self._ensure()
        return self._pg.execute(sql, params)

    def executescript(self, sql: str) -> None:
        self._ensure()
        self._pg.executescript(sql)

    def commit(self) -> None:
        if self._pg:
            self._pg.commit()

    def rollback(self) -> None:
        if self._pg:
            self._pg.rollback()

    def __enter__(self) -> "PooledPgConn":
        self._ensure()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        try:
            if self._conn is not None:
                if exc_type:
                    self._conn.rollback()
                else:
                    self._conn.commit()
        finally:
            if self._conn is not None:
                self._pool.putconn(self._conn)
                self._conn = None
                self._pg = None
        return False
