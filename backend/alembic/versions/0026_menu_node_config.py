"""persist application menu node config

Revision ID: 0026_menu_node_config
Revises: 0025_ai_drafts
Create Date: 2026-05-29
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0026_menu_node_config"
down_revision = "0025_ai_drafts"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("application_menu_nodes", "config"):
        op.add_column("application_menu_nodes", sa.Column("config", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _has_column("application_menu_nodes", "config"):
        op.drop_column("application_menu_nodes", "config")
