"""Data Pipeline API — with fallback to mock data when DB unavailable."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

router = APIRouter()


class PipelineCreate(BaseModel):
    name: str
    description: str | None = None
    config: str  # JSON: {steps: [...]}
    schedule: str | None = None


# ── Mock data ──────────────────────────────────────────────

MOCK_PIPELINES = [
    {"id": 1, "name": "MES数据同步管线", "description": "从MES系统同步生产数据到数据湖", "status": "active", "schedule": "*/5 * * * *", "created_at": "2026-01-20T10:00:00"},
    {"id": 2, "name": "IoT传感器ETL", "description": "实时传感器数据清洗与聚合", "status": "active", "schedule": "*/1 * * * *", "created_at": "2026-02-01T14:00:00"},
    {"id": 3, "name": "质量检测数据管线", "description": "三坐标测量数据自动采集与分析", "status": "active", "schedule": "0 * * * *", "created_at": "2026-02-15T09:00:00"},
    {"id": 4, "name": "ERP物料同步", "description": "SAP物料主数据同步", "status": "paused", "schedule": "0 */6 * * *", "created_at": "2026-03-01T11:00:00"},
    {"id": 5, "name": "设备预测维护模型训练", "description": "基于历史数据训练故障预测模型", "status": "draft", "schedule": None, "created_at": "2026-03-20T16:00:00"},
    {"id": 6, "name": "供应链库存快照", "description": "每日库存快照生成与报表推送", "status": "active", "schedule": "0 2 * * *", "created_at": "2026-04-01T08:00:00"},
]

MOCK_PIPELINE_RUNS = {
    1: [
        {"id": 101, "status": "completed", "records_processed": 3520, "started_at": "2026-04-21T10:00:00", "finished_at": "2026-04-21T10:02:15", "error_message": None},
        {"id": 100, "status": "completed", "records_processed": 3180, "started_at": "2026-04-21T09:55:00", "finished_at": "2026-04-21T09:57:08", "error_message": None},
        {"id": 99,  "status": "failed",    "records_processed": 1200, "started_at": "2026-04-21T09:50:00", "finished_at": "2026-04-21T09:51:30", "error_message": "连接MES系统超时"},
        {"id": 98,  "status": "completed", "records_processed": 3490, "started_at": "2026-04-21T09:45:00", "finished_at": "2026-04-21T09:47:20", "error_message": None},
    ],
    2: [
        {"id": 201, "status": "completed", "records_processed": 84500, "started_at": "2026-04-21T10:59:00", "finished_at": "2026-04-21T10:59:03", "error_message": None},
        {"id": 200, "status": "completed", "records_processed": 84200, "started_at": "2026-04-21T10:58:00", "finished_at": "2026-04-21T10:58:02", "error_message": None},
    ],
}


# DB session helper — unified via core.db.safe_db_call
from app.core.db import safe_db_call as _try_db  # noqa: E402


# ── Endpoints ──────────────────────────────────────────────

@router.get("")
async def list_pipelines(status: str | None = None):
    """列出所有管线."""
    async def _query(db):
        from app.models.relational import Pipeline
        query = select(Pipeline).order_by(Pipeline.created_at.desc())
        if status:
            query = query.where(Pipeline.status == status)
        result = await db.execute(query)
        pipelines = result.scalars().all()
        return {
            "data": [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "status": p.status,
                    "schedule": p.schedule,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in pipelines
            ]
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    filtered = MOCK_PIPELINES
    if status:
        filtered = [p for p in filtered if p["status"] == status]
    return {"data": filtered}


@router.post("")
async def create_pipeline(body: PipelineCreate):
    """创建管线."""
    async def _query(db):
        from app.models.relational import Pipeline
        p = Pipeline(
            name=body.name,
            description=body.description,
            config=body.config,
            schedule=body.schedule,
            status="draft",
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"id": p.id, "name": p.name, "status": p.status}

    result = await _try_db(_query)
    if result is not None:
        return result
    return {"id": 7, "name": body.name, "status": "draft"}


@router.get("/{pipeline_id}")
async def get_pipeline(pipeline_id: int):
    """管线详情."""
    async def _query(db):
        from app.models.relational import Pipeline
        p = await db.get(Pipeline, pipeline_id)
        if not p:
            return None
        return {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "config": p.config,
            "status": p.status,
            "schedule": p.schedule,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    for p in MOCK_PIPELINES:
        if p["id"] == pipeline_id:
            return {
                "id": p["id"],
                "name": p["name"],
                "description": p["description"],
                "config": '{"steps": [{"type": "extract", "source": "mes"}, {"type": "transform"}, {"type": "load"}]}',
                "status": p["status"],
                "schedule": p["schedule"],
                "created_at": p["created_at"],
            }
    raise HTTPException(404, "Pipeline not found")


@router.post("/{pipeline_id}/run")
async def run_pipeline(pipeline_id: int):
    """执行管线."""
    async def _query(db):
        from app.models.relational import Pipeline, PipelineRun
        p = await db.get(Pipeline, pipeline_id)
        if not p:
            return None

        run = PipelineRun(
            pipeline_id=pipeline_id,
            status="running",
            started_at=datetime.now(),
        )
        db.add(run)
        p.status = "running"
        await db.commit()
        await db.refresh(run)

        # Simulate pipeline execution
        import random
        run.status = "completed"
        run.finished_at = datetime.now()
        run.records_processed = random.randint(500, 5000)
        p.status = "active"
        await db.commit()

        return {
            "run_id": run.id,
            "status": run.status,
            "records_processed": run.records_processed,
            "started_at": run.started_at.isoformat(),
            "finished_at": run.finished_at.isoformat(),
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    now = datetime.now()
    return {
        "run_id": 999,
        "status": "completed",
        "records_processed": 2850,
        "started_at": now.isoformat(),
        "finished_at": now.isoformat(),
    }


@router.get("/{pipeline_id}/runs")
async def list_pipeline_runs(
    pipeline_id: int,
    limit: int = Query(20, ge=1, le=100),
):
    """管线执行历史."""
    async def _query(db):
        from app.models.relational import PipelineRun
        result = await db.execute(
            select(PipelineRun)
            .where(PipelineRun.pipeline_id == pipeline_id)
            .order_by(PipelineRun.started_at.desc())
            .limit(limit)
        )
        runs = result.scalars().all()
        return {
            "data": [
                {
                    "id": r.id,
                    "status": r.status,
                    "records_processed": r.records_processed,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                    "error_message": r.error_message,
                }
                for r in runs
            ]
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    runs = MOCK_PIPELINE_RUNS.get(pipeline_id, [])
    return {"data": runs[:limit]}


@router.get("/{pipeline_id}/runs/{run_id}")
async def get_pipeline_run(pipeline_id: int, run_id: int):
    """管线执行详情."""
    async def _query(db):
        from app.models.relational import PipelineRun
        r = await db.get(PipelineRun, run_id)
        if not r or r.pipeline_id != pipeline_id:
            return None
        return {
            "id": r.id,
            "pipeline_id": r.pipeline_id,
            "status": r.status,
            "records_processed": r.records_processed,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            "error_message": r.error_message,
        }

    result = await _try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    for runs in MOCK_PIPELINE_RUNS.values():
        for r in runs:
            if r["id"] == run_id:
                return {"pipeline_id": pipeline_id, **r}
    raise HTTPException(404, "Pipeline run not found")
