"""initial schema baseline

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-26

This migration uses `Base.metadata.create_all` against the alembic
connection to materialize the current SQLAlchemy schema as the v0
baseline. Subsequent migrations should use proper `op.add_column /
op.create_table` etc. and be generated via `alembic revision --autogenerate`.
"""
from __future__ import annotations

from alembic import op

from app.models.relational import Base

# revision identifiers, used by Alembic.
revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
