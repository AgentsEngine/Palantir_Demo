# ManuFoundry -- 制造业数据操作系统

> 对标 Palantir Foundry 五层架构，面向制造业场景的开源数据操作系统原型

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Layer 5 · Workflow 应用层                        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│   │ 运营总览  │ │ 预测维护  │ │ 质量管理  │ │ 供应链   │ │ AI助手  │ │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                     Layer 4 · AI Flow 智能层                         │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐   │
│   │ 故障预测模型  │ │ SPC 控制图    │ │ LangChain 对话分析引擎   │   │
│   └──────────────┘ └──────────────┘ └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                  Layer 3 · Ontology 语义层                           │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │  Neo4j 知识图谱  ·  制造业本体定义  ·  实体关系建模         │    │
│   └────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│               Layer 2 · Data Integration 数据整合层                  │
│   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │
│   │ MES    │ │ ERP    │ │ IoT    │ │ PLC    │ │ SCADA  │         │
│   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │
│              管线引擎  ·  数据源连接器  ·  定时同步                   │
├─────────────────────────────────────────────────────────────────────┤
│                 Layer 1 · Infrastructure 基础设施层                  │
│   ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐    │
│   │ PostgreSQL   │ │ Neo4j    │ │ Redis    │ │ Docker        │    │
│   │ 关系数据存储  │ │ 图数据库 │ │ 缓存     │ │ 容器化部署     │    │
│   └──────────────┘ └──────────┘ └──────────┘ └───────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 四大应用场景

| 场景 | 能力说明 | 关键功能 |
|------|---------|---------|
| **生产制造** | 生产全链路数字化，从订单到交付全程可视 | OEE 分析、排程优化、工单跟踪、实时产量统计 |
| **预测性维护** | 基于设备传感器数据的故障预测与健康管理 | 设备健康评分、故障预警、维修工单管理、传感器监控 |
| **质量管理** | 统计过程控制驱动的全流程质量管控 | SPC 控制图、缺陷帕累托分析、检验记录、CAPA 纠正预防 |
| **供应链协同** | 多工厂供应链风险管控与库存优化 | 供应商管理、库存监控、物流追踪、风险评估 |

## 技术栈

| 分类 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 后端框架 | FastAPI + Uvicorn | 0.115 / 0.34 | 异步 REST API |
| 关系数据库 | PostgreSQL | 16 | 结构化业务数据存储（可降级为 SQLite） |
| 图数据库 | Neo4j | 5 | 知识图谱、本体建模（可选，降级为 Mock） |
| 缓存 | Redis | 7 | 数据缓存、会话管理（可选） |
| 数据库 ORM | SQLAlchemy | 2.0 | 异步 ORM + Alembic 迁移 |
| AI / ML | scikit-learn, Prophet, LangChain | -- | 预测模型、对话分析 |
| 前端框架 | React + TypeScript | 18 / 5.7 | SPA 用户界面 |
| UI 组件库 | Ant Design Pro | 5.22 | 企业级组件 |
| 可视化 | ECharts | 5.5 | 图表与仪表盘 |
| 图可视化 | Cytoscape.js | 3.30 | 知识图谱展示 |
| 流程可视化 | ReactFlow | 11.11 | 数据管线编辑器 |
| 状态管理 | Zustand | 5.0 | 前端全局状态 |
| 部署 | Docker Compose | -- | 容器化编排 |

## 30 秒快速启动（SQLite 零依赖模式）

无需安装 PostgreSQL、Neo4j、Redis，后端自动创建 SQLite 数据库并导入模拟数据：

```bash
# 1. 启动后端
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000

# 2. 启动前端（新终端）
cd frontend
npm install
npm run dev
```

启动后访问：
- 前端界面：http://localhost:3000
- Swagger API 文档：http://localhost:8000/docs

> 后端首次启动时会自动在 `backend/manufoundry.db` 创建 SQLite 数据库并导入全部模拟数据。

## Docker Compose 全栈启动

使用 Docker Compose 一键启动完整技术栈（PostgreSQL + Neo4j + Redis + 后端 + 前端）：

```bash
cd docker
docker-compose up -d
```

等待所有容器健康检查通过后访问：
- 前端界面：http://localhost:3000
- 后端 API：http://localhost:8000/docs
- Neo4j Browser：http://localhost:7474

## 模块总览

| 模块 | 前端页面 | API 路由 | 说明 |
|------|---------|---------|------|
| 运营总览 | Dashboard | `/api/v1/dashboard` | KPI 看板、OEE 分析、产量统计、告警列表 |
| 数据源管理 | DataSource | `/api/v1/data-sources` | 数据源 CRUD、连接测试、同步管理、数据预览 |
| 本体管理 | Ontology | `/api/v1/ontology` | 实体类型定义、实例管理、关系建模、时间旅行 |
| 图谱查询 | GraphExplorer | `/api/v1/graph` | Cypher 查询、邻居发现、路径搜索、子图提取 |
| 数据管线 | Pipeline | `/api/v1/pipelines` | 管线 CRUD、执行调度、运行历史 |
| 预测性维护 | Maintenance | `/api/v1/maintenance` | 设备健康评分、故障预测、维修工单 |
| 质量管理 | Quality | `/api/v1/quality` | SPC 控制图、缺陷分析、质量追溯、检验管理 |
| 供应链 | SupplyChain | `/api/v1/supply-chain` | 供应商管理、库存优化、物流追踪、风险评估 |
| AI 助手 | AIAssistant | `/api/v1/ai` | 自然语言查询、智能分析对话 |

## 模拟数据统计

系统内置完整的制造业模拟数据，覆盖三个工厂的全部运营数据：

| 数据类型 | 数量 | 说明 |
|---------|------|------|
| 工厂 | 3 | 宁海智能制造中心、苏州精密部件厂、武汉电子组装厂 |
| 车间 | 8 | 机加工、焊接、装配、质检、铸造、SMT 等 |
| 产线 | 15 | 涵盖 CNC 加工、焊接、装配、SMT 贴片、测试老化等 |
| 设备 | 65 | CNC 车床、焊接机器人、回流焊、AGV、液压机等 |
| 传感器 | 195 | 温度/转速/压力/电流/振动传感器，每设备 3 个 |
| 产品 | 8 | 轴承组件、PCBA、阀块、齿轮箱等 |
| 物料 | 8 | 钢材、铝合金、覆铜板、芯片等 |
| 供应商 | 12 | 宝钢、中铝、村田、3M、博世等 |
| 客户 | 6 | 三一重工、中车时代、汇川技术等 |
| 员工 | 30 | 质检员、维修工、班组长、工艺工程师等 |
| 销售订单 | 20 | 多优先级、多状态分布 |
| 工单 | 48 | pending / in_progress / completed 多状态 |
| 检验记录 | 100 | 来料 / 过程 / 终检三类 |
| 缺陷记录 | 30 | 尺寸超差、焊接气孔、电气短路等 |
| SPC 数据点 | 数千 | 7 天统计过程控制数据 |
| 传感器读数 | 数万 | 24 小时高频采集数据 |

## 项目结构

```
Palantir_Demo/
├── docs/                            # 产品设计文档
│   ├── 01-产品规格说明书.md           # 功能需求、用户故事、验收标准
│   ├── 02-技术架构设计.md             # 系统架构、技术选型、模块设计
│   ├── 03-制造业本体定义.md           # 实体类型、关系类型、属性定义
│   ├── 04-API接口参考.md             # 全部 API 端点详细文档
│   ├── 05-部署指南.md                # 三种部署模式、环境配置
│   ├── 06-开发者指南.md              # 开发环境、代码规范
│   ├── 07-用户手册.md                # 功能操作说明
│   ├── 08-数据模型.md                # 关系模型、图模型、种子数据
│   ├── 09-场景演示手册.md            # 4 大核心场景 walkthrough
│   └── 10-集成指南.md                # 外部系统对接、连接器开发
├── backend/                         # FastAPI 后端
│   ├── app/
│   │   ├── api/                     # 10 个 API 路由模块
│   │   │   ├── dashboard.py         # 运营总览 (4 端点)
│   │   │   ├── data_sources.py      # 数据源管理 (9 端点)
│   │   │   ├── ontology.py          # 本体管理 (8 端点)
│   │   │   ├── graph.py             # 图谱查询 (5 端点)
│   │   │   ├── pipeline.py          # 数据管线 (6 端点)
│   │   │   ├── maintenance.py       # 预测性维护 (5 端点)
│   │   │   ├── quality.py           # 质量管理 (6 端点)
│   │   │   ├── supply_chain.py      # 供应链 (5 端点)
│   │   │   ├── ai_assistant.py      # AI 助手 (3 端点)
│   │   │   └── analytics.py         # 数据分析
│   │   ├── models/
│   │   │   ├── relational.py        # SQLAlchemy 关系模型 (20+ 表)
│   │   │   └── graph_models.py      # Neo4j 图模型与本体定义
│   │   ├── services/
│   │   │   ├── graph_service.py     # 图谱服务
│   │   │   ├── analytics/           # 分析引擎
│   │   │   │   ├── predictive_maintenance.py
│   │   │   │   └── supply_optimizer.py
│   │   │   └── data_integration/    # 数据整合
│   │   │       ├── pipeline_engine.py
│   │   │       └── connectors/
│   │   │           └── mes_simulator.py
│   │   ├── schemas/                 # Pydantic 数据校验
│   │   ├── config.py                # 配置管理
│   │   ├── database.py              # 数据库连接与自动初始化
│   │   └── main.py                  # FastAPI 应用入口
│   ├── alembic/                     # 数据库迁移
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
├── frontend/                        # React 前端
│   ├── src/
│   │   ├── pages/                   # 9 个功能模块页面
│   │   │   ├── Dashboard/           # 运营总览
│   │   │   ├── DataSource/          # 数据源管理
│   │   │   ├── Ontology/            # 本体管理
│   │   │   ├── GraphExplorer/       # 图谱浏览
│   │   │   ├── Pipeline/            # 数据管线
│   │   │   ├── Maintenance/         # 预测性维护
│   │   │   ├── Quality/             # 质量管理
│   │   │   ├── SupplyChain/         # 供应链
│   │   │   ├── AIAssistant/         # AI 助手
│   │   │   └── Workflow/            # 工作流
│   │   ├── components/              # 可复用组件
│   │   │   ├── ChartPanel/          # ECharts 图表面板
│   │   │   ├── GraphView/           # Cytoscape 图谱视图
│   │   │   ├── OntologyTree/        # 本体树形结构
│   │   │   └── PipelineEditor/      # ReactFlow 管线编辑器
│   │   ├── services/
│   │   │   └── api.ts               # Axios API 客户端
│   │   ├── stores/                  # Zustand 状态管理
│   │   ├── App.tsx                  # 路由配置
│   │   └── main.tsx                 # 入口
│   ├── nginx.conf                   # Nginx 反向代理配置
│   ├── Dockerfile
│   ├── vite.config.ts               # Vite 开发代理配置
│   ├── package.json
│   └── tsconfig.json
├── data/                            # 模拟数据
│   ├── seed/                        # 种子数据 (16 个 JSON 文件)
│   └── simulators/                  # 数据生成器
│       └── generate_sample_data.py
├── docker/
│   └── docker-compose.yml           # Docker Compose 编排
├── scripts/
│   └── seed_data.py                 # PostgreSQL + Neo4j 数据导入脚本
└── README.md
```

## 文档索引

| 文档 | 说明 |
|------|------|
| [产品规格说明书](docs/01-产品规格说明书.md) | 功能需求、用户故事、验收标准 |
| [技术架构设计](docs/02-技术架构设计.md) | 系统架构、技术选型、模块设计 |
| [制造业本体定义](docs/03-制造业本体定义.md) | 实体类型、关系类型、属性定义 |
| [API 接口参考](docs/04-API接口参考.md) | 全部 API 端点详细文档 |
| [部署指南](docs/05-部署指南.md) | 三种部署模式、环境配置、问题排查 |
| [开发者指南](docs/06-开发者指南.md) | 开发环境搭建、代码规范、贡献流程 |
| [用户手册](docs/07-用户手册.md) | 功能操作说明、界面导览 |
| [数据模型](docs/08-数据模型.md) | 关系模型、图模型、种子数据说明 |
| [场景演示手册](docs/09-场景演示手册.md) | 4 大核心场景端到端 walkthrough |
| [集成指南](docs/10-集成指南.md) | 外部系统对接、连接器开发 |

## 对标 Palantir Foundry 架构

| Palantir Foundry | ManuFoundry | 说明 |
|-----------------|-------------|------|
| **Layer 5: Workflow** | 9 个前端 Dashboard 模块 | 运营总览、预测维护、质量管理、供应链、AI 助手 |
| **Layer 4: AI/ML Platform (Ontology-based)** | scikit-learn + Prophet + LangChain | 故障预测模型、SPC 控制图、自然语言分析 |
| **Layer 3: Ontology** | Neo4j 知识图谱 + 制造业本体 | 13 种实体类型、多种关系类型、时间旅行 |
| **Layer 2: Data Integration (Pipeline Builder)** | 管线引擎 + 6 种数据源连接器 | MES/ERP/IoT/PLC/SCADA/API 连接与同步 |
| **Layer 1: Infrastructure** | Docker Compose + PG/Neo4j/Redis | PostgreSQL 16 + Neo4j 5 + Redis 7，可降级为 SQLite |

## License

MIT
