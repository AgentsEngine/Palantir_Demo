"""Workflow Engine API — definition CRUD, instance lifecycle, notifications."""

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────

class WorkflowDefCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config: Optional[dict] = None
    form_config: Optional[dict] = None


class WorkflowStartRequest(BaseModel):
    title: str
    form_data: Optional[dict] = None


class ApprovalAction(BaseModel):
    action: str  # approve / reject
    comment: Optional[str] = None


# ── Mock data ─────────────────────────────────────────────

_MOCK_WORKFLOWS = [
    {
        "id": 1, "name": "设备维修审批", "description": "设备故障维修工单审批流程",
        "config": {
            "nodes": [
                {"id": "start", "type": "start", "position": {"x": 100, "y": 50}, "data": {"label": "发起申请"}},
                {"id": "review", "type": "approval", "position": {"x": 300, "y": 50}, "data": {"label": "生产主管审批", "approver_role": "production_manager"}},
                {"id": "end-approve", "type": "end", "position": {"x": 500, "y": 0}, "data": {"label": "通过"}},
                {"id": "end-reject", "type": "end", "position": {"x": 500, "y": 100}, "data": {"label": "驳回"}},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "review"},
                {"id": "e2", "source": "review", "target": "end-approve", "label": "通过"},
                {"id": "e3", "source": "review", "target": "end-reject", "label": "驳回"},
            ],
        },
        "form_config": {
            "fields": [
                {"name": "equipment_name", "label": "设备名称", "type": "string", "required": True},
                {"name": "fault_desc", "label": "故障描述", "type": "text", "required": True},
                {"name": "urgency", "label": "紧急程度", "type": "enum", "options": ["低", "中", "高"]},
            ],
        },
        "status": "published", "version": 1,
    },
    {
        "id": 2, "name": "质量异常处理", "description": "质量异常上报与处理审批",
        "config": {
            "nodes": [
                {"id": "start", "type": "start", "position": {"x": 100, "y": 50}, "data": {"label": "上报异常"}},
                {"id": "qc-review", "type": "approval", "position": {"x": 300, "y": 50}, "data": {"label": "质检主管审批", "approver_role": "quality_inspector"}},
                {"id": "end", "type": "end", "position": {"x": 500, "y": 50}, "data": {"label": "结束"}},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "qc-review"},
                {"id": "e2", "source": "qc-review", "target": "end"},
            ],
        },
        "form_config": {
            "fields": [
                {"name": "defect_type", "label": "缺陷类型", "type": "string", "required": True},
                {"name": "severity", "label": "严重程度", "type": "enum", "options": ["轻微", "一般", "严重"]},
            ],
        },
        "status": "published", "version": 1,
    },
]

_MOCK_INSTANCES = [
    {"id": 1, "workflow_id": 1, "title": "CNC加工中心主轴异响维修",
     "initiator_id": 2, "initiator_name": "张三",
     "status": "pending", "form_data": json.dumps({"equipment_name": "CNC加工中心-01", "fault_desc": "主轴运行时异响", "urgency": "高"}),
     "workflow_state": json.dumps({"current_node": "review"}),
     "created_at": "2026-04-22T09:30:00",
     "approvals": [
         {"id": 1, "node_id": "review", "approver_id": 2, "action": None, "comment": None, "acted_at": None},
     ]},
    {"id": 2, "workflow_id": 2, "title": "焊接工序气孔缺陷处理",
     "initiator_id": 3, "initiator_name": "李四",
     "status": "approved", "form_data": json.dumps({"defect_type": "气孔", "severity": "一般"}),
     "workflow_state": json.dumps({"current_node": "end"}),
     "created_at": "2026-04-21T14:00:00",
     "approvals": [
         {"id": 2, "node_id": "qc-review", "approver_id": 3, "action": "approve", "comment": "已确认处理", "acted_at": "2026-04-21T15:30:00"},
     ]},
]

_MOCK_NOTIFICATIONS = [
    {"id": 1, "user_id": 2, "title": "待审批：CNC加工中心主轴异响维修",
     "content": "张三提交了设备维修审批，请尽快处理", "type": "approval",
     "is_read": False, "link": "/workflow/my-approvals",
     "created_at": "2026-04-22T09:30:00"},
    {"id": 2, "user_id": 3, "title": "您的申请已通过",
     "content": "质量异常处理申请「焊接工序气孔缺陷处理」已审批通过", "type": "info",
     "is_read": True, "link": "/workflow/my-applications",
     "created_at": "2026-04-21T15:30:00"},
]

_wf_id_counter = 20
_inst_id_counter = 20


# DB session helper — unified via core.db.safe_db_call
from app.core.db import safe_db_call as _try_db  # noqa: E402


# ── Workflow Definition CRUD ─────────────────────────────

@router.get("/definitions")
async def list_definitions():
    """工作流定义列表."""
    async def _query(db):
        from app.models.relational import WorkflowDef
        result = await db.execute(select(WorkflowDef).order_by(WorkflowDef.id))
        defs = result.scalars().all()
        return {"data": [
            {"id": d.id, "name": d.name, "description": d.description,
             "config": json.loads(d.config) if isinstance(d.config, str) else d.config,
             "form_config": json.loads(d.form_config) if isinstance(d.form_config, str) else d.form_config,
             "status": d.status, "version": d.version}
            for d in defs
        ]}

    result = await _try_db(_query)
    return result or {"data": _MOCK_WORKFLOWS}


@router.get("/definitions/{def_id}")
async def get_definition(def_id: int):
    """获取工作流定义详情."""
    async def _query(db):
        from app.models.relational import WorkflowDef
        d = await db.get(WorkflowDef, def_id)
        if not d:
            return None
        return {
            "id": d.id, "name": d.name, "description": d.description,
            "config": json.loads(d.config) if isinstance(d.config, str) else d.config,
            "form_config": json.loads(d.form_config) if isinstance(d.form_config, str) else d.form_config,
            "status": d.status, "version": d.version,
        }

    result = await _try_db(_query)
    if result is not None:
        return result
    for d in _MOCK_WORKFLOWS:
        if d["id"] == def_id:
            return d
    raise HTTPException(404, "Workflow not found")


@router.post("/definitions")
async def create_definition(body: WorkflowDefCreate):
    """创建工作流定义."""
    async def _query(db):
        from app.models.relational import WorkflowDef
        d = WorkflowDef(
            name=body.name, description=body.description,
            config=json.dumps(body.config or {"nodes": [], "edges": []}, ensure_ascii=False),
            form_config=json.dumps(body.form_config or {"fields": []}, ensure_ascii=False),
        )
        db.add(d)
        await db.commit()
        await db.refresh(d)
        return {"id": d.id, "name": d.name}

    result = await _try_db(_query)
    if result is not None:
        return result
    global _wf_id_counter
    _wf_id_counter += 1
    _MOCK_WORKFLOWS.append({
        "id": _wf_id_counter, "name": body.name, "description": body.description,
        "config": body.config or {"nodes": [], "edges": []},
        "form_config": body.form_config or {"fields": []},
        "status": "draft", "version": 1,
    })
    return {"id": _wf_id_counter, "name": body.name}


@router.put("/definitions/{def_id}")
async def update_definition(def_id: int, body: WorkflowDefCreate):
    """更新工作流定义."""
    async def _query(db):
        from app.models.relational import WorkflowDef
        d = await db.get(WorkflowDef, def_id)
        if not d:
            return None
        d.name = body.name
        if body.description is not None:
            d.description = body.description
        if body.config is not None:
            d.config = json.dumps(body.config, ensure_ascii=False)
        if body.form_config is not None:
            d.form_config = json.dumps(body.form_config, ensure_ascii=False)
        d.version += 1
        await db.commit()
        return {"id": d.id, "version": d.version}

    result = await _try_db(_query)
    if result is not None:
        return result
    for d in _MOCK_WORKFLOWS:
        if d["id"] == def_id:
            d["name"] = body.name
            if body.config:
                d["config"] = body.config
            return {"id": def_id, "version": d.get("version", 1)}
    raise HTTPException(404, "Workflow not found")


@router.delete("/definitions/{def_id}")
async def delete_definition(def_id: int):
    """删除工作流定义."""
    async def _query(db):
        from app.models.relational import WorkflowDef
        d = await db.get(WorkflowDef, def_id)
        if not d:
            return None
        await db.delete(d)
        await db.commit()
        return {"ok": True}

    result = await _try_db(_query)
    if result is not None:
        return result
    return {"ok": True}


# ── Instance Lifecycle ───────────────────────────────────

@router.get("/instances")
async def list_instances(
    status: Optional[str] = None,
    initiator_id: Optional[int] = None,
):
    """工作流实例列表."""
    async def _query(db):
        from app.models.relational import WorkflowInstance, WorkflowApproval
        query = select(WorkflowInstance).order_by(WorkflowInstance.created_at.desc())
        if status:
            query = query.where(WorkflowInstance.status == status)
        if initiator_id:
            query = query.where(WorkflowInstance.initiator_id == initiator_id)
        result = await db.execute(query)
        instances = result.scalars().all()
        out = []
        for inst in instances:
            approvals_res = await db.execute(
                select(WorkflowApproval).where(WorkflowApproval.instance_id == inst.id)
            )
            approvals = approvals_res.scalars().all()
            out.append({
                "id": inst.id, "workflow_id": inst.workflow_id, "title": inst.title,
                "initiator_id": inst.initiator_id, "status": inst.status,
                "form_data": json.loads(inst.form_data) if isinstance(inst.form_data, str) else inst.form_data,
                "workflow_state": json.loads(inst.workflow_state) if isinstance(inst.workflow_state, str) else inst.workflow_state,
                "created_at": inst.created_at.isoformat() if inst.created_at else None,
                "approvals": [
                    {"id": a.id, "node_id": a.node_id, "approver_id": a.approver_id,
                     "action": a.action, "comment": a.comment, "acted_at": a.acted_at.isoformat() if a.acted_at else None}
                    for a in approvals
                ],
            })
        return {"data": out}

    result = await _try_db(_query)
    if result is not None:
        return result

    filtered = _MOCK_INSTANCES
    if status:
        filtered = [i for i in filtered if i["status"] == status]
    return {"data": filtered}


@router.post("/definitions/{def_id}/start")
async def start_instance(def_id: int, body: WorkflowStartRequest):
    """发起工作流实例."""
    async def _query(db):
        from app.models.relational import WorkflowDef, WorkflowInstance, WorkflowApproval
        d = await db.get(WorkflowDef, def_id)
        if not d:
            return None
        config = json.loads(d.config) if isinstance(d.config, str) else d.config
        first_approval_node = None
        for node in config.get("nodes", []):
            if node.get("type") == "approval":
                first_approval_node = node
                break

        inst = WorkflowInstance(
            workflow_id=def_id, title=body.title,
            form_data=json.dumps(body.form_data or {}, ensure_ascii=False),
            workflow_state=json.dumps({"current_node": first_approval_node["id"] if first_approval_node else "end"}, ensure_ascii=False),
            status="pending",
        )
        db.add(inst)
        await db.flush()

        if first_approval_node:
            approval = WorkflowApproval(
                instance_id=inst.id, approver_id=2,
                node_id=first_approval_node["id"],
            )
            db.add(approval)
        await db.commit()
        await db.refresh(inst)
        return {"id": inst.id, "status": inst.status}

    result = await _try_db(_query)
    if result is not None:
        return result
    global _inst_id_counter
    _inst_id_counter += 1
    inst = {
        "id": _inst_id_counter, "workflow_id": def_id, "title": body.title,
        "initiator_id": 1, "initiator_name": "当前用户", "status": "pending",
        "form_data": json.dumps(body.form_data or {}),
        "workflow_state": json.dumps({"current_node": "review"}),
        "created_at": datetime.now().isoformat(),
        "approvals": [{"id": _inst_id_counter + 100, "node_id": "review", "approver_id": 2, "action": None}],
    }
    _MOCK_INSTANCES.append(inst)
    return {"id": _inst_id_counter, "status": "pending"}


@router.post("/instances/{inst_id}/act")
async def approve_or_reject(inst_id: int, body: ApprovalAction):
    """审批/驳回工作流实例."""
    if body.action not in ("approve", "reject"):
        raise HTTPException(400, "action must be 'approve' or 'reject'")

    async def _query(db):
        from app.models.relational import WorkflowInstance, WorkflowApproval
        inst = await db.get(WorkflowInstance, inst_id)
        if not inst:
            return None

        pending_approval = await db.scalar(
            select(WorkflowApproval)
            .where(WorkflowApproval.instance_id == inst_id, WorkflowApproval.action == None)
        )
        if pending_approval:
            pending_approval.action = body.action
            pending_approval.comment = body.comment
            pending_approval.acted_at = datetime.now()

        inst.status = body.action + "d" if body.action == "approve" else "rejected"
        inst.workflow_state = json.dumps({"current_node": "end"})
        await db.commit()
        return {"id": inst.id, "status": inst.status}

    result = await _try_db(_query)
    if result is not None:
        return result

    for inst in _MOCK_INSTANCES:
        if inst["id"] == inst_id:
            inst["status"] = "approved" if body.action == "approve" else "rejected"
            for a in inst.get("approvals", []):
                if a.get("action") is None:
                    a["action"] = body.action
                    a["comment"] = body.comment
                    a["acted_at"] = datetime.now().isoformat()
            return {"id": inst_id, "status": inst["status"]}
    raise HTTPException(404, "Instance not found")


@router.post("/instances/{inst_id}/cancel")
async def cancel_instance(inst_id: int):
    """撤销工作流实例."""
    async def _query(db):
        from app.models.relational import WorkflowInstance
        inst = await db.get(WorkflowInstance, inst_id)
        if not inst:
            return None
        inst.status = "cancelled"
        await db.commit()
        return {"id": inst.id, "status": "cancelled"}

    result = await _try_db(_query)
    if result is not None:
        return result
    for inst in _MOCK_INSTANCES:
        if inst["id"] == inst_id:
            inst["status"] = "cancelled"
            return {"id": inst_id, "status": "cancelled"}
    raise HTTPException(404, "Instance not found")


# ── Notifications ────────────────────────────────────────

@router.get("/notifications")
async def list_notifications(user_id: int = Query(1)):
    """通知列表."""
    async def _query(db):
        from app.models.relational import Notification
        result = await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
        )
        items = result.scalars().all()
        return {"data": [
            {"id": n.id, "user_id": n.user_id, "title": n.title, "content": n.content,
             "type": n.type, "is_read": n.is_read, "link": n.link,
             "created_at": n.created_at.isoformat() if n.created_at else None}
            for n in items
        ]}

    result = await _try_db(_query)
    if result is not None:
        return result
    return {"data": [n for n in _MOCK_NOTIFICATIONS if n["user_id"] == user_id]}


@router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: int):
    """标记通知已读."""
    async def _query(db):
        from app.models.relational import Notification
        n = await db.get(Notification, notif_id)
        if not n:
            return None
        n.is_read = True
        await db.commit()
        return {"ok": True}

    result = await _try_db(_query)
    return result or {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(user_id: int = Query(1)):
    """全部标记已读."""
    async def _query(db):
        from app.models.relational import Notification
        from sqlalchemy import update
        await db.execute(
            update(Notification).where(Notification.user_id == user_id).values(is_read=True)
        )
        await db.commit()
        return {"ok": True}

    result = await _try_db(_query)
    return result or {"ok": True}
