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


def postgres_columns(conn, table: str) -> dict[str, dict[str, str | bool | None]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            select column_name, data_type, is_nullable, column_default
            from information_schema.columns
            where table_schema = 'public' and table_name = %s
            order by ordinal_position
            """,
            (table,),
        )
        return {
            name: {
                "data_type": data_type,
                "nullable": is_nullable == "YES",
                "default": column_default,
            }
            for name, data_type, is_nullable, column_default in cur.fetchall()
        }


def postgres_fk_dependencies(conn, tables: set[str]) -> dict[str, set[str]]:
    dependencies = {table: set() for table in tables}
    with conn.cursor() as cur:
        cur.execute(
            """
            select tc.table_name as child_table, ccu.table_name as parent_table
            from information_schema.table_constraints tc
            join information_schema.constraint_column_usage ccu
              on ccu.constraint_name = tc.constraint_name
             and ccu.constraint_schema = tc.constraint_schema
            where tc.constraint_type = 'FOREIGN KEY'
              and tc.table_schema = 'public'
            """
        )
        for child, parent in cur.fetchall():
            if child in dependencies and parent in dependencies and child != parent:
                dependencies[child].add(parent)
    return dependencies


def insertion_order(conn, tables: list[str]) -> list[str]:
    remaining = set(tables)
    dependencies = postgres_fk_dependencies(conn, remaining)
    ordered: list[str] = []

    while remaining:
        ready = sorted(table for table in remaining if not (dependencies[table] & remaining))
        if not ready:
            # Cycles are uncommon in this demo schema. Keep the remaining order stable
            # and let the database surface any truly invalid relationship.
            ordered.extend(sorted(remaining))
            break
        ordered.extend(ready)
        remaining.difference_update(ready)
    return ordered


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


def source_value(row: sqlite3.Row, column: str, target_column: dict[str, str | bool | None]) -> Any:
    if column == "tenant_id":
        value = row[column] if column in row.keys() else None
        return 1 if value is None else value
    return convert_value(row[column], str(target_column["data_type"]))


def valid_ids(sqlite_conn: sqlite3.Connection, table: str) -> set[Any]:
    if table not in sqlite_tables(sqlite_conn):
        return set()
    return {row[0] for row in sqlite_conn.execute(f'select "id" from "{table}"').fetchall()}


def filter_legacy_orphans(table: str, rows: list[sqlite3.Row], columns: list[str], parent_ids: dict[str, set[Any]]) -> list[sqlite3.Row]:
    if table == "forms" or "form_id" not in columns:
        return rows
    form_ids = parent_ids.get("forms", set())
    if not form_ids:
        return rows
    return [row for row in rows if row["form_id"] in form_ids]


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
        parent_ids = {"forms": valid_ids(sqlite_conn, "forms")}
        ordered_tables = insertion_order(pg_conn, tables)
        skipped = sorted(source_tables - target_tables)
        print(f"common_tables={len(tables)} skipped_source_tables={skipped}")

        with pg_conn.cursor() as cur:
            if tables:
                truncate_tables = sql.SQL(", ").join(qident(table) for table in tables)
                print("truncate_tables=" + ",".join(tables))
                if not args.dry_run:
                    cur.execute(sql.SQL("truncate table {} restart identity cascade").format(truncate_tables))

            copied_counts: dict[str, int] = {}
            for table in ordered_tables:
                src_columns = sqlite_columns(sqlite_conn, table)
                target_columns = postgres_columns(pg_conn, table)
                columns = [col for col in src_columns if col in target_columns]
                if "tenant_id" in target_columns and "tenant_id" not in columns:
                    columns.append("tenant_id")
                if not columns:
                    copied_counts[table] = 0
                    continue

                selected_columns = [col for col in columns if col in src_columns]
                rows = sqlite_conn.execute(
                    f'select {", ".join([chr(34) + col + chr(34) for col in selected_columns])} from "{table}"'
                ).fetchall()
                rows = filter_legacy_orphans(table, rows, selected_columns, parent_ids)
                copied_counts[table] = len(rows)
                if args.dry_run or not rows:
                    continue

                values = [
                    tuple(source_value(row, col, target_columns[col]) for col in columns)
                    for row in rows
                ]
                insert_sql = sql.SQL("insert into {table} ({columns}) values %s").format(
                    table=qident(table),
                    columns=sql.SQL(", ").join(qident(col) for col in columns),
                )
                execute_values(cur, insert_sql, values, page_size=1000)

            if not args.dry_run:
                reset_sequences(pg_conn, ordered_tables)
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
