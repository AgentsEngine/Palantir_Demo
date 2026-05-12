"""Model-Driven: menu items CRUD."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api._model_driven_shared import (
    MOCK_MENUS,
    MenuItemCreate,
    MenuItemUpdate,
    try_db,
)

router = APIRouter()


@router.get("/menus")
async def list_menus():
    """菜单列表."""
    async def _query(db):
        from app.models.relational import MenuItem
        result = await db.execute(select(MenuItem).order_by(MenuItem.sort_order))
        items = result.scalars().all()
        return {"data": [
            {"id": i.id, "parent_id": i.parent_id, "title": i.title, "icon": i.icon,
             "route_path": i.route_path, "sort_order": i.sort_order, "is_visible": i.is_visible}
            for i in items
        ]}

    result = await try_db(_query)
    return result or {"data": MOCK_MENUS}


@router.post("/menus")
async def create_menu(body: MenuItemCreate):
    """创建菜单项."""
    async def _query(db):
        from app.models.relational import MenuItem
        mi = MenuItem(
            parent_id=body.parent_id, title=body.title, icon=body.icon,
            route_path=body.route_path, sort_order=body.sort_order, is_visible=body.is_visible,
        )
        db.add(mi)
        await db.commit()
        await db.refresh(mi)
        return {"id": mi.id, "title": mi.title}

    result = await try_db(_query)
    if result is not None:
        return result
    new_id = len(MOCK_MENUS) + 10
    MOCK_MENUS.append({
        "id": new_id, "parent_id": body.parent_id, "title": body.title,
        "icon": body.icon, "route_path": body.route_path,
        "sort_order": body.sort_order, "is_visible": body.is_visible,
    })
    return {"id": new_id, "title": body.title}


@router.put("/menus/{menu_id}")
async def update_menu(menu_id: int, body: MenuItemUpdate):
    """更新菜单项."""
    async def _query(db):
        from app.models.relational import MenuItem
        mi = await db.get(MenuItem, menu_id)
        if not mi:
            return None
        for field, val in [
            ("title", body.title),
            ("icon", body.icon),
            ("route_path", body.route_path),
            ("sort_order", body.sort_order),
            ("is_visible", body.is_visible),
        ]:
            if val is not None:
                setattr(mi, field, val)
        await db.commit()
        return {"id": mi.id, "title": mi.title}

    result = await try_db(_query)
    if result is not None:
        return result
    for m in MOCK_MENUS:
        if m["id"] == menu_id:
            if body.title:
                m["title"] = body.title
            return m
    raise HTTPException(404, "Menu not found")


@router.delete("/menus/{menu_id}")
async def delete_menu(menu_id: int):
    """删除菜单项."""
    async def _query(db):
        from app.models.relational import MenuItem
        mi = await db.get(MenuItem, menu_id)
        if not mi:
            return None
        await db.delete(mi)
        await db.commit()
        return {"ok": True}

    result = await try_db(_query)
    return result or {"ok": True}
