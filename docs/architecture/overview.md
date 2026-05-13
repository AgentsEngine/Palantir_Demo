# ManuFoundry 架构总览

> **文档版本**: v1.0
> **日期**: 2026-05-13
> **状态**: 当前实现基线
> **作用**: 合并设计原则（原 02）与实现快照（原 11），作为架构理解与后续重构的唯一入口。

---

## 目录

1. [产品定位](#1-产品定位)
2. [设计哲学与原则](#2-设计哲学与原则)
3. [五层架构](#3-五层架构)
4. [仓库目录树](#4-仓库目录树)
5. [模块依赖拓扑](#5-模块依赖拓扑)
6. [运行时数据流](#6-运行时数据流)
7. [部署形态](#7-部署形态)
8. [关键设计取舍](#8-关键设计取舍)
9. [与旧文档关系](#9-与旧文档关系)

---

## 1. 产品定位

### 1.1 一句话定义

**ManuFoundry -- 制造业的数据操作系统。**

### 1.2 核心定位

对标 Palantir Foundry 在政府/金融领域的统一数据平台角色，ManuFoundry 聚焦离散制造与流程制造行业，解决制造业核心矛盾：产线数据（PLC 传感器、MES 工单、ERP 订单、SCADA 报警、QMS 质检）分散在不同系统中形成"数据烟囱"。

ManuFoundry 的使命是打通数据壁垒，让数据在制造全价值链中流动，驱动从"经验决策"到"数据决策"的转变。

**它不是又一个 MES，不是又一个 BI。** ManuFoundry 不替换现有系统，而是在 ERP/MES/SCADA/QMS 之上构建统一语义层，将异构数据汇聚为一致的制造知识图谱。

### 1.3 产品原则

1. **数据不动，计算动** -- 支持在数据所在位置（边缘端/工厂内）执行计算，仅将聚合结果上云
2. **语义层统一** -- 所有数据源映射到统一制造语义模型（设备模型、工艺模型、物料模型）
3. **场景驱动** -- 每个功能模块对应一个可衡量的业务场景，而非功能堆叠
4. **渐进式部署** -- 从单场景切入，逐步扩展，不要求一次性全厂上线
5. **开放可扩展** -- 提供标准 API 和插件机制，允许第三方和客户自定义扩展

### 1.4 技术栈全景

| 层级 | 技术选型 |
|------|----------|
| 前端 | React 18 + TypeScript 5 + Vite 5 + Ant Design Pro + Zustand |
| 可视化 | ECharts（指标图表） / Cytoscape.js（图谱） / ReactFlow（流程图） |
| 后端 | FastAPI + Uvicorn + Python 3.11+ / SQLAlchemy 2.0 / Celery + Redis |
| 关系库 | PostgreSQL 15 |
| 时序库 | TimescaleDB（PG 扩展） |
| 图数据库 | Neo4j 5.x |
| 缓存 | Redis 7.x |
| AI/ML | scikit-learn / Prophet / LangChain / HuggingFace |
| DevOps | Docker Compose / GitHub Actions / Prometheus + Grafana |

---

## 2. 设计哲学与原则

### 2.1 对标 Palantir 五层分层

ManuFoundry 的架构直接对标 Palantir Foundry 的五层分层架构。Palantir 的核心壁垒不在于某一层的单点技术，而在于五层之间的**垂直整合** -- 数据从接入到决策的完整链路被一套统一的语义模型（Ontology）贯穿。ManuFoundry 将这一理念移植到制造业场景，每一层针对工厂数据特征做了专门适配。

### 2.2 单向依赖原则

五层架构遵循严格的**单向依赖**：上层可以依赖下层，下层绝不感知上层。这保证任意层的替换或升级不会引发连锁反应。

具体约束：
- L5 Workflow 仅依赖 L4 的分析结果，不直接查库
- L4 AI/Analytics 模型输入必须经过 L3 本体映射
- L2 Data Integration 数据落地必须经过 L3 映射，禁止直写
- L1 Infrastructure 无状态服务，数据全部持久化到卷

### 2.3 Ontology 是核心护城河

Palantir 的 Ontology 层是其在数据平台领域最难以复制的能力。它不是简单的数据字典或 ORM 映射，而是将业务语义直接嵌入数据层的**活文档**：

- **实体定义** -- 将"设备""工单""批次"等制造业概念建模为一等公民
- **关系建模** -- 设备上下游依赖、工单与批次关联在图谱中显式表达
- **虚拟属性** -- 原始数据上叠加计算逻辑（如"设备健康度 = f(温度, 振动, 历史故障)"）
- **动作函数** -- Ontology 上注册操作（如"下发维修工单"），将分析直接闭环到执行
- **权限绑定** -- 粒度精确到实体类型 + 关系类型，而非粗粒度的表级权限

上层无需关心数据来自 MES 还是 ERP，只要 Ontology 层正确映射，一切实体都以统一的制造业语言存在。

---

## 3. 五层架构

### 3.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 5: Workflow                            │
│              人机协同决策界面 (Human-in-the-Loop)                │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│    │ 决策看板  │  │ 工单调度  │  │ 异常审批  │  │ 报表中心  │     │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                  Layer 4: AI / Analytics                        │
│                  智能分析引擎                                    │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│    │ 预测维护  │  │ 质量分析  │  │ 根因诊断  │  │ LLM 助手  │     │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                Layer 3: Ontology  ★ 核心护城河                   │
│                制造业语义层                                       │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  实体定义 │ 关系建模 │ 权限绑定 │ 虚拟属性 │ 动作函数  │    │
│    └──────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│               Layer 2: Data Integration                         │
│               多源数据接入与管线                                  │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│    │ 连接器   │  │ 管线引擎  │  │ 数据清洗  │  │ 本体映射  │     │
│    │ Registry │  │ Pipeline │  │ Transform │  │ Mapper  │     │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
├─────────────────────────────────────────────────────────────────┤
│                Layer 1: Infrastructure                          │
│                容器化基础设施                                     │
│    ┌──────────────────────────────────────────────────────┐    │
│    │  Docker │ PostgreSQL │ Neo4j │ Redis │ TimescaleDB   │    │
│    └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 各层职责与边界

| 层级 | 名称 | 核心职责 | 对外暴露方式 | 关键设计约束 |
|------|------|----------|-------------|-------------|
| L5 | Workflow | 将分析结果转化为可操作的人机决策流程 | React 前端 + WebSocket 推送 | 仅依赖 L4 分析结果，不直接查库 |
| L4 | AI/Analytics | 基于本体模型进行预测、诊断、优化 | REST API + 事件订阅 | 模型输入必须经过 L3 本体映射 |
| L3 | Ontology | 统一定义制造业实体、关系、动作的语义模型 | SDK + GraphQL | 唯一数据语义真相源 (SSOT) |
| L2 | Data Integration | 从异构系统抽取数据，清洗后写入本体结构 | 连接器 SPI + 管线 DSL | 数据落地必须经过 L3 映射，禁止直写 |
| L1 | Infrastructure | 提供计算、存储、网络的容器化运行环境 | 服务端口 + 卷挂载 | 无状态服务，数据全部持久化到卷 |

### 3.3 实现映射（设计层 vs 代码层）

| 设计层 | 代码模块 |
|--------|----------|
| L5 Workflow | `frontend/src/pages/` (Dashboard/Workflow/ReportCenter) + `app/api/workflow.py` |
| L4 AI/Analytics | `app/services/analytics/` + `app/api/analytics.py` / `maintenance.py` / `quality.py` |
| L3 Ontology | `app/models/graph_models.py` (NodeLabel/RelType/ENTITY_SCHEMAS) + `app/models/relational.py` + `app/api/ontology.py` + `app/api/model_driven*.py` |
| L2 Data Integration | `app/services/data_integration/` (pipeline_engine + connectors) + `app/api/pipeline.py` |
| L1 Infrastructure | Docker Compose / PostgreSQL / Neo4j / Redis + `app/database.py` + `app/core/` |

---

## 4. 仓库目录树

```
Palantir_Demo/
├── backend/
│   ├── app/
│   │   ├── core/                    # 横切关注点
│   │   │   ├── logging.py           # setup_logging / get_logger
│   │   │   ├── security.py          # JWT 编解码 + 密码哈希
│   │   │   └── db.py                # db_session() ctx + safe_db_call() 兼容层
│   │   │
│   │   ├── api/                     # FastAPI 路由
│   │   │   ├── deps.py              # get_current_user / get_db / require_admin
│   │   │   ├── auth.py              # /auth/login /logout /me
│   │   │   ├── admin.py             # 用户/角色 CRUD
│   │   │   ├── workflow.py          # 审批流程
│   │   │   ├── data_sources.py      # 数据源管理
│   │   │   ├── ontology.py          # 本体实体/关系
│   │   │   ├── graph.py             # Cypher 查询（白名单 + 只读校验）
│   │   │   ├── pipeline.py          # 数据管线
│   │   │   ├── analytics.py         # 分析聚合
│   │   │   ├── maintenance.py       # 预测性维护
│   │   │   ├── quality.py           # SPC / 缺陷
│   │   │   ├── supply_chain.py      # 供应链
│   │   │   ├── ai_assistant.py      # AI 助手
│   │   │   ├── dashboard.py         # 运营总览
│   │   │   ├── reports.py           # 报表中心
│   │   │   ├── _model_driven_shared.py    # 模型驱动共享原语
│   │   │   ├── model_driven_meta.py       # 元模型 + 页面配置
│   │   │   ├── model_driven_data.py       # 动态数据 CRUD
│   │   │   ├── model_driven_menus.py      # 菜单 CRUD
│   │   │   └── model_driven.py            # 上述三个的聚合 router
│   │   │
│   │   ├── models/                  # ORM + 图模型
│   │   │   ├── relational.py        # SQLAlchemy 2.0 typed ORM (>40 实体)
│   │   │   └── graph_models.py      # NodeLabel / RelType / ENTITY_SCHEMAS / CYPHER_TEMPLATES
│   │   │
│   │   ├── services/                # 业务/集成 service
│   │   │   ├── graph_service.py
│   │   │   ├── analytics/
│   │   │   │   ├── predictive_maintenance.py
│   │   │   │   └── supply_optimizer.py
│   │   │   └── data_integration/
│   │   │       ├── pipeline_engine.py
│   │   │       └── connectors/mes_simulator.py
│   │   │
│   │   ├── schemas/                 # 预留：Pydantic 契约
│   │   ├── config.py                # Settings (BaseSettings)
│   │   ├── database.py              # PG/SQLite 引擎选择 + Neo4j driver + init_db
│   │   └── main.py                  # FastAPI app + lifespan + CORS + exception handler
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/0001_initial.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_security.py
│   │   ├── test_graph_cypher_safety.py
│   │   ├── test_model_driven_safety.py
│   │   └── test_logging_setup.py
│   ├── requirements.txt
│   ├── Dockerfile                   # 生产
│   └── Dockerfile.dev               # 开发
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                 # 入口 + Antd Provider + BrowserRouter
│   │   ├── App.tsx                  # 布局 + 路由 + 通知/搜索
│   │   ├── config/menus.ts          # 业务菜单/角色映射/面包屑
│   │   ├── services/api.ts          # axios 实例 + 拦截器（Bearer + 401）
│   │   ├── stores/authStore.ts      # zustand 鉴权 store
│   │   ├── components/              # 公共组件
│   │   │   ├── GlobalSearch/
│   │   │   ├── DragCanvas/
│   │   │   ├── ConfigPanel/
│   │   │   ├── ComponentPanel/
│   │   │   └── ReportWidgets/       # 8 类 widget + Wrapper + Registry
│   │   └── pages/                   # 业务页面
│   │       ├── Dashboard / Maintenance / Quality / SupplyChain
│   │       ├── AIAssistant / ReportCenter / Pipeline / Ontology
│   │       ├── DataSource / GraphExplorer / ModelDriven / DynamicPage
│   │       ├── SystemAdmin / Workflow / Login
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.conf
│   ├── Dockerfile                   # 生产 (nginx)
│   └── Dockerfile.dev               # 开发 (vite)
│
├── docker/
│   ├── docker-compose.yml           # 默认 dev（HMR + reload）
│   └── docker-compose.prod.yml      # 生产 overlay
│
├── data/
│   ├── seed/                        # 15 份 JSON 种子数据
│   └── simulators/generate_sample_data.py
│
├── scripts/
│   └── seed_data.py
│
└── docs/
    ├── 01-产品规格说明书.md
    ├── 03-制造业本体定义.md
    ├── architecture/
    │   ├── overview.md              ← 本文件
    │   └── low-code-platform.md
    ├── business/
    ├── development/
    ├── operations/
    └── archive/
```

---

## 5. 模块依赖拓扑

backend 内部关键依赖边：

```
                        app.config.Settings
                               ▲
                               │ (env)
               ┌───────────────┼───────────────────┐
               │               │                   │
        app.core.logging  app.core.security   app.database
               ▲               ▲                   ▲
               │               │                   │
               └──── app.core.db ──────────────────┘
                         ▲
                         │ db_session / safe_db_call
                         │
                 app.api.deps
                         ▲
                         │ Depends(get_current_user) / Depends(get_db)
            ┌────────────┼────────────────────────┐
            │            │                        │
      app.api.auth  app.api.<biz>    app.api.model_driven
                        │                  │
                        │          ┌───────┴───────┐
                        │          │               │
                        │   _model_driven_shared  model_driven_meta
                        ▼          │               │
                   app.models.*    │          model_driven_data
                                 └── safe_db_call ┘
```

核心规则：

- `app.core.*` 是叶子模块，**不允许反向依赖** `app.api` / `app.services` / `app.models`
- `app.api.deps.get_db` 透过 `app.core.db.db_session` 提供 `AsyncSession`，是受保护路由的唯一 DB 注入入口
- 所有 router 通过 `safe_db_call` 共用同一个错误处理管道（log + None fallback）
- `model_driven` 四文件结构：`_shared` 提供共享原语，`meta/data/menus` 各挂子 router，`model_driven.py` 聚合暴露单一 `router`

---

## 6. 运行时数据流

以「前端加载 `/dashboard/overview`」为例：

```
┌─ Browser
│   1. page mount -> api.getOverview()
│   2. axios request interceptor 注入 Authorization: Bearer <token>
└──┬────────────────────────────────────────────────────────────
   │ HTTPS / Vite proxy / nginx
   ▼
┌─ FastAPI (main.py)
│   3. CORSMiddleware -> Authorization 通过
│   4. Route 匹配 /api/v1/dashboard/overview
│   5. Depends(get_current_user) 解码 JWT
│   6. Depends(get_db) 通过 db_session() 拿 AsyncSession
└──┬────────────────────────────────────────────────────────────
   │
   ▼
┌─ Router 业务函数 (dashboard.py)
│   7. await safe_db_call(query)
│      ├─ try: 真实 PG 查询
│      └─ except: log warning + return None -> fallback to mock
│   8. 返回 JSON
└──┬────────────────────────────────────────────────────────────
   │
   ▼
┌─ Browser
│   9. axios response 解析 res.data
│  10. 渲染 ECharts / Antd Statistic / Table
└──────────────────────────────────────────────────────────────
```

未捕获异常由 `main.unhandled_exception_handler` 兜底，统一返回 `500 + {detail, type}`，避免 stacktrace 外泄。

---

## 7. 部署形态

| 形态 | 命令 | 说明 |
|------|------|------|
| **Local dev** | `uvicorn app.main:app --reload` + `npm run dev` | SQLite fallback，最快 onboarding 路径 |
| **Docker dev** | `docker compose -f docker/docker-compose.yml up -d` | PG/Neo4j/Redis 完整栈 + 后端 reload + 前端 HMR |
| **Docker prod** | `docker compose -f docker/...yml -f docker/...prod.yml up -d --build` | 后端去掉 reload，前端 nginx 静态 dist；强制 401 |
| **K8s** | TBD | 当前未提供 helm chart |

详见 `15-部署与运行.md`。

---

## 8. 关键设计取舍

### 8.1 SQLite + PostgreSQL 双引擎

`app/database.py` 在 import 时优先创建 PG 引擎；若 `asyncpg` 缺失则回退到 SQLite + aiosqlite，让 demo 可在零依赖环境跑通。代价是 `init_db()` 仅 SQLite 模式建表，PG 必须走 Alembic。

### 8.2 所有 router 的 _try_db + mock fallback

Demo 项目的显式取舍：让前端在 PG/Neo4j 都未就绪时仍能展示完整 UI。代价是错误被吞为 `warning` 级别 log。生产部署应对关键业务接口（auth、admin）改为直接抛 5xx。

### 8.3 model_driven 拆四文件

三类职责（meta / data / menus）修改频率与作者域不同；动态 SQL CRUD 是高安全风险点，独立成 `model_driven_data.py` 便于审计；共享原语通过 `_model_driven_shared` 收敛避免重复。

### 8.4 前端用 Zustand 而非 Redux

仅需鉴权一处全局状态，Zustand 体积更小（~1KB）；业务页面间无共享数据流，`useState` + `useMemo` 已足够。

---

## 9. 与旧文档关系

本文档合并了以下两份旧文档的核心内容，合并后旧文档可归档：

| 旧文档 | 合并内容 | 处置 |
|--------|----------|------|
| `02-技术架构设计.md` | 设计哲学、五层架构图、各层职责边界、Ontology 护城河说明 | 设计原则已合并至第 2-3 节，技术栈表已精简至第 1.3 节 |
| `11-架构总览与目录结构.md` | 仓库目录树、模块依赖拓扑、运行时数据流、部署形态、设计取舍 | 实现快照已合并至第 4-8 节，保持原目录树精度 |

旧文档中未合并的部分（如 02 的数据流详细流程图、Ontology 映射 YAML 示例、数据库详细选型理由等）属于专题内容，可在 `development/` 或 `archive/` 中保留为参考。

产品定位部分提取自 `01-产品规格说明书.md` 第 1 节的核心定位与产品原则，完整规格以原文档为准。
