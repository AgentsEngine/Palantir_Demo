"""business tenant isolation

Revision ID: 0022_business_tenant_isolation
Revises: 0021_form_versions, 0021_tenant_operations
Create Date: 2026-05-28
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022_business_tenant_isolation"
down_revision = ("0021_form_versions", "0021_tenant_operations")
branch_labels = None
depends_on = None


TENANT_TABLES = [
    "factories",
    "workshops",
    "production_lines",
    "equipment",
    "sensors",
    "sensor_readings",
    "products",
    "materials",
    "bom",
    "process_routes",
    "customers",
    "sales_orders",
    "work_orders",
    "operations",
    "workers",
    "suppliers",
    "warehouses",
    "inventory",
    "shipments",
    "inspections",
    "defects",
    "spc_points",
    "capa",
    "data_sources",
    "pipelines",
    "pipeline_runs",
]

TENANT_UNIQUES = [
    ("products", "uq_products_tenant_sku", ["tenant_id", "sku"], ["sku"]),
    ("sales_orders", "uq_sales_orders_tenant_order_no", ["tenant_id", "order_no"], ["order_no"]),
    ("work_orders", "uq_work_orders_tenant_order_no", ["tenant_id", "order_no"], ["order_no"]),
    ("data_sources", "uq_data_sources_tenant_name", ["tenant_id", "name"], ["name"]),
    ("pipelines", "uq_pipelines_tenant_name", ["tenant_id", "name"], ["name"]),
]

TENANT_INDEXES = [
    ("ix_factories_tenant_status", "factories", ["tenant_id", "status"]),
    ("ix_workshops_tenant_factory", "workshops", ["tenant_id", "factory_id"]),
    ("ix_production_lines_tenant_status", "production_lines", ["tenant_id", "status"]),
    ("ix_equipment_tenant_status", "equipment", ["tenant_id", "status"]),
    ("ix_sensors_tenant_equipment", "sensors", ["tenant_id", "equipment_id"]),
    ("ix_sensor_readings_tenant_sensor_time", "sensor_readings", ["tenant_id", "sensor_id", "timestamp"]),
    ("ix_materials_tenant_type", "materials", ["tenant_id", "material_type"]),
    ("ix_bom_tenant_product", "bom", ["tenant_id", "product_id"]),
    ("ix_process_routes_tenant_product", "process_routes", ["tenant_id", "product_id"]),
    ("ix_operations_tenant_work_order", "operations", ["tenant_id", "work_order_id"]),
    ("ix_suppliers_tenant_rating", "suppliers", ["tenant_id", "rating"]),
    ("ix_customers_tenant_region", "customers", ["tenant_id", "region"]),
    ("ix_warehouses_tenant_location", "warehouses", ["tenant_id", "location"]),
    ("ix_inventory_tenant_material_warehouse", "inventory", ["tenant_id", "material_id", "warehouse_id"]),
    ("ix_shipments_tenant_status", "shipments", ["tenant_id", "status"]),
    ("ix_inspections_tenant_type_result", "inspections", ["tenant_id", "inspection_type", "result"]),
    ("ix_defects_tenant_severity", "defects", ["tenant_id", "severity"]),
    ("ix_spc_points_tenant_parameter_time", "spc_points", ["tenant_id", "parameter", "timestamp"]),
    ("ix_capa_tenant_status", "capa", ["tenant_id", "status"]),
    ("ix_workers_tenant_role", "workers", ["tenant_id", "role"]),
    ("ix_pipeline_runs_tenant_pipeline", "pipeline_runs", ["tenant_id", "pipeline_id"]),
]


def _inspector():
    return sa.inspect(op.get_bind())


def _dialect() -> str:
    return op.get_bind().dialect.name


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return _has_table(table_name) and column_name in {col["name"] for col in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    return _has_table(table_name) and index_name in {idx["name"] for idx in _inspector().get_indexes(table_name)}


def _has_unique(table_name: str, columns: list[str]) -> str | None:
    if not _has_table(table_name):
        return None
    target = tuple(columns)
    for constraint in _inspector().get_unique_constraints(table_name):
        if tuple(constraint.get("column_names") or []) == target:
            return constraint.get("name")
    return None


def _add_tenant_column(table_name: str) -> None:
    if not _has_table(table_name) or _has_column(table_name, "tenant_id"):
        return
    op.add_column(table_name, sa.Column("tenant_id", sa.Integer(), nullable=False, server_default="1"))
    if _dialect() != "sqlite":
        op.create_foreign_key(
            f"fk_{table_name}_tenant_id_tenants",
            table_name,
            "tenants",
            ["tenant_id"],
            ["id"],
        )


def _create_index(index_name: str, table_name: str, columns: list[str]) -> None:
    if _has_table(table_name) and not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns)


def upgrade() -> None:
    for table_name in TENANT_TABLES:
        _add_tenant_column(table_name)

    for table_name, constraint_name, columns, old_columns in TENANT_UNIQUES:
        old_name = _has_unique(table_name, old_columns)
        if old_name:
            op.drop_constraint(old_name, table_name, type_="unique")
        if _has_table(table_name) and not _has_unique(table_name, columns):
            op.create_unique_constraint(constraint_name, table_name, columns)

    for index_name, table_name, columns in TENANT_INDEXES:
        _create_index(index_name, table_name, columns)


def downgrade() -> None:
    for table_name, constraint_name, _columns, old_columns in reversed(TENANT_UNIQUES):
        if _has_unique(table_name, ["tenant_id", old_columns[0]]):
            op.drop_constraint(constraint_name, table_name, type_="unique")
        if _has_table(table_name) and not _has_unique(table_name, old_columns):
            op.create_unique_constraint(f"uq_{table_name}_{old_columns[0]}", table_name, old_columns)

    for index_name, table_name, _columns in reversed(TENANT_INDEXES):
        if _has_index(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)

    if _dialect() == "sqlite":
        return
    for table_name in reversed(TENANT_TABLES):
        if _has_column(table_name, "tenant_id"):
            op.drop_constraint(f"fk_{table_name}_tenant_id_tenants", table_name, type_="foreignkey")
            op.drop_column(table_name, "tenant_id")
