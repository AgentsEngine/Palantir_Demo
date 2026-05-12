"""General Analytics API — with fallback to mock data when DB unavailable."""

from fastapi import APIRouter, Query

router = APIRouter()


# ── Mock data ──────────────────────────────────────────────

MOCK_OVERVIEW = {
    "equipment_utilization": 80.5,
    "work_order_completion": 85.3,
    "production_lines": 6,
    "active_lines": 5,
}


# DB session helper — unified via core.db.safe_db_call
from app.core.db import safe_db_call as _try_db  # noqa: E402


# ── Endpoints ──────────────────────────────────────────────

@router.get("/overview")
async def analytics_overview():
    """分析总览数据."""
    async def _query(db):
        from app.models.relational import Equipment, ProductionLine, WorkOrder
        from sqlalchemy import func, select

        lines = await db.execute(select(ProductionLine))
        line_list = lines.scalars().all()

        eq_total = await db.scalar(select(func.count(Equipment.id)))
        eq_running = await db.scalar(
            select(func.count(Equipment.id)).where(Equipment.status == "running")
        )

        wo_total = await db.scalar(select(func.count(WorkOrder.id)))
        wo_completed = await db.scalar(
            select(func.count(WorkOrder.id)).where(WorkOrder.status == "completed")
        )

        return {
            "equipment_utilization": round((eq_running or 0) / max(eq_total or 1, 1) * 100, 1),
            "work_order_completion": round((wo_completed or 0) / max(wo_total or 1, 1) * 100, 1),
            "production_lines": len(line_list),
            "active_lines": sum(1 for l in line_list if l.status == "running"),
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    return MOCK_OVERVIEW
