# ManuFoundry / Palantir Demo

一个面向制造业场景的低代码数据工作台原型。项目目标是把生产、质量、设备、供应链等业务数据组织成可配置的应用、表单、菜单、权限、知识库和图谱探索能力。

当前项目仍处于开发演示阶段，不是可直接商用的完整平台。README 以 2026-05-25 当前代码状态为准。

## 当前已经包含的内容

- 登录、用户信息、账号中心和应用工作台外壳。
- 系统管理：用户、角色、权限、组织、应用、菜单、语义资产。
- 低代码表单：表单定义、字段、布局、动作、权限、动态记录。
- 制造业演示数据：工厂、车间、产线、设备、传感器、工单、质检、SPC、客户、供应商、物料和订单。
- 知识库能力：文档上传、Markdown 内容、分块、抽取任务、实体/关系抽取结果持久化。
- 本体与图谱：本体管理、图谱查询、质量事件影响链路等可视化能力。
- 业务模块：生产看板、预测性维护、质量分析、供应链风险、报表、规则、工作流、通知、模板市场。
- AI 相关服务：AI 助手接口、知识摄取、抽取策略、Provider 抽象、提示词和工具层雏形。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18, TypeScript, Vite, Ant Design, ECharts, Cytoscape, ReactFlow, Zustand |
| 后端 | FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| 数据库 | PostgreSQL, SQLite fallback |
| 图数据库 | Neo4j 5 Community |
| 缓存 | Redis |
| 部署 | Docker Compose |
| 测试 | pytest, TypeScript build |

## 目录结构

```text
backend/      FastAPI 后端、模型、迁移、测试和服务层
frontend/     React 前端工作台
data/seed/    制造业演示种子数据
docker/       Docker Compose、Dockerfile、nginx 配置
docs/         架构、业务、开发和运维文档
scripts/      数据初始化和辅助脚本
```

## 本地启动

### 后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：

- 前端：`http://localhost:3000`
- 后端接口文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health`

默认演示账号：

- 用户名：`admin`
- 密码：`admin123`

## Docker 启动

开发模式：

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

开发端口：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8000`
- PostgreSQL：`localhost:5432`
- Neo4j Browser：`http://localhost:7474`
- Redis：`localhost:6379`

生产风格模式：

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d --build
```

生产风格端口：

- 前端：`http://localhost`，宿主机端口 `80`
- 后端：`http://localhost:8000`

生产风格模式要求提供 `SECRET_KEY`，并使用 `DEMO_AUTH_OPTIONAL=false`。

## 数据库迁移

在后端环境中执行：

```bash
cd backend
alembic upgrade head
```

当前迁移包含：

- 应用、菜单和角色绑定表。
- 表单平台、动态记录和工作流绑定。
- 租户字段和核心列表索引。
- 演示管理员、用户、角色、权限、组织和应用角色数据。
- 知识库文档、分块、抽取任务、抽取实体和抽取关系持久化。

## 主要 API 前缀

所有业务接口挂在 `/api/v1` 下。

| 模块 | 前缀 |
| --- | --- |
| 认证 | `/api/v1/auth` |
| 系统管理 | `/api/v1/admin` |
| 应用管理 | `/api/v1/applications` |
| 表单平台 | `/api/v1/forms` |
| 语义资产 | `/api/v1/semantic-assets` |
| 知识库 | `/api/v1/knowledge` |
| 数据源 | `/api/v1/data-sources` |
| 本体 | `/api/v1/ontology` |
| 图谱 | `/api/v1/graph` |
| 数据管道 | `/api/v1/pipelines` |
| 生产总览 | `/api/v1/dashboard` |
| 分析 | `/api/v1/analytics` |
| 维护 | `/api/v1/maintenance` |
| 质量 | `/api/v1/quality` |
| 供应链 | `/api/v1/supply-chain` |
| AI 助手 | `/api/v1/ai` |
| 报表 | `/api/v1/reports` |
| 模型驱动 | `/api/v1/model-driven` |
| 规则 | `/api/v1/rules` |
| 工作流 | `/api/v1/workflow` |
| 通知 | `/api/v1/notifications` |
| 模板 | `/api/v1/templates` |
| 配置导入导出 | `/api/v1/config` |
| 定时任务 | `/api/v1/scheduler` |
| 搜索 | `/api/v1/search` |
| AI Builder | `/api/v1/ai-builder` |

## 验证命令

前端构建：

```bash
cd frontend
npm run build
```

后端测试：

```bash
cd backend
python -m pytest
```

常用的重点测试：

```bash
cd backend
python -m pytest tests/test_ai_agent_services.py tests/test_ai_knowledge_api.py tests/test_knowledge_ingestion.py tests/test_knowledge_extraction.py tests/test_security.py tests/test_forms_platform.py
```

## 开发注意事项

- `runtime-logs/`、临时 tar 包、本地数据库快照等运行产物不要提交。
- 生产环境不要使用默认密码，部署后应立即修改管理员密码。
- Neo4j 不可用时，图谱相关功能应降级，不应影响基础业务 API。
- 服务器生产前端约定监听宿主机 `80` 端口，容器内 nginx 监听 `80`。
- 数据结构变化优先通过 Alembic 迁移和 seed 脚本固化，少做手工数据库修改。

## 文档

更多细节见 [docs/README.md](docs/README.md)。
