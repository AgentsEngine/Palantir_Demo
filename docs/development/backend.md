# 后端开发指南（含安全）

> **文档版本**: v2.0 | **日期**: 2026-05-13
> **适用范围**: `backend/` 目录所有 Python 代码
> **前置阅读**: `architecture/overview.md`

> 本文档由 12-后端开发指南 + 14-安全与鉴权 合并而成。

---

## 目录

1. [技术栈](#1-技术栈)
2. [启动与本地开发](#2-启动与本地开发)
3. [配置与环境变量](#3-配置与环境变量)
4. [日志规范](#4-日志规范)
5. [数据库会话](#5-数据库会话)
6. [新增路由与模型](#6-新增路由与模型)
7. [Neo4j 操作](#7-neo4j-操作)
8. [Model-driven 动态 CRUD](#8-model-driven-动态-crud)
9. [鉴权与安全](#9-鉴权与安全)
10. [生产部署 Checklist](#10-生产部署-checklist)

---

## 1. 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| Web 框架 | FastAPI 0.115 | 路由 + 依赖注入 + OpenAPI |
| ORM | SQLAlchemy 2.0 (async) | typed ORM；`Mapped[...]` 风格 |
| 数据校验 | Pydantic 2.x + pydantic-settings | Schema + 配置 |
| 迁移 | Alembic 1.14 | schema 版本管理 |
| 数据库驱动 | asyncpg / aiosqlite | PostgreSQL / SQLite fallback |
| 图数据库 | neo4j 5.x (async driver) | Neo4j |
| 认证 | passlib[bcrypt] + python-jose | 密码哈希 + JWT |
| 分析 | scipy / numpy / pandas | 分析层 |

完整依赖见 `backend/requirements.txt`。

---

## 2. 启动与本地开发

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档：<http://localhost:8000/docs>

---

## 3. 配置与环境变量

所有配置集中在 `app/config.py: Settings`，通过 `.env` 读取。

| 变量 | 默认 | 用途 |
|---|---|---|
| `SECRET_KEY` | `manufoundry-secret-key-change-in-production` | JWT 签发密钥（**生产必改**） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | token 有效期（分钟） |
| `DEMO_AUTH_OPTIONAL` | `true` | 缺 token 时是否退化为 guest（生产应 `false`） |
| `CORS_ORIGINS` | `[localhost:3000, ...]` | 允许的前端域 |
| `LOG_LEVEL` | `INFO` | 日志级别 |
| `POSTGRES_*` | localhost / manufoundry / 5432 | PG 连接 |
| `NEO4J_*` | bolt://localhost:7687 / neo4j | Neo4j |
| `REDIS_*` | localhost / 6379 / 0 | Redis |

---

## 4. 日志规范

```python
from app.core.logging import get_logger
logger = get_logger(__name__)
```

- 统一格式：`2026-04-28 12:34:56 [INFO] app.api.dashboard: ...`
- **禁止** `print()` 和 bare `except: pass`
- 热路径用 `warning`，调试用 `debug`，未捕获异常由 `unhandled_exception_handler` 自动记录

---

## 5. 数据库会话

### 三种方式

| 场景 | API | 行为 |
|---|---|---|
| 路由依赖注入 | `Depends(get_db)` | 失败抛 500 |
| service 内部 | `async with db_session() as s:` | 异常 rollback + log |
| router 兼容模式 | `safe_db_call` | 异常 rollback + log，返回 None |

### router 兼容模式

```python
from app.core.db import safe_db_call as _try_db

async def _query(db):
    result = await db.execute(select(Equipment))
    return {"data": [...]}

result = await _try_db(_query)
if result is not None:
    return result
return {"data": MOCK_EQUIPMENT}
```

失败必须 5xx 的接口直接用 `db_session()`。

---

## 6. 新增路由与模型

### 新增路由

1. 新建 `app/api/<feature>.py`
2. 在 `app/main.py` 挂载：`app.include_router(<feature>.router, prefix="/api/v1/<feature>", tags=["标签"])`

### 新增 ORM 模型

```python
class ProcessParam(TimestampMixin, Base):
    __tablename__ = "process_params"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    line_id: Mapped[int] = mapped_column(ForeignKey("production_lines.id"))
```

约定：继承 `Base + TimestampMixin`，主键 `Integer + autoincrement`，外键命名 `<entity>_id`，状态用 `String(50)`。

生成迁移：`alembic revision --autogenerate -m "add xxx"`

---

## 7. Neo4j 操作

### driver 复用

`app/database.py` 创建全局 `neo4j_driver`，失败不阻断启动。router 内用 `_try_neo4j`。

### Cypher 安全

- **禁止**拼接用户输入到 Cypher 字符串
- 优先使用 `graph.py: _TEMPLATE_WHITELIST` 的命名模板
- 自由 `query` 经 `_assert_readonly_cypher` 检查：凡含 `CREATE/MERGE/DELETE/SET/REMOVE/DROP/CALL/LOAD` → 400
- 标识符替换必须取自服务端常量

### 双写一致性

PG → Neo4j 双写为 best-effort，异常记 warning。需强一致考虑 outbox + worker 或 Saga 模式。

---

## 8. Model-driven 动态 CRUD

新增一张可被动态 CRUD 的表：

1. 在 `app/api/_model_driven_shared.py: SAFE_COLUMNS` 加入表名 + 允许的列
2. 如模型名与表名不能直接推出，加到 `ENTITY_TABLE_MAP`
3. `assert_safe_identifier` 自动覆盖正则校验
4. 测试自动覆盖：`tests/test_model_driven_safety.py`

**绝对不要**在 router 里写 `f"... FROM {model_name} ..."` 式拼接。

---

## 9. 鉴权与安全

### 威胁模型

| 威胁 | 严重度 | 缓解措施 |
|------|--------|---------|
| SQL/Cypher 注入 | 高 | 白名单 + 参数化 + 只读校验 |
| JWT 伪造 | 高 | SECRET_KEY 集中签发 |
| CSRF | 中 | Bearer token 不依赖 cookie |
| XSS → token 泄漏 | 中 | React 默认转义，禁用 dangerouslySetInnerHTML |
| CORS 误配 | 中 | 显式 origin 列表，`*` 自动禁用 credentials |

### JWT 流程

```
浏览器: POST /api/v1/auth/login → 收到 {token, user} → localStorage
后续请求: Authorization: Bearer <token>
FastAPI: Depends(get_current_user) 解析 token
```

```python
from app.core.security import create_access_token, hash_password, verify_password

token = create_access_token(subject=user.username, extra={"uid": user.id, "is_admin": user.is_admin})
```

### SQL 注入防御

- SQLAlchemy ORM 查询自动参数化
- 动态表/列名：`SAFE_COLUMNS` 白名单 + `assert_safe_identifier` 正则 + 参数化值
- 测试：`pytest tests/test_model_driven_safety.py -v`

### Cypher 注入防御

- 优先使用白名单模板 `_TEMPLATE_WHITELIST`
- 自由 query：`_FORBIDDEN_CYPHER_PATTERN` 拦截写操作关键字
- 标签拼接：`SAFE_LABELS` 白名单前置校验
- 测试：`pytest tests/test_graph_cypher_safety.py -v`

### 前端安全

| 项 | 当前 | 后续目标 |
|---|---|---|
| token 存储 | localStorage | HttpOnly Cookie + CSRF Token |
| HTML 注入 | React 默认转义 | DOMPurify |
| CSP | 无 | FastAPI middleware 或 nginx 配置 |

---

## 10. 生产部署 Checklist

- [ ] `SECRET_KEY` 改为长随机串
- [ ] `DEMO_AUTH_OPTIONAL=false`
- [ ] `CORS_ORIGINS` 仅列正式域名
- [ ] `LOG_LEVEL=INFO`
- [ ] PostgreSQL 与 Neo4j 启用强密码 + TLS
- [ ] nginx 配置 HSTS / X-Frame-Options / CSP
- [ ] 后端容器不挂载源码（用 prod Dockerfile）
- [ ] 关键接口增加速率限制
- [ ] 接入集中式 logging（ELK / Loki）

---

> 安全是持续工程。任何「绕过校验的捷径」均视为合规违规。
