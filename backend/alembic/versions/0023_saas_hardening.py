"""saas hardening tenant boundaries and exports

Revision ID: 0023_saas_hardening
Revises: 0022_business_tenant_isolation
Create Date: 2026-05-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023_saas_hardening"
down_revision = "0022_business_tenant_isolation"
branch_labels = None
depends_on = None


TENANT_TABLES = [
    "notifications",
    "rules",
    "scheduled_jobs",
    "knowledge_documents",
    "knowledge_chunks",
    "knowledge_ingestion_jobs",
    "knowledge_extraction_results",
    "knowledge_object_links",
    "ai_conversations",
    "ai_messages",
    "ai_agent_runs",
    "ai_tool_calls",
]

TENANT_UNIQUES = [
    ("knowledge_documents", "uq_knowledge_documents_tenant_document_id", ["tenant_id", "document_id"]),
    ("knowledge_chunks", "uq_knowledge_chunks_tenant_chunk_id", ["tenant_id", "chunk_id"]),
    ("knowledge_ingestion_jobs", "uq_knowledge_ingestion_jobs_tenant_job_id", ["tenant_id", "job_id"]),
    ("knowledge_extraction_results", "uq_knowledge_extraction_results_tenant_job_id", ["tenant_id", "job_id"]),
    ("ai_conversations", "uq_ai_conversations_tenant_conversation_id", ["tenant_id", "conversation_id"]),
    ("ai_messages", "uq_ai_messages_tenant_message_id", ["tenant_id", "message_id"]),
    ("ai_agent_runs", "uq_ai_agent_runs_tenant_run_id", ["tenant_id", "run_id"]),
    ("ai_tool_calls", "uq_ai_tool_calls_tenant_call_id", ["tenant_id", "call_id"]),
]

TENANT_INDEXES = [
    ("ix_notifications_tenant_user_read", "notifications", ["tenant_id", "user_id", "is_read"]),
    ("ix_rules_tenant_model_type", "rules", ["tenant_id", "model_id", "rule_type"]),
    ("ix_scheduled_jobs_tenant_active", "scheduled_jobs", ["tenant_id", "is_active"]),
    ("ix_knowledge_object_links_tenant_object", "knowledge_object_links", ["tenant_id", "object_type", "object_id"]),
]


def _inspector():
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _columns(table_name: str) -> set[str]:
    if not _has_table(table_name):
        return set()
    return {column["name"] for column in _inspector().get_columns(table_name)}


def _unique_names(table_name: str) -> set[str]:
    if not _has_table(table_name):
        return set()
    return {item.get("name") for item in _inspector().get_unique_constraints(table_name) if item.get("name")}


def _index_names(table_name: str) -> set[str]:
    if not _has_table(table_name):
        return set()
    return {item.get("name") for item in _inspector().get_indexes(table_name) if item.get("name")}


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    for table_name in TENANT_TABLES:
        if not _has_table(table_name):
            continue
        if "tenant_id" not in _columns(table_name):
            op.add_column(table_name, sa.Column("tenant_id", sa.Integer(), nullable=False, server_default="1"))
            if dialect != "sqlite":
                op.create_foreign_key(f"fk_{table_name}_tenant_id_tenants", table_name, "tenants", ["tenant_id"], ["id"])
            op.alter_column(table_name, "tenant_id", server_default=None)

    for index_name, table_name, columns in TENANT_INDEXES:
        if _has_table(table_name) and index_name not in _index_names(table_name):
            op.create_index(index_name, table_name, columns)

    if dialect != "sqlite":
        legacy_unique_columns = {
            "knowledge_documents": "document_id",
            "knowledge_chunks": "chunk_id",
            "knowledge_ingestion_jobs": "job_id",
            "knowledge_extraction_results": "job_id",
            "ai_conversations": "conversation_id",
            "ai_messages": "message_id",
            "ai_agent_runs": "run_id",
            "ai_tool_calls": "call_id",
        }
        for table_name, column_name in legacy_unique_columns.items():
            if not _has_table(table_name):
                continue
            for constraint in _inspector().get_unique_constraints(table_name):
                if constraint.get("column_names") == [column_name] and constraint.get("name"):
                    op.drop_constraint(constraint["name"], table_name, type_="unique")

        for table_name, name, columns in TENANT_UNIQUES:
            if _has_table(table_name) and name not in _unique_names(table_name):
                op.create_unique_constraint(name, table_name, columns)

    if not _has_table("tenant_exports"):
        op.create_table(
            "tenant_exports",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("requested_by", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
            sa.Column("format", sa.String(length=20), nullable=False, server_default="zip"),
            sa.Column("file_path", sa.String(length=1000), nullable=True),
            sa.Column("checksum", sa.String(length=128), nullable=True),
            sa.Column("size_bytes", sa.Integer(), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
        )
    if _has_table("tenant_exports"):
        if "ix_tenant_exports_tenant_id" not in _index_names("tenant_exports"):
            op.create_index("ix_tenant_exports_tenant_id", "tenant_exports", ["tenant_id"])
        if "ix_tenant_exports_tenant_status" not in _index_names("tenant_exports"):
            op.create_index("ix_tenant_exports_tenant_status", "tenant_exports", ["tenant_id", "status"])


def downgrade() -> None:
    if _has_table("tenant_exports"):
        op.drop_index("ix_tenant_exports_tenant_status", table_name="tenant_exports")
        op.drop_index("ix_tenant_exports_tenant_id", table_name="tenant_exports")
        op.drop_table("tenant_exports")

    for index_name, table_name, _columns_ in reversed(TENANT_INDEXES):
        if _has_table(table_name) and index_name in _index_names(table_name):
            op.drop_index(index_name, table_name=table_name)

    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        for table_name, name, _columns_ in reversed(TENANT_UNIQUES):
            if _has_table(table_name) and name in _unique_names(table_name):
                op.drop_constraint(name, table_name, type_="unique")

    for table_name in reversed(TENANT_TABLES):
        if _has_table(table_name) and "tenant_id" in _columns(table_name):
            op.drop_column(table_name, "tenant_id")
