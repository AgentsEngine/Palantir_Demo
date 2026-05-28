"""form publish versions and dynamic record schema version

Revision ID: 0021_form_versions
Revises: 0020_tenant_onboarding
Create Date: 2026-05-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_form_versions"
down_revision = "0020_tenant_onboarding"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {col["name"] for col in sa.inspect(op.get_bind()).get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return index_name in {idx["name"] for idx in sa.inspect(op.get_bind()).get_indexes(table_name)}


def _create_index(index_name: str, table: str, columns: list[str], *, unique: bool = False) -> None:
    if _has_table(table) and not _has_index(table, index_name):
        op.create_index(index_name, table, columns, unique=unique)


def upgrade() -> None:
    if not _has_table("form_versions"):
        op.create_table(
            "form_versions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
            sa.Column("form_id", sa.Integer(), sa.ForeignKey("forms.id"), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default="published"),
            sa.Column("snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
            sa.Column("impact_report", sa.JSON(), nullable=True),
            sa.Column("published_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("published_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint("form_id", "version", name="uq_form_versions_form_version"),
        )
    _create_index("ix_form_versions_tenant_id", "form_versions", ["tenant_id"])
    _create_index("ix_form_versions_form_id", "form_versions", ["form_id"])

    if _has_table("dynamic_records") and not _has_column("dynamic_records", "schema_version"):
        op.add_column(
            "dynamic_records",
            sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        )
    _create_index(
        "ix_dynamic_records_tenant_form_schema_version_id",
        "dynamic_records",
        ["tenant_id", "form_id", "schema_version", "id"],
    )


def downgrade() -> None:
    if _has_index("dynamic_records", "ix_dynamic_records_tenant_form_schema_version_id"):
        op.drop_index("ix_dynamic_records_tenant_form_schema_version_id", table_name="dynamic_records")
    if _has_table("dynamic_records") and _has_column("dynamic_records", "schema_version"):
        op.drop_column("dynamic_records", "schema_version")
    if _has_table("form_versions"):
        op.drop_table("form_versions")
