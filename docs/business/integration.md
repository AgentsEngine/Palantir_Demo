# ManuFoundry 集成开发指南

> 数据源连接器架构、管线引擎原理、自定义开发指南、对接真实制造系统

---

## 目录

- [数据接入架构](#数据接入架构)
- [数据源连接器](#数据源连接器)
- [管线引擎](#管线引擎)
- [自定义连接器开发](#自定义连接器开发)
- [对接真实制造系统](#对接真实制造系统)
- [Webhook 配置](#webhook-配置)

---

## 数据接入架构

ManuFoundry 的数据接入层对标 Palantir Foundry 的 Layer 2（Data Integration），负责从异构制造系统中抽取、清洗、转换数据，统一注入 Ontology 语义层。

```
┌─────────────────────────────────────────────────────────────────┐
│                      外部制造系统                                │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐        │
│  │ MES │  │ ERP │  │ IoT │  │ PLC │  │SCADA│  │ LIMS│        │
│  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘        │
└─────┼────────┼────────┼────────┼────────┼────────┼────────────┘
      │        │        │        │        │        │
      ▼        ▼        ▼        ▼        ▼        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   连接器层（Connectors）                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ REST/HTTP    │ │ OPC-UA/Modbus│ │ MQTT/Kafka   │            │
│  │ Database JDBC│ │ File (CSV/Excel)│ WebSocket   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   管线引擎（Pipeline Engine）                     │
│  Extract → Clean → Normalize → Deduplicate → Map → Validate    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Ontology 语义层（PostgreSQL + Neo4j）                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 数据源连接器

### 预置连接器

系统内置 4 类数据源模拟器，位于 `backend/app/services/data_integration/connectors/`：

#### 1. MES 模拟器 (`mes_simulator.py`)

模拟制造执行系统（MES）数据，包含：

- **工单数据**：工单编号、产品、数量、状态、计划/实际时间
- **工序数据**：工步编号、设备、操作员、结果
- **生产报表**：每班次产量、合格数、OEE

```python
from app.services.data_integration.connectors.mes_simulator import MESSimulator

sim = MESSimulator(factory_id=1)
work_orders = sim.generate_work_orders(count=20)
operations = sim.generate_operations(work_orders)
```

**模拟数据量**：20 个工单、60 个工序、7 天生产报表

#### 2. ERP 模拟器 (`erp_simulator.py`)

模拟企业资源计划（ERP）系统数据：

- **销售订单**：订单号、客户、产品、数量、交期、优先级
- **物料主数据**：物料编号、类型、规格、单位、安全库存
- **BOM 清单**：产品-物料对应关系、用量、层级

#### 3. IoT 模拟器 (`iot_simulator.py`)

模拟物联网传感器网关数据：

- **传感器配置**：温度、振动、压力、电流等传感器类型
- **实时读数**：高频采样数据（1Hz-1kHz），含正常波动和异常注入
- **设备关联**：每台设备关联多个传感器

```python
from app.services.data_integration.connectors.iot_simulator import IoTSimulator

sim = IoTSimulator()
sensors = sim.generate_sensors(equipment_count=15, sensors_per_equipment=13)
readings = sim.generate_readings(sensors, hours=24)
```

**模拟数据量**：195 个传感器、9360 条/24小时读数

#### 4. PLC 模拟器 (`plc_simulator.py`)

模拟可编程逻辑控制器（PLC）数据：

- **设备状态**：运行/停机/待机/维护
- **控制参数**：主轴转速、进给速度、温度设定值
- **报警记录**：超限报警、故障代码

### 数据源管理 API

通过 REST API 管理数据源的完整生命周期：

```
POST   /api/v1/data-sources          创建数据源
GET    /api/v1/data-sources          列出所有数据源
GET    /api/v1/data-sources/{id}     查看数据源详情
PUT    /api/v1/data-sources/{id}     更新配置
DELETE /api/v1/data-sources/{id}     删除数据源
POST   /api/v1/data-sources/{id}/test   测试连接
POST   /api/v1/data-sources/{id}/sync   触发同步
GET    /api/v1/data-sources/{id}/status 查看同步状态
GET    /api/v1/data-sources/{id}/preview 数据预览
```

---

## 管线引擎

管线引擎位于 `backend/app/services/data_integration/pipeline_engine.py`，实现轻量级 ETL 流程。

### 管线步骤

每条管线由一系列有序步骤组成：

| 步骤类型 | 说明 | 输入 | 输出 |
|----------|------|------|------|
| `extract` | 从数据源抽取原始数据 | 数据源配置 | 原始数据集 |
| `clean` | 数据清洗（去空值、格式修正） | 原始数据 | 清洗后数据 |
| `normalize` | 标准化（单位转换、编码统一） | 清洗后数据 | 标准化数据 |
| `deduplicate` | 去重（基于主键或哈希） | 标准化数据 | 去重数据 |
| `map` | Ontology 映射（字段→实体属性） | 去重数据 | 实体数据 |
| `validate` | 数据校验（类型/范围/完整性） | 实体数据 | 最终数据 |

### 管线配置

管线以 JSON 配置定义，存储在 `pipelines.config` 字段中：

```json
{
  "steps": [
    {"type": "extract", "source": "mes", "query": "work_orders"},
    {"type": "clean",   "rules": ["remove_nulls", "trim_strings"]},
    {"type": "normalize", "mappings": [
      {"field": "status", "values": {"1": "pending", "2": "in_progress", "3": "completed"}}
    ]},
    {"type": "deduplicate", "key": "order_no"},
    {"type": "map", "entity": "WorkOrder", "field_map": {
      "order_no": "order_no",
      "qty": "quantity",
      "line": "line_id"
    }},
    {"type": "validate", "rules": [
      {"field": "quantity", "type": "float", "min": 0},
      {"field": "status", "enum": ["pending", "in_progress", "completed"]}
    ]}
  ]
}
```

### 管线调度

支持 Cron 表达式定时调度：

| 调度 | Cron 表达式 | 说明 |
|------|-------------|------|
| 每 5 分钟 | `*/5 * * * *` | 高频传感器数据 |
| 每 1 分钟 | `*/1 * * * *` | IoT 实时数据 |
| 每小时 | `0 * * * *` | 质量检测数据 |
| 每 6 小时 | `0 */6 * * *` | ERP 物料同步 |
| 每天凌晨 | `0 2 * * *` | 库存快照 |

### 预置管线

系统内置 6 条管线：

| ID | 名称 | 调度 | 说明 |
|----|------|------|------|
| 1 | MES 数据同步 | 每 5 分钟 | 工单+工序数据 |
| 2 | IoT 传感器 ETL | 每 1 分钟 | 实时传感器数据 |
| 3 | 质量检测数据 | 每小时 | 三坐标测量数据 |
| 4 | ERP 物料同步 | 每 6 小时 | SAP 物料主数据 |
| 5 | 设备预测维护模型训练 | 手动 | 故障预测模型 |
| 6 | 供应链库存快照 | 每天凌晨 | 库存报表 |

---

## 自定义连接器开发

### 开发规范

每个连接器需继承基础接口并实现以下方法：

```python
# backend/app/services/data_integration/connectors/base.py

from abc import ABC, abstractmethod
from typing import Any

class BaseConnector(ABC):
    """数据源连接器基类"""

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    async def test_connection(self) -> bool:
        """测试连接是否可用"""
        ...

    @abstractmethod
    async def extract(self, query: str | None = None) -> list[dict]:
        """抽取数据"""
        ...

    @abstractmethod
    async def get_schema(self) -> dict:
        """返回数据源的 schema 信息"""
        ...

    def validate_config(self) -> list[str]:
        """验证配置项，返回错误列表"""
        errors = []
        if not self.config.get("host"):
            errors.append("缺少 host 配置")
        return errors
```

### 示例：开发 OPC-UA 连接器

```python
# backend/app/services/data_integration/connectors/opcua_connector.py

from .base import BaseConnector

class OPCUAConnector(BaseConnector):
    """OPC-UA 工业协议连接器"""

    async def test_connection(self) -> bool:
        try:
            from opcua import Client
            client = Client(self.config["endpoint"])
            client.connect()
            client.disconnect()
            return True
        except Exception:
            return False

    async def extract(self, query: str | None = None) -> list[dict]:
        from opcua import Client
        client = Client(self.config["endpoint"])
        client.connect()

        nodes = self.config.get("nodes", [])
        results = []
        for node_id in nodes:
            node = client.get_node(node_id)
            value = node.get_value()
            results.append({
                "node_id": node_id,
                "value": value,
                "timestamp": datetime.now().isoformat(),
            })

        client.disconnect()
        return results

    async def get_schema(self) -> dict:
        return {
            "type": "opcua",
            "fields": ["node_id", "value", "timestamp"],
            "sample_rate": self.config.get("sample_rate", 1000),
        }
```

### 注册新连接器

1. 创建连接器文件到 `connectors/` 目录
2. 在 `data_sources.py` 的 `SOURCE_TYPE_MAP` 中注册：

```python
SOURCE_TYPE_MAP = {
    "mes": MESSimulator,
    "erp": ERPSimulator,
    "iot": IoTSimulator,
    "plc": PLCSimulator,
    "opcua": OPCUAConnector,  # 新增
}
```

3. 通过 API 创建使用该连接器的数据源：

```bash
curl -X POST http://localhost:8000/api/v1/data-sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "车间OPC-UA网关",
    "source_type": "opcua",
    "connection_config": "{\"endpoint\": \"opc.tcp://192.168.1.100:4840\", \"nodes\": [\"ns=2;s=Temperature\", \"ns=2;s=Pressure\"]}"
  }'
```

---

## 对接真实制造系统

### MES 系统对接

大多数 MES 系统提供 REST API 或数据库视图：

```python
class MESConnector(BaseConnector):
    async def extract(self, query=None):
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.config['api_url']}/api/work-orders",
                headers={"Authorization": f"Bearer {self.config['api_key']}"},
                params={"status": "active", "limit": 1000}
            )
            return resp.json()["records"]
```

### ERP（SAP）对接

SAP 通过 RFC/BAPI 接口暴露数据：

```python
class SAPConnector(BaseConnector):
    async def extract(self, query=None):
        from pyrfc import Connection
        conn = Connection(
            ashost=self.config["host"],
            sysnr=self.config["sysnr"],
            client=self.config["client"],
            user=self.config["user"],
            passwd=self.config["password"]
        )
        result = conn.call("BAPI_MATERIAL_GETLIST", ...)
        return self._parse_sap_result(result)
```

### IoT 平台对接

通过 MQTT 订阅传感器数据：

```python
class MQTTConnector(BaseConnector):
    async def extract(self, query=None):
        import aiomqtt
        messages = []
        async with aiomqtt.Client(self.config["broker"]) as client:
            await client.subscribe(self.config["topic"])
            async for message in client.messages:
                messages.append(json.loads(message.payload))
                if len(messages) >= self.config.get("batch_size", 100):
                    break
        return messages
```

### 数据库直连

通过 SQLAlchemy 连接外部数据库：

```python
class DatabaseConnector(BaseConnector):
    async def extract(self, query=None):
        from sqlalchemy.ext.asyncio import create_async_engine
        engine = create_async_engine(self.config["connection_string"])
        async with engine.connect() as conn:
            result = await conn.execute(text(query or self.config["default_query"]))
            return [dict(row._mapping) for row in result]
```

---

## Webhook 配置

### 告警 Webhook

系统支持将告警事件推送到外部系统（企业微信、钉钉、Slack 等）。

### 配置方式

在环境变量中配置 Webhook URL：

```env
WEBHOOK_ALERT_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
WEBHOOK_ENABLED=true
```

### 推送格式

```json
{
  "event_type": "equipment_alert",
  "severity": "critical",
  "title": "设备健康预警",
  "message": "空压机-阿特拉斯健康评分降至 38.9，建议立即停机检修",
  "entity": {"type": "Equipment", "id": 15, "name": "空压机-阿特拉斯"},
  "timestamp": "2026-04-21T14:30:00"
}
```

### 扩展点

在 `backend/app/services/` 中添加 `webhook_service.py`：

```python
import httpx
from app.config import settings

async def send_alert_webhook(event: dict):
    if not settings.WEBHOOK_ENABLED:
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            settings.WEBHOOK_ALERT_URL,
            json=event,
            timeout=10.0
        )
```

在需要触发告警的地方（如设备健康评分低于阈值时）调用此函数即可。

---

## 集成最佳实践

1. **先小后大**：先用模拟器验证管线逻辑，再切换到真实数据源
2. **渐进接入**：按 MES → IoT → ERP → 质量系统的顺序接入
3. **数据质量监控**：在管线 `validate` 步骤中设置严格校验规则
4. **错误隔离**：每条管线独立运行，单条失败不影响其他管线
5. **增量同步**：优先使用增量抽取（基于时间戳或序列号），减少全量同步开销
6. **Mock 回退**：所有端点都内置 `_try_db()` Mock 数据回退，确保离线环境也可演示
