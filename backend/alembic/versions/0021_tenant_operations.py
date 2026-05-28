"""tenant operation invites

Revision ID: 0021_tenant_operations
Revises: 0020_tenant_onboarding
Create Date: 2026-05-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021_tenant_operations"
down_revision = "0020_tenant_onboarding"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {col["name"] for col in sa.inspect(op.get_bind()).get_columns(table_name)}


def upgrade() -> None:
    if _has_table("tenant_invites"):
        for name, column in [
            ("revoked_at", sa.Column("revoked_at", sa.DateTime(), nullable=True)),
            ("revoked_by", sa.Column("revoked_by", sa.Integer(), nullable=True)),
            ("replaced_by_invite_id", sa.Column("replaced_by_invite_id", sa.Integer(), nullable=True)),
        ]:
            if not _has_column("tenant_invites", name):
                op.add_column("tenant_invites", column)


def downgrade() -> None:
    if _has_table("tenant_invites"):
        for column in ["replaced_by_invite_id", "revoked_by", "revoked_at"]:
            if _has_column("tenant_invites", column):
                op.drop_column("tenant_invites", column)
