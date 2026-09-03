"""Create cape_v2 database and import cape-pg-data.sql (TablePlus dump from cape-v2)."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
DEFAULT_DUMP = REPO_ROOT / "cape-pg-data.sql"
TARGET_DB = "cape_v2"
TABLESPACE = "cape_v2_data"
TABLESPACE_DIR = Path(r"D:\PostgreSQL\cape_v2_data")


def _postgres_bin(name: str) -> str:
    for base in (
        Path(os.environ.get("PGHOME", "")),
        Path(r"C:\Program Files\PostgreSQL\18\bin"),
        Path(r"C:\Program Files\PostgreSQL\17\bin"),
        Path(r"C:\Program Files\PostgreSQL\16\bin"),
    ):
        candidate = base / f"{name}.exe" if os.name == "nt" else base / name
        if candidate.is_file():
            return str(candidate)
    return name


def _admin_url() -> str:
    sys.path.insert(0, str(BACKEND_ROOT))
    try:
        from app.config import settings

        parsed = urlparse(settings.database_url.replace("postgresql+asyncpg://", "postgresql://"))
        user = parsed.username or "postgres"
        password = parsed.password or ""
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        auth = f"{user}:{password}@" if password else f"{user}@"
        return f"postgresql://{auth}{host}:{port}/postgres"
    except Exception:
        return os.environ.get("DATABASE_ADMIN_URL", "postgresql://postgres@localhost:5432/postgres")


def _ensure_tablespace_dir() -> None:
    TABLESPACE_DIR.mkdir(parents=True, exist_ok=True)


async def _ensure_database(admin_url: str, *, recreate: bool = False) -> None:
    import asyncpg

    _ensure_tablespace_dir()
    parsed = urlparse(admin_url)
    conn = await asyncpg.connect(
        user=parsed.username or "postgres",
        password=parsed.password or None,
        host=parsed.hostname or "localhost",
        port=parsed.port or 5432,
        database="postgres",
    )
    try:
        exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", TARGET_DB)
        if exists and recreate:
            await conn.execute(
                """
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = $1 AND pid <> pg_backend_pid()
                """,
                TARGET_DB,
            )
            await conn.execute(f'DROP DATABASE "{TARGET_DB}"')
            exists = None
            print(f"Dropped existing database {TARGET_DB}")

        ts_exists = await conn.fetchval("SELECT 1 FROM pg_tablespace WHERE spcname = $1", TABLESPACE)
        if not ts_exists:
            location = str(TABLESPACE_DIR).replace("\\", "/")
            await conn.execute(f"CREATE TABLESPACE {TABLESPACE} LOCATION '{location}'")
            print(f"Created tablespace {TABLESPACE} at {location}")

        if exists:
            print(f"Database {TARGET_DB} already exists")
            return
        await conn.execute(f'CREATE DATABASE "{TARGET_DB}" TABLESPACE {TABLESPACE}')
        print(f"Created database {TARGET_DB} on tablespace {TABLESPACE}")
    finally:
        await conn.close()


async def _prepare_schemas(admin_url: str) -> None:
    """TablePlus dump assumes pgboss schema and pgcrypto already exist."""
    import asyncpg

    parsed = urlparse(admin_url)
    conn = await asyncpg.connect(
        user=parsed.username or "postgres",
        password=parsed.password or None,
        host=parsed.hostname or "localhost",
        port=parsed.port or 5432,
        database=TARGET_DB,
    )
    try:
        await conn.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
        await conn.execute("CREATE SCHEMA IF NOT EXISTS pgboss")
        print("Prepared extensions and pgboss schema")
    finally:
        await conn.close()


def _iter_sanitized_lines(dump_path: Path):
    """Stream dump lines, skipping broken pgboss DDL from TablePlus export."""
    skip_pgboss_ddl = False
    start_marker = 'DROP TABLE IF EXISTS "pgboss"."version"'
    end_marker = 'DROP TABLE IF EXISTS "public"."oneview_new_hire"'
    skip_pgboss_tail = False

    with dump_path.open("r", encoding="utf-8", errors="replace") as src:
        for line in src:
            if start_marker in line:
                skip_pgboss_ddl = True
                continue
            if skip_pgboss_ddl and end_marker in line:
                skip_pgboss_ddl = False
            if skip_pgboss_ddl:
                continue

            stripped = line.strip()
            if stripped.startswith('ALTER TABLE "pgboss".'):
                skip_pgboss_tail = True
                continue
            if skip_pgboss_tail:
                if stripped.startswith('CREATE INDEX') and "pgboss." in stripped:
                    continue
                if stripped.startswith('CREATE UNIQUE INDEX') and "pgboss." in stripped:
                    continue
                if stripped.startswith('ALTER TABLE "pgboss".'):
                    continue
                if stripped.startswith("-- Indices") or stripped == "" or stripped == ";":
                    continue
                skip_pgboss_tail = False

            yield line


def _run_sql_file(admin_url: str, sql_path: Path) -> None:
    parsed = urlparse(admin_url)
    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = parsed.password

    psql = _postgres_bin("psql")
    cmd = [
        psql,
        "-h",
        parsed.hostname or "localhost",
        "-p",
        str(parsed.port or 5432),
        "-U",
        parsed.username or "postgres",
        "-d",
        TARGET_DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        str(sql_path),
    ]
    print(f"Applying {sql_path.name}...")
    subprocess.run(cmd, check=True, env=env)


def _import_dump(admin_url: str, dump_path: Path) -> None:
    parsed = urlparse(admin_url)
    env = os.environ.copy()
    if parsed.password:
        env["PGPASSWORD"] = parsed.password

    psql = _postgres_bin("psql")
    cmd = [
        psql,
        "-h",
        parsed.hostname or "localhost",
        "-p",
        str(parsed.port or 5432),
        "-U",
        parsed.username or "postgres",
        "-d",
        TARGET_DB,
        "-v",
        "ON_ERROR_STOP=1",
        "-f",
        "-",
    ]
    print(f"Streaming {dump_path} into {TARGET_DB} (this may take several minutes)...")
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, env=env, text=True, encoding="utf-8")
    assert proc.stdin is not None
    try:
        for line in _iter_sanitized_lines(dump_path):
            proc.stdin.write(line)
    finally:
        proc.stdin.close()
    if proc.wait() != 0:
        raise subprocess.CalledProcessError(proc.returncode, cmd)
    print("Import complete.")


def _target_database_url(admin_url: str) -> str:
    parsed = urlparse(admin_url)
    user = parsed.username or "postgres"
    password = parsed.password or ""
    host = parsed.hostname or "localhost"
    port = parsed.port or 5432
    auth = f"{user}:{password}@" if password else f"{user}@"
    return f"postgresql+asyncpg://{auth}{host}:{port}/{TARGET_DB}"



def _update_env_file(database_url: str) -> None:
    env_path = BACKEND_ROOT / ".env"
    example_path = BACKEND_ROOT / ".env.example"
    if not env_path.is_file() and example_path.is_file():
        env_path.write_text(example_path.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Created {env_path} from .env.example")

    keys = {
        "DATABASE_URL": database_url,
        "AUTO_SEED": "false",
    }
    if env_path.is_file():
        lines = env_path.read_text(encoding="utf-8").splitlines()
        seen = set()
        out: list[str] = []
        for line in lines:
            key = line.split("=", 1)[0] if "=" in line else ""
            if key in keys:
                out.append(f"{key}={keys[key]}")
                seen.add(key)
            else:
                out.append(line)
        for key, value in keys.items():
            if key not in seen:
                out.append(f"{key}={value}")
        env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
        print(f"Updated {env_path} (DATABASE_URL, AUTO_SEED=false)")
    else:
        print("No backend/.env found — set DATABASE_URL manually:")
        print(database_url)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    flags = {a for a in sys.argv[1:] if a.startswith("-")}
    dump_path = Path(args[0]) if args else DEFAULT_DUMP
    recreate = "--recreate" in flags

    if not dump_path.is_file():
        raise SystemExit(f"Dump not found: {dump_path}")

    admin_url = _admin_url()
    asyncio.run(_ensure_database(admin_url, recreate=recreate))
    asyncio.run(_prepare_schemas(admin_url))
    _run_sql_file(admin_url, BACKEND_ROOT / "schema" / "pgboss_schema.sql")
    _import_dump(admin_url, dump_path)
    _update_env_file(_target_database_url(admin_url))


if __name__ == "__main__":
    main()
