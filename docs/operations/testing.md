# ManuFoundry 测试指南

> **文档版本**: v1.0
> **日期**: 2026-04-28
> **作用**: 测试体系约定、当前覆盖范围、扩展模板

---

## 目录

1. [运行入口](#1-运行入口)
2. [当前覆盖](#2-当前覆盖)
3. [测试分层](#3-测试分层)
4. [写新测试的模板](#4-写新测试的模板)
5. [Mock 与隔离策略](#5-mock-与隔离策略)
6. [前端测试](#6-前端测试)
7. [CI 接入建议](#7-ci-接入建议)

---

## 1. 运行入口

```bash
cd backend
pip install pytest                      # 若未安装
python -m pytest                        # 默认配置见 pytest.ini
python -m pytest -v                     # verbose
python -m pytest tests/test_security.py
python -m pytest -k "cypher"            # 关键字过滤
```

`backend/pytest.ini` 已声明 `testpaths = tests`，无需额外参数。

`tests/conftest.py` 作用：

- 把 `backend/` 加入 `sys.path`，免去 `pip install -e .`；
- 注入测试用 `SECRET_KEY` / `LOG_LEVEL=WARNING` / `DEMO_AUTH_OPTIONAL=true`，保持确定性。

---

## 2. 当前覆盖

| 测试文件 | 覆盖目标 | 用例数 |
|---|---|---|
| `test_security.py` | JWT 编/解码、tampered 签名、密码哈希、命名空间 | 5 |
| `test_graph_cypher_safety.py` | 只读 Cypher 关键字校验、模板白名单自一致 | 9 |
| `test_model_driven_safety.py` | 标识符正则、白名单决议、注入字串拒绝 | 6 |
| `test_logging_setup.py` | `setup_logging` 幂等、namespace 隔离 | 2 |

**总计 22 个用例**。这是 P3 阶段建立的最低安全/工程基线，覆盖最高风险点（鉴权、注入、日志）。

`test_graph_cypher_safety` 和 `test_model_driven_safety` 内部使用 `pytest.importorskip("fastapi")`，在缺 FastAPI 的环境下自动跳过；`test_security` 与 `test_logging_setup` 仅依赖标准库 + 项目代码。

冒烟模式：在沙箱无 pytest 时也可单跑：

```bash
cd backend
python3 << 'EOF'
import sys; sys.path.insert(0, '.')
from app.core.security import create_access_token, decode_access_token
t = create_access_token("alice", extra={"uid": 1})
assert decode_access_token(t)["sub"] == "alice"
print("ok")
EOF
```

---

## 3. 测试分层

| 层 | 范围 | 工具 | 当前状态 |
|---|---|---|---|
| **Unit** | 单纯函数 / class，无 IO | pytest | ✅ 已有 4 个文件 |
| **Integration (router)** | 一条 router → DB → 返回 JSON | `pytest-asyncio` + `httpx.AsyncClient(app=...)` + SQLite memory | ⏳ 待补 |
| **Contract (schema)** | OpenAPI / pydantic 契约不破坏 | `schemathesis` | ⏳ 待考虑 |
| **E2E** | 浏览器真实操作 | `playwright` | ⏳ 待考虑 |

---

## 4. 写新测试的模板

### 4.1 单元测试模板

```python
# tests/test_<feature>_<aspect>.py
import pytest


def test_xxx_happy_path():
    from app.foo import bar
    assert bar(1, 2) == 3


@pytest.mark.parametrize("bad", ["", "x;", "1abc"])
def test_xxx_rejects_garbage(bad):
    pytest.importorskip("fastapi")           # 如果被测函数依赖 fastapi
    from fastapi import HTTPException
    from app.foo import validate_id
    with pytest.raises(HTTPException):
        validate_id(bad)
```

### 4.2 集成（异步 router）模板

```python
# tests/test_auth_endpoint.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_login_returns_token(monkeypatch):
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from app.main import app

    async with AsyncClient(app=app, base_url="http://test") as ac:
        r = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    body = r.json()
    assert "token" in body
    assert body["user"]["username"] == "admin"
```

需要安装：`pip install pytest-asyncio httpx`。

### 4.3 隔离 DB

```python
@pytest.fixture
async def db():
    from app.database import _engine
    from app.models.relational import Base
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

或使用 `pytest-postgresql` / `pytest-docker` 起独立 PG 实例。

---

## 5. Mock 与隔离策略

| 资源 | 隔离手段 |
|---|---|
| **DB** | SQLite memory (`sqlite+aiosqlite://` 默认 fallback) |
| **Neo4j** | `monkeypatch.setattr("app.database.neo4j_driver", None)` 让 router 走 mock 分支 |
| **HTTP outbound** | `httpx.MockTransport` |
| **当前时钟** | `freezegun` 或注入 `now=lambda: datetime(...)` |
| **OpenAI / LLM** | 当前 `ai_assistant.py` 还是规则匹配，无外部调用；接入后请用 `respx` |

避免 monkey-patch `os.environ`，改用 pytest 的 `monkeypatch.setenv`，自动 teardown。

---

## 6. 前端测试

当前 `frontend/` 暂无单元测试。建议：

| 层 | 工具 | 模板 |
|---|---|---|
| 组件 | `vitest` + `@testing-library/react` | `import { render, screen } from '@testing-library/react'; render(<Foo />); expect(screen.getByText('xx')).toBeInTheDocument();` |
| 状态 | `vitest` + Zustand 直接 import store | `useAuthStore.setState({ ... }); useAuthStore.getState().logout(); expect(...)` |
| E2E | `playwright` | 关键路径：登录 → 仪表盘 → 报表 |

接入步骤（备忘）：

```bash
cd frontend
npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
# 在 package.json 增 "test": "vitest run"
```

---

## 7. CI 接入建议

### 7.1 GitHub Actions 模板

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt pytest pytest-asyncio httpx
      - run: cd backend && python -m py_compile $(find app -name '*.py')
      - run: cd backend && python -m pytest -q

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run type-check
      - run: cd frontend && npm run build
```

### 7.2 PR 合并条件

至少满足：

1. `backend` job 全绿（py_compile + pytest）
2. `frontend` job 全绿（type-check + build）
3. 新代码必须附带至少 1 条单元测试（覆盖率工具未配置前，code review 强制保证）

---

> 任何安全相关的修复（rule of thumb：commit message 含 `sec:` / `vuln:`）必须**同时新增回归测试**，否则不接受合并。
