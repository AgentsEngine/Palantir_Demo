"""tenant onboarding and tenant-scoped uniqueness

Revision ID: 0020_tenant_onboarding
Revises: 0019_identity_access_center
Create Date: 2026-05-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020_tenant_onboarding"
down_revision = "0019_identity_access_center"
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
    if _has_table("tenants"):
        for name, column in [
            ("config", sa.Column("config", sa.JSON(), nullable=True)),
            ("limits", sa.Column("limits", sa.JSON(), nullable=True)),
            ("opened_by", sa.Column("opened_by", sa.Integer(), nullable=True)),
            ("suspended_reason", sa.Column("suspended_reason", sa.Text(), nullable=True)),
        ]:
            if not _has_column("tenants", name):
                op.add_column("tenants", column)

    if not _has_table("tenant_domains"):
        op.create_table(
            "tenant_domains",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("domain", sa.String(255), nullable=False),
            sa.Column("status", sa.String(50), nullable=False, server_default="active"),
            sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint("domain", name="uq_tenant_domains_domain"),
        )
    _create_index("ix_tenant_domains_tenant_id", "tenant_domains", ["tenant_id"])
    _create_index("ix_tenant_domains_domain", "tenant_domains", ["domain"])

    if not _has_table("tenant_invites"):
        op.create_table(
            "tenant_invites",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("role", sa.String(50), nullable=False, server_default="member"),
            sa.Column("token_hash", sa.String(128), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("accepted_at", sa.DateTime(), nullable=True),
            sa.Column("invited_by", sa.Integer(), nullable=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint("token_hash", name="uq_tenant_invites_token_hash"),
        )
    _create_index("ix_tenant_invites_tenant_id", "tenant_invites", ["tenant_id"])
    _create_index("ix_tenant_invites_email", "tenant_invites", ["email"])
    _create_index("ix_tenant_invites_token_hash", "tenant_invites", ["token_hash"])
    _create_index("ix_tenant_invites_expires_at", "tenant_invites", ["expires_at"])

    if not _has_table("password_reset_tokens"):
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("token_hash", sa.String(128), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
            sa.Column("used_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
            sa.UniqueConstraint("token_hash", name="uq_password_reset_tokens_token_hash"),
        )
    _create_index("ix_password_reset_tokens_tenant_id", "password_reset_tokens", ["tenant_id"])
    _create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    _create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"])
    _create_index("ix_password_reset_tokens_expires_at", "password_reset_tokens", ["expires_at"])

    _create_index("uq_applications_tenant_code", "applications", ["tenant_id", "code"], unique=True)
    _create_index("uq_forms_tenant_code", "forms", ["tenant_id", "code"], unique=True)
    _create_index("uq_roles_tenant_name", "roles", ["tenant_id", "name"], unique=True)
    _create_index("uq_users_tenant_username", "users", ["tenant_id", "username"], unique=True)
    _create_index("uq_users_tenant_email", "users", ["tenant_id", "email"], unique=True)


def downgrade() -> None:
    for index_name, table_name in [
        ("uq_users_tenant_email", "users"),
        ("uq_users_tenant_username", "users"),
        ("uq_roles_tenant_name", "roles"),
        ("uq_forms_tenant_code", "forms"),
        ("uq_applications_tenant_code", "applications"),
    ]:
        if _has_index(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)
    for table in ["password_reset_tokens", "tenant_invites", "tenant_domains"]:
        if _has_table(table):
            op.drop_table(table)
    if _has_table("tenants"):
        for column in ["suspended_reason", "opened_by", "limits", "config"]:
            if _has_column("tenants", column):
                op.drop_column("tenants", column)
