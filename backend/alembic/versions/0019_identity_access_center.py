"""identity access center foundation

Revision ID: 0019_identity_access_center
Revises: 0018_system_settings
Create Date: 2026-05-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0019_identity_access_center"
down_revision = "0018_system_settings"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {col["name"] for col in sa.inspect(op.get_bind()).get_columns(table_name)}


def _add_column(table_name: str, column: sa.Column) -> None:
    if _has_table(table_name) and not _has_column(table_name, column.name):
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column("users", sa.Column("login_failed_count", sa.Integer(), nullable=False, server_default="0"))
    _add_column("users", sa.Column("locked_until", sa.DateTime(), nullable=True))
    _add_column("users", sa.Column("force_password_change", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add_column("users", sa.Column("last_login_at", sa.DateTime(), nullable=True))
    _add_column("users", sa.Column("last_login_ip", sa.String(length=100), nullable=True))
    _add_column("users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add_column("users", sa.Column("mfa_secret", sa.String(length=200), nullable=True))
    _add_column("users", sa.Column("sso_provider", sa.String(length=100), nullable=True))
    _add_column("users", sa.Column("sso_subject", sa.String(length=300), nullable=True))

    _add_column("role_permissions", sa.Column("effect", sa.String(length=20), nullable=False, server_default="allow"))
    _add_column("role_permissions", sa.Column("data_scope", sa.String(length=50), nullable=False, server_default="all"))
    _add_column("role_permissions", sa.Column("condition_json", sa.JSON(), nullable=True))
    _add_column("role_permissions", sa.Column("field_rules_json", sa.JSON(), nullable=True))
    _add_column("role_permissions", sa.Column("priority", sa.Integer(), nullable=False, server_default="100"))
    _add_column("role_permissions", sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()))

    if not _has_table("user_sessions"):
        op.create_table(
            "user_sessions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), nullable=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("session_id", sa.String(length=120), nullable=False),
            sa.Column("login_method", sa.String(length=50), nullable=False, server_default="local"),
            sa.Column("ip_address", sa.String(length=100), nullable=True),
            sa.Column("user_agent", sa.String(length=500), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_user_sessions_session_id", "user_sessions", ["session_id"], unique=True)
        op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
        op.create_index("ix_user_sessions_tenant_id", "user_sessions", ["tenant_id"])
        op.create_index("ix_user_sessions_expires_at", "user_sessions", ["expires_at"])

    if not _has_table("password_history"):
        op.create_table(
            "password_history",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), nullable=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("password_hash", sa.String(length=500), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_password_history_tenant_id", "password_history", ["tenant_id"])
        op.create_index("ix_password_history_user_id", "password_history", ["user_id"])

    if not _has_table("oidc_states"):
        op.create_table(
            "oidc_states",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), nullable=True),
            sa.Column("state", sa.String(length=200), nullable=False),
            sa.Column("nonce", sa.String(length=200), nullable=False),
            sa.Column("redirect_uri", sa.String(length=500), nullable=True),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("consumed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_oidc_states_state", "oidc_states", ["state"], unique=True)
        op.create_index("ix_oidc_states_tenant_id", "oidc_states", ["tenant_id"])
        op.create_index("ix_oidc_states_expires_at", "oidc_states", ["expires_at"])


def downgrade() -> None:
    for table in ("oidc_states", "password_history", "user_sessions"):
        if _has_table(table):
            op.drop_table(table)
    for column in ("enabled", "priority", "field_rules_json", "condition_json", "data_scope", "effect"):
        if _has_column("role_permissions", column):
            op.drop_column("role_permissions", column)
    for column in (
        "sso_subject",
        "sso_provider",
        "mfa_secret",
        "mfa_enabled",
        "last_login_ip",
        "last_login_at",
        "force_password_change",
        "locked_until",
        "login_failed_count",
    ):
        if _has_column("users", column):
            op.drop_column("users", column)
