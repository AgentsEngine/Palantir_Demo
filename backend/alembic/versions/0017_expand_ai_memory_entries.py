"""expand AI memory entry metadata

Revision ID: 0017_expand_ai_memory_entries
Revises: 0016_knowledge_ocr_result
Create Date: 2026-05-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0017_expand_ai_memory_entries"
down_revision = "0016_knowledge_ocr_result"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def _create_index_if_missing(table_name: str, index_name: str, columns: list[str]) -> None:
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def _drop_index_if_present(table_name: str, index_name: str) -> None:
    if _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def upgrade() -> None:
    table_name = "ai_memory_entries"
    if not _has_table(table_name):
        return

    columns = [
        sa.Column("tenant_id", sa.Integer(), nullable=True),
        sa.Column("user_key", sa.String(length=100), nullable=True),
        sa.Column("page", sa.String(length=100), nullable=True),
        sa.Column("document_id", sa.String(length=100), nullable=True),
        sa.Column("run_id", sa.String(length=100), nullable=True),
        sa.Column("user_message_id", sa.String(length=100), nullable=True),
        sa.Column("assistant_message_id", sa.String(length=100), nullable=True),
        sa.Column("source_type", sa.String(length=80), nullable=True),
        sa.Column("source_id", sa.String(length=200), nullable=True),
        sa.Column("memory_type", sa.String(length=80), nullable=False, server_default="turn_summary"),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("importance_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("visibility", sa.String(length=50), nullable=False, server_default="private"),
        sa.Column("sensitivity", sa.String(length=50), nullable=False, server_default="normal"),
        sa.Column("redaction_status", sa.String(length=50), nullable=False, server_default="clean"),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("last_accessed_at", sa.DateTime(), nullable=True),
        sa.Column("access_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("content_hash", sa.String(length=128), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("vault_path", sa.String(length=500), nullable=True),
        sa.Column("exported_at", sa.DateTime(), nullable=True),
        sa.Column("export_checksum", sa.String(length=128), nullable=True),
    ]
    for column in columns:
        _add_column_if_missing(table_name, column)

    for index_name, index_columns in [
        ("ix_ai_memory_entries_tenant_id", ["tenant_id"]),
        ("ix_ai_memory_entries_user_key", ["user_key"]),
        ("ix_ai_memory_entries_page", ["page"]),
        ("ix_ai_memory_entries_document_id", ["document_id"]),
        ("ix_ai_memory_entries_run_id", ["run_id"]),
        ("ix_ai_memory_entries_content_hash", ["content_hash"]),
    ]:
        _create_index_if_missing(table_name, index_name, index_columns)


def downgrade() -> None:
    table_name = "ai_memory_entries"
    if not _has_table(table_name):
        return

    for index_name in [
        "ix_ai_memory_entries_content_hash",
        "ix_ai_memory_entries_run_id",
        "ix_ai_memory_entries_document_id",
        "ix_ai_memory_entries_page",
        "ix_ai_memory_entries_user_key",
        "ix_ai_memory_entries_tenant_id",
    ]:
        _drop_index_if_present(table_name, index_name)

    for column_name in [
        "export_checksum",
        "exported_at",
        "vault_path",
        "version",
        "content_hash",
        "pinned",
        "access_count",
        "last_accessed_at",
        "expires_at",
        "redaction_status",
        "sensitivity",
        "visibility",
        "confidence",
        "importance_score",
        "tags",
        "content",
        "memory_type",
        "source_id",
        "source_type",
        "assistant_message_id",
        "user_message_id",
        "run_id",
        "document_id",
        "page",
        "user_key",
        "tenant_id",
    ]:
        if _has_column(table_name, column_name):
            op.drop_column(table_name, column_name)
