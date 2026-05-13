# 18 — 低代码平台架构设计

> **版本**: v1.0 | **日期**: 2026-05-13 | **状态**: 设计中
>
> 本文档定义 ManuFoundry 从"预构建 Demo"向"低代码开发平台"演进的核心架构。

---

## 1. 定位与目标

ManuFoundry 低代码平台的核心目标：**让不会写代码的制造业业务人员，能够自己搭建数据应用。**

```
传统方式：业务提需求 → 开发写代码 → 测试 → 上线（周期：周/月）
低代码方式：业务自己建模 → 拖拽搭页面 → 配置规则 → 即时发布（周期：小时/天）
```

### 1.1 核心能力矩阵

| 能力 | 描述 | 当前状态 |
|------|------|---------|
| 动态建模 | 用户通过界面定义实体、字段、关系 | API 有，前端无 |
| 表单设计 | 拖拽组件生成数据录入/编辑表单 | 未实现 |
| 页面设计 | 拖拽组件混合表单和图表，生成业务页面 | 未实现 |
| 工作流引擎 | 可视化流程编排，审批/流转/条件分支 | API 有，前端无 |
| 规则引擎 | IF-THEN 配置式业务规则 | 未实现 |
| 权限体系 | 角色→权限→资源，字段级、行级控制 | API 有，未启用 |

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户层 (User Layer)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 页面设计器 │  │ 表单设计器 │  │ 流程设计器 │  │ 规则配置器 │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │              │              │              │          │
│       └──────────────┴──────┬───────┴──────────────┘          │
│                             │                                  │
│  ┌──────────────────────────▼─────────────────────────────┐  │
│  │               设计时引擎 (Design-Time Engine)            │  │
│  │  DSL Schema │ 组件注册表 │ 属性面板 │ 撤销/重做 │ 预览   │  │
│  └──────────────────────────┬─────────────────────────────┘  │
│                             │ 保存配置                         │
│  ┌──────────────────────────▼─────────────────────────────┐  │
│  │               运行时引擎 (Runtime Engine)                │  │
│  │  DSL 渲染器 │ 动态路由 │ 数据绑定 │ 事件总线 │ 缓存     │  │
│  └──────────────────────────┬─────────────────────────────┘  │
│                             │                                  │
├─────────────────────────────┼────────────────────────────────┤
│                    服务层 (Service Layer)                     │
│                             │                                  │
│  ┌────────┐  ┌────────┐  ┌──▼───┐  ┌────────┐  ┌────────┐  │
│  │模型服务 │  │表单服务 │  │权限  │  │工作流  │  │规则引擎│  │
│  └───┬────┘  └───┬────┘  │服务  │  │服务    │  └───┬────┘  │
│      │           │       └──┬───┘  └───┬────┘      │       │
│      └───────────┴──────────┴──────────┴───────────┘       │
│                             │                                  │
├─────────────────────────────┼────────────────────────────────┤
│                    数据层 (Data Layer)                        │
│                             │                                  │
│  ┌──────────────┐  ┌───────▼───────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Neo4j      │  │    Redis     │      │
│  │              │  │               │  │              │      │
│  │ · 平台元数据  │  │ · 实体关系图谱 │  │ · 会话缓存   │      │
│  │ · 动态实体数据│  │ · 元模型图谱   │  │ · 查询缓存   │      │
│  │ · 用户/权限   │  │ · 影响分析     │  │ · 事件队列   │      │
│  └──────────────┘  └───────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据存储策略

### 3.1 三库分工

| 数据库 | 职责 | 存什么 |
|--------|------|--------|
| **PostgreSQL** | 结构化数据 + 平台配置 | 用户/权限/审计、模型定义、表单配置、规则配置、动态实体实例 |
| **Neo4j** | 关系图谱 | 实体间关系、元模型关系、影响分析、全链路追溯 |
| **Redis** | 缓存 + 实时 | 会话、查询结果缓存、事件队列、实时推送 |

### 3.2 动态实体数据存储（核心设计）

用户通过界面定义新实体后，数据怎么存？采用**混合方案**：

```sql
-- 模型定义（正规表，存元数据）
CREATE TABLE meta_models (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    icon        VARCHAR(50),
    description TEXT,
    table_name  VARCHAR(100),          -- 对应的动态表名（可选）
    storage_mode VARCHAR(20) DEFAULT 'jsonb',  -- 'jsonb' | 'table'
    status      VARCHAR(20) DEFAULT 'active',
    version     INTEGER DEFAULT 1,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 字段定义（正规表，存元数据）
CREATE TABLE meta_fields (
    id              SERIAL PRIMARY KEY,
    model_id        INTEGER REFERENCES meta_models(id),
    name            VARCHAR(100) NOT NULL,
    display_name    VARCHAR(200),
    field_type      VARCHAR(30) NOT NULL,    -- text/number/date/enum/relation/computed/sub_table
    required        BOOLEAN DEFAULT FALSE,
    unique_field    BOOLEAN DEFAULT FALSE,
    default_value   TEXT,
    sort_order      INTEGER DEFAULT 0,

    -- 关联字段配置（field_type = 'relation' 时使用）
    relation_config JSONB,    -- {target_model_id, relation_type, display_field, cascade_from, cascade_filter}

    -- 计算字段配置（field_type = 'computed' 时使用）
    computed_config JSONB,    -- {formula, dependencies}

    -- 子表配置（field_type = 'sub_table' 时使用）
    sub_table_config JSONB,   -- {target_model_id, relation_field, columns}

    -- 校验配置
    validation      JSONB,    -- {min, max, regex, message}

    version         INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 动态实体数据（JSONB 方案 — 通用灵活）
CREATE TABLE dynamic_data (
    id          SERIAL,
    model_id    INTEGER REFERENCES meta_models(id),
    data        JSONB NOT NULL,           -- 所有字段值存在这里
    created_by  INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, model_id)
);

-- GIN 索引用于 JSONB 字段查询
CREATE INDEX idx_dynamic_data_data ON dynamic_data USING GIN (data);
CREATE INDEX idx_dynamic_data_model ON dynamic_data (model_id);
```

### 3.3 存储模式选择

```
storage_mode = 'jsonb' （默认，适合字段频繁变更的实体）
  → 数据存 dynamic_data 表，字段增删只需改 meta_fields
  → 查询走 GIN 索引，适合中小数据量（< 10万条）

storage_mode = 'table' （适合大数据量、高频查询的实体）
  → 自动 CREATE TABLE dyn_{model_name} (...) 
  → 字段变更通过 ALTER TABLE
  → 适合传感器读数、日志等高频写入场景
```

### 3.4 Neo4j 中的元模型图谱

```cypher
// 每个模型定义为一个节点
(:MetaModel {name: "Equipment", display_name: "设备"})
  -[:HAS_FIELD {required: true}]-> 
    (:MetaField {name: "health_score", type: "float"})

// 模型间关系
(:MetaModel {name: "Equipment"})
  -[:HAS_RELATION {type: "many_to_one"}]->
(:MetaModel {name: "ProductionLine"})

// 实例数据的关系也在图中
(:Equipment {id: 1, name: "回流焊-001"})
  -[:BELONGS_TO]->
(:ProductionLine {id: 1, name: "CNC加工-A线"})
  -[:BELONGS_TO]->
(:Workshop {id: 1, name: "CNC加工车间"})
```

---

## 4. 表单/字段/规则关联设计

### 4.1 核心实体关系

```
meta_models (实体模型)
  │
  ├── 1:N → meta_fields (字段定义)
  │            │
  │            ├── field_type = text/number/date/enum
  │            │     → 普通字段，直接存值
  │            │
  │            ├── field_type = relation (引用)
  │            │     → relation_config: {target_model_id, display_field, cascade_from}
  │            │
  │            ├── field_type = computed (计算)
  │            │     → computed_config: {formula, dependencies}
  │            │
  │            └── field_type = sub_table (主从)
  │                  → sub_table_config: {target_model_id, relation_field}
  │
  ├── 1:N → form_definitions (表单定义)
  │            │
  │            └── 1:N → form_fields (表单字段布局)
  │                        ├── 引用哪个 meta_field
  │                        ├── 用什么 widget (input/select/datepicker/...)
  │                        ├── 布局位置 (row/col/span)
  │                        └── 可见性规则 ID
  │
  ├── 1:N → rules (规则)
  │            ├── validation (校验规则): 保存时检查数据有效性
  │            ├── trigger (触发规则): 数据变更时执行动作
  │            └── visibility (显示规则): 控制字段显示/隐藏
  │
  └── 1:N → workflows (工作流)
               ├── 状态定义
               ├── 审批节点
               └── 条件分支
```

### 4.2 字段关联的四种类型

#### 类型 A：引用（Lookup）

```
设备表单                              产线表单
┌────────────────────┐              ┌────────────────────┐
│ 所属产线: [CNC加工-A线 ▾] ───引用──→│ 名称: CNC加工-A线   │
└────────────────────┘              └────────────────────┘

// meta_fields 表
{
  "name": "line_id",
  "field_type": "relation",
  "relation_config": {
    "target_model_id": 4,
    "relation_type": "many_to_one",
    "display_field": "name",
    "display_template": "{name}（{workshop.name}）"
  }
}
```

#### 类型 B：级联（Cascade）

```
工厂 [▾ 宁海制造中心]     ← 选了宁海
  └→ 车间 [▾ CNC加工车间]   ← 只显示宁海的车间
       └→ 产线 [▾ CNC加工-A线]  ← 只显示CNC车间的产线

// "车间"字段
{
  "field_type": "relation",
  "relation_config": {
    "target_model_id": 3,
    "cascade_from": "factory_id",
    "cascade_filter": "factory_id"
  }
}
```

#### 类型 C：主从（Master-Detail）

```
┌─ 销售订单 ─────────────────────────────────────┐
│ 订单号: SO-2026-0001                             │
│ ┌─ 订单明细 ─────────────────────────────────┐ │
│ │ 产品       │ 数量 │ 单价    │ 小计         │ │
│ │ 电路板-A   │  500 │ ¥28.00  │ ¥14,000     │ │
│ │ [+ 添加明细]                                 │ │
│ └─────────────────────────────────────────────┘ │
│ 合计: ¥14,000                                    │
└──────────────────────────────────────────────────┘

// "订单明细"字段
{
  "field_type": "sub_table",
  "sub_table_config": {
    "target_model_id": 8,
    "relation_field": "order_id",
    "columns": ["product_id", "quantity", "unit_price"],
    "allow_inline_add": true
  }
}
```

#### 类型 D：联动计算（Cross-Form）

```
场景：设备健康分 < 60 → 自动创建维修工单 → 通知维修班组

// rules 表
{
  "rule_type": "trigger",
  "trigger_config": {
    "on": "update",
    "condition": {"field": "health_score", "operator": "lt", "value": 60}
  },
  "action": {
    "type": "create_record",
    "target_model_id": 5,
    "field_mapping": [
      {"target": "equipment_id", "source": "id"},
      {"target": "description", "template": "{name}健康分降至{health_score}"}
    ]
  }
}
```

---

## 5. 表单与仪表盘的关系

### 5.1 统一页面设计器

表单和仪表盘不是两个独立系统，而是同一个**页面设计器**中不同组件的组合：

```
页面设计器 (Page Builder) — 统一的拖拽画布
  │
  ├── 组件库
  │    ├── 数据录入组件（输入框/下拉/日期选择/开关/文件上传...）
  │    ├── 数据展示组件（KPI卡片/折线图/柱状图/饼图/表格...）
  │    ├── 布局组件（标签页/分栏/折叠面板/卡片容器...）
  │    └── 操作组件（按钮/链接/导入导出/流程发起...）
  │
  └── 数据绑定
       ├── 绑定到实体字段（录入组件用）
       └── 绑定到聚合查询（展示组件用）
```

### 5.2 页面配置数据结构

```sql
-- 页面定义
CREATE TABLE page_definitions (
    id          SERIAL PRIMARY KEY,
    model_id    INTEGER REFERENCES meta_models(id),
    name        VARCHAR(100) NOT NULL,
    page_type   VARCHAR(20),  -- 'form' / 'dashboard' / 'mixed'
    layout      JSONB NOT NULL,    -- 页面布局 DSL
    published   BOOLEAN DEFAULT FALSE,
    version     INTEGER DEFAULT 1,
    created_by  INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- layout DSL 示例
{
  "type": "page",
  "children": [
    {
      "type": "row",
      "children": [
        {"type": "kpi_card", "data_source": "count(equipment)", "title": "设备总数"},
        {"type": "kpi_card", "data_source": "avg(equipment.health_score)", "title": "平均健康分"}
      ]
    },
    {
      "type": "form",
      "model_id": 1,
      "mode": "edit",
      "fields": [
        {"field": "name", "widget": "input", "col_span": 6},
        {"field": "status", "widget": "select", "col_span": 3},
        {"field": "line_id", "widget": "relation_picker", "col_span": 3}
      ]
    },
    {
      "type": "chart",
      "chart_type": "line",
      "data_source": "timeseries(sensor_readings, sensor_id={id})",
      "title": "传感器趋势"
    }
  ]
}
```

### 5.3 表单 vs 仪表盘的区别

| 维度 | 表单 | 仪表盘 |
|------|------|--------|
| 方向 | 用户 → 系统（录入） | 系统 → 用户（展示） |
| 数据粒度 | 单条记录 | 聚合/多条 |
| 典型组件 | 输入框、下拉、日期 | 折线图、柱状图、KPI |
| 交互 | 填写→提交→校验 | 查看→筛选→钻取 |

**在统一页面设计器中**：一个"设备详情页"可以同时包含 KPI 卡片（仪表盘）+ 设备信息表单（表单）+ 传感器趋势图（仪表盘），不再区分。

---

## 6. 权限体系

### 6.1 权限模型（RBAC + 扩展）

```
用户 (User)
  └── 属于 → 角色 (Role)
               └── 拥有 → 权限 (Permission)
                            ├── 资源类型: model / form / page / workflow / menu
                            ├── 资源ID: 具体哪个模型/表单/页面
                            └── 操作: create / read / update / delete / design / publish

权限粒度:
  L1 - 菜单级：能否看到这个菜单入口
  L2 - 模型级：能否操作这个实体的数据
  L3 - 字段级：能否看到/编辑某个字段
  L4 - 行级：只能看到自己部门/工厂的数据
```

### 6.2 数据隔离策略

```sql
-- 行级隔离配置（存在模型定义上）
ALTER TABLE meta_models ADD COLUMN row_level_rule JSONB;

-- 示例：设备实体，按工厂隔离
{
  "isolation_field": "factory_id",
  "user_field": "factory_ids",   -- 用户属性中的字段
  "description": "用户只能看到自己所属工厂的设备数据"
}
```

### 6.3 字段级权限

```sql
-- 字段权限配置
CREATE TABLE field_permissions (
    id          SERIAL PRIMARY KEY,
    role_id     INTEGER REFERENCES roles(id),
    field_id    INTEGER REFERENCES meta_fields(id),
    can_read    BOOLEAN DEFAULT TRUE,
    can_write   BOOLEAN DEFAULT FALSE
);
```

---

## 7. 安全

### 7.1 动态查询安全

低代码平台的用户通过界面构造查询条件，后端必须防止注入：

```python
# 白名单校验（model-driven 模块已有）
ALLOWED_OPERATORS = {"eq", "ne", "gt", "lt", "gte", "lte", "in", "like", "between"}
ALLOWED_FIELD_TYPES = {"text", "number", "date", "enum", "boolean"}

def validate_query(model_id: int, filters: dict):
    """校验动态查询参数"""
    fields = get_model_fields(model_id)
    field_map = {f.name: f for f in fields}
    
    for field_name, condition in filters.items():
        if field_name not in field_map:
            raise ValueError(f"Unknown field: {field_name}")
        if condition["op"] not in ALLOWED_OPERATORS:
            raise ValueError(f"Disallowed operator: {condition['op']}")
```

### 7.2 Cypher 注入防御

```python
# Neo4j 查询必须参数化，禁止字符串拼接
# 正确 ✓
result = await session.run(
    "MATCH (n:`$label` {id: $id}) RETURN n",
    label=label, id=entity_id
)
# 错误 ✗
result = await session.run(
    f"MATCH (n:`{label}` {{id: {entity_id}}}) RETURN n"
)
```

### 7.3 安全清单

| 项目 | 状态 | 备注 |
|------|------|------|
| JWT 鉴权 | 已有 | FastAPI + python-jose |
| CORS | 已有 | 白名单模式 |
| SQL 注入防御 | 已有 | SQLAlchemy 参数化 |
| Cypher 注入防御 | 已有 | neo4j driver 参数化 |
| 动态查询白名单 | 已有 | model-driven 模块 |
| HTTPS | 待做 | 需配置 Nginx SSL |
| 速率限制 | 待做 | API 网关层 |
| 字段级加密 | 待做 | 敏感字段（密码、薪资等） |

---

## 8. 版本与变更管理

### 8.1 模型版本

```
meta_models.version: 每次字段变更 +1
meta_fields.version: 每次属性变更 +1

变更流程:
  1. 用户编辑模型 → 创建新版本草稿
  2. 系统检测影响范围（哪些表单/规则/报表在使用）
  3. 用户确认 → 发布新版本
  4. 旧版本保留，可回滚
```

### 8.2 影响检测

```python
def detect_impact(model_id: int, field_id: int, change_type: str):
    """检测字段变更的影响范围"""
    impact = {
        "forms": [],       # 哪些表单引用了这个字段
        "rules": [],       # 哪些规则依赖了这个字段
        "pages": [],       # 哪些页面绑定了这个字段
        "workflows": [],   # 哪些工作流用到了这个字段
        "data_migration": False  # 是否需要数据迁移
    }
    
    # 字段类型变更需要数据迁移
    if change_type == "type_change":
        impact["data_migration"] = True
    
    return impact
```

### 8.3 配置导入导出

```json
// 导出格式
{
  "version": "1.0",
  "export_time": "2026-05-13T10:00:00Z",
  "models": [...],
  "fields": [...],
  "forms": [...],
  "rules": [...],
  "pages": [...],
  "workflows": [...],
  "menus": [...]
}
```

---

## 9. 易被忽视但必要的功能

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 撤销/重做 | 表单/页面设计器中的 Ctrl+Z/Y | P1 |
| 复制模板 | 从已有实体/表单复制，改一改就是新的 | P1 |
| 回收站 | 误删的模型/数据可恢复（软删除 + 30天清理） | P1 |
| 批量导入 | Excel/CSV 导入数据，异步处理 + 进度条 | P2 |
| 全文搜索 | 跨实体搜索（搜"回流焊"→ 设备+工单+维修记录） | P2 |
| 错误提示 | 配置错误时精确告知哪个字段/哪条规则有问题 | P1 |
| 操作引导 | 新用户引导教程（Tooltips / 步骤指引） | P3 |
| 移动端适配 | 表单/列表在手机上可用 | P3 |
| WebSocket 推送 | 仪表盘实时刷新、工单状态实时通知 | P2 |
| 审计日志 | 谁/什么时候/改了什么/从什么值改成什么值 | P0 |
| 通知系统 | 站内信 + 企业微信/钉钉推送 | P2 |
| 文件存储 | 附件、图片上传与管理 | P1 |

---

## 10. 开发路线图

### Phase 1 — 地基（P0）

> 目标：用户能通过界面定义实体 → 自动获得 CRUD API → 前端能增删改查

| 任务 | 后端 | 前端 | 依赖 |
|------|------|------|------|
| 确定数据存储策略（方案C） | ✅ 本文档已定义 | - | 无 |
| meta_models/meta_fields CRUD | 完善 model-driven API | 模型管理页面 | 无 |
| 动态建表 / JSONB 存储引擎 | dynamic_data CRUD API | - | 模型定义 |
| 模型→Neo4j 同步 | 模型变更时自动更新图节点 | - | Neo4j |
| RBAC 权限激活 | 启用现有 auth/admin API | 登录/角色管理 | 无 |
| 审计日志 | 记录所有 CRUD 操作 | - | 权限体系 |
| 种子数据修复 | 日期格式问题 | - | 动态存储 |

### Phase 2 — 骨架（P1）

> 目标：用户能拖拽生成表单，配置字段关联，生成业务页面

| 任务 | 后端 | 前端 | 依赖 |
|------|------|------|------|
| 组件注册表 | 定义 widget 类型清单 | 基础组件库实现 | Phase 1 |
| 表单设计器 | form_definitions CRUD | 拖拽画布 + 属性面板 | 组件库 |
| 引用/级联组件 | relation 字段查询 API | 下拉联动渲染 | 表单设计器 |
| 主从子表 | sub_table CRUD API | 行内编辑表格 | 表单设计器 |
| 页面设计器 | page_definitions CRUD | 混合拖拽画布 | 表单设计器 |
| 动态路由 | 根据页面配置生成路由 | 动态路由渲染 | 页面定义 |
| 导航菜单配置 | menus CRUD | 动态侧边栏 | 页面定义 |

### Phase 3 — 血肉（P2）

> 目标：业务逻辑可配置，工作流可执行

| 任务 | 后端 | 前端 | 依赖 |
|------|------|------|------|
| 校验规则引擎 | rules CRUD + 执行 | 规则配置界面 | Phase 2 |
| 触发规则引擎 | 事件监听 + 动作执行 | 触发器配置 | 规则引擎 |
| 工作流引擎打通 | workflow 执行引擎 | 流程设计器（BPMN） | Phase 2 |
| 通知系统 | 站内信 + 推送 | 通知中心 | 工作流 |
| 图表绑定 | 聚合查询 API | 图表组件数据绑定 | 页面设计器 |
| 版本管理 | 模型版本 + 影响检测 | 版本对比界面 | Phase 2 |

### Phase 4 — 皮肤（P3）

> 目标：模板市场、移动端、高级功能

| 任务 | 说明 |
|------|------|
| 模板市场 | 预置制造业模板（设备管理、质检流程、供应商管理） |
| 移动端适配 | 表单/列表在手机上可用 |
| 配置导入导出 | 开发环境→生产环境一键迁移 |
| 全文搜索 | 跨实体搜索 |
| AI 增强 | 自然语言生成页面/表单建议 |
| 定时任务 | 周期性报表、数据同步 |

---

## 11. 与现有文档的关系

| 本文档章节 | 对应现有文档 | 关系 |
|-----------|-------------|------|
| §3 数据存储 | 08-数据模型 | 08 描述当前 schema，本文档描述新增的 meta_* 表 |
| §4 字段关联 | 03-制造业本体定义 | 03 描述业务本体，本文档描述平台元模型 |
| §5 页面设计器 | 01-产品规格 §6 | 01 已有低代码能力概述，本文档给出完整设计 |
| §6 权限 | 14-安全与鉴权 | 14 描述现有安全，本文档新增字段级/行级权限 |
| §7 安全 | 14-安全与鉴权 | 14 已覆盖基础安全，本文档补充动态查询安全 |
| §10 路线图 | 01-产品规格 Phase 路线图 | 01 的路线图以 Demo 为目标，本文档以低代码平台为目标 |

---

## 附录 A：术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 实体模型 | Entity Model / MetaModel | 用户定义的数据实体（如"设备""工单"） |
| 字段定义 | Field Definition / MetaField | 实体模型的属性（如"名称""状态""健康分"） |
| 表单定义 | Form Definition | 字段的 UI 布局配置 |
| 页面定义 | Page Definition | 表单 + 图表的混合布局配置 |
| 规则 | Rule | 校验/触发/显示规则 |
| 工作流 | Workflow | 审批/流转的业务流程 |
| 组件 | Widget / Component | 前端可拖拽的 UI 单元 |
| 数据绑定 | Data Binding | 组件与数据源的关联 |
| DSL | Domain Specific Language | 页面/表单的结构化描述语言 |
| RBAC | Role-Based Access Control | 基于角色的访问控制 |
