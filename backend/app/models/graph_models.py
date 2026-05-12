"""Neo4j graph models for ManuFoundry Ontology layer.

Entity nodes and relationship types for the manufacturing knowledge graph.
"""

from enum import Enum
from typing import Any


# ── Node Labels ──────────────────────────────────────────

class NodeLabel(str, Enum):
    FACTORY = "Factory"
    WORKSHOP = "Workshop"
    PRODUCTION_LINE = "ProductionLine"
    EQUIPMENT = "Equipment"
    SENSOR = "Sensor"
    PRODUCT = "Product"
    MATERIAL = "Material"
    SALES_ORDER = "SalesOrder"
    WORK_ORDER = "WorkOrder"
    SUPPLIER = "Supplier"
    CUSTOMER = "Customer"
    WAREHOUSE = "Warehouse"
    INSPECTION = "Inspection"
    DEFECT = "Defect"
    WORKER = "Worker"


# ── Relationship Types ──────────────────────────────────

class RelType(str, Enum):
    CONTAINS = "CONTAINS"
    PRODUCES = "PRODUCES"
    REQUIRES = "REQUIRES"
    SUPPLIES = "SUPPLIES"
    INSPECTS = "INSPECTS"
    MAINTAINS = "MAINTAINS"
    FEEDS = "FEEDS"
    ASSIGNED_TO = "ASSIGNED_TO"
    STORED_IN = "STORED_IN"
    SHIPS_TO = "SHIPS_TO"


# ── Ontology Entity Schema Definitions ──────────────────

ENTITY_SCHEMAS: dict[str, dict[str, Any]] = {
    "Factory": {
        "label": "工厂",
        "icon": "factory",
        "properties": {
            "name": {"type": "string", "required": True, "label": "工厂名称"},
            "location": {"type": "string", "required": True, "label": "地理位置"},
            "capacity": {"type": "float", "required": False, "label": "产能"},
            "status": {"type": "string", "required": False, "label": "状态"},
        },
        "outgoing_relations": ["CONTAINS"],
        "allowed_targets": {"CONTAINS": ["Workshop"]},
    },
    "Workshop": {
        "label": "车间",
        "icon": "workshop",
        "properties": {
            "name": {"type": "string", "required": True, "label": "车间名称"},
            "area": {"type": "float", "required": False, "label": "面积(㎡)"},
            "workshop_type": {"type": "string", "required": False, "label": "车间类型"},
        },
        "outgoing_relations": ["CONTAINS"],
        "allowed_targets": {"CONTAINS": ["ProductionLine"]},
    },
    "ProductionLine": {
        "label": "产线",
        "icon": "production-line",
        "properties": {
            "name": {"type": "string", "required": True, "label": "产线名称"},
            "capacity": {"type": "float", "required": False, "label": "产能"},
            "oee_target": {"type": "float", "required": False, "label": "OEE目标"},
            "status": {"type": "string", "required": False, "label": "状态"},
        },
        "outgoing_relations": ["CONTAINS", "PRODUCES"],
        "allowed_targets": {
            "CONTAINS": ["Equipment"],
            "PRODUCES": ["Product"],
        },
    },
    "Equipment": {
        "label": "设备",
        "icon": "equipment",
        "properties": {
            "name": {"type": "string", "required": True, "label": "设备名称"},
            "model": {"type": "string", "required": False, "label": "设备型号"},
            "manufacturer": {"type": "string", "required": False, "label": "制造商"},
            "status": {"type": "string", "required": False, "label": "状态"},
            "health_score": {"type": "float", "required": False, "label": "健康评分"},
        },
        "outgoing_relations": ["FEEDS"],
        "allowed_targets": {"FEEDS": ["Sensor"]},
    },
    "Sensor": {
        "label": "传感器",
        "icon": "sensor",
        "properties": {
            "name": {"type": "string", "required": True, "label": "传感器名称"},
            "sensor_type": {"type": "string", "required": False, "label": "类型"},
            "unit": {"type": "string", "required": False, "label": "单位"},
            "sampling_rate": {"type": "int", "required": False, "label": "采样频率(秒)"},
        },
        "outgoing_relations": [],
        "allowed_targets": {},
    },
    "Product": {
        "label": "产品",
        "icon": "product",
        "properties": {
            "name": {"type": "string", "required": True, "label": "产品名称"},
            "sku": {"type": "string", "required": True, "label": "SKU"},
            "category": {"type": "string", "required": False, "label": "分类"},
            "specs": {"type": "string", "required": False, "label": "规格"},
        },
        "outgoing_relations": ["REQUIRES"],
        "allowed_targets": {"REQUIRES": ["Material"]},
    },
    "Material": {
        "label": "物料",
        "icon": "material",
        "properties": {
            "name": {"type": "string", "required": True, "label": "物料名称"},
            "material_type": {"type": "string", "required": False, "label": "物料类型"},
            "specs": {"type": "string", "required": False, "label": "规格"},
            "safety_stock": {"type": "float", "required": False, "label": "安全库存"},
        },
        "outgoing_relations": [],
        "allowed_targets": {},
    },
    "Supplier": {
        "label": "供应商",
        "icon": "supplier",
        "properties": {
            "name": {"type": "string", "required": True, "label": "供应商名称"},
            "location": {"type": "string", "required": False, "label": "地区"},
            "rating": {"type": "float", "required": False, "label": "评级(1-5)"},
            "lead_time_days": {"type": "int", "required": False, "label": "交货周期(天)"},
        },
        "outgoing_relations": ["SUPPLIES"],
        "allowed_targets": {"SUPPLIES": ["Material"]},
    },
    "Customer": {
        "label": "客户",
        "icon": "customer",
        "properties": {
            "name": {"type": "string", "required": True, "label": "客户名称"},
            "industry": {"type": "string", "required": False, "label": "行业"},
            "region": {"type": "string", "required": False, "label": "区域"},
        },
        "outgoing_relations": [],
        "allowed_targets": {},
    },
    "Worker": {
        "label": "工人",
        "icon": "worker",
        "properties": {
            "name": {"type": "string", "required": True, "label": "姓名"},
            "role": {"type": "string", "required": False, "label": "角色"},
            "department": {"type": "string", "required": False, "label": "部门"},
        },
        "outgoing_relations": ["ASSIGNED_TO"],
        "allowed_targets": {"ASSIGNED_TO": ["Equipment", "WorkOrder"]},
    },
}


# ── Cypher Query Templates ──────────────────────────────

CYPHER_TEMPLATES = {
    "create_entity": (
        "CREATE (n:{label} {{pg_id: $pg_id}}) SET n += $props RETURN n"
    ),
    "create_relation": (
        "MATCH (a:{src_label} {{pg_id: $src_id}}) "
        "MATCH (b:{tgt_label} {{pg_id: $tgt_id}}) "
        "CREATE (a)-[r:{rel_type}]->(b) SET r += $props RETURN r"
    ),
    "get_neighbors": (
        "MATCH (n {{pg_id: $entity_id}})-[r]-(m) "
        "RETURN n, type(r) AS rel_type, m LIMIT $limit"
    ),
    "shortest_path": (
        "MATCH p = shortestPath((a {{pg_id: $src_id}})-[*..{max_hops}]-(b {{pg_id: $tgt_id}})) "
        "RETURN p"
    ),
    "subgraph": (
        "MATCH (n {{pg_id: $entity_id}})-[r*1..{depth}]-(m) "
        "RETURN n, r, m LIMIT $limit"
    ),
    "entity_timeline": (
        "MATCH (n {{pg_id: $entity_id}}) "
        "MATCH (n)-[r:VERSION_OF]->(v:EntityVersion) "
        "WHERE v.valid_from <= $timestamp "
        "RETURN v ORDER BY v.valid_from DESC LIMIT 1"
    ),
    "stats": (
        "MATCH (n) RETURN labels(n)[0] AS label, count(*) AS count "
        "ORDER BY count DESC"
    ),
}
