"""persist AI drafts

Revision ID: 0025_ai_drafts
Revises: 0024_seed_application_assembly
Create Date: 2026-05-29
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0025_ai_drafts"
down_revision = "0024_seed_application_assembly"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _has_table("ai_drafts"):
        return
    op.create_table(
        "ai_drafts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False, server_default="1"),
        sa.Column("draft_id", sa.String(length=100), nullable=False),
        sa.Column("skill", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),
        sa.Column("payload", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("evidence", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("run_id", sa.String(length=100), nullable=True),
        sa.Column("created_by", sa.String(length=100), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "draft_id", name="uq_ai_drafts_tenant_draft_id"),
    )
    op.create_index("ix_ai_drafts_tenant_id", "ai_drafts", ["tenant_id"])
    op.create_index("ix_ai_drafts_draft_id", "ai_drafts", ["draft_id"])
    op.create_index("ix_ai_drafts_skill", "ai_drafts", ["skill"])
    op.create_index("ix_ai_drafts_run_id", "ai_drafts", ["run_id"])
    op.create_index("ix_ai_drafts_created_by", "ai_drafts", ["created_by"])


def downgrade() -> None:
    if not _has_table("ai_drafts"):
        return
    for index_name in [
        "ix_ai_drafts_created_by",
        "ix_ai_drafts_run_id",
        "ix_ai_drafts_skill",
        "ix_ai_drafts_draft_id",
        "ix_ai_drafts_tenant_id",
    ]:
        op.drop_index(index_name, table_name="ai_drafts")
    op.drop_table("ai_drafts")
