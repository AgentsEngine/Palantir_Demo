"""add knowledge OCR result metadata

Revision ID: 0016_knowledge_ocr_result
Revises: 0015_ai_agent_runtime
Create Date: 2026-05-26
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0016_knowledge_ocr_result"
down_revision = "0015_ai_agent_runtime"
branch_labels = None
depends_on = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    if table_name not in inspector.get_table_names():
        return False
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("knowledge_documents", "ocr_result"):
        op.add_column("knowledge_documents", sa.Column("ocr_result", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _has_column("knowledge_documents", "ocr_result"):
        op.drop_column("knowledge_documents", "ocr_result")
