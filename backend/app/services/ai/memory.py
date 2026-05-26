"""Short-term and long-term AI memory helpers."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.relational import AIAgentRun, AIConversation, AIMemoryEntry, AIMessage


def conversation_memory_key(user_id: str | None, session_id: str | None, tenant_id: int | None = None) -> str:
    tenant = tenant_id if tenant_id is not None else "default"
    return f"{tenant}:{user_id or 'anonymous'}:{session_id or 'default'}"


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()


class MemoryService:
    async def append_turn_memory(
        self,
        session: AsyncSession,
        *,
        conversation: AIConversation,
        run: AIAgentRun,
        user_message: AIMessage,
        assistant_message: AIMessage,
        evidence: list[dict[str, Any]],
        tenant_id: int = 1,
        user_key: str | None = None,
        status: str = "candidate",
    ) -> AIMemoryEntry:
        summary = assistant_message.content[:500]
        value = {
            "last_user_message": user_message.content,
            "last_answer": assistant_message.content,
            "evidence_count": len(evidence),
            "source_message_ids": [user_message.message_id, assistant_message.message_id],
        }
        memory = AIMemoryEntry(
            memory_id=f"mem-{uuid.uuid4().hex[:12]}",
            conversation_id=conversation.conversation_id,
            scope="conversation",
            key="last_agent_turn",
            value=value,
            summary=summary,
            status=status,
        )
        self.apply_optional_runtime_fields(
            memory,
            tenant_id=tenant_id,
            user_key=user_key or conversation.user_id,
            page=conversation.page,
            document_id=conversation.document_id,
            run_id=run.run_id,
            user_message_id=user_message.message_id,
            assistant_message_id=assistant_message.message_id,
            memory_type="turn_summary",
            content=summary,
            confidence=0.7,
            importance_score=0.4,
            visibility="private",
            sensitivity="normal",
            content_hash=_content_hash(summary),
        )
        session.add(memory)
        return memory

    async def retrieve_context(
        self,
        session: AsyncSession,
        *,
        tenant_id: int = 1,
        user_key: str | None = None,
        conversation_id: str | None = None,
        page: str | None = None,
        document_id: str | None = None,
        query: str | None = None,
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        stmt = select(AIMemoryEntry).where(AIMemoryEntry.status == "active")
        if conversation_id:
            stmt = stmt.where(AIMemoryEntry.conversation_id == conversation_id)
        if hasattr(AIMemoryEntry, "tenant_id"):
            stmt = stmt.where(or_(AIMemoryEntry.tenant_id == tenant_id, AIMemoryEntry.tenant_id.is_(None)))
        if user_key and hasattr(AIMemoryEntry, "user_key"):
            stmt = stmt.where(or_(AIMemoryEntry.user_key == user_key, AIMemoryEntry.user_key.is_(None)))
        if page and hasattr(AIMemoryEntry, "page"):
            stmt = stmt.where(or_(AIMemoryEntry.page == page, AIMemoryEntry.page.is_(None)))
        if document_id and hasattr(AIMemoryEntry, "document_id"):
            stmt = stmt.where(or_(AIMemoryEntry.document_id == document_id, AIMemoryEntry.document_id.is_(None)))
        stmt = stmt.order_by(desc(AIMemoryEntry.updated_at)).limit(max(1, min(limit, 20)))
        rows = (await session.execute(stmt)).scalars().all()
        return [self.serialize(row) for row in rows]

    def build_prompt_context(self, memories: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {
                "memory_id": item.get("memory_id"),
                "scope": item.get("scope"),
                "summary": item.get("summary"),
                "memory_type": item.get("memory_type"),
            }
            for item in memories
            if item.get("summary")
        ]

    def serialize(self, memory: AIMemoryEntry) -> dict[str, Any]:
        payload = {
            "memory_id": memory.memory_id,
            "conversation_id": memory.conversation_id,
            "scope": memory.scope,
            "key": memory.key,
            "value": memory.value,
            "summary": memory.summary,
            "status": memory.status,
        }
        for name in [
            "tenant_id",
            "user_key",
            "page",
            "document_id",
            "run_id",
            "memory_type",
            "content",
            "tags",
            "importance_score",
            "confidence",
            "visibility",
            "sensitivity",
        ]:
            if hasattr(memory, name):
                payload[name] = getattr(memory, name)
        return payload

    def apply_optional_runtime_fields(self, memory: AIMemoryEntry, **fields: Any) -> None:
        for key, value in fields.items():
            if hasattr(memory, key):
                setattr(memory, key, value)

    async def export_vault(
        self,
        session: AsyncSession,
        *,
        tenant_id: int,
        root: str | Path,
        user_key: str | None = None,
    ) -> dict[str, Any]:
        target_root = Path(root).resolve()
        target_root.mkdir(parents=True, exist_ok=True)
        memories = await self.retrieve_context(session, tenant_id=tenant_id, user_key=user_key, limit=100)
        manifest: dict[str, Any] = {"tenant_id": tenant_id, "generated_at": datetime.now().isoformat(), "files": []}
        memories_dir = target_root / "memories"
        memories_dir.mkdir(exist_ok=True)
        for item in memories:
            if item.get("sensitivity") == "restricted":
                continue
            memory_id = str(item["memory_id"])
            path = memories_dir / f"{memory_id}.md"
            body = self._memory_markdown(item)
            path.write_text(body, encoding="utf-8")
            manifest["files"].append({"memory_id": memory_id, "path": str(path), "checksum": _content_hash(body)})
        (target_root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return manifest

    def _memory_markdown(self, item: dict[str, Any]) -> str:
        frontmatter = {
            "memory_id": item.get("memory_id"),
            "tenant_id": item.get("tenant_id"),
            "user_key": item.get("user_key"),
            "conversation_id": item.get("conversation_id"),
            "document_id": item.get("document_id"),
            "memory_type": item.get("memory_type"),
            "status": item.get("status"),
            "readonly": True,
        }
        header = "\n".join(["---", *[f"{key}: {value}" for key, value in frontmatter.items() if value is not None], "---"])
        return f"{header}\n\n# {item.get('key') or item.get('memory_id')}\n\n{item.get('summary') or ''}\n"


memory_service = MemoryService()
