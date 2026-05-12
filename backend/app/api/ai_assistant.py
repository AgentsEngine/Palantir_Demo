"""AI Assistant API — with fallback to mock data when DB unavailable."""

import json
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class AnalyzeRequest(BaseModel):
    query: str
    entity_type: str | None = None
    entity_id: int | None = None


# Simulated AI responses based on intent detection
INTENT_RESPONSES = {
    "oee": {
        "keywords": ["OEE", "oee", "设备综合效率", "综合效率"],
        "handler": "handle_oee_query",
    },
    "equipment": {
        "keywords": ["设备", "健康", "故障", "维修", "machine", "health"],
        "handler": "handle_equipment_query",
    },
    "production": {
        "keywords": ["产量", "产能", "排产", "工单", "production"],
        "handler": "handle_production_query",
    },
    "quality": {
        "keywords": ["质量", "缺陷", "良率", "SPC", "quality", "检验"],
        "handler": "handle_quality_query",
    },
    "supply": {
        "keywords": ["供应链", "库存", "供应商", "物流", "supply"],
        "handler": "handle_supply_query",
    },
}


def detect_intent(message: str) -> str:
    for intent, config in INTENT_RESPONSES.items():
        for kw in config["keywords"]:
            if kw in message:
                return intent
    return "general"


async def handle_oee_query(message: str) -> dict:
    async def _query(db):
        from sqlalchemy import select
        from app.models.relational import ProductionLine
        result = await db.execute(select(ProductionLine))
        lines = result.scalars().all()
        if not lines:
            return None
        line_data = []
        for line in lines:
            random.seed(line.id)
            oee = round(random.uniform(0.75, 0.92), 3)
            line_data.append({"line": line.name, "oee": f"{oee*100:.1f}%"})
        return {
            "answer": f"当前各产线OEE如下：\n" + "\n".join(f"- {d['line']}: {d['oee']}" for d in line_data),
            "data": line_data,
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    line_data = [
        {"line": "齿轮产线-A", "oee": "85.2%"},
        {"line": "齿轮产线-B", "oee": "82.7%"},
        {"line": "壳体产线", "oee": "88.1%"},
        {"line": "轴类产线", "oee": "79.5%"},
        {"line": "热处理产线", "oee": "91.3%"},
    ]
    return {
        "answer": f"当前各产线OEE如下：\n" + "\n".join(f"- {d['line']}: {d['oee']}" for d in line_data),
        "data": line_data,
    }


async def handle_equipment_query(message: str) -> dict:
    async def _query(db):
        from sqlalchemy import select
        from app.models.relational import Equipment
        result = await db.execute(
            select(Equipment).where(Equipment.health_score < 80).order_by(Equipment.health_score)
        )
        low_health = result.scalars().all()
        if not low_health:
            return None
        eq_data = [{"name": e.name, "score": round(e.health_score, 1)} for e in low_health[:5]]
        return {
            "answer": f"有 {len(low_health)} 台设备需要关注：\n"
            + "\n".join(f"- {e.name}: 健康评分 {e.health_score:.1f}" for e in low_health[:5]),
            "data": eq_data,
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    return {
        "answer": "有 6 台设备需要关注：\n- 空压机-阿特拉斯: 健康评分 38.9\n- 磨床-上海机床: 健康评分 45.2\n- 数控车床-沈阳机床: 健康评分 68.5\n- 电火花机-沙迪克: 健康评分 72.3\n- 焊接机器人-KUKA: 健康评分 76.8",
        "data": [
            {"name": "空压机-阿特拉斯", "score": 38.9},
            {"name": "磨床-上海机床", "score": 45.2},
            {"name": "数控车床-沈阳机床", "score": 68.5},
            {"name": "电火花机-沙迪克", "score": 72.3},
            {"name": "焊接机器人-KUKA", "score": 76.8},
        ],
    }


async def handle_production_query(message: str) -> dict:
    async def _query(db):
        from sqlalchemy import select
        from app.models.relational import WorkOrder
        wo_result = await db.execute(select(WorkOrder))
        work_orders = wo_result.scalars().all()
        total = len(work_orders)
        in_progress = sum(1 for wo in work_orders if wo.status == "in_progress")
        return {
            "answer": f"当前工单状态：共 {total} 个工单，其中 {in_progress} 个正在执行，{total - in_progress} 个已完成/待处理。",
            "data": {"total": total, "in_progress": in_progress},
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    return {
        "answer": "当前工单状态：共 18 个工单，其中 7 个正在执行，11 个已完成/待处理。",
        "data": {"total": 18, "in_progress": 7},
    }


async def handle_quality_query(message: str) -> dict:
    return {
        "answer": "近30天质量概况：\n- 整体良率: 98.2%\n- SPC异常点: 3个\n- 待处理CAPA: 2个\n建议关注焊接工序的温度参数波动。",
        "data": {"yield_rate": 98.2, "spc_exceptions": 3, "pending_capa": 2},
    }


async def handle_supply_query(message: str) -> dict:
    return {
        "answer": "供应链概况：\n- 活跃供应商: 8家\n- 库存预警物料: 3个\n- 在途物流: 2单\n- 准时交付率: 91.2%",
        "data": {"suppliers": 8, "inventory_alerts": 3, "in_transit": 2, "otd_rate": 91.2},
    }


# DB session helper — unified via core.db.safe_db_call
from app.core.db import safe_db_call as _try_db  # noqa: E402


@router.post("/chat")
async def chat(body: ChatRequest):
    """AI 对话查询 — 自然语言查询制造数据."""
    intent = detect_intent(body.message)

    handler_map = {
        "oee": handle_oee_query,
        "equipment": handle_equipment_query,
        "production": handle_production_query,
        "quality": handle_quality_query,
        "supply": handle_supply_query,
    }

    handler = handler_map.get(intent)
    if handler:
        result = await handler(body.message)
    else:
        result = {
            "answer": "我是 ManuFoundry AI 助手，可以帮您查询和分析制造数据。您可以问我关于设备健康、OEE、产量、质量、供应链等方面的问题。",
            "data": None,
        }

    return {
        "session_id": body.session_id or f"session-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "message": body.message,
        "intent": intent,
        "response": result["answer"],
        "data": result.get("data"),
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/sessions")
async def list_sessions(
    limit: int = Query(20, ge=1, le=100),
):
    """对话历史（模拟）."""
    sessions = [
        {
            "id": f"session-{i:04d}",
            "last_message": "3号产线今天的OEE是多少？",
            "timestamp": (datetime.now() - timedelta(days=random.randint(0, 7))).isoformat(),
            "message_count": random.randint(2, 15),
        }
        for i in range(1, min(limit + 1, 11))
    ]
    return {"data": sessions}


@router.post("/analyze")
async def smart_analyze(body: AnalyzeRequest):
    """智能分析."""
    analysis = {
        "query": body.query,
        "analysis_type": "trend",
        "insights": [
            {
                "title": "产量趋势",
                "description": "近7天日均产量 1,050 件，环比上升 3.2%。",
                "confidence": 0.92,
            },
            {
                "title": "设备利用率",
                "description": "当前设备利用率 87.5%，高于目标值 85%。",
                "confidence": 0.88,
            },
            {
                "title": "质量预警",
                "description": "焊接工序温度波动增大，建议加强SPC监控。",
                "confidence": 0.78,
            },
        ],
        "recommendations": [
            "建议对3号产线进行预防性维护，预计可将OEE提升2-3%。",
            "物料M-0042库存低于安全线，建议立即补货。",
        ],
        "timestamp": datetime.now().isoformat(),
    }
    return analysis
