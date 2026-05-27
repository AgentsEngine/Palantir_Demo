from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2 import sql
from psycopg2.extras import Json, execute_values


SKIP_TABLES = {"alembic_version", "spatial_ref_sys"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Overwrite PostgreSQL demo data from a local SQLite database.")
    parser.add_argument("--sqlite", required=True, help="Path to source SQLite database.")
    parser.add_argument("--pg-host", default="postgres")
    parser.add_argument("--pg-port", type=int, default=5432)
    parser.add_argument("--pg-db", default="manufoundry")
    parser.add_argument("--pg-user", default="manufoundry")
    parser.add_argument("--pg-password", default="manufoundry123")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def qident(name: str) -> sql.Identifier:
    return sql.Identifier(name)


def sqlite_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "select name from sqlite_master where type='table' and name not like 'sqlite_%'"
    ).fetchall()
    return {row[0] for row in rows} - SKIP_TABLES


def postgres_tables(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select table_name
            from information_schema.tables
            where table_schema = 'public' and table_type = 'BASE TABLE'
            """
        )
        return {row[0] for row in cur.fetchall()} - SKIP_TABLES


def sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in conn.execute(f'pragma table_info("{table}")').fetchall()]


def postgres_columns(conn, table: str) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select column_name, data_type
            from information_schema.columns
            where table_schema = 'public' and table_name = %s
            order by ordinal_position
            """,
            (table,),
        )
        return {name: data_type for name, data_type in cur.fetchall()}


def convert_value(value: Any, data_type: str) -> Any:
    if value is None:
        return None
    if data_type == "boolean":
        return bool(value)
    if data_type in {"json", "jsonb"}:
        if isinstance(value, str):
            try:
                return Json(json.loads(value))
            except json.JSONDecodeError:
                return Json(value)
        return Json(value)
    return value


def reset_sequences(pg_conn, tables: list[str]) -> None:
    with pg_conn.cursor() as cur:
        for table in tables:
            cur.execute(
                """
                select column_name
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = %s
                  and column_default like 'nextval%%'
                """,
                (table,),
            )
            for (column,) in cur.fetchall():
                cur.execute(
                    sql.SQL(
                        """
                        select setval(
                          pg_get_serial_sequence(%s, %s),
                          coalesce((select max({column}) from {table}), 1),
                          (select count(*) > 0 from {table})
                        )
                        """
                    ).format(column=qident(column), table=qident(table)),
                    (table, column),
                )


def main() -> None:
    args = parse_args()
    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        raise SystemExit(f"SQLite database not found: {sqlite_path}")

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    pg_conn = psycopg2.connect(
        host=args.pg_host,
        port=args.pg_port,
        dbname=args.pg_db,
        user=args.pg_user,
        password=args.pg_password,
    )

    try:
        source_tables = sqlite_tables(sqlite_conn)
        target_tables = postgres_tables(pg_conn)
        tables = sorted(source_tables & target_tables)
        skipped = sorted(source_tables - target_tables)
        print(f"common_tables={len(tables)} skipped_source_tables={skipped}")

        with pg_conn.cursor() as cur:
            if tables:
                truncate_tables = sql.SQL(", ").join(qident(table) for table in tables)
                print("truncate_tables=" + ",".join(tables))
                if not args.dry_run:
                    cur.execute(sql.SQL("truncate table {} restart identity cascade").format(truncate_tables))

            copied_counts: dict[str, int] = {}
            for table in tables:
                src_columns = sqlite_columns(sqlite_conn, table)
                target_column_types = postgres_columns(pg_conn, table)
                columns = [col for col in src_columns if col in target_column_types]
                if not columns:
                    copied_counts[table] = 0
                    continue

                rows = sqlite_conn.execute(
                    f'select {", ".join([chr(34) + col + chr(34) for col in columns])} from "{table}"'
                ).fetchall()
                copied_counts[table] = len(rows)
                if args.dry_run or not rows:
                    continue

                values = [
                    tuple(convert_value(row[col], target_column_types[col]) for col in columns)
                    for row in rows
                ]
                insert_sql = sql.SQL("insert into {table} ({columns}) values %s").format(
                    table=qident(table),
                    columns=sql.SQL(", ").join(qident(col) for col in columns),
                )
                execute_values(cur, insert_sql, values, page_size=1000)

            if not args.dry_run:
                reset_sequences(pg_conn, tables)
                pg_conn.commit()

        for table, count in copied_counts.items():
            print(f"{table}\t{count}")
    except Exception:
        pg_conn.rollback()
        raise
    finally:
        pg_conn.close()
        sqlite_conn.close()


if __name__ == "__main__":
    main()

