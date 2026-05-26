"""Unified Agent runtime facade.

This first stage keeps public API contracts stable while moving prompt
construction, model calls, and policy-aware answer generation into services.
"""

from __future__ import annotations

from typing import Any

from .knowledge_ingestion import search_ingested_knowledge
from .prompt_builder import PromptBuildInput, PromptBuilder
from .schemas import AgentRequest, AgentResponse, ChatMessage, ChatOptions
from .settings import settings_snapshot, settings_to_provider_config
from .tenant_profile import TenantProfile, default_tenant_profile
from .tools import choose_draft_actions
from .client import get_provider


RISK_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _max_risk(actions) -> str:
    if not actions:
        return "low"
    return max((action.risk_level for action in actions), key=lambda value: RISK_RANK.get(value, 0))


class AgentRuntime:
    def __init__(self, prompt_builder: PromptBuilder | None = None):
        self.prompt_builder = prompt_builder or PromptBuilder()

    async def run(self, request: AgentRequest, *, tenant_profile: TenantProfile | None = None, user: dict[str, Any] | None = None) -> AgentResponse:
        """Run the generic enterprise Agent shell.

        The planner is still conservative in this stage: it proposes draft
        skill actions and RAG evidence, while the actual model-backed response
        path is introduced for knowledge conversations first.
        """

        profile = tenant_profile or default_tenant_profile()
        steps = [
            {
                "id": "step-intent",
                "type": "observe",
                "title": "Intent received",
                "status": "completed",
                "summary": request.message[:160],
            }
        ]
        evidence = search_ingested_knowledge(request.message, limit=3)
        steps.append(
            {
                "id": "step-knowledge-search",
                "type": "tool",
                "tool": "knowledge.search",
                "status": "completed",
                "result_count": len(evidence),
            }
        )
        actions = choose_draft_actions(request.message, evidence=evidence)
        if actions:
            steps.append(
                {
                    "id": "step-skill-selection",
                    "type": "plan",
                    "status": "completed",
                    "skills": [action.skill for action in actions],
                }
            )
            steps.append(
                {
                    "id": "step-confirmation",
                    "type": "policy",
                    "status": "waiting_confirmation",
                    "summary": "Draft actions require human confirmation before saving or submission.",
                }
            )
            return AgentResponse(
                answer=f"{profile.assistant_name} 已准备好草稿动作，确认前不会写入或提交业务流程。",
                actions=actions,
                evidence=evidence,
                steps=steps,
                risk_level=_max_risk(actions),
                requires_confirmation=any(action.requires_confirmation for action in actions),
                mode="assisted",
            )

        if evidence:
            return AgentResponse(
                answer=f"{profile.assistant_name} 找到了相关知识证据。请结合引用来源复核后再执行后续动作。",
                evidence=evidence,
                steps=steps,
                mode="qa",
            )

        steps.append(
            {
                "id": "step-no-action",
                "type": "reflect",
                "status": "completed",
                "summary": "No supported draft skill or knowledge evidence was selected.",
            }
        )
        return AgentResponse(
            answer=f"{profile.assistant_name} 可以进行企业问答、知识检索和草稿生成。补充知识资产后，我能给出更有依据的回答。",
            steps=steps,
            mode="qa",
        )

    async def answer_knowledge(
        self,
        *,
        query: str,
        title: str,
        evidence: list[dict[str, Any]],
        history: list[Any],
        tenant_profile: TenantProfile | None = None,
        provider_config=None,
        memory: list[dict[str, Any]] | None = None,
    ) -> tuple[str, str, dict[str, Any]]:
        profile = tenant_profile or default_tenant_profile()
        config = provider_config or settings_to_provider_config(settings_snapshot())
        fallback = self._local_knowledge_answer(query=query, title=title, evidence=evidence, history=history, profile=profile)
        try:
            provider = get_provider(config)
            history_messages = [
                ChatMessage(role=item.role, content=item.content)
                for item in history[-8:]
                if getattr(item, "role", None) in {"user", "assistant"}
            ]
            messages = self.prompt_builder.build(
                PromptBuildInput(
                    mode="knowledge",
                    tenant_profile=profile,
                    user_context={},
                    page_context={"page": "knowledge-center", "document_title": title},
                    evidence=evidence,
                    memory=memory or [],
                    history=history_messages,
                    tool_policy={"write_policy": "risk_based_confirmation"},
                    output_contract=(
                        "用中文自然回答。企业事实需要引用 [Sx]；使用记忆时引用 [Mx]；"
                        "如果证据不足，请明确说明缺口，并给出下一步建议。"
                    ),
                    user_message=query,
                )
            )
            result = await provider.chat(messages, ChatOptions(model=config.chat_model, max_tokens=1000, temperature=0.2))
            return (
                result.content,
                result.model,
                {
                    "mode": "ai_provider_rag",
                    "provider": result.provider,
                    "prompt_version": self.prompt_builder.version,
                    "history_messages": len(history),
                    "evidence_count": len(evidence),
                    "memory_count": len(memory or []),
                    "usage": result.usage,
                },
            )
        except Exception as exc:  # noqa: BLE001 - knowledge chat should degrade gracefully
            return (
                fallback,
                "knowledge-agent-v1",
                {
                    "mode": "local_agent_runtime",
                    "prompt_version": self.prompt_builder.version,
                    "fallback_reason": str(exc),
                    "history_messages": len(history),
                    "evidence_count": len(evidence),
                    "memory_count": len(memory or []),
                },
            )

    def _local_knowledge_answer(
        self,
        *,
        query: str,
        title: str,
        evidence: list[dict[str, Any]],
        history: list[Any],
        profile: TenantProfile,
    ) -> str:
        lower = query.lower()
        if any(term in lower for term in ["who are you", "model", "模型", "你是谁", "大模型"]):
            return (
                f"你好，我是 {profile.assistant_name}，运行在 {profile.product_name} 平台中。"
                "我会结合当前页面、知识库证据、会话记忆和角色权限来回答问题；"
                "当前模型由 AI 平台配置决定，如果模型不可用，我会退回到本地知识 Agent 逻辑。"
            )
        if evidence:
            lines = [f"我先基于《{title}》和当前检索到的证据做一个概括："]
            for index, item in enumerate(evidence[:3], start=1):
                snippet = item.get("snippet") or item.get("chunk_text") or item.get("summary") or ""
                if snippet:
                    lines.append(f"- {str(snippet)[:180]} [S{index}]")
            if len(history) > 0:
                lines.append("我也会结合本轮会话前文继续收敛上下文。")
            return "\n".join(lines)
        return (
            f"当前知识库没有检索到足够强的证据来回答《{title}》下的这个问题。"
            "我可以给出通用判断，但建议先补充文档片段、抽取结果或切换到对应知识对象后再继续。"
        )


agent_runtime = AgentRuntime()
