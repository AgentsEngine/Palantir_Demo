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
GENERAL_CHAT_TERMS = [
    "你好",
    "您好",
    "早上好",
    "晚上好",
    "你是谁",
    "你叫什么",
    "who are you",
    "喜欢我",
    "你喜欢",
    "爱我",
    "谢谢",
    "thank",
]
KNOWLEDGE_TASK_TERMS = [
    "文档",
    "该文档",
    "这个文档",
    "内容",
    "包含",
    "总结",
    "概括",
    "分析",
    "证据",
    "来源",
    "引用",
    "SOP",
    "流程",
    "风险",
    "CAPA",
    "本体",
    "图谱",
    "关系",
    "实体",
    "字段",
    "document",
    "content",
    "contains",
    "summary",
    "summarize",
    "evidence",
]


def _max_risk(actions) -> str:
    if not actions:
        return "low"
    return max((action.risk_level for action in actions), key=lambda value: RISK_RANK.get(value, 0))


class AgentRuntime:
    def __init__(self, prompt_builder: PromptBuilder | None = None):
        self.prompt_builder = prompt_builder or PromptBuilder()

    def classify_knowledge_intent(self, query: str) -> str:
        """Route short social turns away from RAG while keeping knowledge tasks grounded."""

        normalized = query.strip().lower()
        if not normalized:
            return "general"
        if any(term.lower() in normalized for term in KNOWLEDGE_TASK_TERMS):
            return "knowledge"
        if len(normalized) <= 40 and any(term.lower() in normalized for term in GENERAL_CHAT_TERMS):
            return "general"
        return "knowledge"

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

        fallback = self._local_page_answer(request=request, profile=profile, evidence=evidence)
        config = request.provider_config or settings_to_provider_config(settings_snapshot())
        try:
            provider = get_provider(config)
            messages = self.prompt_builder.build(
                PromptBuildInput(
                    mode="agent",
                    tenant_profile=profile,
                    user_context=user or {},
                    page_context={
                        "page": request.page,
                        **(request.context or {}),
                    },
                    evidence=evidence,
                    tool_policy={"write_policy": "risk_based_confirmation"},
                    output_contract=(
                        "用中文自然回答用户当前问题。不要说自己只是 Demo 或 mock。"
                        "如果问题可以直接回答，就直接回答；涉及企业事实时优先结合页面上下文和证据。"
                        "可以给出建议和草稿思路，但不要声称已经写入、提交或执行业务动作。"
                    ),
                    user_message=request.message,
                )
            )
            result = await provider.chat(messages, ChatOptions(model=config.chat_model, max_tokens=1200, temperature=0.3))
            steps.append(
                {
                    "id": "step-answer",
                    "type": "respond",
                    "status": "completed",
                    "model": result.model,
                    "provider": result.provider,
                }
            )
            return AgentResponse(
                answer=result.content,
                evidence=evidence,
                steps=steps,
                mode="qa",
            )
        except Exception as exc:  # noqa: BLE001 - page assistant should degrade gracefully
            steps.append(
                {
                    "id": "step-answer",
                    "type": "respond",
                    "status": "completed",
                    "model": "local-agent-runtime",
                    "fallback_reason": str(exc),
                }
            )
            return AgentResponse(
                answer=fallback,
                evidence=evidence,
                steps=steps,
                mode="qa",
            )

    def _local_page_answer(self, *, request: AgentRequest, profile: TenantProfile, evidence: list[dict[str, Any]]) -> str:
        page_title = str(request.context.get("pageTitle") or request.context.get("title") or request.page or "当前页面")
        if evidence:
            lines = [f"我可以先结合“{page_title}”和检索到的知识证据回答："]
            for index, item in enumerate(evidence[:3], start=1):
                snippet = item.get("snippet") or item.get("chunk_text") or item.get("summary") or ""
                if snippet:
                    lines.append(f"- {str(snippet)[:180]} [S{index}]")
            lines.append("如果你希望我继续展开，我可以按概念解释、业务流程或实施建议三个角度讲。")
            return "\n".join(lines)
        return (
            f"我是 {profile.assistant_name}，可以围绕“{page_title}”回答页面问题、解释业务概念或整理下一步建议。"
            "当前没有检索到可引用的知识证据；如果后端模型已配置成功，我会优先用模型正常回答。"
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
        intent: str | None = None,
    ) -> tuple[str, str, dict[str, Any]]:
        profile = tenant_profile or default_tenant_profile()
        config = provider_config or settings_to_provider_config(settings_snapshot())
        resolved_intent = intent or self.classify_knowledge_intent(query)
        scoped_evidence = evidence if resolved_intent == "knowledge" else []
        fallback = self._local_knowledge_answer(
            query=query,
            title=title,
            evidence=scoped_evidence,
            history=history,
            profile=profile,
            intent=resolved_intent,
            configured_model=config.chat_model,
        )
        try:
            provider = get_provider(config)
            history_messages = [
                ChatMessage(role=item.role, content=item.content)
                for item in history[-8:]
                if getattr(item, "role", None) in {"user", "assistant"}
            ]
            mode = "knowledge" if resolved_intent == "knowledge" else "chat"
            messages = self.prompt_builder.build(
                PromptBuildInput(
                    mode=mode,
                    tenant_profile=profile,
                    user_context={},
                    page_context={"page": "knowledge-center", "document_title": title} if resolved_intent == "knowledge" else {"page": "knowledge-center"},
                    evidence=scoped_evidence,
                    memory=memory or [],
                    history=history_messages,
                    tool_policy={"write_policy": "risk_based_confirmation"},
                    output_contract=(
                        "用中文自然回答。普通寒暄、情绪、身份或偏好问题不要强行引用文档。"
                        "只有涉及企业事实、文档、SOP、数据、本体或图谱时才引用 [Sx]；使用记忆时引用 [Mx]。"
                        "如果知识任务证据不足，请明确说明缺口，并给出下一步建议。"
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
                    "intent": resolved_intent,
                    "history_messages": len(history),
                    "evidence_count": len(scoped_evidence),
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
                    "intent": resolved_intent,
                    "fallback_reason": str(exc),
                    "history_messages": len(history),
                    "evidence_count": len(scoped_evidence),
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
        intent: str = "knowledge",
        configured_model: str | None = None,
    ) -> str:
        lower = query.lower()
        if intent == "general":
            if any(term in lower for term in ["who are you", "model", "模型", "你是谁", "大模型"]):
                model_hint = f"当前 AI 平台配置的默认生成模型是 {configured_model}。" if configured_model else "背后的模型由 AI 平台配置决定。"
                return (
                    f"你好，我是 {profile.assistant_name}。"
                    f"{model_hint}"
                    "我可以正常聊天，也可以在你询问文档、SOP、知识对象或业务数据时切换到知识检索模式。"
                )
            if any(term in lower for term in ["喜欢我", "爱我", "你喜欢"]):
                return "当然愿意认真陪你聊。作为 AI 我没有人类意义上的喜欢，但我会以稳定、真诚和有边界的方式回应你。"
            if any(term in lower for term in ["你好", "您好", "早上好", "晚上好", "hello", "hi"]):
                return f"你好呀，我是 {profile.assistant_name}。你可以直接和我聊天，也可以让我帮你查文档、梳理 SOP 或分析知识关系。"
            return "我在。你可以像正常对话一样问我；如果问题涉及当前文档或知识库，我会再结合证据回答。"
        if any(term in lower for term in ["who are you", "model", "模型", "你是谁", "大模型"]):
            model_hint = f"当前 AI 平台配置的默认生成模型是 {configured_model}。" if configured_model else "背后的模型由 AI 平台配置决定。"
            return (
                f"你好，我是 {profile.assistant_name}，运行在 {profile.product_name} 平台中。"
                "我会结合当前页面、知识库证据、会话记忆和角色权限来回答问题；"
                f"{model_hint}"
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
