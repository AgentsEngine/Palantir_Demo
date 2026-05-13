# ManuFoundry 数据模型与本体定义

> 版本: v2.0 | 日期: 2026-05-13 | 状态: 设计阶段
>
> 本文档由 `03-制造业本体定义.md` 与 `08-数据模型.md` 合并而成，作为 ManuFoundry 数据层的统一参考。

---

## 目录

1. [本体定义](#1-本体定义)
2. [关系数据库模型](#2-关系数据库模型)
3. [图数据库模型](#3-图数据库模型)
4. [与旧文档关系](#4-与旧文档关系)

---

## 1. 本体定义

ManuFoundry 的 Ontology 是一个**活的语义层**——所有业务实体、关系、动作在 Ontology 中有且仅有一个权威定义，上层应用全部基于此语义层构建。四大设计原则：

| 原则 | 含义 |
|------|------|
| **业务实体中心** | 围绕业务对象建模，而非数据库表 |
| **关系一等公民** | 关系可独立查询、授权、加动作 |
| **时间旅行** | 保留完整变更历史，可回溯到任意时间点 |
| **权限粒度** | 绑定到实体实例和属性级别 |

Ontology 在五层架构中位于 Layer 3（Integration 与 Workflow/AI 之间），是唯一同时被上层四层依赖的核心层。

### 1.1 六大实体族、22 种实体

制造业本体包含 **6 大实体族、22 种实体类型**。以下列出每种实体的唯一标识和核心状态枚举。

| 族 | 实体 | 唯一标识 | 核心状态枚举 |
|----|------|----------|-------------|
| **工厂族** | Factory | factory_id | OPERATING / MAINTENANCE / SHUTDOWN |
| | Workshop | workshop_id | ACTIVE / INACTIVE |
| | ProductionLine | line_id | RUNNING / IDLE / DOWN / CHANGEOVER |
| | Equipment | equipment_id | RUNNING / IDLE / FAULT / MAINTENANCE / DECOMMISSIONED |
| | Sensor | sensor_id | ONLINE / OFFLINE / FAULT |
| **产品族** | Product | product_id | ACTIVE / PHASE_OUT / OBSOLETE |
| | Material | material_id | ACTIVE / INACTIVE |
| | BOM | bom_id | DRAFT / APPROVED / OBSOLETE |
| | ProcessRoute | route_id | DRAFT / APPROVED / OBSOLETE |
| **订单族** | SalesOrder | order_id | UNCONFIRMED / CONFIRMED / IN_PRODUCTION / SHIPPED / DELIVERED / CANCELLED |
| | WorkOrder | wo_id | CREATED / RELEASED / IN_PROGRESS / COMPLETED / CLOSED / CANCELLED |
| | Operation | op_id | PENDING / IN_PROGRESS / COMPLETED / SKIPPED / REWORK |
| **供应链族** | Supplier | supplier_id | ACTIVE / PROBATION / BLACKLISTED |
| | Customer | customer_id | ACTIVE / INACTIVE |
| | Warehouse | warehouse_id | ACTIVE / INACTIVE |
| | Shipment | shipment_id | SCHEDULED / IN_TRANSIT / DELIVERED / DELAYED / CANCELLED |
| **质量族** | Inspection | inspection_id | PASS / FAIL / CONDITIONAL（result 字段） |
| | Defect | defect_id | OPEN / ANALYZING / CORRECTING / VERIFIED / CLOSED |
| | SPCPoint | spc_id | 由 ooc_rule_triggered 标识状态 |
| | CAPA | capa_id | OPEN / IN_PROGRESS / IMPLEMENTED / VERIFIED / CLOSED |
| **人员族** | Worker | worker_id | ACTIVE / ON_LEAVE / RESIGNED |
| | Skill | skill_id | — |
| | Shift | shift_id | — |

#### 工厂族 — 物理层级（ISA-95）

工厂 → 车间 → 产线 → 设备 → 传感器，严格遵循 ISA-95 设备层级模型。

**Factory**: factory_id, name, location(POINT), timezone, area_sqm, capacity_utilization, status, established_date, metadata(MAP)

**Workshop**: workshop_id, name, factory_id, workshop_type(MACHINING/ASSEMBLY/PAINTING/INSPECTION/WAREHOUSE), temperature_range, humidity_range, floor_number, area_sqm, status

**ProductionLine**: line_id, name, workshop_id, line_type(DISCRETE/CONTINUOUS/HYBRID), cycle_time_sec, throughput_per_hour, oee_target, current_shift, status, status_since

**Equipment**: equipment_id, name, line_id, equipment_type(CNC/ROBOT/CONVEYOR/PRESS/OVEN/AGV/OTHER), manufacturer, model, serial_number, install_date, mtbf_hours, mttr_hours, health_score(0~100), maintenance_strategy(REACTIVE/PREVENTIVE/PREDICTIVE), status

**Sensor**: sensor_id, name, equipment_id, sensor_type(TEMPERATURE/VIBRATION/PRESSURE/FLOW/CURRENT/VISION/OTHER), measure_unit, sample_rate_hz, range_min/max, alert_threshold_high/low, last_calibration, status

#### 产品族

**Product**: product_id, name, category, spec, unit, weight_kg, status, created_date

**Material**: material_id, name, material_type(RAW/SEMI_FINISHED/FINISHED/PACKAGING/CONSUMABLE), unit, safety_stock, current_stock, lead_time_days, shelf_life_days, status

**BOM**: bom_id, product_id, version, bom_type(EBOM/MBOM/SBOM), effective_date, expiry_date, items(LIST[MAP]{material_id, quantity, unit, scrap_rate}), status

**ProcessRoute**: route_id, product_id, version, steps(LIST[MAP]{step_num, operation_type, equipment_type, std_cycle_sec, quality_gate}), effective_date, total_cycle_sec, status

#### 订单族

**SalesOrder**: order_id, customer_id, order_date, delivery_date, priority(URGENT/HIGH/NORMAL/LOW), items(LIST[MAP]), total_amount, fulfillment_status, payment_status

**WorkOrder**: wo_id, sales_order_id, product_id, bom_version, route_version, planned/completed/scrap_qty, line_id, planned/actual_start/end, status

**Operation**: op_id, wo_id, step_num, operation_type, equipment_id, operator_id, planned/actual_cycle_sec, input/output/defect_qty, start/end_time, status

#### 供应链族

**Supplier**: supplier_id, name, contact_name/phone, address, rating(1~5), lead_time_days, on_time_delivery_rate, quality_score, certification(LIST), status

**Customer**: customer_id, name, industry, tier(A/B/C), contact_name, annual_volume, status

**Warehouse**: warehouse_id, name, factory_id, warehouse_type(RAW_MATERIAL/WIP/FINISHED_GOODS/HAZARDOUS), location_code, capacity, utilization, status

**Shipment**: shipment_id, type(INBOUND/OUTBOUND/TRANSFER), partner_id, warehouse_id, items(LIST[MAP]), carrier, tracking_number, planned/actual_ship_date, estimated/actual_arrival, status

#### 质量族

**Inspection**: inspection_id, type(INCOMING/IN_PROCESS/FINAL/PATROL), target_type/id, inspector_id, wo_id, sample_size, accept/reject_qty, result, inspection_time, attachments

**Defect**: defect_id, inspection_id, defect_type, defect_code, severity(CRITICAL/MAJOR/MINOR/OBSERVATION), detection_method, quantity, root_cause, corrective_action, status

**SPCPoint**: spc_id, sensor_id, characteristic, lsl, usl, target_value, mean, sigma, cpk, ppk, last_sample_time, ooc_rule_triggered

**CAPA**: capa_id, type(CORRECTIVE/PREVENTIVE), trigger_type(DEFECT/SPC_ALERT/CUSTOMER_COMPLAINT/AUDIT_FINDING), trigger_id, description, root_cause, action_plan, responsible_id, due_date, effectiveness, status

#### 人员族

**Worker**: worker_id, name, department, role(OPERATOR/TECHNICIAN/INSPECTOR/ENGINEER/MANAGER), skill_ids, shift_id, factory_id, hire_date, certification(LIST[MAP]), status

**Skill**: skill_id, name, category, proficiency_levels, required_cert, description

**Shift**: shift_id, name, start_time, end_time, factory_id, color_code

### 1.2 关系类型（7 种）

| 关系类型 | 源 → 目标 | 语义 | 特有属性 |
|----------|-----------|------|----------|
| **CONTAINS** | Factory → Workshop → Line → Equipment → Sensor | 物理层级 | position, install_date |
| **PRODUCES** | Line → Product, WorkOrder → Product | 生产了什么 | quantity, yield_rate, batch_id |
| **REQUIRES** | BOM → Material, WO → Equipment, Op → Worker, Route → Equipment | 生产依赖 | quantity, unit, is_critical |
| **SUPPLIES** | Supplier → Material, Shipment → Warehouse | 供应关系 | contract_id, unit_price, min_order_qty |
| **INSPECTS** | Inspection → Defect/Operation, Worker → SPCPoint | 检验关系 | sample_method, aql_level |
| **MAINTAINS** | Worker → Equipment, CAPA → Defect | 维护/纠正 | maintenance_type, duration_min |
| **FEEDS** | Sensor → Equipment/SPCPoint | 数据流 | data_frequency, protocol |

所有关系共有属性: rel_id(UUID), effective_from, effective_to, confidence(0~1), source(MANUAL/PIPELINE/AI_INFERRED)

### 1.3 时间旅行设计

采用 Event Sourcing 模式，变更以 `ChangeLog` 节点追加写入：

```
(:ChangeLog {
  change_id: UUID, target_type, target_id,
  change_type: CREATED/UPDATED/DELETED,
  field_name, old_value, new_value,
  changed_by, changed_at, reason, source
})-[:APPLIES_TO]->(目标实体)
```

存储策略：实体属性变更和关系变更永久保留（合规要求），>2 年可压缩合并。时序传感器数据不由本体存储（由 TimescaleDB 管理）。

### 1.4 权限模型

四级权限控制：

1. **对象级** — 能否看到这个实体存在
2. **属性级** — 能否看到某个属性（MASKED / HIDDEN / READONLY）
3. **关系级** — 能否看到/建立实体之间的关系
4. **行级** — 在什么条件下可以访问（如 `entity.factory_id = user.factory_id`）

权限评估在 API 层完成，将条件转化为 Cypher WHERE 子句注入查询，不依赖 Neo4j 原生权限。

### 1.5 Neo4j 存储方案

#### 节点标签策略

族标签 + 类型标签双重标记：

```cypher
(:Factory:Entity:FactoryFamily)
(:Workshop:Entity:FactoryFamily)
(:ProductionLine:Entity:FactoryFamily)
(:Equipment:Entity:FactoryFamily)
(:Sensor:Entity:FactoryFamily)

(:Product:Entity:ProductFamily)
(:Material:Entity:ProductFamily)
(:BOM:Entity:ProductFamily)
(:ProcessRoute:Entity:ProductFamily)

(:SalesOrder:Entity:OrderFamily)
(:WorkOrder:Entity:OrderFamily)
(:Operation:Entity:OrderFamily)

(:Supplier:Entity:SupplyChainFamily)
(:Customer:Entity:SupplyChainFamily)
(:Warehouse:Entity:SupplyChainFamily)
(:Shipment:Entity:SupplyChainFamily)

(:Inspection:Entity:QualityFamily)
(:Defect:Entity:QualityFamily)
(:SPCPoint:Entity:QualityFamily)
(:CAPA:Entity:QualityFamily)

(:Worker:Entity:PeopleFamily)
(:Skill:Entity:PeopleFamily)
(:Shift:Entity:PeopleFamily)
```

#### 关系定义

```cypher
-- 物理层级
(:Factory)-[:CONTAINS]->(:Workshop)
(:Workshop)-[:CONTAINS]->(:ProductionLine)
(:ProductionLine)-[:CONTAINS]->(:Equipment)
(:Equipment)-[:CONTAINS]->(:Sensor)

-- 生产关系
(:ProductionLine)-[:PRODUCES]->(:Product)
(:WorkOrder)-[:PRODUCES]->(:Product)

-- 需求关系
(:BOM)-[:REQUIRES]->(:Material)
(:WorkOrder)-[:REQUIRES]->(:Equipment)
(:Operation)-[:REQUIRES]->(:Worker)
(:ProcessRoute)-[:REQUIRES]->(:Equipment)

-- 供应关系
(:Supplier)-[:SUPPLIES]->(:Material)
(:Shipment)-[:SUPPLIES]->(:Warehouse)

-- 检验关系
(:Inspection)-[:INSPECTS]->(:Defect)
(:Inspection)-[:INSPECTS]->(:Operation)
(:Worker)-[:INSPECTS]->(:SPCPoint)

-- 维护关系
(:Worker)-[:MAINTAINS]->(:Equipment)
(:CAPA)-[:MAINTAINS]->(:Defect)

-- 数据流
(:Sensor)-[:FEEDS]->(:Equipment)
(:Sensor)-[:FEEDS]->(:SPCPoint)
```

#### 索引与约束

唯一性约束覆盖全部 22 种实体类型（factory_id, workshop_id, line_id, equipment_id, sensor_id, product_id, material_id, bom_id, route_id, order_id, wo_id, op_id, supplier_id, customer_id, warehouse_id, shipment_id, inspection_id, defect_id, spc_id, capa_id, worker_id, skill_id, shift_id）。

复合索引用于查询优化：equipment(status, equipment_type), workorder(status, planned_start), defect(severity, status), sensor(status), inspection(inspection_time), operation(status)。

全文索引用于 LLM 自然语言查询加速：`entity_name_fulltext` 覆盖 Entity 标签下所有 name 和 *_id 字段。

#### 5 个常用 Cypher 查询模板

| 模板 | 场景 |
|------|------|
| 设备全链路追溯 | 设备故障时定位关联工单和缺陷 |
| 产品族谱展开 | 查看完整 BOM + 工艺路线 |
| 供应商风险传导 | 评估断供影响的产品和订单 |
| 质量异常根因定位 | 定位缺陷的高频设备和工序 |
| 车间 OEE 仪表盘 | 实时监控产线状态和关键指标 |

---

## 2. 关系数据库模型

ManuFoundry 关系数据库使用 PostgreSQL（生产）/ SQLite（开发），ORM 为 SQLAlchemy 2.0 (async)。首次启动时 `init_db()` 自动建表并从 `data/seed/*.json` 导入种子数据（共 16 个 JSON 文件、10,399 条记录）。

### 2.1 工厂族

**Factory** — 表名: `factories`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK, 自增 | 工厂编号 |
| name | String(200) | NOT NULL | 工厂名称 |
| location | String(500) | NOT NULL | 地理位置 |
| capacity | Float | DEFAULT 0 | 产能上限 |
| status | String(50) | DEFAULT 'active' | 状态 |
| description | Text | NULLABLE | 描述 |
| created_at / updated_at | DateTime | 自动 | 时间戳 |

**Workshop** — 表名: `workshops` | FK: factory_id → factories.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 车间编号 |
| name | String(200) | NOT NULL | 车间名称 |
| factory_id | Integer | FK | 所属工厂 |
| area | Float | DEFAULT 0 | 面积 |
| workshop_type | String(100) | DEFAULT 'production' | machining/welding/assembly/inspection/casting/surface/smt/testing |

**ProductionLine** — 表名: `production_lines` | FK: workshop_id → workshops.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 产线编号 |
| name | String(200) | NOT NULL | 产线名称 |
| workshop_id | Integer | FK | 所属车间 |
| capacity | Float | DEFAULT 0 | 产能（件/日） |
| oee_target | Float | DEFAULT 0.85 | OEE 目标值 |
| status | String(50) | DEFAULT 'running' | running/idle/maintenance |

**Equipment** — 表名: `equipment` | FK: line_id → production_lines.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 设备编号 |
| name | String(200) | NOT NULL | 设备名称 |
| line_id | Integer | FK | 所属产线 |
| model | String(200) | NOT NULL | 设备型号 |
| manufacturer | String(200) | NOT NULL | 制造商 |
| install_date | DateTime | NULLABLE | 安装日期 |
| status | String(50) | DEFAULT 'running' | running/idle/maintenance/fault/offline |
| health_score | Float | DEFAULT 100.0 | 健康评分（0-100） |

### 2.2 传感监测族

**Sensor** — 表名: `sensors` | FK: equipment_id → equipment.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 传感器编号 |
| name | String(200) | NOT NULL | 名称 |
| equipment_id | Integer | FK | 关联设备 |
| sensor_type | String(100) | NOT NULL | temperature/vibration/pressure/current/dimension 等 |
| unit | String(50) | NOT NULL | 单位 |
| sampling_rate | Integer | DEFAULT 60 | 采样间隔（秒） |

**SensorReading** — 表名: `sensor_readings` | FK: sensor_id → sensors.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 读数编号 |
| sensor_id | Integer | FK | 关联传感器 |
| value | Float | NOT NULL | 采集值 |
| timestamp | DateTime | INDEXED | 采集时间 |

> 种子数据最大表，9360 条记录，导入时以 5000 条/批分批写入。

### 2.3 产品族

**Product** — 表名: `products`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 产品编号 |
| name | String(200) | NOT NULL | 产品名称 |
| sku | String(100) | UNIQUE | SKU 编码 |
| category | String(100) | NOT NULL | 产品分类 |
| specs | Text | NULLABLE | 规格参数 |
| unit | String(50) | DEFAULT '个' | 计量单位 |

**Material** — 表名: `materials`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 物料编号 |
| name | String(200) | NOT NULL | 物料名称 |
| material_type | String(100) | NOT NULL | steel/casting/bearing/seal/aluminum/copper/stainless_steel 等 |
| specs | Text | NULLABLE | 规格描述 |
| unit | String(50) | DEFAULT '个' | 计量单位 |
| safety_stock | Float | DEFAULT 0 | 安全库存量 |

**BOM** — 表名: `bom` | FK: product_id → products.id, material_id → materials.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | BOM 编号 |
| product_id | Integer | FK | 成品 |
| material_id | Integer | FK | 原材料 |
| quantity | Float | NOT NULL | 用量 |
| level | Integer | DEFAULT 1 | BOM 层级 |

**ProcessRoute** — 表名: `process_routes` | FK: product_id → products.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 路线编号 |
| product_id | Integer | FK | 产品 |
| step_order | Integer | NOT NULL | 工序顺序 |
| operation | String(200) | NOT NULL | 工序名称 |
| equipment_type | String(200) | NOT NULL | 所需设备类型 |
| cycle_time | Float | NOT NULL | 节拍时间（秒） |

### 2.4 订单族

**SalesOrder** — 表名: `sales_orders` | FK: customer_id → customers.id, product_id → products.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 订单编号 |
| order_no | String(100) | UNIQUE | 订单号 |
| customer_id | Integer | FK | 客户 |
| product_id | Integer | FK | 产品 |
| quantity | Float | NOT NULL | 数量 |
| due_date | DateTime | NOT NULL | 交期 |
| priority | String(50) | DEFAULT 'normal' | low/normal/high/urgent |
| status | String(50) | DEFAULT 'pending' | pending/confirmed/in_progress/completed/cancelled |

**WorkOrder** — 表名: `work_orders` | FK: sales_order_id → sales_orders.id, line_id → production_lines.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 工单编号 |
| order_no | String(100) | UNIQUE | 工单号 |
| sales_order_id | Integer | FK | 关联销售订单 |
| line_id | Integer | FK | 执行产线 |
| planned_start/end | DateTime | NOT NULL | 计划时间 |
| actual_start/end | DateTime | NULLABLE | 实际时间 |
| quantity | Float | NOT NULL | 计划数量 |
| completed_quantity | Float | DEFAULT 0 | 完成数量 |
| status | String(50) | DEFAULT 'pending' | 状态 |

**Operation** — 表名: `operations` | FK: work_order_id → work_orders.id, equipment_id → equipment.id, operator_id → workers.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 工序编号 |
| work_order_id | Integer | FK | 所属工单 |
| step | Integer | NOT NULL | 工序步骤号 |
| equipment_id | Integer | FK | 使用设备 |
| start_time / end_time | DateTime | NULLABLE | 时间 |
| operator_id | Integer | FK | 操作员 |
| result | String(50) | DEFAULT 'pending' | pass/fail/pending |

### 2.5 供应链族

**Supplier** — 表名: `suppliers`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 供应商编号 |
| name | String(200) | NOT NULL | 名称 |
| location | String(500) | NOT NULL | 所在地 |
| rating | Float | DEFAULT 0 | 评级（1.0-5.0） |
| lead_time_days | Integer | DEFAULT 7 | 交货周期（天） |
| contact | String(200) | NULLABLE | 联系方式 |

**Customer** — 表名: `customers`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 客户编号 |
| name | String(200) | NOT NULL | 客户名称 |
| industry | String(200) | NOT NULL | 所属行业 |
| region | String(200) | NOT NULL | 所在区域 |

**Warehouse** — 表名: `warehouses`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 仓库编号 |
| name | String(200) | NOT NULL | 名称 |
| location | String(500) | NOT NULL | 地址 |
| capacity | Float | NOT NULL | 容量 |
| utilization | Float | DEFAULT 0 | 利用率 |

**Inventory** — 表名: `inventory` | FK: material_id → materials.id, warehouse_id → warehouses.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 库存编号 |
| material_id | Integer | FK | 物料 |
| warehouse_id | Integer | FK | 仓库 |
| quantity | Float | DEFAULT 0 | 在库数量 |
| reserved | Float | DEFAULT 0 | 已预留数量 |

> 可用库存 = quantity - reserved

**Shipment** — 表名: `shipments` | FK: origin_id/destination_id → warehouses.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 物流编号 |
| origin_id | Integer | FK | 发出仓库 |
| destination_id | Integer | FK | 目标仓库 |
| status | String(50) | DEFAULT 'pending' | pending/in_transit/delivered/delayed |
| eta | DateTime | NULLABLE | 预计到达 |
| tracking_no | String(200) | NULLABLE | 物流单号 |

### 2.6 质量族

**Inspection** — 表名: `inspections` | FK: inspector_id → workers.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 检验编号 |
| inspection_type | String(50) | NOT NULL | incoming/in_process/final |
| target_type | String(100) | NOT NULL | Material/Equipment/WorkOrder/Product |
| target_id | Integer | NOT NULL | 检验对象 ID |
| result | String(50) | NOT NULL | pass/fail |
| inspector_id | Integer | FK | 检验员 |
| inspected_at | DateTime | NOT NULL | 检验时间 |

**Defect** — 表名: `defects` | FK: inspection_id → inspections.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 缺陷编号 |
| inspection_id | Integer | FK | 关联检验 |
| defect_type | String(200) | NOT NULL | 尺寸超差/表面缺陷/裂纹/变形/硬度不足/毛刺/气孔 等 |
| severity | String(50) | NOT NULL | critical/major/minor |
| description | Text | NULLABLE | 描述 |
| root_cause | Text | NULLABLE | 根因分析 |
| correction | Text | NULLABLE | 纠正措施 |

**SPCPoint** — 表名: `spc_points` | FK: equipment_id → equipment.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 控制点编号 |
| parameter | String(200) | NOT NULL | 监控参数 |
| value | Float | NOT NULL | 实测值 |
| ucl / lcl / cl | Float | NOT NULL | 控制上限/下限/中心线 |
| equipment_id | Integer | FK | 关联设备 |
| timestamp | DateTime | INDEXED | 采集时间 |

> 失控判定: value > ucl 或 value < lcl 时标记为 out_of_control。

**CAPA** — 表名: `capa` | FK: defect_id → defects.id, assignee_id → workers.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | CAPA 编号 |
| defect_id | Integer | FK | 关联缺陷 |
| action_type | String(100) | NOT NULL | corrective/preventive |
| description | Text | NOT NULL | 措施描述 |
| status | String(50) | DEFAULT 'open' | open/in_progress/closed |
| due_date | DateTime | NOT NULL | 截止日期 |
| assignee_id | Integer | FK | 负责人 |

### 2.7 人员

**Worker** — 表名: `workers`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 工人编号 |
| name | String(200) | NOT NULL | 姓名 |
| role | String(100) | NOT NULL | 操作员/检验员/维修工 等 |
| department | String(200) | NULLABLE | 部门 |

### 2.8 管线族

**DataSource** — 表名: `data_sources`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 数据源编号 |
| name | String(200) | NOT NULL | 名称 |
| source_type | String(100) | NOT NULL | mqtt/opc_ua/http/modbus/rest_api |
| connection_config | Text | NOT NULL | 连接配置（JSON） |
| status | String(50) | DEFAULT 'active' | active/inactive/error |
| last_sync | DateTime | NULLABLE | 最后同步时间 |

**Pipeline** — 表名: `pipelines`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 管线编号 |
| name | String(200) | NOT NULL | 管线名称 |
| description | Text | NULLABLE | 描述 |
| config | Text | NOT NULL | 管线配置（JSON，含 extractor/transformer/loader） |
| schedule | String(200) | NULLABLE | 调度规则（cron 表达式） |
| status | String(50) | DEFAULT 'draft' | draft/active/paused/archived |

**PipelineRun** — 表名: `pipeline_runs` | FK: pipeline_id → pipelines.id

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | Integer | PK | 运行编号 |
| pipeline_id | Integer | FK | 关联管线 |
| status | String(50) | DEFAULT 'running' | running/success/failed/cancelled |
| started_at | DateTime | NOT NULL | 开始时间 |
| finished_at | DateTime | NULLABLE | 结束时间 |
| records_processed | Integer | DEFAULT 0 | 处理记录数 |
| error_message | Text | NULLABLE | 错误信息 |

### 2.9 公共 Mixin

所有继承 `TimestampMixin` 的模型自动包含 `created_at` 和 `updated_at` 字段。例外：`SensorReading` 使用独立的 `timestamp` 字段。

### 2.10 外键引用速查

```
factories.id           <- workshops.factory_id
workshops.id           <- production_lines.workshop_id
production_lines.id    <- equipment.line_id, work_orders.line_id
equipment.id           <- sensors.equipment_id, spc_points.equipment_id, operations.equipment_id
sensors.id             <- sensor_readings.sensor_id
customers.id           <- sales_orders.customer_id
products.id            <- sales_orders.product_id, bom.product_id, process_routes.product_id
materials.id           <- bom.material_id, inventory.material_id
sales_orders.id        <- work_orders.sales_order_id
work_orders.id         <- operations.work_order_id
warehouses.id          <- inventory.warehouse_id, shipments.origin_id, shipments.destination_id
inspections.id         <- defects.inspection_id
defects.id             <- capa.defect_id
workers.id             <- operations.operator_id, inspections.inspector_id, capa.assignee_id
pipelines.id           <- pipeline_runs.pipeline_id
```

### 2.11 种子数据

由 `data/simulators/generate_sample_data.py` 生成（`random.seed(42)` 确保可复现），包含 3 个工厂（宁海/苏州/武汉）、8 个车间、15 条产线、65 台设备、195 个传感器、8 种产品、8 种物料等，共 10,399 条记录。

---

## 3. 图数据库模型

ManuFoundry 图数据库使用 Neo4j，通过 `pg_id` 属性与关系数据库记录保持对应。关系数据为主，图节点同步写入。

### 3.1 节点标签（15 种）

| 节点标签 | 中文名 | 关键属性 | 出发关系 |
|----------|--------|----------|----------|
| Factory | 工厂 | name, location, capacity, status | CONTAINS |
| Workshop | 车间 | name, area, workshop_type | CONTAINS |
| ProductionLine | 产线 | name, capacity, oee_target, status | CONTAINS, PRODUCES |
| Equipment | 设备 | name, model, manufacturer, status, health_score | FEEDS |
| Sensor | 传感器 | name, sensor_type, unit, sampling_rate | — |
| Product | 产品 | name, sku, category, specs | REQUIRES |
| Material | 物料 | name, material_type, specs, safety_stock | — |
| Supplier | 供应商 | name, location, rating, lead_time_days | SUPPLIES |
| Customer | 客户 | name, industry, region | — |
| Warehouse | 仓库 | — | STORED_IN, SHIPS_TO |
| Worker | 工人 | name, role, department | ASSIGNED_TO |
| SalesOrder | 销售订单 | — | — |
| WorkOrder | 工单 | — | — |
| Inspection | 检验 | — | — |
| Defect | 缺陷 | — | — |

### 3.2 关系类型（10 种）

| 关系类型 | 起点 → 终点 | 语义 |
|----------|-------------|------|
| CONTAINS | Factory → Workshop → Line → Equipment | 组织层级 |
| PRODUCES | Line → Product | 产线生产的产品 |
| REQUIRES | Product → Material | BOM 物料需求 |
| SUPPLIES | Supplier → Material | 供应商提供的物料 |
| INSPECTS | Inspection → Material/Equipment | 检验关联 |
| MAINTAINS | Worker → Equipment | 维护关系 |
| FEEDS | Equipment → Sensor | 设备挂载的传感器 |
| ASSIGNED_TO | Worker → Equipment/WorkOrder | 人员分配 |
| STORED_IN | Material → Warehouse | 库存位置 |
| SHIPS_TO | Warehouse → Warehouse | 物流流向 |

### 3.3 本体约束（ENTITY_SCHEMAS）

`graph_models.py` 中定义了 `ENTITY_SCHEMAS` 字典，对每种实体类型做严格约束：

- **properties** — 允许的属性、类型、是否必填、中文标签
- **outgoing_relations** — 允许的出发关系类型
- **allowed_targets** — 每种关系允许的目标实体类型

### 3.4 Cypher 查询模板

系统内置 6 个常用模板（定义于 `CYPHER_TEMPLATES`）：create_entity, create_relation, get_neighbors, shortest_path, subgraph, stats。

---

## 4. 与旧文档关系

本文档由以下两份文档合并而成，合并后它们可视为归档文件：

| 旧文档 | 内容 | 合并去向 |
|--------|------|----------|
| `03-制造业本体定义.md` | 本体理念、6 大实体族（22 种实体）完整属性、7 种关系类型、Neo4j 存储方案（标签/索引/Cypher）、时间旅行、权限模型 | 第 1 节「本体定义」 |
| `08-数据模型.md` | 26 个 ORM 模型表结构、Neo4j 图模型（15 种节点 + 10 种关系）、种子数据、ER 关系图 | 第 2 节「关系数据库模型」+ 第 3 节「图数据库模型」 |

**去重处理**：两份文档中重叠的 Neo4j 节点标签、关系类型、Cypher 查询等内容已合并为统一描述，避免重复。本体层面的语义定义（22 种实体的完整属性、7 种关系及其专属属性、时间旅行、权限模型）以 `03` 为主；ORM 表结构、种子数据、外键速查以 `08` 为主。
