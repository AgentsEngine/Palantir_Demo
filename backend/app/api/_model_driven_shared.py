"""Shared internals for the model-driven router family.

Splitting `model_driven.py` (643 lines) into three sibling modules:
- model_driven_meta.py   — meta-model + page-config CRUD
- model_driven_data.py   — dynamic data CRUD over whitelisted tables
- model_driven_menus.py  — menu items CRUD

This module hosts the cross-cutting helpers, mocks and Pydantic schemas
they all depend on.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel

from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Pydantic Schemas ─────────────────────────────────────


class MetaModelCreate(BaseModel):
    name: str
    label: str
    icon: Optional[str] = None
    table_name: str
    description: Optional[str] = None
    is_system: bool = False


class MetaModelUpdate(BaseModel):
    label: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None


class MetaFieldCreate(BaseModel):
    field_name: str
    label: str
    field_type: str = "string"
    required: bool = False
    searchable: bool = False
    sortable: bool = False
    visible_in_list: bool = True
    visible_in_form: bool = True
    enum_values: Optional[str] = None
    relation_config: Optional[str] = None
    default_value: Optional[str] = None
    sort_order: int = 0


class PageConfigCreate(BaseModel):
    name: str
    title: str
    paradigm: str = "master-detail"
    model_name: str
    config: Optional[dict] = None
    route_path: Optional[str] = None
    is_published: bool = False


class MenuItemCreate(BaseModel):
    parent_id: Optional[int] = None
    title: str
    icon: Optional[str] = None
    route_path: Optional[str] = None
    sort_order: int = 0
    is_visible: bool = True


class MenuItemUpdate(BaseModel):
    parent_id: Optional[int] = None
    title: Optional[str] = None
    icon: Optional[str] = None
    route_path: Optional[str] = None
    sort_order: Optional[int] = None
    is_visible: Optional[bool] = None


# ── Identifier safety ────────────────────────────────────

# Strict identifier pattern — only lowercase ASCII names with underscores.
_IDENT_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def assert_safe_identifier(name: str) -> None:
    """Defense-in-depth check on dynamic table/column names."""
    if not _IDENT_RE.match(name):
        raise HTTPException(400, f"Invalid identifier: {name!r}")


# ── Whitelisted dynamic CRUD targets ─────────────────────

SAFE_COLUMNS: dict[str, set[str]] = {
    "factories": {"id", "name", "location", "capacity", "status", "description"},
    "workshops": {"id", "name", "factory_id", "area", "workshop_type"},
    "production_lines": {"id", "name", "workshop_id", "capacity", "oee_target", "status"},
    "equipment": {"id", "name", "line_id", "model", "manufacturer", "install_date", "status", "health_score"},
    "sensors": {"id", "name", "equipment_id", "sensor_type", "unit", "sampling_rate"},
    "products": {"id", "name", "sku", "category", "specs", "unit"},
    "materials": {"id", "name", "material_type", "specs", "unit", "safety_stock"},
    "suppliers": {"id", "name", "location", "rating", "lead_time_days", "contact"},
    "customers": {"id", "name", "industry", "region"},
    "workers": {"id", "name", "role", "department"},
    "sales_orders": {"id", "order_no", "customer_id", "product_id", "quantity", "due_date", "priority", "status"},
    "work_orders": {
        "id", "order_no", "sales_order_id", "line_id", "planned_start", "planned_end",
        "actual_start", "actual_end", "quantity", "completed_quantity", "status",
    },
    "inspections": {"id", "inspection_type", "target_type", "target_id", "result", "inspector_id", "inspected_at"},
    "defects": {"id", "inspection_id", "defect_type", "severity", "description", "root_cause", "correction"},
}

for _tenant_table in SAFE_COLUMNS:
    SAFE_COLUMNS[_tenant_table].add("tenant_id")

ENTITY_TABLE_MAP = {
    "Factory": "factories", "Workshop": "workshops", "ProductionLine": "production_lines",
    "Equipment": "equipment", "Sensor": "sensors", "Product": "products",
    "Material": "materials", "Supplier": "suppliers", "Customer": "customers",
    "Worker": "workers", "SalesOrder": "sales_orders", "WorkOrder": "work_orders",
}


# ── Mock fallbacks (shared across submodules) ────────────

MOCK_MODELS: list[dict] = [
    {
        "id": 1, "name": "equipment", "label": "设备", "icon": "ToolOutlined", "table_name": "equipment",
        "description": "生产设备管理", "is_system": True,
        "fields": [
            {"id": 1, "field_name": "name", "label": "设备名称", "field_type": "string", "required": True, "searchable": True, "sortable": False, "visible_in_list": True, "visible_in_form": True, "sort_order": 1},
            {"id": 2, "field_name": "model", "label": "设备型号", "field_type": "string", "required": False, "searchable": True, "sortable": False, "visible_in_list": True, "visible_in_form": True, "sort_order": 2},
            {"id": 3, "field_name": "manufacturer", "label": "制造商", "field_type": "string", "required": False, "searchable": True, "sortable": False, "visible_in_list": True, "visible_in_form": True, "sort_order": 3},
            {"id": 4, "field_name": "status", "label": "状态", "field_type": "enum", "required": False, "searchable": True, "sortable": True, "visible_in_list": True, "visible_in_form": True,
             "enum_values": json.dumps(["running", "idle", "maintenance", "fault", "offline"]), "sort_order": 4},
            {"id": 5, "field_name": "health_score", "label": "健康评分", "field_type": "float", "required": False, "searchable": False, "sortable": True, "visible_in_list": True, "visible_in_form": False, "sort_order": 5},
        ],
    },
    {
        "id": 2, "name": "supplier", "label": "供应商", "icon": "ShopOutlined", "table_name": "suppliers",
        "description": "供应商信息管理", "is_system": True,
        "fields": [
            {"id": 10, "field_name": "name", "label": "供应商名称", "field_type": "string", "required": True, "searchable": True, "sortable": False, "visible_in_list": True, "visible_in_form": True, "sort_order": 1},
            {"id": 11, "field_name": "location", "label": "所在地区", "field_type": "string", "required": False, "searchable": True, "sortable": False, "visible_in_list": True, "visible_in_form": True, "sort_order": 2},
            {"id": 12, "field_name": "rating", "label": "评级", "field_type": "float", "required": False, "searchable": False, "sortable": True, "visible_in_list": True, "visible_in_form": True, "sort_order": 3},
            {"id": 13, "field_name": "lead_time_days", "label": "交货周期(天)", "field_type": "int", "required": False, "searchable": False, "sortable": True, "visible_in_list": True, "visible_in_form": True, "sort_order": 4},
            {"id": 14, "field_name": "contact", "label": "联系方式", "field_type": "string", "required": False, "searchable": True, "sortable": False, "visible_in_list": True, "visible_in_form": True, "sort_order": 5},
        ],
    },
    {
        "id": 3, "name": "product", "label": "产品", "icon": "AppstoreOutlined", "table_name": "products",
        "description": "产品信息管理", "is_system": True,
        "fields": [
            {"id": 20, "field_name": "name", "label": "产品名称", "field_type": "string", "required": True, "searchable": True, "sortable": False, "visible_in_list": True, "visible_in_form": True, "sort_order": 1},
            {"id": 21, "field_name": "sku", "label": "SKU", "field_type": "string", "required": True, "searchable": True, "sortable": True, "visible_in_list": True, "visible_in_form": True, "sort_order": 2},
            {"id": 22, "field_name": "category", "label": "分类", "field_type": "string", "required": False, "searchable": True, "sortable": True, "visible_in_list": True, "visible_in_form": True, "sort_order": 3},
        ],
    },
]

MOCK_PAGES: list[dict] = [
    {"id": 1, "name": "equipment-list", "title": "设备管理", "paradigm": "master-detail",
     "model_id": 1, "model_name": "equipment", "config": {}, "route_path": "/dynamic/equipment-list", "is_published": True},
    {"id": 2, "name": "supplier-list", "title": "供应商管理", "paradigm": "master-detail",
     "model_id": 2, "model_name": "supplier", "config": {}, "route_path": "/dynamic/supplier-list", "is_published": True},
]

MOCK_MENUS: list[dict] = [
    {"id": 1, "parent_id": None, "title": "动态页面", "icon": "AppstoreOutlined", "route_path": None, "sort_order": 100, "is_visible": True},
    {"id": 2, "parent_id": 1, "title": "设备管理", "icon": "ToolOutlined", "route_path": "/dynamic/equipment-list", "sort_order": 101, "is_visible": True},
    {"id": 3, "parent_id": 1, "title": "供应商管理", "icon": "ShopOutlined", "route_path": "/dynamic/supplier-list", "sort_order": 102, "is_visible": True},
]

MOCK_DATA: dict[str, list[dict]] = {
    "equipment": [
        {"id": 1, "name": "DMG MORI NLX 2500", "line_id": 1, "model": "NLX2500/700", "manufacturer": "DMG MORI", "status": "running", "health_score": 92.5},
        {"id": 2, "name": "CNC加工中心-01", "line_id": 1, "model": "VMC850", "manufacturer": "大连机床", "status": "running", "health_score": 88.3},
        {"id": 3, "name": "焊接机器人-01", "line_id": 2, "model": "IRB 6700", "manufacturer": "ABB", "status": "running", "health_score": 95.1},
        {"id": 4, "name": "液压机-01", "line_id": 3, "model": "YH32-315", "manufacturer": "南通锻压", "status": "maintenance", "health_score": 72.0},
        {"id": 5, "name": "AGV-01", "line_id": 1, "model": "AGV-X100", "manufacturer": "新松机器人", "status": "idle", "health_score": 98.2},
    ],
    "suppliers": [
        {"id": 1, "name": "宝钢股份", "location": "上海市宝山区", "rating": 4.8, "lead_time_days": 5, "contact": "张经理"},
        {"id": 2, "name": "SKF中国", "location": "上海市嘉定区", "rating": 4.6, "lead_time_days": 7, "contact": "李经理"},
        {"id": 3, "name": "东北特钢集团", "location": "辽宁省大连市", "rating": 4.5, "lead_time_days": 8, "contact": "王经理"},
        {"id": 4, "name": "NOK密封技术", "location": "江苏省无锡市", "rating": 4.3, "lead_time_days": 3, "contact": "陈经理"},
    ],
    "products": [
        {"id": 1, "name": "轴承组件A-100", "sku": "BRG-A100", "category": "轴承", "specs": "外径100mm", "unit": "个"},
        {"id": 2, "name": "PCBA主控板V2", "sku": "PCB-V2", "category": "电路板", "specs": "4层板", "unit": "片"},
        {"id": 3, "name": "液压阀块HV-50", "sku": "VLV-50", "category": "阀块", "specs": "通径50mm", "unit": "个"},
    ],
}


# ── DB session helper ────────────────────────────────────
# Re-export the unified helper from core.db so all model-driven submodules
# share the same logging/rollback semantics as the rest of the API.
from app.core.db import safe_db_call as try_db  # noqa: E402,F401
