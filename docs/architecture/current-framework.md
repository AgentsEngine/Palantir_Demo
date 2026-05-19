# ManuFoundry 当前代码框架说明

> 更新时间：2026-05-19  
> 状态：浅色 Foundry 工作台 UI 已接入，应用切换和系统管理装配为前端 Demo 闭环；应用基础模型已有后端 API，装配细节下一阶段落库。

## 1. 当前产品形态

ManuFoundry 现在被设计为一个面向制造业的低代码分析平台。普通用户通过顶部应用下拉切换业务工作包，左侧菜单展示当前应用下的页面入口；管理员通过系统管理维护应用、表单、菜单、本体、数据资产、用户和角色。

当前前端主结构是：

```text
登录页
  -> 工作台 /
  -> 顶部应用切换
  -> 左侧菜单：我的工作台 + 当前应用菜单结构
  -> 中央页面：标题栏 + 操作按钮 + 业务展示区
  -> 右下角 AI 浮动入口
```

系统管理当前包含：

```text
系统管理
  -> 应用与菜单
     -> 应用管理
     -> 表单管理
     -> 应用装配
  -> 数据资产与本体
  -> 用户管理
  -> 角色权限
```

## 2. 核心概念

### 2.1 应用

应用是一个业务工作包，不是单个页面。一个应用包含：

- 应用名称、编码、图标、描述
- 默认入口
- 可见角色
- 菜单结构
- 可用表单集合

示例应用：

- 生产态势
- 预测性维护
- 质量分析
- 供应链风险

### 2.2 表单

表单是低代码平台中的业务对象页面配置单元。它不是菜单，也不是数据库表本身，而是后续会绑定到本体对象和字段配置。

示例表单：

- 生产总览表单
- 产线状态表单
- 设备健康表单
- 故障预测表单
- 维修工单表单
- 告警中心表单
- 质量事件表单
- 检验批次表单
- 供应商风险表单
- 物料影响表单

### 2.3 菜单结构

菜单结构是应用内的导航组织方式。它负责“用户怎么看到入口”，不直接等于应用和表单关系。

菜单节点分两类：

- 分组节点：只用于组织层级，不绑定表单。
- 表单节点：绑定一个表单，作为业务页面入口。

当前规则：

- 拖拽表单到菜单结构，会把表单加入当前应用菜单。
- 如果表单尚未绑定当前应用，会同步建立应用和表单关系。
- 删除表单菜单节点，会移除这个菜单入口。
- 如果该表单在当前应用里没有其他菜单入口，会同步解除应用和表单绑定。
- 删除分组节点，不删除子表单，子节点会提升到同级，避免误删配置。

### 2.4 应用、表单、菜单三者关系

当前设计关系如下：

```text
Application N:N Form
Application 1:N MenuNode
MenuNode 0/1:1 Form
MenuNode 1:N MenuNode
```

含义：

- 一个应用可以包含多个表单。
- 一个表单可以被多个应用复用。
- 一个应用有自己的菜单树。
- 菜单树可以用分组组织表单入口。
- 同一个表单可以在同一应用中有多个菜单入口，但默认交互会避免重复添加。

## 3. 当前代码结构

```text
frontend/src/
  App.tsx                         # 全局外壳、顶部应用切换、左侧菜单、路由
  main.tsx                        # Ant Design 主题入口
  index.css                       # Foundry 风格全局样式
  services/api.ts                 # Axios API 封装
  config/menus.ts                 # 业务菜单和面包屑配置
  pages/
    Login/                        # 登录页
    Workspace/                    # 我的工作台
    Dashboard/                    # 生产态势
    Maintenance/                  # 预测性维护
    Quality/                      # 质量分析
    SupplyChain/                  # 供应链风险
    SystemAdmin/
      index.tsx                   # 系统管理 Tab 入口
      AppMenuManagement.tsx       # 应用、表单、菜单装配
      SemanticAssetCenter.tsx     # 数据资产与本体
      UserManagement.tsx          # 用户管理
      RoleManagement.tsx          # 角色权限
    ModelDriven/                  # 模型驱动/低代码配置原型
    DynamicPage/                  # 动态页面运行时原型
    ReportCenter/                 # 报表中心
    RuleEngine/                   # 规则引擎
    Workflow/                     # 流程中心与我的应用目录
```

```text
backend/app/
  main.py                         # FastAPI 入口和 router 注册
  database.py                     # 数据库连接和初始化
  models/relational.py            # SQLAlchemy 关系模型
  models/graph_models.py          # 图谱和本体模型定义
  api/
    applications.py               # 应用 API 与管理端应用 API
    admin.py                      # 用户、角色、权限管理
    semantic_assets.py            # 数据资产与本体 API
    model_driven_meta.py          # 元模型、字段、页面配置
    model_driven_menus.py         # 菜单 CRUD
    model_driven_data.py          # 动态数据 CRUD
    model_driven.py               # 模型驱动聚合 router
    data_sources.py               # 数据源管理
    ontology.py                   # 本体管理
    graph.py                      # 图谱查询
    workflow.py                   # 流程
    rules.py                      # 规则
    reports.py                    # 报表
```

## 4. 数据当前在哪里

当前数据分三类：

| 数据类型 | 当前状态 | 说明 |
| --- | --- | --- |
| 用户、角色 | 后端 API + mock fallback | 用户和角色管理已有后端接口。 |
| 应用基础信息 | 后端 API + mock fallback | `applications`、`application_menus`、`application_roles` 已有基础模型和接口。 |
| 系统管理应用装配页中的表单、菜单树、应用-表单关系 | 前端 Demo state | 当前在 `AppMenuManagement.tsx` 内维护，刷新后回到初始演示状态。 |
| 数据资产与本体 | 后端 API + 前端展示 | 目前用于产品结构演示，后续需要和表单配置强绑定。 |
| 业务页面指标数据 | 后端业务 API + mock fallback | Dashboard、Maintenance、Quality、SupplyChain 等页面仍以演示数据为主。 |

## 5. 下一阶段数据库落库计划

下一阶段建议优先让“应用装配”真正保存到数据库，目标是刷新不丢、不同用户看到授权后的应用和菜单。

第一阶段落库表：

```text
applications
forms
application_forms
application_menu_nodes
application_roles
```

建议字段：

```text
forms
  id
  name
  code
  ontology_object_id
  status
  owner
  description
  field_count
  created_at
  updated_at

application_forms
  id
  application_id
  form_id
  alias
  enabled
  default_view
  data_scope
  allow_create
  allow_edit
  allow_export
  sort_order

application_menu_nodes
  id
  application_id
  parent_id
  node_type            # group | form
  title
  icon
  form_id
  route_path
  visible
  default_entry
  sort_order
```

第二阶段再落页面配置：

```text
form_fields
form_query_filters
form_actions
form_layouts
form_permissions
workflow_bindings
```

第三阶段接入本体与图谱：

```text
ontology_objects
ontology_fields
ontology_relations
form_ontology_bindings
graph_relation_mappings
```

## 6. 重要实现边界

当前版本已经完成的是 UI 和产品交互闭环，不代表所有配置已经持久化。

已完成：

- 浅色 Foundry 工作台 UI
- 顶部应用切换
- 当前应用下左侧菜单展示
- 系统管理的应用、表单、菜单装配交互
- 表单拖拽到菜单结构
- 菜单分组
- 菜单节点删除、表单解绑、分组子节点上移
- 数据资产与本体中心的产品结构入口

待落库：

- 表单主数据
- 应用与表单 N:N 绑定
- 应用菜单树
- 菜单分组层级
- 表单字段、按钮、查询条件、权限、流程动作
- 本体对象到表单字段的映射

## 7. 推荐开发顺序

1. 固化数据库模型：`forms`、`application_forms`、`application_menu_nodes`。
2. 新增 Alembic 迁移和 seed 数据。
3. 新增后端 API：读取/保存应用装配。
4. 前端 `AppMenuManagement.tsx` 从静态 state 改为 API 加载和保存。
5. App 左侧菜单从后端菜单树读取完整分组结构。
6. 表单设置页接入本体对象和字段配置。
7. 流程设置、权限设置接入表单动作和角色权限。
8. 图谱探索从本体对象和关系自动生成。
