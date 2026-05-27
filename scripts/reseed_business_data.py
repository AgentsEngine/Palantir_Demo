"""Reload normal manufacturing seed tables into the configured database."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.core.seed_config import SEED_TABLE_COLUMNS, convert_datetimes, make_insert_sql

SEED_DIR = Path(__file__).resolve().parent.parent / "data" / "seed"

async def reseed() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        table_list = ", ".join(SEED_TABLE_COLUMNS)
        await session.execute(text(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE"))
        await session.commit()

        total = 0
        for table in SEED_TABLE_COLUMNS:
            path = SEED_DIR / f"{table}.json"
            if not path.exists():
                continue
            rows = json.loads(path.read_text(encoding="utf-8"))
            rows = convert_datetimes(table, rows)
            sql = make_insert_sql(table)
            batch_size = 5000 if table == "sensor_readings" else len(rows) or 1
            for start in range(0, len(rows), batch_size):
                await session.execute(text(sql), rows[start:start + batch_size])
                await session.commit()
            total += len(rows)
            print(f"RELOAD {table}: {len(rows)} rows")

        for table in SEED_TABLE_COLUMNS:
            await session.execute(
                text("SELECT setval(pg_get_serial_sequence(:table_name, 'id'), COALESCE((SELECT MAX(id) FROM " + table + "), 1), true)"),
                {"table_name": table},
            )
        await session.commit()
        print(f"Done. Reloaded {total} rows.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reseed())
