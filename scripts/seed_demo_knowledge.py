"""Generate and seed demo Word/Excel/PDF knowledge assets."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database import init_db
from app.services.ai.demo_knowledge_seed import seed_demo_knowledge_assets


async def main() -> None:
    await init_db()
    result = await seed_demo_knowledge_assets()
    print(f"Seeded demo knowledge: {result['documents']} new documents, {result['chunks']} chunks written")


if __name__ == "__main__":
    asyncio.run(main())
