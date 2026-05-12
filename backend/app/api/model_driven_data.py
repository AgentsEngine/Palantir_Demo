"""Model-Driven: dynamic data CRUD over whitelisted relational tables.

All identifiers go through both the SAFE_COLUMNS whitelist AND the
`assert_safe_identifier` regex check (defense in depth). Values pass
through SQLAlchemy bound parameters as usual.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from app.api._model_driven_shared import (
    ENTITY_TABLE_MAP,
    MOCK_DATA,
    SAFE_COLUMNS,
    assert_safe_identifier,
    try_db,
)

router = APIRouter()


def _resolve_table(model_name: str) -> str:
    """Resolve `model_name` (e.g. 'Equipment' or 'equipment') to a safe table name."""
    table_name = ENTITY_TABLE_MAP.get(model_name.title(), model_name.lower())
    if table_name not in SAFE_COLUMNS:
        raise HTTPException(404, f"Unknown model: {model_name}")
    assert_safe_identifier(table_name)
    return table_name


@router.get("/data/{model_name}")
async def list_data(
    model_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
):
    """动态数据列表."""
    table_name = _resolve_table(model_name)

    async def _query(db):
        cols = SAFE_COLUMNS.get(table_name, set())
        for c in cols:
            assert_safe_identifier(c)
        col_list = ",".join(sorted(cols))
        count_sql = f"SELECT COUNT(*) as cnt FROM {table_name}"
        data_sql = f"SELECT {col_list} FROM {table_name}"

        params: dict = {}
        if search:
            like_clauses = [f"CAST({c} AS TEXT) LIKE :search" for c in cols if c != "id"]
            if like_clauses:
                where = " WHERE " + " OR ".join(like_clauses)
                data_sql += where
                count_sql += where
                params["search"] = f"%{search}%"

        total = (await db.execute(text(count_sql), params)).scalar()
        data_sql += " LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        rows = (await db.execute(text(data_sql), params)).mappings().all()
        return {
            "data": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "table_name": table_name,
        }

    result = await try_db(_query)
    if result is not None:
        return result

    # Mock fallback
    mock_rows = MOCK_DATA.get(table_name, [])
    if search:
        mock_rows = [r for r in mock_rows if any(search.lower() in str(v).lower() for v in r.values())]
    start = (page - 1) * page_size
    return {
        "data": mock_rows[start:start + page_size],
        "total": len(mock_rows),
        "page": page,
        "page_size": page_size,
        "table_name": table_name,
    }


@router.post("/data/{model_name}")
async def create_data(model_name: str, body: dict):
    """动态创建数据."""
    table_name = _resolve_table(model_name)

    async def _query(db):
        allowed = SAFE_COLUMNS.get(table_name, set())
        safe_keys = [k for k in body.keys() if k in allowed and k != "id"]
        if not safe_keys:
            raise HTTPException(400, "No valid fields")
        for k in safe_keys:
            assert_safe_identifier(k)
        cols = ",".join(safe_keys)
        vals = ",".join([f":{k}" for k in safe_keys])
        sql = f"INSERT INTO {table_name} ({cols}) VALUES ({vals})"
        await db.execute(text(sql), {k: body[k] for k in safe_keys})
        await db.commit()
        return {"ok": True, "table": table_name}

    result = await try_db(_query)
    return result or {"ok": True, "table": table_name}


@router.put("/data/{model_name}/{record_id}")
async def update_data(model_name: str, record_id: int, body: dict):
    """动态更新数据."""
    table_name = _resolve_table(model_name)

    async def _query(db):
        allowed = SAFE_COLUMNS.get(table_name, set())
        safe_keys = [k for k in body.keys() if k in allowed and k != "id"]
        if not safe_keys:
            raise HTTPException(400, "No valid fields")
        for k in safe_keys:
            assert_safe_identifier(k)
        set_clause = ",".join([f"{k} = :{k}" for k in safe_keys])
        sql = f"UPDATE {table_name} SET {set_clause} WHERE id = :id"
        params = {k: body[k] for k in safe_keys}
        params["id"] = record_id
        await db.execute(text(sql), params)
        await db.commit()
        return {"ok": True}

    result = await try_db(_query)
    return result or {"ok": True}


@router.delete("/data/{model_name}/{record_id}")
async def delete_data(model_name: str, record_id: int):
    """动态删除数据."""
    table_name = _resolve_table(model_name)

    async def _query(db):
        await db.execute(text(f"DELETE FROM {table_name} WHERE id = :id"), {"id": record_id})
        await db.commit()
        return {"ok": True}

    result = await try_db(_query)
    return result or {"ok": True}
