"""Backward-compatible AI Agent orchestrator facade."""

from __future__ import annotations

from .runtime import agent_runtime
from .schemas import AgentRequest, AgentResponse


async def run_agent(request: AgentRequest) -> AgentResponse:
    return await agent_runtime.run(request)
