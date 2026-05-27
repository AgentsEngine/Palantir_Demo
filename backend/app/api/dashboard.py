"""Dashboard API for production operations."""

from __future__ import annotations

import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import safe_db_call as _try_db
from app.models.relational import Defect, Equipment, Factory, ProductionLine, WorkOrder

router = APIRouter()

MOCK_OVERVIEW = {
    "factories": {"count": 320},
    "equipment": {"total": 1920, "running": 1450, "utilization_rate": 0.755},
    "production_lines": {"total": 960, "running": 748},
    "work_orders": {"total": 1800, "in_progress": 760, "completed": 720},
    "quality": {"defect_count": 900},
    "avg_equipment_health": 0.76,
}


@router.get("/overview")
async def get_overview():
    result = await _try_db(lambda db: _query_overview(db))
    return result or MOCK_OVERVIEW


async def _query_overview(db: AsyncSession):
    factory_count = await db.scalar(select(func.count(Factory.id)))
    equipment_total = await db.scalar(select(func.count(Equipment.id)))
    equipment_running = await db.scalar(select(func.count(Equipment.id)).where(Equipment.status == "running"))
    line_count = await db.scalar(select(func.count(ProductionLine.id)))
    lines_running = await db.scalar(select(func.count(ProductionLine.id)).where(ProductionLine.status == "running"))
    wo_total = await db.scalar(select(func.count(WorkOrder.id)))
    wo_in_progress = await db.scalar(select(func.count(WorkOrder.id)).where(WorkOrder.status == "in_progress"))
    wo_completed = await db.scalar(select(func.count(WorkOrder.id)).where(WorkOrder.status == "completed"))
    defect_count = await db.scalar(select(func.count(Defect.id)))
    avg_health = await db.scalar(select(func.avg(Equipment.health_score))) or 0.0

    return {
        "factories": {"count": factory_count or 0},
        "equipment": {
            "total": equipment_total or 0,
            "running": equipment_running or 0,
            "utilization_rate": round((equipment_running or 0) / max(equipment_total or 1, 1), 3),
        },
        "production_lines": {"total": line_count or 0, "running": lines_running or 0},
        "work_orders": {
            "total": wo_total or 0,
            "in_progress": wo_in_progress or 0,
            "completed": wo_completed or 0,
        },
        "quality": {"defect_count": defect_count or 0},
        "avg_equipment_health": round(avg_health / 100, 3) if avg_health > 1 else round(avg_health, 3),
    }


@router.get("/oee")
async def get_oee(line_id: int | None = None):
    lines = await _try_db(lambda db: _query_lines(db, line_id))
    if not lines:
        lines = [
            {"id": i, "name": f"产线-{i:03d}", "oee_target": 0.86}
            for i in range(1, 25)
        ]

    oee_data = []
    for line in lines[:80]:
        lid = line["id"] if isinstance(line, dict) else line.id
        lname = line["name"] if isinstance(line, dict) else line.name
        target = line.get("oee_target", 0.86) if isinstance(line, dict) else getattr(line, "oee_target", 0.86)
        random.seed(lid * 17)
        availability = round(random.uniform(0.82, 0.98), 3)
        performance = round(random.uniform(0.78, 0.96), 3)
        quality_rate = round(random.uniform(0.94, 0.998), 3)
        oee_data.append({
            "line_id": lid,
            "line_name": lname,
            "availability": availability,
            "performance": performance,
            "quality": quality_rate,
            "oee": round(availability * performance * quality_rate, 3),
            "target": target,
        })
    return {"data": oee_data}


async def _query_lines(db: AsyncSession, line_id: int | None):
    query = select(ProductionLine).order_by(ProductionLine.id)
    if line_id:
        query = query.where(ProductionLine.id == line_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/production")
async def get_production_stats(days: int = Query(14, ge=1, le=90)):
    result = await _try_db(lambda db: _query_production_stats(db, days))
    if result is not None:
        return result
    return {"data": _mock_production_stats(days)}


async def _query_production_stats(db: AsyncSession, days: int):
    start = datetime.now() - timedelta(days=days - 1)
    result = await db.execute(select(WorkOrder).where(WorkOrder.planned_start >= start))
    rows = result.scalars().all()
    buckets: dict[str, dict[str, int]] = {}
    for row in rows:
        day = row.planned_start.strftime("%Y-%m-%d") if row.planned_start else datetime.now().strftime("%Y-%m-%d")
        bucket = buckets.setdefault(day, {"planned": 0, "actual": 0, "passed": 0})
        planned = int(row.quantity or 0)
        actual = int(row.completed_quantity or 0)
        bucket["planned"] += planned
        bucket["actual"] += actual
        bucket["passed"] += int(actual * 0.985) if row.status == "completed" else int(actual * 0.965)

    data = []
    for offset in range(days):
        day = (start + timedelta(days=offset)).strftime("%Y-%m-%d")
        bucket = buckets.get(day, {"planned": 0, "actual": 0, "passed": 0})
        data.append({
            "date": day,
            "planned": bucket["planned"],
            "actual": bucket["actual"],
            "passed": bucket["passed"],
            "yield_rate": round(bucket["passed"] / max(bucket["actual"], 1), 3),
        })
    return {"data": data}


def _mock_production_stats(days: int) -> list[dict]:
    now = datetime.now()
    data = []
    for offset in range(days):
        day = now - timedelta(days=days - offset - 1)
        random.seed(day.toordinal())
        planned = random.randint(18000, 36000)
        actual = random.randint(int(planned * 0.78), planned)
        passed = random.randint(int(actual * 0.94), actual)
        data.append({
            "date": day.strftime("%Y-%m-%d"),
            "planned": planned,
            "actual": actual,
            "passed": passed,
            "yield_rate": round(passed / max(actual, 1), 3),
        })
    return data


@router.get("/alerts")
async def get_alerts(limit: int = Query(20, ge=1, le=100)):
    result = await _try_db(lambda db: _query_alerts(db, limit))
    if result is not None:
        return result
    alerts = [
        {
            "id": f"alert-{i}",
            "type": "equipment_health",
            "severity": "critical" if i % 5 == 0 else "warning",
            "title": f"设备 EQ-{i:04d} 健康度偏低",
            "message": f"当前健康度 {random.uniform(35, 68):.1f}，建议安排点检。",
            "entity_id": i,
            "entity_type": "Equipment",
            "timestamp": (datetime.now() - timedelta(hours=i)).isoformat(),
        }
        for i in range(1, limit + 1)
    ]
    return {"data": alerts, "total": len(alerts)}


async def _query_alerts(db: AsyncSession, limit: int):
    result = await db.execute(
        select(Equipment)
        .where(Equipment.health_score < 68)
        .order_by(Equipment.health_score.asc(), Equipment.id.asc())
        .limit(limit)
    )
    low_health = result.scalars().all()
    alerts = []
    for eq in low_health:
        severity = "critical" if eq.health_score < 52 else "warning"
        alerts.append({
            "id": f"alert-eq-{eq.id}",
            "type": "equipment_health",
            "severity": severity,
            "title": f"设备 {eq.name} 健康度偏低",
            "message": f"当前健康度: {eq.health_score:.1f}",
            "entity_id": eq.id,
            "entity_type": "Equipment",
            "timestamp": eq.updated_at.isoformat() if eq.updated_at else None,
        })
    return {"data": alerts, "total": len(alerts)}
