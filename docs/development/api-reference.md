# ManuFoundry API 参考文档

> 制造业数据操作系统 — API Reference
>
> 版本: 2.0.0 | 最后更新: 2026-04-22 | 状态: Phase 1-3 已实现

---

## 目录

1. [API 总览](#1-api-总览)
2. [数据源管理 API](#2-数据源管理-api)
3. [本体管理 API](#3-本体管理-api)
4. [图谱查询 API](#4-图谱查询-api)
5. [数据管线 API](#5-数据管线-api)
6. [预测性维护 API](#6-预测性维护-api)
7. [质量管理 API](#7-质量管理-api)
8. [供应链 API](#8-供应链-api)
9. [AI 助手 API](#9-ai-助手-api)
10. [运营总览 API](#10-运营总览-api)
11. [报表中心 API](#11-报表中心-api) *(Phase 1)*
12. [模型驱动 API](#12-模型驱动-api) *(Phase 2)*
13. [认证 API](#13-认证-api) *(Phase 3)*
14. [系统管理 API](#14-系统管理-api) *(Phase 3)*
15. [工作流 API](#15-工作流-api) *(Phase 3)*

---

## 1. API 总览

### 1.1 Base URL

```
https://{host}/api/v1
```

| 环境 | 地址 |
|------|------|
| 开发 | `http://localhost:8000/api/v1` |
| 测试 | `https://staging.manufoundry.io/api/v1` |
| 生产 | `https://api.manufoundry.io/api/v1` |

### 1.2 JWT 认证

除登录接口外，所有请求须在 Header 中携带 Bearer Token：

```
Authorization: Bearer <access_token>
```

Token 通过 `POST /api/v1/auth/login` 获取，有效期 2 小时。过期后通过 `POST /api/v1/auth/refresh` 刷新（Refresh Token 有效期 7 天）。

```
登录:
POST /api/v1/auth/login
→ 返回 { access_token, refresh_token, expires_in }

刷新:
POST /api/v1/auth/refresh
→ Header: Authorization: Bearer <refresh_token>
→ 返回 { access_token, refresh_token, expires_in }

登出:
POST /api/v1/auth/logout
→ 使当前 Token 失效
```

### 1.3 分页规范

所有列表接口统一支持以下查询参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | int | 1 | 页码，从 1 开始 |
| `page_size` | int | 20 | 每页条数，最大 100 |
| `sort_by` | string | `created_at` | 排序字段 |
| `sort_order` | string | `desc` | 排序方向：`asc` / `desc` |

分页响应格式：

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [],
        "pagination": {
            "page": 1,
            "page_size": 20,
            "total": 156,
            "total_pages": 8
        }
    }
}
```

### 1.4 统一响应格式

**成功响应（单资源）：**

```json
{
    "code": 200,
    "message": "success",
    "data": { }
}
```

**错误响应：**

```json
{
    "code": 422,
    "message": "Validation Error",
    "errors": [
        {
            "field": "health_score",
            "message": "must be between 0 and 1",
            "rejected_value": 1.5
        }
    ],
    "request_id": "req_abc123def456"
}
```

### 1.5 错误码一览

| HTTP Status | 业务 Code | 含义 | 典型场景 |
|-------------|-----------|------|----------|
| 400 | `BAD_REQUEST` | 请求格式错误 | JSON 解析失败 |
| 401 | `UNAUTHORIZED` | 未认证 | Token 缺失或过期 |
| 403 | `FORBIDDEN` | 权限不足 | 操作员访问管理员接口 |
| 404 | `NOT_FOUND` | 资源不存在 | 设备 ID 无效 |
| 409 | `CONFLICT` | 资源冲突 | 重复创建设备编号 |
| 422 | `VALIDATION_ERROR` | 数据校验失败 | 字段值超出范围 |
| 429 | `RATE_LIMITED` | 请求限流 | 超过 API 配额 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 数据库连接失败 |
| 503 | `SERVICE_UNAVAILABLE` | 服务不可用 | 管线引擎重启中 |

### 1.6 通用约定

- 资源名使用复数名词：`/equipments`、`/pipelines`
- 嵌套资源最多两层：`/factories/{id}/lines`
- 动作用 `POST` 子路径：`/pipelines/{id}/execute`
- 查询参数用蛇形命名：`?page_size=20&sort_by=created_at`
- 所有时间字段使用 ISO 8601 格式：`2026-04-21T10:30:00Z`
- 所有 ID 使用 UUID v4 格式

---

## 2. 数据源管理 API

管理 ManuFoundry 接入的所有异构数据源，包括 IoT 传感器、MES/ERP 系统、文件导入等。

---

### 2.1 List DataSources

列出所有已注册的数据源。

```
GET /api/v1/datasources
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 否 | 按类型过滤：`opcua` / `modbus` / `mqtt` / `mes` / `erp` / `file` / `database` |
| `status` | string | 否 | 按状态过滤：`active` / `inactive` / `error` |
| `factory_id` | uuid | 否 | 按工厂过滤 |
| `page` | int | 否 | 页码 |
| `page_size` | int | 否 | 每页条数 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "id": "ds_550e8400",
                "name": "1号车间PLC数据源",
                "type": "opcua",
                "status": "active",
                "factory_id": "fac_a1b2c3d4",
                "connection": {
                    "endpoint": "opc.tcp://192.168.1.100:4840",
                    "security_mode": "SignAndEncrypt"
                },
                "metrics": {
                    "total_tags": 256,
                    "last_sync_at": "2026-04-21T10:25:00Z",
                    "error_count_24h": 0
                },
                "created_at": "2026-03-15T08:00:00Z",
                "updated_at": "2026-04-21T10:25:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 1, "total_pages": 1 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/datasources?type=opcua&status=active" \
  -H "Authorization: Bearer <token>"
```

---

### 2.2 Get DataSource

获取单个数据源详情。

```
GET /api/v1/datasources/{datasource_id}
```

**路径参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `datasource_id` | string | 数据源 ID |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "id": "ds_550e8400",
        "name": "1号车间PLC数据源",
        "type": "opcua",
        "status": "active",
        "factory_id": "fac_a1b2c3d4",
        "connection": {
            "endpoint": "opc.tcp://192.168.1.100:4840",
            "security_mode": "SignAndEncrypt",
            "username": "opcua_user",
            " polling_interval_ms": 1000
        },
        "tags": [
            { "tag_id": "ns=2;s=Temperature", "alias": "temp_01", "data_type": "Float" },
            { "tag_id": "ns=2;s=Vibration", "alias": "vib_01", "data_type": "Float" }
        ],
        "metrics": {
            "total_tags": 256,
            "last_sync_at": "2026-04-21T10:25:00Z",
            "error_count_24h": 0,
            "throughput_eps": 1250
        },
        "created_at": "2026-03-15T08:00:00Z",
        "updated_at": "2026-04-21T10:25:00Z"
    }
}
```

**响应 `404 Not Found`：**

```json
{
    "code": 404,
    "message": "DataSource not found",
    "errors": [{ "field": "datasource_id", "message": "ds_invalid does not exist" }],
    "request_id": "req_xyz789"
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/datasources/ds_550e8400" \
  -H "Authorization: Bearer <token>"
```

---

### 2.3 Create DataSource

创建新的数据源连接。

```
POST /api/v1/datasources
```

**请求体：**

```json
{
    "name": "2号车间MQTT数据源",
    "type": "mqtt",
    "factory_id": "fac_a1b2c3d4",
    "connection": {
        "broker": "mqtt://192.168.1.200:1883",
        "topic": "factory/workshop2/#",
        "qos": 1,
        "username": "mqtt_user",
        "password": "********"
    },
    "tags": [
        { "topic_filter": "factory/workshop2/temp", "alias": "ws2_temp", "data_type": "Float" }
    ],
    "options": {
        "auto_reconnect": true,
        "polling_interval_ms": 500
    }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 数据源名称，1-128 字符 |
| `type` | string | 是 | 数据源类型 |
| `factory_id` | uuid | 是 | 所属工厂 |
| `connection` | object | 是 | 连接配置，结构因 type 而异 |
| `tags` | array | 否 | 标签/点位列表 |
| `options` | object | 否 | 扩展选项 |

**响应 `201 Created`：**

```json
{
    "code": 201,
    "message": "DataSource created successfully",
    "data": {
        "id": "ds_7f8e9d0a",
        "name": "2号车间MQTT数据源",
        "type": "mqtt",
        "status": "active",
        "factory_id": "fac_a1b2c3d4",
        "created_at": "2026-04-21T11:00:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/datasources" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "2号车间MQTT数据源",
    "type": "mqtt",
    "factory_id": "fac_a1b2c3d4",
    "connection": { "broker": "mqtt://192.168.1.200:1883", "topic": "factory/workshop2/#", "qos": 1 }
  }'
```

---

### 2.4 Update DataSource

更新数据源配置。

```
PUT /api/v1/datasources/{datasource_id}
```

**请求体：**

```json
{
    "name": "2号车间MQTT数据源(v2)",
    "connection": {
        "broker": "mqtt://192.168.1.200:1883",
        "topic": "factory/workshop2/#",
        "qos": 2
    },
    "status": "active"
}
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "DataSource updated successfully",
    "data": {
        "id": "ds_7f8e9d0a",
        "name": "2号车间MQTT数据源(v2)",
        "type": "mqtt",
        "status": "active",
        "updated_at": "2026-04-21T11:30:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X PUT "https://api.manufoundry.io/api/v1/datasources/ds_7f8e9d0a" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "2号车间MQTT数据源(v2)", "connection": { "qos": 2 } }'
```

---

### 2.5 Delete DataSource

删除数据源（软删除）。

```
DELETE /api/v1/datasources/{datasource_id}
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "DataSource deleted successfully",
    "data": { "id": "ds_7f8e9d0a", "deleted_at": "2026-04-21T12:00:00Z" }
}
```

**curl 示例：**

```bash
curl -X DELETE "https://api.manufoundry.io/api/v1/datasources/ds_7f8e9d0a" \
  -H "Authorization: Bearer <token>"
```

---

### 2.6 Test DataSource Connection

测试数据源连接是否可用。

```
POST /api/v1/datasources/{datasource_id}/test
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "Connection test completed",
    "data": {
        "success": true,
        "latency_ms": 23,
        "available_tags": 256,
        "errors": []
    }
}
```

**响应 `200 OK`（连接失败）：**

```json
{
    "code": 200,
    "message": "Connection test completed",
    "data": {
        "success": false,
        "latency_ms": null,
        "available_tags": 0,
        "errors": [{ "code": "CONNECTION_REFUSED", "message": "目标主机拒绝连接" }]
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/datasources/ds_550e8400/test" \
  -H "Authorization: Bearer <token>"
```

---

### 2.7 List DataSource Tags

获取数据源下所有标签/点位。

```
GET /api/v1/datasources/{datasource_id}/tags
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data_type` | string | 否 | 按数据类型过滤 |
| `alias` | string | 否 | 按别名模糊搜索 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "tag_id": "ns=2;s=Temperature",
                "alias": "temp_01",
                "data_type": "Float",
                "unit": "°C",
                "description": "主轴温度",
                "sampling_rate_hz": 10,
                "last_value": 42.5,
                "last_updated_at": "2026-04-21T10:30:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 256, "total_pages": 13 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/datasources/ds_550e8400/tags?data_type=Float" \
  -H "Authorization: Bearer <token>"
```

---

### 2.8 Get DataSource Health

获取数据源健康状态与指标。

```
GET /api/v1/datasources/{datasource_id}/health
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "datasource_id": "ds_550e8400",
        "status": "healthy",
        "uptime_seconds": 3214080,
        "last_error": null,
        "metrics_24h": {
            "avg_latency_ms": 15,
            "p99_latency_ms": 45,
            "error_rate": 0.001,
            "throughput_eps": 1250,
            "data_completeness": 0.998
        },
        "alerts": []
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/datasources/ds_550e8400/health" \
  -H "Authorization: Bearer <token>"
```

---

### 2.9 Sync DataSource

触发数据源立即同步。

```
POST /api/v1/datasources/{datasource_id}/sync
```

**请求体：**

```json
{
    "mode": "full",
    "time_range": {
        "start": "2026-04-20T00:00:00Z",
        "end": "2026-04-21T00:00:00Z"
    }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `mode` | string | 否 | `full`（全量）/ `incremental`（增量），默认 `incremental` |
| `time_range` | object | 否 | 同步时间范围，增量模式下必填 |

**响应 `202 Accepted`：**

```json
{
    "code": 202,
    "message": "Sync job submitted",
    "data": {
        "job_id": "job_sync_abc123",
        "status": "queued",
        "estimated_duration_seconds": 300
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/datasources/ds_550e8400/sync" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "mode": "incremental", "time_range": { "start": "2026-04-20T00:00:00Z", "end": "2026-04-21T00:00:00Z" } }'
```

---

## 3. 本体管理 API

管理 ManuFoundry 的 Ontology 语义层，包括实体类型定义、关系建模、虚拟属性和动作函数的注册与查询。

---

### 3.1 List Entity Types

列出所有本体实体类型。

```
GET /api/v1/ontology/entity-types
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | 否 | 按分类过滤：`equipment` / `material` / `process` / `order` / `quality` / `person` |
| `search` | string | 否 | 按名称搜索 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "type_id": "ent_equipment",
                "name": "Equipment",
                "display_name": "设备",
                "category": "equipment",
                "properties": [
                    { "name": "equipment_code", "type": "String", "required": true },
                    { "name": "equipment_type", "type": "Enum[CNC,Robot,Conveyor,PLC]", "required": true },
                    { "name": "factory_id", "type": "UUID", "required": true, "ref": "Factory" }
                ],
                "virtual_properties": [
                    { "name": "health_score", "expression": "weighted_avg(temp_norm, vib_norm, hist_fault)", "return_type": "Float" }
                ],
                "actions": ["create_maintenance_order", "adjust_parameter"],
                "instance_count": 342,
                "created_at": "2026-01-10T08:00:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 15, "total_pages": 1 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/ontology/entity-types?category=equipment" \
  -H "Authorization: Bearer <token>"
```

---

### 3.2 Get Entity Type

获取单个实体类型定义（含完整属性、关系、动作）。

```
GET /api/v1/ontology/entity-types/{type_id}
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "type_id": "ent_equipment",
        "name": "Equipment",
        "display_name": "设备",
        "category": "equipment",
        "description": "工厂内所有生产设备与辅助设备",
        "properties": [
            { "name": "equipment_code", "type": "String", "required": true, "indexed": true },
            { "name": "equipment_type", "type": "Enum[CNC,Robot,Conveyor,PLC,AGV]", "required": true },
            { "name": "model", "type": "String", "required": false },
            { "name": "install_date", "type": "Date", "required": false },
            { "name": "factory_id", "type": "UUID", "required": true, "ref": "Factory" },
            { "name": "line_id", "type": "UUID", "required": false, "ref": "ProductionLine" }
        ],
        "virtual_properties": [
            {
                "name": "health_score",
                "expression": "weighted_avg(temp_normalized, vibration_normalized, 1 - recent_fault_rate)",
                "return_type": "Float",
                "description": "设备健康综合评分 (0-1)",
                "cache_ttl_seconds": 300
            },
            {
                "name": "oee",
                "expression": "availability * performance * quality",
                "return_type": "Float",
                "description": "设备综合效率",
                "cache_ttl_seconds": 60
            }
        ],
        "relations": [
            { "name": "installed_in", "target": "ProductionLine", "cardinality": "many_to_one" },
            { "name": "has_sensor", "target": "Sensor", "cardinality": "one_to_many" },
            { "name": "produced_by", "target": "WorkOrder", "cardinality": "many_to_many" }
        ],
        "actions": [
            { "name": "create_maintenance_order", "trigger": "manual|auto_alert", "payload_schema": { "priority": "Enum[low,medium,high,critical]", "description": "String" } },
            { "name": "adjust_parameter", "trigger": "manual", "payload_schema": { "parameter": "String", "value": "Float" } }
        ],
        "permissions": {
            "read": ["admin", "manager", "engineer", "operator"],
            "write": ["admin", "manager", "engineer"],
            "action": ["admin", "manager"]
        },
        "instance_count": 342,
        "created_at": "2026-01-10T08:00:00Z",
        "updated_at": "2026-04-15T14:20:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/ontology/entity-types/ent_equipment" \
  -H "Authorization: Bearer <token>"
```

---

### 3.3 Create Entity Type

创建新的实体类型定义。

```
POST /api/v1/ontology/entity-types
```

**请求体：**

```json
{
    "name": "Tool",
    "display_name": "刀具",
    "category": "equipment",
    "description": "机加工用刀具",
    "properties": [
        { "name": "tool_code", "type": "String", "required": true, "indexed": true },
        { "name": "tool_type", "type": "Enum[EndMill,Drill,Insert,Reamer]", "required": true },
        { "name": "material", "type": "String", "required": false },
        { "name": "diameter_mm", "type": "Float", "required": false }
    ],
    "virtual_properties": [
        { "name": "wear_level", "expression": "estimated_wear_from_cutting_time", "return_type": "Float", "cache_ttl_seconds": 600 }
    ],
    "relations": [
        { "name": "mounted_on", "target": "Equipment", "cardinality": "many_to_one" }
    ]
}
```

**响应 `201 Created`：**

```json
{
    "code": 201,
    "message": "Entity type created successfully",
    "data": {
        "type_id": "ent_tool",
        "name": "Tool",
        "display_name": "刀具",
        "instance_count": 0,
        "created_at": "2026-04-21T12:00:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/ontology/entity-types" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tool",
    "display_name": "刀具",
    "category": "equipment",
    "properties": [
      { "name": "tool_code", "type": "String", "required": true },
      { "name": "tool_type", "type": "Enum[EndMill,Drill,Insert,Reamer]", "required": true }
    ]
  }'
```

---

### 3.4 Update Entity Type

更新实体类型定义（仅允许新增字段，不允许删除已有字段以保护数据完整性）。

```
PUT /api/v1/ontology/entity-types/{type_id}
```

**请求体：**

```json
{
    "display_name": "刀具(含刀柄)",
    "properties": [
        { "name": "holder_type", "type": "String", "required": false }
    ],
    "virtual_properties": [
        { "name": "remaining_life_pct", "expression": "1 - wear_level", "return_type": "Float", "cache_ttl_seconds": 600 }
    ]
}
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "Entity type updated successfully",
    "data": {
        "type_id": "ent_tool",
        "name": "Tool",
        "display_name": "刀具(含刀柄)",
        "updated_at": "2026-04-21T12:30:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X PUT "https://api.manufoundry.io/api/v1/ontology/entity-types/ent_tool" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "display_name": "刀具(含刀柄)" }'
```

---

### 3.5 List Entity Instances

获取指定类型的所有实体实例。

```
GET /api/v1/ontology/entities/{type_id}
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `filter` | string | 否 | 属性过滤表达式，如 `equipment_type=CNC,factory_id=fac_a1b2` |
| `search` | string | 否 | 全文搜索 |
| `include_virtual` | bool | 否 | 是否计算虚拟属性（默认 `false`，计算有性能开销） |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "id": "eq_001",
                "type_id": "ent_equipment",
                "properties": {
                    "equipment_code": "CNC-042",
                    "equipment_type": "CNC",
                    "model": "DMG MORI NHX 4000",
                    "factory_id": "fac_a1b2c3d4",
                    "line_id": "line_x1y2z3"
                },
                "virtual_properties": {
                    "health_score": 0.87,
                    "oee": 0.82
                },
                "created_at": "2026-01-15T10:00:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 342, "total_pages": 18 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/ontology/entities/ent_equipment?filter=equipment_type=CNC&include_virtual=true" \
  -H "Authorization: Bearer <token>"
```

---

### 3.6 Get Entity Instance

获取单个实体实例详情。

```
GET /api/v1/ontology/entities/{type_id}/{instance_id}
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `include_relations` | bool | 否 | 是否展开关联实体（默认 `false`） |
| `relation_depth` | int | 否 | 关联展开深度，默认 1，最大 3 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "id": "eq_001",
        "type_id": "ent_equipment",
        "properties": {
            "equipment_code": "CNC-042",
            "equipment_type": "CNC",
            "model": "DMG MORI NHX 4000",
            "install_date": "2024-06-15",
            "factory_id": "fac_a1b2c3d4",
            "line_id": "line_x1y2z3"
        },
        "virtual_properties": {
            "health_score": 0.87,
            "oee": 0.82
        },
        "relations": {
            "installed_in": { "id": "line_x1y2z3", "type_id": "ent_production_line", "display": "1号产线" },
            "has_sensor": [
                { "id": "sensor_s01", "type_id": "ent_sensor", "display": "温度传感器-主轴" },
                { "id": "sensor_s02", "type_id": "ent_sensor", "display": "振动传感器-主轴" }
            ]
        },
        "audit": {
            "created_by": "user_admin",
            "created_at": "2026-01-15T10:00:00Z",
            "updated_by": "user_engineer",
            "updated_at": "2026-04-20T16:30:00Z"
        }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/ontology/entities/ent_equipment/eq_001?include_relations=true&relation_depth=2" \
  -H "Authorization: Bearer <token>"
```

---

### 3.7 Execute Entity Action

触发实体上注册的动作函数。

```
POST /api/v1/ontology/entities/{type_id}/{instance_id}/actions/{action_name}
```

**请求体（以 `create_maintenance_order` 为例）：**

```json
{
    "payload": {
        "priority": "high",
        "description": "主轴振动超限，需立即检修"
    },
    "async": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `payload` | object | 是 | 动作参数，须符合注册时的 payload_schema |
| `async` | bool | 否 | 是否异步执行，默认 `false` |

**响应 `200 OK`（同步）：**

```json
{
    "code": 200,
    "message": "Action executed successfully",
    "data": {
        "action": "create_maintenance_order",
        "entity_id": "eq_001",
        "result": { "order_id": "wo_maint_789", "status": "created" }
    }
}
```

**响应 `202 Accepted`（异步）：**

```json
{
    "code": 202,
    "message": "Action submitted for async execution",
    "data": {
        "action": "create_maintenance_order",
        "entity_id": "eq_001",
        "task_id": "task_action_xyz"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/ontology/entities/ent_equipment/eq_001/actions/create_maintenance_order" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "payload": { "priority": "high", "description": "主轴振动超限" }, "async": true }'
```

---

### 3.8 Get Ontology Schema Version

获取当前本体模型的版本与变更历史。

```
GET /api/v1/ontology/schema/versions
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `limit` | int | 否 | 返回最近 N 个版本，默认 10 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "current_version": "v1.3.2",
        "items": [
            {
                "version": "v1.3.2",
                "description": "新增刀具实体类型，Equipment 增加虚拟属性 oee",
                "changed_by": "user_admin",
                "changed_at": "2026-04-21T12:00:00Z",
                "diff": {
                    "added_entity_types": ["ent_tool"],
                    "modified_entity_types": ["ent_equipment"],
                    "added_relations": []
                }
            }
        ]
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/ontology/schema/versions?limit=5" \
  -H "Authorization: Bearer <token>"
```

---

## 4. 图谱查询 API

基于 Neo4j 图数据库的关系查询，支持 Cypher 原生查询和封装好的图谱遍历接口。

---

### 4.1 Query Graph (Cypher)

执行 Cypher 查询语句。

```
POST /api/v1/graph/query
```

**请求体：**

```json
{
    "query": "MATCH (e:Equipment {equipment_type: $type})-[r:installed_in]->(l:ProductionLine) RETURN e, r, l LIMIT $limit",
    "params": {
        "type": "CNC",
        "limit": 50
    },
    "options": {
        "timeout_ms": 10000,
        "include_stats": true
    }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | Cypher 查询语句 |
| `params` | object | 否 | 查询参数（参数化查询防止注入） |
| `options.timeout_ms` | int | 否 | 超时时间，默认 30000ms，最大 60000ms |
| `options.include_stats` | bool | 否 | 是否返回查询统计 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "nodes": [
            { "id": "eq_001", "labels": ["Equipment"], "properties": { "equipment_code": "CNC-042", "equipment_type": "CNC" } },
            { "id": "line_x1y2z3", "labels": ["ProductionLine"], "properties": { "name": "1号产线" } }
        ],
        "edges": [
            { "source": "eq_001", "target": "line_x1y2z3", "type": "installed_in", "properties": {} }
        ],
        "stats": { "nodes_returned": 50, "relationships_returned": 50, "query_time_ms": 12 }
    }
}
```

**响应 `400 Bad Request`（查询语法错误）：**

```json
{
    "code": 400,
    "message": "Invalid Cypher query",
    "errors": [{ "field": "query", "message": "Syntax error at line 1, column 15" }],
    "request_id": "req_cypher_001"
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/graph/query" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "MATCH (e:Equipment)-[:has_sensor]->(s:Sensor) WHERE e.health_score < $threshold RETURN e.equipment_code, count(s) as sensor_count",
    "params": { "threshold": 0.5 }
  }'
```

---

### 4.2 Get Node Neighborhood

获取指定节点的邻居子图。

```
GET /api/v1/graph/nodes/{node_id}/neighborhood
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `depth` | int | 否 | 遍历深度，默认 1，最大 3 |
| `edge_types` | string | 否 | 只沿指定关系类型遍历，逗号分隔 |
| `direction` | string | 否 | `outgoing` / `incoming` / `both`，默认 `both` |
| `limit` | int | 否 | 每层最大节点数，默认 100 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "center": { "id": "eq_001", "labels": ["Equipment"], "properties": { "equipment_code": "CNC-042" } },
        "nodes": [
            { "id": "sensor_s01", "labels": ["Sensor"], "properties": { "name": "温度传感器-主轴" } },
            { "id": "line_x1y2z3", "labels": ["ProductionLine"], "properties": { "name": "1号产线" } }
        ],
        "edges": [
            { "source": "eq_001", "target": "sensor_s01", "type": "has_sensor" },
            { "source": "eq_001", "target": "line_x1y2z3", "type": "installed_in" }
        ]
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/graph/nodes/eq_001/neighborhood?depth=2&direction=outgoing" \
  -H "Authorization: Bearer <token>"
```

---

### 4.3 Get Shortest Path

查询两个节点之间的最短路径。

```
GET /api/v1/graph/paths
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source_id` | string | 是 | 起始节点 ID |
| `target_id` | string | 是 | 目标节点 ID |
| `max_depth` | int | 否 | 最大搜索深度，默认 10 |
| `edge_types` | string | 否 | 限定关系类型 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "found": true,
        "path": {
            "nodes": ["eq_001", "line_x1y2z3", "fac_a1b2c3d4"],
            "edges": [
                { "source": "eq_001", "target": "line_x1y2z3", "type": "installed_in" },
                { "source": "line_x1y2z3", "target": "fac_a1b2c3d4", "type": "belongs_to" }
            ],
            "length": 2
        }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/graph/paths?source_id=eq_001&target_id=fac_a1b2c3d4" \
  -H "Authorization: Bearer <token>"
```

---

### 4.4 Trace Lineage

追溯实体血缘链（质量追溯、物料追溯）。

```
GET /api/v1/graph/lineage/{node_id}
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `direction` | string | 否 | `upstream`（上游）/ `downstream`（下游）/ `both`，默认 `both` |
| `depth` | int | 否 | 追溯深度，默认 5，最大 10 |
| `entity_types` | string | 否 | 只追溯指定实体类型 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "root": { "id": "batch_0042", "labels": ["Batch"], "properties": { "batch_code": "B2026-0421-001" } },
        "upstream": {
            "nodes": [
                { "id": "mat_0089", "labels": ["Material"], "properties": { "name": "铝合金6061-T6", "supplier": "供应商A" } },
                { "id": "eq_001", "labels": ["Equipment"], "properties": { "equipment_code": "CNC-042" } }
            ],
            "edges": [
                { "source": "mat_0089", "target": "batch_0042", "type": "input_to" },
                { "source": "eq_001", "target": "batch_0042", "type": "produced_by" }
            ]
        },
        "downstream": {
            "nodes": [
                { "id": "product_1001", "labels": ["Product"], "properties": { "product_code": "P-1001" } }
            ],
            "edges": [
                { "source": "batch_0042", "target": "product_1001", "type": "output_of" }
            ]
        },
        "stats": { "total_nodes": 3, "total_edges": 3, "query_time_ms": 8 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/graph/lineage/batch_0042?direction=upstream&depth=5" \
  -H "Authorization: Bearer <token>"
```

---

### 4.5 Get Graph Statistics

获取图谱整体统计信息。

```
GET /api/v1/graph/stats
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "node_count": 15823,
        "edge_count": 42156,
        "node_labels": {
            "Equipment": 342,
            "Sensor": 1845,
            "Material": 5621,
            "Batch": 3200,
            "WorkOrder": 1890,
            "Product": 1525,
            "Factory": 12,
            "ProductionLine": 45,
            "Supplier": 143,
            "Person": 1200
        },
        "edge_types": {
            "installed_in": 342,
            "has_sensor": 1845,
            "produced_by": 8900,
            "input_to": 12400,
            "belongs_to": 397,
            "supplied_by": 5100,
            "operated_by": 1800,
            "next_step": 11372
        },
        "last_updated_at": "2026-04-21T10:30:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/graph/stats" \
  -H "Authorization: Bearer <token>"
```

---

## 5. 数据管线 API

管理数据接入、清洗、转换、映射的完整管线生命周期。

---

### 5.1 List Pipelines

列出所有数据管线。

```
GET /api/v1/pipelines
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 否 | `draft` / `active` / `paused` / `archived` |
| `datasource_id` | uuid | 否 | 按数据源过滤 |
| `trigger_type` | string | 否 | `schedule` / `event` / `manual` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "id": "pipe_001",
                "name": "OPC-UA数据清洗管线",
                "description": "采集1号车间PLC数据并进行异常值过滤",
                "status": "active",
                "datasource_id": "ds_550e8400",
                "steps": [
                    { "type": "extract", "config": { "batch_size": 10000 } },
                    { "type": "transform", "config": { "rules": ["remove_nulls", "clamp_outliers"] } },
                    { "type": "map", "config": { "target_entity": "SensorReading" } },
                    { "type": "load", "config": { "target": "timescaledb" } }
                ],
                "trigger": { "type": "schedule", "cron": "*/5 * * * *" },
                "last_run": {
                    "run_id": "run_abc",
                    "status": "success",
                    "started_at": "2026-04-21T10:25:00Z",
                    "duration_seconds": 3
                },
                "created_at": "2026-03-01T08:00:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 8, "total_pages": 1 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/pipelines?status=active" \
  -H "Authorization: Bearer <token>"
```

---

### 5.2 Create Pipeline

创建新管线。

```
POST /api/v1/pipelines
```

**请求体：**

```json
{
    "name": "MES工单同步管线",
    "description": "定时同步MES系统工单数据到本体模型",
    "datasource_id": "ds_mes_001",
    "steps": [
        {
            "type": "extract",
            "config": { "query": "SELECT * FROM work_orders WHERE updated_at > $last_sync", "batch_size": 5000 }
        },
        {
            "type": "transform",
            "config": {
                "mappings": [
                    { "source": "WO_ID", "target": "order_code" },
                    { "source": "PLAN_QTY", "target": "planned_quantity", "transform": "int" },
                    { "source": "STATUS", "target": "status", "transform": "enum_map", "map": { "1": "planned", "2": "in_progress", "3": "completed", "4": "closed" } }
                ]
            }
        },
        {
            "type": "validate",
            "config": { "rules": ["required:order_code", "range:planned_quantity:1-999999"] }
        },
        {
            "type": "map",
            "config": { "target_entity": "WorkOrder", "upsert": true, "upsert_key": "order_code" }
        },
        {
            "type": "load",
            "config": { "target": "postgresql" }
        }
    ],
    "trigger": { "type": "schedule", "cron": "0 */1 * * *" },
    "error_handling": { "strategy": "retry", "max_retries": 3, "retry_delay_seconds": 30 }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 管线名称 |
| `steps` | array | 是 | 管线步骤列表，按顺序执行 |
| `datasource_id` | uuid | 是 | 关联数据源 |
| `trigger` | object | 否 | 触发配置，默认手动触发 |
| `error_handling` | object | 否 | 错误处理策略 |

**响应 `201 Created`：**

```json
{
    "code": 201,
    "message": "Pipeline created successfully",
    "data": {
        "id": "pipe_002",
        "name": "MES工单同步管线",
        "status": "draft",
        "created_at": "2026-04-21T13:00:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/pipelines" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MES工单同步管线",
    "datasource_id": "ds_mes_001",
    "steps": [
      { "type": "extract", "config": { "query": "SELECT * FROM work_orders", "batch_size": 5000 } },
      { "type": "load", "config": { "target": "postgresql" } }
    ],
    "trigger": { "type": "schedule", "cron": "0 */1 * * *" }
  }'
```

---

### 5.3 Get Pipeline

获取管线详情。

```
GET /api/v1/pipelines/{pipeline_id}
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "id": "pipe_002",
        "name": "MES工单同步管线",
        "description": "定时同步MES系统工单数据到本体模型",
        "status": "active",
        "datasource_id": "ds_mes_001",
        "steps": [ "...（同创建时结构）" ],
        "trigger": { "type": "schedule", "cron": "0 */1 * * *", "next_run_at": "2026-04-21T14:00:00Z" },
        "error_handling": { "strategy": "retry", "max_retries": 3, "retry_delay_seconds": 30 },
        "stats": {
            "total_runs": 156,
            "success_rate": 0.98,
            "avg_duration_seconds": 4.2,
            "last_success_at": "2026-04-21T13:00:00Z"
        },
        "created_at": "2026-04-21T13:00:00Z",
        "updated_at": "2026-04-21T13:05:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/pipelines/pipe_002" \
  -H "Authorization: Bearer <token>"
```

---

### 5.4 Execute Pipeline

手动触发管线执行。

```
POST /api/v1/pipelines/{pipeline_id}/execute
```

**请求体：**

```json
{
    "parameters": {
        "time_range": { "start": "2026-04-20T00:00:00Z", "end": "2026-04-21T00:00:00Z" }
    },
    "async": true
}
```

**响应 `202 Accepted`：**

```json
{
    "code": 202,
    "message": "Pipeline execution started",
    "data": {
        "run_id": "run_def456",
        "pipeline_id": "pipe_002",
        "status": "running",
        "started_at": "2026-04-21T13:30:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/pipelines/pipe_002/execute" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "async": true }'
```

---

### 5.5 List Pipeline Runs

获取管线的执行历史记录。

```
GET /api/v1/pipelines/{pipeline_id}/runs
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 否 | `running` / `success` / `failed` / `cancelled` |
| `start_time` | datetime | 否 | 时间范围起点 |
| `end_time` | datetime | 否 | 时间范围终点 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "run_id": "run_def456",
                "pipeline_id": "pipe_002",
                "status": "success",
                "trigger": "manual",
                "steps_result": [
                    { "step": "extract", "status": "success", "rows_in": 1250, "rows_out": 1250, "duration_ms": 320 },
                    { "step": "transform", "status": "success", "rows_in": 1250, "rows_out": 1248, "duration_ms": 45 },
                    { "step": "validate", "status": "success", "rows_in": 1248, "rejected": 0, "duration_ms": 12 },
                    { "step": "map", "status": "success", "rows_in": 1248, "duration_ms": 89 },
                    { "step": "load", "status": "success", "rows_in": 1248, "upserted": 1200, "inserted": 48, "duration_ms": 210 }
                ],
                "started_at": "2026-04-21T13:30:00Z",
                "finished_at": "2026-04-21T13:30:07Z",
                "duration_ms": 676
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 156, "total_pages": 8 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/pipelines/pipe_002/runs?status=failed&start_time=2026-04-20T00:00:00Z" \
  -H "Authorization: Bearer <token>"
```

---

### 5.6 Get Pipeline Run Detail

获取单次管线执行的详细日志。

```
GET /api/v1/pipelines/{pipeline_id}/runs/{run_id}
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "run_id": "run_def456",
        "pipeline_id": "pipe_002",
        "status": "success",
        "trigger": "manual",
        "triggered_by": "user_admin",
        "parameters": { "time_range": { "start": "2026-04-20T00:00:00Z", "end": "2026-04-21T00:00:00Z" } },
        "steps_result": [
            {
                "step": "extract",
                "type": "extract",
                "status": "success",
                "rows_in": 0,
                "rows_out": 1250,
                "duration_ms": 320,
                "log": "Extracted 1250 rows from MES work_orders table",
                "sample_data": [
                    { "WO_ID": "WO-2026-0420-001", "PLAN_QTY": 500, "STATUS": "3" }
                ]
            }
        ],
        "summary": {
            "total_rows_processed": 1250,
            "total_rows_loaded": 1248,
            "total_rows_rejected": 2,
            "total_duration_ms": 676
        },
        "errors": [
            { "step": "validate", "row_index": 523, "message": "planned_quantity out of range: -1" },
            { "step": "validate", "row_index": 987, "message": "order_code is null" }
        ],
        "started_at": "2026-04-21T13:30:00Z",
        "finished_at": "2026-04-21T13:30:07Z"
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/pipelines/pipe_002/runs/run_def456" \
  -H "Authorization: Bearer <token>"
```

---

## 6. 预测性维护 API

基于设备传感器数据和 ML 模型，提供设备健康评分、故障预测、维修工单管理能力。

---

### 6.1 Get Equipment Health

获取设备健康评分与异常指标。

```
GET /api/v1/maintenance/equipments/{equipment_id}/health
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "equipment_id": "eq_001",
        "equipment_code": "CNC-042",
        "overall_health": 0.72,
        "health_status": "warning",
        "components": [
            {
                "name": "主轴",
                "health": 0.65,
                "status": "warning",
                "indicators": [
                    { "metric": "vibration_rms", "value": 4.2, "unit": "mm/s", "threshold": 3.5, "trend": "rising" },
                    { "metric": "temperature", "value": 68.3, "unit": "°C", "threshold": 70.0, "trend": "stable" }
                ]
            },
            {
                "name": "刀具",
                "health": 0.85,
                "status": "good",
                "indicators": [
                    { "metric": "wear_level", "value": 0.15, "unit": "", "threshold": 0.8, "trend": "rising_slow" }
                ]
            }
        ],
        "last_updated_at": "2026-04-21T10:30:00Z",
        "next_check_at": "2026-04-21T10:35:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/maintenance/equipments/eq_001/health" \
  -H "Authorization: Bearer <token>"
```

---

### 6.2 Predict Failures

预测设备未来可能的故障。

```
POST /api/v1/maintenance/predict
```

**请求体：**

```json
{
    "equipment_id": "eq_001",
    "prediction_horizon_hours": 168,
    "include_components": true,
    "confidence_threshold": 0.7
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `equipment_id` | uuid | 是 | 设备 ID |
| `prediction_horizon_hours` | int | 否 | 预测时间窗口（小时），默认 168（7 天） |
| `include_components` | bool | 否 | 是否按部件分别预测，默认 `true` |
| `confidence_threshold` | float | 否 | 最低置信度，默认 0.5 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "equipment_id": "eq_001",
        "equipment_code": "CNC-042",
        "predictions": [
            {
                "component": "主轴轴承",
                "failure_type": "wear_out",
                "probability": 0.82,
                "estimated_failure_at": "2026-04-25T18:00:00Z",
                "remaining_useful_life_hours": 104,
                "confidence": 0.78,
                "contributing_factors": [
                    { "factor": "vibration_rms_trend", "weight": 0.45, "description": "振动RMS值持续上升" },
                    { "factor": "temperature_trend", "weight": 0.30, "description": "轴承温度接近阈值" },
                    { "factor": "operating_hours", "weight": 0.25, "description": "累计运行超过 12000 小时" }
                ],
                "recommended_actions": [
                    { "action": "schedule_bearing_inspection", "priority": "high", "suggested_deadline": "2026-04-23" },
                    { "action": "order_spare_bearing", "priority": "medium", "part_number": "SKF-6205-2RS" }
                ]
            }
        ],
        "model_info": {
            "model_id": "model_rul_v2",
            "model_type": "XGBoost",
            "accuracy": 0.89,
            "last_trained_at": "2026-04-15T00:00:00Z"
        }
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/maintenance/predict" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "equipment_id": "eq_001", "prediction_horizon_hours": 168 }'
```

---

### 6.3 List Maintenance Orders

获取维修工单列表。

```
GET /api/v1/maintenance/orders
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `status` | string | 否 | `pending` / `in_progress` / `completed` / `cancelled` |
| `priority` | string | 否 | `low` / `medium` / `high` / `critical` |
| `equipment_id` | uuid | 否 | 按设备过滤 |
| `assignee_id` | uuid | 否 | 按负责人过滤 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "id": "wo_maint_789",
                "title": "CNC-042主轴轴承检查",
                "description": "预测性维护：主轴轴承RUL约104小时，建议立即安排检查",
                "status": "pending",
                "priority": "high",
                "equipment_id": "eq_001",
                "equipment_code": "CNC-042",
                "assignee_id": "user_zhang",
                "assignee_name": "张工",
                "source": "prediction",
                "prediction_id": "pred_abc",
                "estimated_duration_hours": 4,
                "parts_required": [
                    { "part_number": "SKF-6205-2RS", "name": "主轴轴承", "quantity": 2, "in_stock": true }
                ],
                "created_at": "2026-04-21T10:30:00Z",
                "deadline_at": "2026-04-23T18:00:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 15, "total_pages": 1 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/maintenance/orders?status=pending&priority=high" \
  -H "Authorization: Bearer <token>"
```

---

### 6.4 Create Maintenance Order

创建维修工单。

```
POST /api/v1/maintenance/orders
```

**请求体：**

```json
{
    "title": "CNC-042冷却液泵异响处理",
    "description": "操作员报告冷却液泵运行时有异常噪音",
    "priority": "medium",
    "equipment_id": "eq_001",
    "assignee_id": "user_li",
    "estimated_duration_hours": 2,
    "parts_required": [
        { "part_number": "PUMP-SEAL-001", "name": "机械密封件", "quantity": 1 }
    ],
    "deadline_at": "2026-04-22T18:00:00Z",
    "source": "manual"
}
```

**响应 `201 Created`：**

```json
{
    "code": 201,
    "message": "Maintenance order created successfully",
    "data": {
        "id": "wo_maint_790",
        "title": "CNC-042冷却液泵异响处理",
        "status": "pending",
        "created_at": "2026-04-21T14:00:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/maintenance/orders" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CNC-042冷却液泵异响处理",
    "priority": "medium",
    "equipment_id": "eq_001",
    "assignee_id": "user_li",
    "description": "操作员报告冷却液泵运行时有异常噪音"
  }'
```

---

### 6.5 Get Spare Parts Inventory

查询备件库存。

```
GET /api/v1/maintenance/spare-parts
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | 否 | 按分类过滤 |
| `stock_status` | string | 否 | `normal` / `low` / `out_of_stock` / `overstock` |
| `search` | string | 否 | 按名称或编号搜索 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "part_number": "SKF-6205-2RS",
                "name": "主轴轴承",
                "category": "轴承",
                "stock_quantity": 8,
                "min_quantity": 5,
                "max_quantity": 20,
                "stock_status": "normal",
                "unit_cost": 320.00,
                "supplier": "SKF授权经销商",
                "lead_time_days": 3,
                "last_restocked_at": "2026-03-15T00:00:00Z",
                "usage_rate_30d": 2.5,
                "estimated_stockout_date": "2026-05-28"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 89, "total_pages": 5 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/maintenance/spare-parts?stock_status=low" \
  -H "Authorization: Bearer <token>"
```

---

## 7. 质量管理 API

覆盖来料检验 (IQC)、过程控制 (SPC)、成品检验 (OQC)、缺陷分析和质量追溯。

---

### 7.1 List Inspections

获取检验记录列表。

```
GET /api/v1/quality/inspections
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 否 | `iqc` / `spc` / `oqc` |
| `result` | string | 否 | `pass` / `fail` / `conditional` |
| `batch_id` | uuid | 否 | 按批次过滤 |
| `product_id` | uuid | 否 | 按产品过滤 |
| `date_from` | datetime | 否 | 起始日期 |
| `date_to` | datetime | 否 | 截止日期 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "id": "insp_001",
                "type": "iqc",
                "batch_id": "batch_0042",
                "product_code": "MAT-AL6061-001",
                "inspector": "王工",
                "result": "pass",
                "items_checked": 15,
                "items_passed": 15,
                "items_failed": 0,
                "checklist": [
                    { "item": "外观检查", "standard": "无划痕、无氧化", "result": "pass", "value": null },
                    { "item": "尺寸检测", "standard": "100.00±0.05mm", "result": "pass", "value": "100.02mm" },
                    { "item": "硬度测试", "standard": "≥95 HB", "result": "pass", "value": "102 HB" }
                ],
                "started_at": "2026-04-21T09:00:00Z",
                "finished_at": "2026-04-21T09:45:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 245, "total_pages": 13 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/quality/inspections?type=iqc&result=fail&date_from=2026-04-01T00:00:00Z" \
  -H "Authorization: Bearer <token>"
```

---

### 7.2 Get SPC Chart Data

获取 SPC 统计过程控制图数据。

```
GET /api/v1/quality/spc/charts
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `characteristic` | string | 是 | 质量特性名（如"外径"、"硬度"） |
| `product_id` | uuid | 否 | 按产品过滤 |
| `line_id` | uuid | 否 | 按产线过滤 |
| `chart_type` | string | 否 | `xbar_r` / `xbar_s` / `p` / `np` / `c` / `u`，默认 `xbar_r` |
| `sample_size` | int | 否 | 子组样本量，默认 5 |
| `date_from` | datetime | 否 | 默认最近 30 天 |
| `date_to` | datetime | 否 | 默认当前时间 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "characteristic": "外径",
        "chart_type": "xbar_r",
        "specification": { "target": 100.00, "usl": 100.05, "lsl": 99.95 },
        "control_limits": {
            "xbar": { "ucl": 100.035, "cl": 100.010, "lcl": 99.985 },
            "r": { "ucl": 0.058, "cl": 0.027, "lcl": 0 }
        },
        "capability": { "cp": 1.45, "cpk": 1.38, "pp": 1.52, "ppk": 1.41 },
        "samples": [
            {
                "subgroup": 1,
                "timestamp": "2026-04-21T08:00:00Z",
                "values": [100.01, 100.03, 99.98, 100.02, 100.00],
                "xbar": 100.008,
                "range": 0.05,
                "ooc": false
            },
            {
                "subgroup": 2,
                "timestamp": "2026-04-21T09:00:00Z",
                "values": [100.04, 100.06, 100.03, 100.05, 100.02],
                "xbar": 100.040,
                "range": 0.04,
                "ooc": true,
                "ooc_rules": ["Rule 1: 单点超出控制限"]
            }
        ],
        "ooc_count": 2,
        "total_subgroups": 48
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/quality/spc/charts?characteristic=外径&chart_type=xbar_r&date_from=2026-04-01T00:00:00Z" \
  -H "Authorization: Bearer <token>"
```

---

### 7.3 Analyze Defects

缺陷帕累托分析与根因诊断。

```
POST /api/v1/quality/defects/analyze
```

**请求体：**

```json
{
    "product_id": "prod_1001",
    "time_range": { "start": "2026-04-01T00:00:00Z", "end": "2026-04-21T00:00:00Z" },
    "analysis_type": "pareto",
    "group_by": "defect_type",
    "include_root_cause": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `product_id` | uuid | 否 | 按产品过滤 |
| `time_range` | object | 是 | 分析时间范围 |
| `analysis_type` | string | 否 | `pareto` / `trend` / `correlation`，默认 `pareto` |
| `group_by` | string | 否 | `defect_type` / `equipment` / `operator` / `shift` |
| `include_root_cause` | bool | 否 | 是否触发根因分析，默认 `false` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "summary": {
            "total_defects": 156,
            "total_inspected": 12480,
            "defect_rate": 0.0125,
            "compared_to_previous": -0.003
        },
        "pareto": [
            { "defect_type": "尺寸超差", "count": 62, "percentage": 39.7, "cumulative": 39.7 },
            { "defect_type": "表面划伤", "count": 41, "percentage": 26.3, "cumulative": 66.0 },
            { "defect_type": "毛刺", "count": 28, "percentage": 17.9, "cumulative": 84.0 },
            { "defect_type": "色差", "count": 15, "percentage": 9.6, "cumulative": 93.6 },
            { "defect_type": "其他", "count": 10, "percentage": 6.4, "cumulative": 100.0 }
        ],
        "root_cause_analysis": {
            "triggered": true,
            "top_defect": "尺寸超差",
            "identified_factors": [
                { "factor": "设备精度偏移", "confidence": 0.85, "related_equipment": ["eq_003", "eq_007"], "description": "CNC-018和CNC-025的定位精度近期下降" },
                { "factor": "刀具磨损", "confidence": 0.72, "related_equipment": ["eq_003"], "description": "CNC-018当前刀具磨损程度较高" }
            ],
            "recommendations": [
                "对 CNC-018 和 CNC-025 进行精度校准",
                "更换 CNC-018 当前刀具（磨损度已达 78%）"
            ]
        }
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/quality/defects/analyze" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod_1001",
    "time_range": { "start": "2026-04-01T00:00:00Z", "end": "2026-04-21T00:00:00Z" },
    "analysis_type": "pareto",
    "group_by": "defect_type",
    "include_root_cause": true
  }'
```

---

### 7.4 Trace Quality Chain

质量全链路追溯。

```
GET /api/v1/quality/trace/{batch_id}
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `depth` | int | 否 | 追溯深度，默认 `full` |
| `include_material` | bool | 否 | 包含来料信息，默认 `true` |
| `include_process` | bool | 否 | 包含工艺参数，默认 `true` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "batch": {
            "id": "batch_0042",
            "batch_code": "B2026-0421-001",
            "product_code": "P-1001",
            "product_name": "精密轴承座",
            "quantity": 500,
            "status": "completed",
            "quality_result": "conditional_pass"
        },
        "material_trace": [
            {
                "material_code": "MAT-AL6061-001",
                "name": "铝合金6061-T6棒材",
                "supplier": "供应商A",
                "supplier_batch": "SA-2026-0315",
                "iqc_result": "pass",
                "iqc_id": "insp_001"
            }
        ],
        "process_trace": [
            {
                "step": 1,
                "operation": "车削",
                "equipment_code": "CNC-042",
                "operator": "李师傅",
                "start_time": "2026-04-21T08:00:00Z",
                "end_time": "2026-04-21T10:30:00Z",
                "parameters": { "spindle_speed": 3500, "feed_rate": 0.15, "depth_of_cut": 2.0 },
                "spc_result": { "status": "ooc", "details": "第2子组X-bar超上限" },
                "inspection_result": "conditional_pass"
            },
            {
                "step": 2,
                "operation": "铣削",
                "equipment_code": "CNC-018",
                "operator": "张师傅",
                "start_time": "2026-04-21T11:00:00Z",
                "end_time": "2026-04-21T14:00:00Z",
                "parameters": { "spindle_speed": 4000, "feed_rate": 0.10 },
                "spc_result": { "status": "in_control" },
                "inspection_result": "pass"
            }
        ],
        "oqc_trace": {
            "oqc_id": "insp_oqc_045",
            "result": "conditional_pass",
            "inspector": "赵工",
            "checked_at": "2026-04-21T15:30:00Z",
            "defects_found": [
                { "defect_type": "尺寸超差", "quantity": 3, "severity": "minor", "disposition": "返工" }
            ]
        },
        "trace_time_ms": 45
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/quality/trace/batch_0042" \
  -H "Authorization: Bearer <token>"
```

---

### 7.5 Get Quality Dashboard

获取质量总览看板数据。

```
GET /api/v1/quality/dashboard
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `factory_id` | uuid | 否 | 按工厂过滤 |
| `line_id` | uuid | 否 | 按产线过滤 |
| `period` | string | 否 | `today` / `week` / `month` / `quarter`，默认 `month` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "period": "month",
        "first_pass_yield": 0.962,
        "first_pass_yield_trend": "+0.008",
        "defect_rate_ppm": 12500,
        "defect_rate_trend": "-3200",
        "spc_ooc_count": 12,
        "open_ncr_count": 3,
        "inspection_summary": {
            "iqc": { "total": 120, "pass": 115, "fail": 3, "conditional": 2 },
            "spc": { "total_points": 2400, "in_control": 2388, "ooc": 12 },
            "oqc": { "total": 95, "pass": 88, "fail": 2, "conditional": 5 }
        },
        "top_defect_types": [
            { "type": "尺寸超差", "count": 62, "trend": "up" },
            { "type": "表面划伤", "count": 41, "trend": "down" }
        ]
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/quality/dashboard?period=month&factory_id=fac_a1b2c3d4" \
  -H "Authorization: Bearer <token>"
```

---

### 7.6 Create NCR

创建不合格品报告 (Non-Conformance Report)。

```
POST /api/v1/quality/ncr
```

**请求体：**

```json
{
    "batch_id": "batch_0042",
    "product_id": "prod_1001",
    "defect_type": "尺寸超差",
    "severity": "major",
    "quantity_affected": 12,
    "description": "外径尺寸超出公差范围，测量值100.08mm（USL=100.05mm）",
    "detected_at": "oqc",
    "disposition_proposal": "返工",
    "assigned_to": "user_qa_wang",
    "attachments": [
        { "type": "image", "url": "/files/ncr_img_001.jpg", "description": "超差部位照片" }
    ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `batch_id` | uuid | 是 | 关联批次 |
| `defect_type` | string | 是 | 缺陷类型 |
| `severity` | string | 是 | `minor` / `major` / `critical` |
| `quantity_affected` | int | 是 | 不合格数量 |
| `description` | string | 是 | 问题描述 |
| `disposition_proposal` | string | 否 | 处置建议：`rework` / `scrap` / `use_as_is` / `return_to_supplier` |

**响应 `201 Created`：**

```json
{
    "code": 201,
    "message": "NCR created successfully",
    "data": {
        "id": "ncr_001",
        "batch_id": "batch_0042",
        "status": "open",
        "ncr_number": "NCR-2026-0421-001",
        "created_at": "2026-04-21T16:00:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/quality/ncr" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": "batch_0042",
    "defect_type": "尺寸超差",
    "severity": "major",
    "quantity_affected": 12,
    "description": "外径尺寸超出公差范围",
    "detected_at": "oqc",
    "disposition_proposal": "返工",
    "assigned_to": "user_qa_wang"
  }'
```

---

## 8. 供应链 API

供应商管理、库存优化、物流追踪和风险评估。

---

### 8.1 List Suppliers

获取供应商列表及评分。

```
GET /api/v1/supply-chain/suppliers
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `rating_min` | float | 否 | 最低评分过滤（0-100） |
| `category` | string | 否 | 按供应类别过滤 |
| `risk_level` | string | 否 | `low` / `medium` / `high` / `critical` |
| `status` | string | 否 | `active` / `suspended` / `pending` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "items": [
            {
                "id": "sup_001",
                "name": "供应商A",
                "category": "原材料-铝合金",
                "status": "active",
                "rating": {
                    "overall": 87,
                    "quality": 92,
                    "delivery": 85,
                    "price": 88,
                    "service": 82
                },
                "risk_level": "low",
                "contracts": 3,
                "lead_time_days": 5,
                "on_time_delivery_rate": 0.92,
                "quality_acceptance_rate": 0.98,
                "last_evaluation_at": "2026-04-01T00:00:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 143, "total_pages": 8 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/supply-chain/suppliers?rating_min=80&category=原材料" \
  -H "Authorization: Bearer <token>"
```

---

### 8.2 Get Inventory Optimization

获取库存优化建议。

```
GET /api/v1/supply-chain/inventory/optimization
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `warehouse_id` | uuid | 否 | 按仓库过滤 |
| `category` | string | 否 | 按物料分类过滤 |
| `recommendation_type` | string | 否 | `reorder` / `overstock` / `slow_moving` / `all`，默认 `all` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "summary": {
            "total_skus": 1250,
            "normal_count": 980,
            "low_stock_count": 45,
            "overstock_count": 32,
            "slow_moving_count": 28,
            "dead_stock_count": 15,
            "total_inventory_value": 12500000.00,
            "potential_savings": 850000.00
        },
        "recommendations": [
            {
                "material_code": "MAT-BOLT-M8",
                "name": "M8x30内六角螺栓",
                "current_stock": 120,
                "recommended_reorder_point": 200,
                "recommended_order_qty": 500,
                "recommended_safety_stock": 80,
                "annual_demand": 6000,
                "lead_time_days": 7,
                "stock_status": "low_stock",
                "action": "立即补货",
                "estimated_stockout_date": "2026-04-28",
                "preferred_supplier": { "id": "sup_015", "name": "紧固件供应商C", "unit_price": 0.85 }
            },
            {
                "material_code": "MAT-OIL-003",
                "name": "导轨润滑油（已停用规格）",
                "current_stock": 45,
                "annual_demand": 0,
                "stock_status": "dead_stock",
                "action": "报废或折价处理",
                "holding_cost_per_month": 120.00
            }
        ]
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/supply-chain/inventory/optimization?recommendation_type=reorder" \
  -H "Authorization: Bearer <token>"
```

---

### 8.3 Track Logistics

物流追踪。

```
GET /api/v1/supply-chain/logistics/{shipment_id}
```

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "shipment_id": "ship_001",
        "po_number": "PO-2026-0415-008",
        "supplier": { "id": "sup_001", "name": "供应商A" },
        "carrier": "顺丰速运",
        "tracking_number": "SF1234567890",
        "status": "in_transit",
        "origin": { "address": "苏州市工业园区XX路100号", "lat": 31.30, "lng": 120.70 },
        "destination": { "address": "上海市松江区XX路200号", "lat": 31.00, "lng": 121.22 },
        "estimated_arrival": "2026-04-22T14:00:00Z",
        "items": [
            { "material_code": "MAT-AL6061-001", "name": "铝合金6061-T6棒材", "quantity": 500, "unit": "kg" }
        ],
        "timeline": [
            { "time": "2026-04-21T09:00:00Z", "event": "已揽收", "location": "苏州市" },
            { "time": "2026-04-21T14:30:00Z", "event": "运输中", "location": "无锡转运中心" }
        ],
        "delay_risk": { "level": "low", "reason": null }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/supply-chain/logistics/ship_001" \
  -H "Authorization: Bearer <token>"
```

---

### 8.4 Assess Supply Risk

供应链风险评估。

```
POST /api/v1/supply-chain/risk/assess
```

**请求体：**

```json
{
    "scope": "all",
    "include_sub_suppliers": true,
    "risk_categories": ["supply_disruption", "quality", "financial", "geopolitical"]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scope` | string | 否 | `all` / 指定 `supplier_id` / 指定 `material_category` |
| `include_sub_suppliers` | bool | 否 | 是否包含二级供应商，默认 `false` |
| `risk_categories` | array | 否 | 风险类别筛选 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "overall_risk_level": "medium",
        "overall_risk_score": 38,
        "risk_matrix": {
            "supply_disruption": { "score": 42, "level": "medium", "trend": "rising" },
            "quality": { "score": 25, "level": "low", "trend": "stable" },
            "financial": { "score": 35, "level": "medium", "trend": "stable" },
            "geopolitical": { "score": 18, "level": "low", "trend": "stable" }
        },
        "alerts": [
            {
                "supplier_id": "sup_023",
                "supplier_name": "稀土材料供应商F",
                "risk_type": "supply_disruption",
                "severity": "high",
                "description": "供应商F所在地区近期环保政策收紧，产能下降40%",
                "affected_materials": ["MAT-NEO-001", "MAT-NEO-002"],
                "mitigation_suggestions": ["寻找替代供应商", "建立3个月安全库存"]
            }
        ],
        "single_source_dependencies": 5,
        "assessed_at": "2026-04-21T16:00:00Z"
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/supply-chain/risk/assess" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "scope": "all", "include_sub_suppliers": true }'
```

---

### 8.5 Get Supply Chain Dashboard

供应链总览看板。

```
GET /api/v1/supply-chain/dashboard
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `factory_id` | uuid | 否 | 按工厂过滤 |
| `period` | string | 否 | `today` / `week` / `month`，默认 `month` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "period": "month",
        "supplier_performance": {
            "active_suppliers": 143,
            "avg_rating": 82,
            "on_time_delivery_rate": 0.91,
            "quality_acceptance_rate": 0.97
        },
        "inventory_health": {
            "total_value": 12500000,
            "turnover_rate": 6.2,
            "low_stock_alerts": 45,
            "overstock_value": 850000
        },
        "logistics": {
            "active_shipments": 28,
            "on_time_rate": 0.93,
            "avg_lead_time_days": 5.2
        },
        "risk_summary": {
            "overall_level": "medium",
            "active_alerts": 3,
            "single_source_deps": 5
        }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/supply-chain/dashboard?period=month" \
  -H "Authorization: Bearer <token>"
```

---

## 9. AI 助手 API

基于 LLM 的自然语言数据查询、智能诊断报告生成。

---

### 9.1 Chat (Natural Language Query)

自然语言对话式数据查询。

```
POST /api/v1/ai/chat
```

**请求体：**

```json
{
    "message": "过去7天CNC-042的OEE趋势如何？有没有异常时段？",
    "context": {
        "conversation_id": "conv_abc123",
        "scope": {
            "factory_id": "fac_a1b2c3d4",
            "time_range": { "start": "2026-04-14T00:00:00Z", "end": "2026-04-21T00:00:00Z" }
        }
    },
    "options": {
        "include_charts": true,
        "include_data_tables": true,
        "max_tokens": 2000
    }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 用户自然语言提问 |
| `context.conversation_id` | string | 否 | 多轮对话 ID |
| `context.scope` | object | 否 | 限定查询范围 |
| `options.include_charts` | bool | 否 | 返回图表配置（ECharts 格式），默认 `true` |
| `options.include_data_tables` | bool | 否 | 返回原始数据表，默认 `false` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "conversation_id": "conv_abc123",
        "message_id": "msg_def456",
        "answer": "CNC-042 过去 7 天 OEE 均值为 **82.3%**，整体呈下降趋势。4月19日出现明显低谷（OEE=68.5%），原因是主轴振动超限导致停机 2.3 小时。排除该异常后，OEE 均值为 84.7%。",
        "charts": [
            {
                "type": "line",
                "title": "CNC-042 OEE 趋势（过去7天）",
                "x_axis": ["4/15", "4/16", "4/17", "4/18", "4/19", "4/20", "4/21"],
                "series": [
                    { "name": "OEE", "data": [0.85, 0.86, 0.83, 0.84, 0.685, 0.86, 0.84] }
                ],
                "annotations": [
                    { "x": "4/19", "label": "主轴振动超限停机" }
                ]
            }
        ],
        "data_tables": [
            {
                "headers": ["日期", "可用率", "表现率", "良品率", "OEE", "备注"],
                "rows": [
                    ["2026-04-15", "92%", "94%", "98%", "85%", ""],
                    ["2026-04-19", "75%", "91%", "99%", "68.5%", "主轴振动超限"]
                ]
            }
        ],
        "follow_up_suggestions": [
            "CNC-042 的主轴健康状态如何？",
            "过去30天哪些设备OEE最低？",
            "4月19日的停机事件详情"
        ],
        "sources": [
            { "type": "entity", "id": "eq_001", "name": "CNC-042" },
            { "type": "metric", "name": "OEE" },
            { "type": "event", "id": "evt_001", "name": "主轴振动超限停机事件" }
        ],
        "tokens_used": 850,
        "latency_ms": 1200
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/ai/chat" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "过去7天CNC-042的OEE趋势如何？",
    "context": { "scope": { "factory_id": "fac_a1b2c3d4" } },
    "options": { "include_charts": true }
  }'
```

---

### 9.2 Generate Diagnostic Report

生成智能诊断报告。

```
POST /api/v1/ai/diagnose
```

**请求体：**

```json
{
    "subject": "equipment",
    "target_id": "eq_001",
    "report_type": "comprehensive",
    "time_range": { "start": "2026-04-14T00:00:00Z", "end": "2026-04-21T00:00:00Z" },
    "include_recommendations": true,
    "output_format": "markdown"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `subject` | string | 是 | 诊断对象类型：`equipment` / `batch` / `production_line` / `quality_issue` |
| `target_id` | string | 是 | 诊断对象 ID |
| `report_type` | string | 否 | `quick`（快速摘要）/ `comprehensive`（全面报告），默认 `quick` |
| `time_range` | object | 否 | 诊断时间范围 |
| `include_recommendations` | bool | 否 | 是否包含改进建议，默认 `true` |
| `output_format` | string | 否 | `markdown` / `html` / `json`，默认 `markdown` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "report_id": "rpt_diag_001",
        "subject": "equipment",
        "target": { "id": "eq_001", "name": "CNC-042", "type": "CNC" },
        "time_range": { "start": "2026-04-14T00:00:00Z", "end": "2026-04-21T00:00:00Z" },
        "summary": "CNC-042 近 7 天整体运行状况中等偏下。主要问题是主轴振动持续升高，已触发预测性维护工单。OEE 因 4 月 19 日异常停机降至 82.3%。",
        "sections": [
            {
                "title": "1. 设备健康评估",
                "content": "综合健康评分：**0.72（警告）**\n- 主轴健康：0.65（振动RMS 4.2mm/s，阈值 3.5）\n- 刀具健康：0.85（磨损度 15%）\n- 冷却系统：0.92（正常）",
                "severity": "warning"
            },
            {
                "title": "2. 异常事件分析",
                "content": "共发生 **2 次异常停机**：\n- 4/19 08:23 主轴振动超限，停机 2.3h\n- 4/20 14:10 液压压力低报警，自动恢复",
                "severity": "high"
            },
            {
                "title": "3. 改进建议",
                "content": "1. 【紧急】安排主轴轴承检查（工单已创建：WO-MAINT-789）\n2. 【建议】下次保养时校核主轴动平衡\n3. 【建议】将振动报警阈值从 3.5 调整为 3.0 以提前预警",
                "severity": "info"
            }
        ],
        "recommendations": [
            { "priority": "high", "action": "主轴轴承检查", "deadline": "2026-04-23", "related_work_order": "wo_maint_789" },
            { "priority": "medium", "action": "主轴动平衡校核", "deadline": "下次保养窗口" },
            { "priority": "low", "action": "调整振动报警阈值", "deadline": "2026-04-25" }
        ],
        "generated_at": "2026-04-21T17:00:00Z",
        "generation_time_ms": 3500
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/ai/diagnose" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "equipment",
    "target_id": "eq_001",
    "report_type": "comprehensive",
    "time_range": { "start": "2026-04-14T00:00:00Z", "end": "2026-04-21T00:00:00Z" }
  }'
```

---

### 9.3 Natural Language to Graph Query

将自然语言转换为图查询并执行。

```
POST /api/v1/ai/graph-query
```

**请求体：**

```json
{
    "question": "找出所有使用了供应商A原材料且出现质量问题的批次",
    "max_depth": 3,
    "limit": 50,
    "explain": true
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `question` | string | 是 | 自然语言查询 |
| `max_depth` | int | 否 | 图遍历最大深度，默认 3 |
| `limit` | int | 否 | 返回结果上限，默认 50 |
| `explain` | bool | 否 | 是否返回生成的 Cypher 查询语句，默认 `false` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "interpretation": "查找供应商A供应的原材料 → 追溯到使用该材料的批次 → 过滤出有质量问题的批次",
        "generated_query": "MATCH (s:Supplier {name: '供应商A'})<-[:supplied_by]-(m:Material)-[:input_to]->(b:Batch)-[:has_quality_issue]->(q:QualityIssue) RETURN b, m, q LIMIT 50",
        "nodes": [
            { "id": "batch_0038", "labels": ["Batch"], "properties": { "batch_code": "B2026-0418-003" } },
            { "id": "batch_0042", "labels": ["Batch"], "properties": { "batch_code": "B2026-0421-001" } }
        ],
        "edges": [
            { "source": "mat_0089", "target": "batch_0038", "type": "input_to" },
            { "source": "batch_0038", "target": "qi_001", "type": "has_quality_issue" }
        ],
        "summary": "共找到 **2 个批次**使用了供应商A的原材料且存在质量问题。主要缺陷类型为尺寸超差。",
        "query_time_ms": 45,
        "confidence": 0.91
    }
}
```

**curl 示例：**

```bash
curl -X POST "https://api.manufoundry.io/api/v1/ai/graph-query" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "question": "找出所有使用了供应商A原材料且出现质量问题的批次", "explain": true }'
```

---

## 10. 运营总览 API

面向管理层的高层看板，汇总生产、设备、质量、供应链全维度运营数据。

---

### 10.1 Get Executive Dashboard

运营总览看板。

```
GET /api/v1/operations/dashboard
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `factory_id` | uuid | 否 | 按工厂过滤，不传则汇总所有工厂 |
| `period` | string | 否 | `today` / `week` / `month` / `quarter`，默认 `today` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "period": "today",
        "generated_at": "2026-04-21T18:00:00Z",
        "production": {
            "active_lines": 4,
            "total_lines": 5,
            "line_utilization_rate": 0.80,
            "oee_avg": 0.83,
            "orders_completed_today": 12,
            "orders_in_progress": 8,
            "plan_achievement_rate": 0.96
        },
        "equipment": {
            "total_count": 342,
            "running": 298,
            "idle": 28,
            "maintenance": 12,
            "fault": 4,
            "avg_health_score": 0.84,
            "critical_alerts": 3
        },
        "quality": {
            "first_pass_yield": 0.965,
            "defect_rate_ppm": 11800,
            "open_ncr_count": 3,
            "spc_ooc_count": 2
        },
        "supply_chain": {
            "active_shipments": 28,
            "on_time_delivery_rate": 0.93,
            "low_stock_alerts": 45,
            "risk_level": "medium"
        },
        "energy": {
            "consumption_kwh": 12500,
            "unit_cost_per_product": 2.35,
            "compared_to_yesterday": -0.08
        }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/operations/dashboard?period=today&factory_id=fac_a1b2c3d4" \
  -H "Authorization: Bearer <token>"
```

---

### 10.2 Get OEE Analysis

OEE（综合设备效率）分析。

```
GET /api/v1/operations/oee
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `factory_id` | uuid | 否 | 按工厂过滤 |
| `line_id` | uuid | 否 | 按产线过滤 |
| `equipment_id` | uuid | 否 | 按设备过滤 |
| `period` | string | 否 | `day` / `week` / `month`，默认 `day` |
| `date` | date | 否 | 指定日期，默认今天 |
| `compare` | bool | 否 | 是否包含环比对比，默认 `true` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "period": "day",
        "date": "2026-04-21",
        "oee": 0.83,
        "availability": 0.91,
        "performance": 0.93,
        "quality": 0.98,
        "comparison": {
            "oee_change": "+0.02",
            "availability_change": "-0.01",
            "performance_change": "+0.03",
            "quality_change": "+0.005"
        },
        "loss_analysis": {
            "availability_losses": [
                { "type": "计划停机", "minutes": 120, "percentage": 45 },
                { "type": "故障停机", "minutes": 60, "percentage": 22 },
                { "type": "换线调试", "minutes": 45, "percentage": 17 },
                { "type": "待料", "minutes": 42, "percentage": 16 }
            ],
            "performance_losses": [
                { "type": "降速运行", "minutes": 35, "percentage": 55 },
                { "type": "短暂停机", "minutes": 28, "percentage": 45 }
            ],
            "quality_losses": [
                { "type": "不良品", "count": 15, "percentage": 75 },
                { "type": "返工", "count": 5, "percentage": 25 }
            ]
        },
        "trend": [
            { "date": "2026-04-15", "oee": 0.85 },
            { "date": "2026-04-16", "oee": 0.86 },
            { "date": "2026-04-17", "oee": 0.83 },
            { "date": "2026-04-18", "oee": 0.84 },
            { "date": "2026-04-19", "oee": 0.72 },
            { "date": "2026-04-20", "oee": 0.85 },
            { "date": "2026-04-21", "oee": 0.83 }
        ],
        "top_loss_equipments": [
            { "equipment_code": "CNC-018", "oee": 0.68, "main_loss": "故障停机" },
            { "equipment_code": "CNC-042", "oee": 0.74, "main_loss": "故障停机" }
        ]
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/operations/oee?period=week&compare=true" \
  -H "Authorization: Bearer <token>"
```

---

### 10.3 Get Production Schedule

获取生产排程信息。

```
GET /api/v1/operations/schedule
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `factory_id` | uuid | 是 | 工厂 ID |
| `line_id` | uuid | 否 | 按产线过滤 |
| `date_from` | date | 否 | 起始日期 |
| `date_to` | date | 否 | 截止日期 |
| `status` | string | 否 | `planned` / `in_progress` / `completed` / `delayed` |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "factory_id": "fac_a1b2c3d4",
        "date_range": { "from": "2026-04-21", "to": "2026-04-27" },
        "capacity_utilization": 0.85,
        "schedules": [
            {
                "line_id": "line_x1y2z3",
                "line_name": "1号产线",
                "shifts": [
                    {
                        "shift": "白班",
                        "date": "2026-04-21",
                        "orders": [
                            {
                                "order_id": "wo_001",
                                "order_code": "WO-2026-0421-001",
                                "product_name": "精密轴承座",
                                "planned_qty": 500,
                                "completed_qty": 350,
                                "status": "in_progress",
                                "start_time": "2026-04-21T08:00:00Z",
                                "planned_end_time": "2026-04-21T16:00:00Z",
                                "estimated_end_time": "2026-04-21T16:30:00Z",
                                "delay_minutes": 30,
                                "delay_reason": "换线时间超出预期"
                            }
                        ]
                    }
                ]
            }
        ],
        "alerts": [
            { "line": "1号产线", "date": "2026-04-21", "alert": "预计超计划30分钟", "severity": "low" }
        ]
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/operations/schedule?factory_id=fac_a1b2c3d4&date_from=2026-04-21&date_to=2026-04-27" \
  -H "Authorization: Bearer <token>"
```

---

### 10.4 Get Alerts Feed

获取实时告警流。

```
GET /api/v1/operations/alerts
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `severity` | string | 否 | `info` / `warning` / `high` / `critical` |
| `source` | string | 否 | `equipment` / `quality` / `supply_chain` / `production` |
| `status` | string | 否 | `active` / `acknowledged` / `resolved` |
| `since` | datetime | 否 | 起始时间，默认最近 24 小时 |

**响应 `200 OK`：**

```json
{
    "code": 200,
    "message": "success",
    "data": {
        "summary": {
            "total_active": 18,
            "by_severity": { "critical": 1, "high": 3, "warning": 8, "info": 6 },
            "by_source": { "equipment": 7, "quality": 5, "supply_chain": 3, "production": 3 }
        },
        "items": [
            {
                "id": "alert_001",
                "severity": "critical",
                "source": "equipment",
                "title": "CNC-025主轴温度超限",
                "description": "主轴温度达到 75°C，超过 70°C 阈值，已自动停机",
                "equipment_id": "eq_025",
                "equipment_code": "CNC-025",
                "status": "active",
                "acknowledged_by": null,
                "related_links": [
                    { "type": "work_order", "id": "wo_maint_791" },
                    { "type": "entity", "id": "eq_025" }
                ],
                "triggered_at": "2026-04-21T17:45:00Z",
                "updated_at": "2026-04-21T17:45:00Z"
            },
            {
                "id": "alert_002",
                "severity": "high",
                "source": "quality",
                "title": "SPC失控：外径特性",
                "description": "1号产线外径SPC连续7点递增，触发Rule 6",
                "status": "active",
                "triggered_at": "2026-04-21T16:30:00Z"
            }
        ],
        "pagination": { "page": 1, "page_size": 20, "total": 18, "total_pages": 1 }
    }
}
```

**curl 示例：**

```bash
curl -X GET "https://api.manufoundry.io/api/v1/operations/alerts?severity=critical&status=active" \
  -H "Authorization: Bearer <token>"
```

---

## 11. 报表中心 API

> Phase 1 新增 — 拖拽式报表编辑器，支持 7 种组件类型。

---

### 11.1 List Reports

列出所有报表。

```
GET /api/v1/reports
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `category` | string | 否 | 按分类过滤 |
| `page` | int | 否 | 页码 |
| `page_size` | int | 否 | 每页条数 |

**响应 `200 OK`：**

```json
{
    "data": [
        {
            "id": 1,
            "name": "设备综合看板",
            "description": "全厂设备健康状态与OEE分析",
            "config": { "canvas": {}, "widgets": [], "filters": [] },
            "category": "production",
            "is_published": true,
            "created_by": 1,
            "created_at": "2026-04-22T10:00:00",
            "updated_at": "2026-04-22T10:00:00"
        }
    ],
    "total": 3
}
```

---

### 11.2 Create Report

创建报表。

```
POST /api/v1/reports
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 报表名称 |
| `description` | string | 否 | 描述 |
| `config` | object | 是 | 画布配置（widgets + filters） |
| `category` | string | 否 | 分类标签 |

---

### 11.3 Get Report

获取单个报表配置。

```
GET /api/v1/reports/{report_id}
```

---

### 11.4 Update Report

更新报表配置。

```
PUT /api/v1/reports/{report_id}
```

---

### 11.5 Delete Report

删除报表。

```
DELETE /api/v1/reports/{report_id}
```

---

### 11.6 Create Snapshot

创建报表版本快照。

```
POST /api/v1/reports/{report_id}/snapshot
```

**响应 `200 OK`：**

```json
{
    "data": {
        "id": 1,
        "report_id": 1,
        "config": { "...snapshot config..." },
        "version": 1,
        "created_at": "2026-04-22T10:30:00"
    }
}
```

---

### 11.7 List Snapshots

获取报表的历史版本列表。

```
GET /api/v1/reports/{report_id}/snapshots
```

---

## 12. 模型驱动 API

> Phase 2 新增 — 元模型定义、页面生成、动态数据 CRUD、菜单管理。

---

### 12.1 元模型管理

```
GET    /api/v1/model-driven/models              # 列出所有元模型
POST   /api/v1/model-driven/models              # 创建元模型
GET    /api/v1/model-driven/models/{id}          # 获取元模型详情
PUT    /api/v1/model-driven/models/{id}          # 更新元模型
DELETE /api/v1/model-driven/models/{id}          # 删除元模型
POST   /api/v1/model-driven/models/{id}/fields   # 添加字段
POST   /api/v1/model-driven/models/import-from-ontology  # 从本体导入
```

**创建元模型请求体：**

```json
{
    "name": "supplier",
    "label": "供应商",
    "icon": "ShopOutlined",
    "description": "供应商主数据",
    "fields": [
        { "field_name": "name", "label": "名称", "field_type": "text", "required": true, "visible_in_list": true },
        { "field_name": "rating", "label": "评分", "field_type": "number", "visible_in_list": true },
        { "field_name": "status", "label": "状态", "field_type": "select", "enum_values": ["active", "inactive"] }
    ]
}
```

---

### 12.2 页面配置

```
GET    /api/v1/model-driven/pages              # 列出所有页面
POST   /api/v1/model-driven/pages              # 创建页面配置
POST   /api/v1/model-driven/pages/generate     # 自动生成页面
DELETE /api/v1/model-driven/pages/{id}          # 删除页面
```

**自动生成页面请求体：**

```json
{
    "model_name": "equipment",
    "paradigm": "master_detail",
    "title": "设备管理"
}
```

---

### 12.3 动态数据 CRUD

```
GET    /api/v1/model-driven/data/{model_name}           # 列出数据
POST   /api/v1/model-driven/data/{model_name}           # 创建记录
PUT    /api/v1/model-driven/data/{model_name}/{id}      # 更新记录
DELETE /api/v1/model-driven/data/{model_name}/{id}      # 删除记录
```

**支持的模型名称：** `equipment`, `supplier`, `product` 等（由 MetaModel 定义）。

列名白名单 `_SAFE_COLUMNS` 防止 SQL 注入。

---

### 12.4 菜单管理

```
GET    /api/v1/model-driven/menus              # 列出菜单（含树形结构）
POST   /api/v1/model-driven/menus              # 创建菜单
PUT    /api/v1/model-driven/menus/{id}          # 更新菜单
DELETE /api/v1/model-driven/menus/{id}          # 删除菜单
```

**菜单对象：**

```json
{
    "id": 1,
    "parent_id": null,
    "title": "设备管理",
    "icon": "ToolOutlined",
    "route_path": "/dynamic/equipment",
    "sort_order": 10,
    "is_visible": true
}
```

---

## 13. 认证 API

> Phase 3 新增 — JWT 登录认证。

---

### 13.1 Login

用户登录，获取 JWT Token。

```
POST /api/v1/auth/login
```

**请求体：**

```json
{
    "username": "admin",
    "password": "admin123"
}
```

**响应 `200 OK`：**

```json
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "id": 1,
        "username": "admin",
        "display_name": "系统管理员",
        "email": "admin@manufoundry.local",
        "is_admin": true,
        "roles": [
            { "id": 1, "name": "admin", "label": "系统管理员" }
        ]
    }
}
```

**演示账号：**

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 管理员 (is_admin=true) |
| `zhangsan` | `123456` | 生产主管 (production_manager) |
| `lisi` | `123456` | 质检员 (quality_inspector) |

---

### 13.2 Logout

用户登出。

```
POST /api/v1/auth/logout
```

---

### 13.3 Get Current User

获取当前登录用户信息。

```
GET /api/v1/auth/me
```

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 否 | JWT Token（可选，默认从 Header 获取） |

---

## 14. 系统管理 API

> Phase 3 新增 — 用户、角色、权限管理。

---

### 14.1 User Management

```
GET    /api/v1/admin/users              # 列出所有用户
POST   /api/v1/admin/users              # 创建用户
PUT    /api/v1/admin/users/{id}          # 更新用户
DELETE /api/v1/admin/users/{id}          # 删除用户
```

**创建用户请求体：**

```json
{
    "username": "wangwu",
    "password": "123456",
    "display_name": "王五",
    "email": "wangwu@manufoundry.local",
    "is_admin": false,
    "role_ids": [2]
}
```

---

### 14.2 Role Management

```
GET    /api/v1/admin/roles              # 列出所有角色
POST   /api/v1/admin/roles              # 创建角色
DELETE /api/v1/admin/roles/{id}          # 删除角色
PUT    /api/v1/admin/roles/0/permissions # 设置角色权限
```

**预置角色：**

| 角色 | name | 说明 |
|------|------|------|
| 系统管理员 | `admin` | 全权限 |
| 生产主管 | `production_manager` | 生产/维护/质量/报表 |
| 质检员 | `quality_inspector` | 质量/供应链 |

**设置权限请求体：**

```json
{
    "role_id": 2,
    "permissions": [
        { "resource_type": "menu", "resource_key": "/", "action": "view" },
        { "resource_type": "menu", "resource_key": "/maintenance", "action": "view" }
    ]
}
```

---

## 15. 工作流 API

> Phase 3 新增 — 工作流定义、实例生命周期、通知管理。

---

### 15.1 Workflow Definitions

```
GET    /api/v1/workflow/definitions              # 列出所有流程定义
GET    /api/v1/workflow/definitions/{id}          # 获取流程定义详情
POST   /api/v1/workflow/definitions              # 创建流程定义
PUT    /api/v1/workflow/definitions/{id}          # 更新流程定义
DELETE /api/v1/workflow/definitions/{id}          # 删除流程定义
```

**预置流程定义：**

| ID | 名称 | 说明 |
|----|------|------|
| 1 | 设备维修审批 | 设备故障→审批→维修 |
| 2 | 质量异常处理 | 质量缺陷→分析→处理 |

---

### 15.2 Start Instance

发起工作流实例。

```
POST /api/v1/workflow/definitions/{def_id}/start
```

**请求体：**

```json
{
    "title": "维修申请 - CNC 加工中心 #3",
    "form_data": {
        "equipment_name": "CNC 加工中心 #3",
        "priority": "high",
        "fault_type": "mechanical",
        "description": "主轴振动异常，超过安全阈值"
    }
}
```

**响应 `200 OK`：**

```json
{
    "id": 21,
    "status": "pending"
}
```

---

### 15.3 Instance Lifecycle

```
GET  /api/v1/workflow/instances                     # 列出实例
POST /api/v1/workflow/instances/{id}/act             # 审批/驳回
POST /api/v1/workflow/instances/{id}/cancel          # 撤销
```

**审批/驳回请求体：**

```json
{
    "action": "approve",
    "comment": "同意维修，请尽快安排"
}
```

**action 值：** `approve` | `reject`

---

### 15.4 Notifications

```
GET  /api/v1/workflow/notifications?user_id={id}     # 获取通知列表
POST /api/v1/workflow/notifications/{id}/read         # 标记单条已读
POST /api/v1/workflow/notifications/read-all?user_id={id}  # 全部标为已读
```

**通知对象：**

```json
{
    "id": 1,
    "user_id": 1,
    "type": "approval",
    "title": "审批请求：维修申请 - CNC 加工中心 #3",
    "content": "张三提交了维修申请",
    "is_read": false,
    "related_id": 21,
    "created_at": "2026-04-22T10:30:00"
}
```

---

## 附录 A：状态码速查表

| Status | 含义 | 出现场景 |
|--------|------|----------|
| `200` | 成功 | 所有成功的 GET / PUT / DELETE |
| `201` | 已创建 | POST 创建资源成功 |
| `202` | 已接受 | 异步任务已提交（管线执行、同步任务） |
| `400` | 请求错误 | 参数格式错误、JSON 解析失败 |
| `401` | 未认证 | Token 缺失、过期、无效 |
| `403` | 权限不足 | 角色/权限不满足操作要求 |
| `404` | 未找到 | 资源 ID 不存在 |
| `409` | 冲突 | 重复创建、版本冲突 |
| `422` | 校验失败 | 字段值不符合约束条件 |
| `429` | 限流 | 超过 API 调用频率限制 |
| `500` | 内部错误 | 服务端未预期的运行时异常 |
| `503` | 服务不可用 | 依赖服务（数据库/消息队列）不可用 |

## 附录 B：数据类型枚举速查

| 枚举类型 | 取值 |
|----------|------|
| DataSource Type | `opcua`, `modbus`, `mqtt`, `mes`, `erp`, `file`, `database` |
| DataSource Status | `active`, `inactive`, `error` |
| Pipeline Status | `draft`, `active`, `paused`, `archived` |
| Pipeline Run Status | `running`, `success`, `failed`, `cancelled` |
| Equipment Health | `healthy`, `warning`, `critical`, `offline` |
| Alert Severity | `info`, `warning`, `high`, `critical` |
| Alert Source | `equipment`, `quality`, `supply_chain`, `production` |
| Inspection Type | `iqc`, `spc`, `oqc` |
| Inspection Result | `pass`, `fail`, `conditional` |
| NCR Severity | `minor`, `major`, `critical` |
| Risk Level | `low`, `medium`, `high`, `critical` |
| Order Priority | `low`, `medium`, `high`, `critical` |
| Order Status | `pending`, `in_progress`, `completed`, `cancelled` |

---

> **文档维护说明**：本 API 参考文档与 ManuFoundry v1.0.0 同步。接口变更需经过版本评审，破坏性变更触发大版本升级（v2）。所有新增字段视为兼容变更，不触发版本升级。
