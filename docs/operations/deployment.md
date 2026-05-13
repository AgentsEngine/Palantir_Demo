# 15 — 部署与运行（v2 更新）

> **更新日期**: 2026-05-13 | 本文档反映当前生产环境部署配置

---

## 1. 生产环境部署

### 1.1 服务器信息

| 项目 | 值 |
|------|-----|
| IP | 111.229.172.100 |
| 系统 | OpenCloudOS 9 (Linux 6.6, x86_64) |
| 内存 | 7.4 GB |
| 磁盘 | 80 GB（已用 28G） |
| Docker | 29.4.2 |

### 1.2 访问地址

| 服务 | URL |
|------|-----|
| 前端（制造数智平台） | http://111.229.172.100 |
| 后端 API | http://111.229.172.100:8000 |
| API 文档 (Swagger) | http://111.229.172.100:8000/docs |
| 思源笔记 | http://111.229.172.100:3051 |

### 1.3 容器清单

| 容器 | 镜像 | 对外端口 | 说明 |
|------|------|---------|------|
| manufoundry-frontend | 自建 (nginx:alpine) | 80 | 前端静态托管 + API 反向代理 |
| manufoundry-backend | 自建 (python:3.11-slim) | 8000 | FastAPI 后端 |
| manufoundry-postgres | postgres:16-alpine | 无（仅内部） | 关系数据库 |
| manufoundry-neo4j | neo4j:5-community | 无（仅内部） | 图数据库 |
| manufoundry-redis | redis:7-alpine | 无（仅内部） | 缓存 |

### 1.4 SSH 连接

```bash
ssh -i "claudecode.pem" root@111.229.172.100
```

---

## 2. 部署命令

### 2.1 首次部署

```bash
# 1. clone 代码
cd /root
git clone https://github.com/yelan-131/Palantir_Demo.git
cd Palantir_Demo

# 2. 启动所有服务
docker compose -f docker/docker-compose.prod-full.yml up -d --build

# 3. 等待容器健康（约 30 秒）
docker compose -f docker/docker-compose.prod-full.yml ps

# 4. 运行数据库迁移
docker exec manufoundry-backend alembic upgrade head

# 5. 导入种子数据
docker cp scripts manufoundry-backend:/app/scripts
docker cp data manufoundry-backend:/app/data
docker exec -w /app manufoundry-backend bash -c 'PYTHONPATH=/app python scripts/seed_data.py'
```

### 2.2 更新代码

```bash
cd /root/Palantir_Demo
git pull
docker compose -f docker/docker-compose.prod-full.yml up -d --build
```

### 2.3 常用运维命令

```bash
# 查看容器状态
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'

# 查看后端日志
docker logs -f manufoundry-backend --tail 50

# 查看前端日志
docker logs -f manufoundry-frontend --tail 20

# 重启某个服务
docker compose -f docker/docker-compose.prod-full.yml restart backend

# 停止所有服务
docker compose -f docker/docker-compose.prod-full.yml down

# 完全重建（清除数据卷）
docker compose -f docker/docker-compose.prod-full.yml down -v
```

---

## 3. 关键文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 生产 compose | `docker/docker-compose.prod-full.yml` | 独立生产环境配置 |
| 前端 nginx 配置 | `frontend/nginx-prod.conf` | 端口 80 + API 代理 |
| 后端 Dockerfile | `backend/Dockerfile` | 清华 pip 镜像源 |
| 前端 Dockerfile | `frontend/Dockerfile` | Node build → nginx 托管 |
| 环境变量 | `.env` | 数据库连接等配置 |

---

## 4. 腾讯云安全组

需要在腾讯云控制台放行的端口：

| 端口 | 协议 | 用途 |
|------|------|------|
| 80 | TCP | 前端 Web 访问 |
| 8000 | TCP | 后端 API（可选，调试用） |
| 3051 | TCP | 思源笔记 |
| 22 | TCP | SSH |

---

## 5. 故障排查

| 症状 | 可能原因 | 解决方案 |
|------|---------|---------|
| 前端打不开 | 安全组未开 80 端口 | 腾讯云控制台放行 |
| API 返回 500 | 后端未启动或数据库未连接 | `docker logs manufoundry-backend` |
| 图谱数据为空 | Neo4j 未初始化 | 重新运行 seed_data.py |
| 容器频繁重启 | 内存不足 | `free -h` 检查，可能需要扩容 |
| git pull 冲突 | 本地有修改 | `git checkout . && git pull` |

---

## 6. 备份策略

```bash
# 备份 PostgreSQL
docker exec manufoundry-postgres pg_dump -U manufoundry manufoundry > backup_$(date +%Y%m%d).sql

# 备份 Neo4j
docker exec manufoundry-neo4j neo4j-admin database dump neo4j --to-path=/tmp/
docker cp manufoundry-neo4j:/tmp/neo4j.dump neo4j_backup_$(date +%Y%m%d).dump
```
