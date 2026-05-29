"""Unified Agent runtime facade.

This first stage keeps public API contracts stable while moving prompt
construction, model calls, and policy-aware answer generation into services.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from app.core.db import db_session

from .form_record_tools import query_form_records
from .knowledge_ingestion import search_ingested_knowledge
from .prompt_builder import PromptBuildInput, PromptBuilder
from .schemas import AgentRequest, AgentResponse, ChatMessage, ChatOptions
from .settings import settings_snapshot, settings_to_provider_config
from .tenant_profile import TenantProfile, default_tenant_profile
from .intent_router import route_intent, route_intent_async
from .tools import choose_draft_actions, create_contract_draft_action, create_low_code_form_definition_action
from .action_guidance import (
    build_action_guidance_answer,
    describe_action_contract,
    has_minimum_action_requirements,
)
from .action_state import create_or_update_action_state
from .client import get_provider
from .preflight import preflight_agent_request


EXTERNAL_PROVIDER_NAMES = {"openai-compatible", "openai", "azure-openai", "deepseek", "qwen", "glm"}
RISK_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
AgentEventSink = Callable[[str, dict[str, Any]], Awaitable[None]]


def _max_risk(actions) -> str:
    if not actions:
        return "low"
    return max((action.risk_level for action in actions), key=lambda value: RISK_RANK.get(value, 0))


def _is_real_model_configured(config) -> bool:
    return config.provider in EXTERNAL_PROVIDER_NAMES and bool(config.api_key)


def _format_provider_failure(exc: Exception) -> str:
    detail = str(exc)
    if "余额不足" in detail or "无可用资源包" in detail or '"code":"1113"' in detail:
        return "大模型连接失败：供应商返回余额不足或无可用资源包，请充值、更换 API Key，或切换到有可用额度的模型资源。"
    return "大模型连接失败。请检查 AI provider、base URL、API Key、模型名称、账户额度和网络连通性后重试。"


def _form_query_payload(context: dict[str, Any]) -> dict[str, Any] | None:
    form_id = context.get("form_id") or context.get("formId") or context.get("currentFormId")
    form_code = context.get("form_code") or context.get("formCode") or context.get("currentFormCode")
    if not form_id and not form_code:
        return None
    payload: dict[str, Any] = {"limit": context.get("limit") or context.get("pageSize") or 20}
    if form_id:
        payload["form_id"] = form_id
    if form_code:
        payload["form_code"] = form_code
    if context.get("status"):
        payload["status"] = context.get("status")
    return payload


async def _emit_step(event_sink: AgentEventSink | None, step: dict[str, Any]) -> None:
    if event_sink:
        await event_sink("step.completed", {"step": step})


class AgentRuntime:
    def __init__(self, prompt_builder: PromptBuilder | None = None):
        self.prompt_builder = prompt_builder or PromptBuilder()

    def classify_knowledge_intent(self, query: str) -> str:
        """Backward-compatible wrapper around structured intent routing."""

        route = route_intent(query, {})
        return "knowledge" if route.intent in {"knowledge", "business_query", "page_help"} else "general"

    async def run(
        self,
        request: AgentRequest,
        *,
        tenant_profile: TenantProfile | None = None,
        user: dict[str, Any] | None = None,
        event_sink: AgentEventSink | None = None,
    ) -> AgentResponse:
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
        pending_action = (request.context or {}).get("pendingActionState") or (request.context or {}).get("pending_action_state")
        resume_draft = (request.context or {}).get("resumeDraft") or (request.context or {}).get("resume_draft")
        if isinstance(resume_draft, dict) and resume_draft.get("draft_id"):
            resume_step = {
                "id": "step-draft-resume",
                "type": "context",
                "status": "completed",
                "draft_id": resume_draft.get("draft_id"),
                "skill": resume_draft.get("skill"),
                "draft_status": resume_draft.get("status"),
                "summary": "Loaded saved AI draft for review.",
            }
            steps.append(resume_step)
            await _emit_step(event_sink, resume_step)
        if isinstance(resume_draft, dict) and resume_draft.get("skill") and not isinstance(pending_action, dict):
            draft_payload = resume_draft.get("payload") if isinstance(resume_draft.get("payload"), dict) else {}
            pending_action = {
                "status": "ready_for_confirmation",
                "skill": str(resume_draft.get("skill")),
                "source_message": str(draft_payload.get("source_message") or request.message),
                "collected_slots": draft_payload,
                "missing_slots": [],
                "notes": [f"resume draft {resume_draft.get('draft_id')}"],
            }
        settings_data = settings_snapshot()
        preflight = preflight_agent_request(
            message=request.message,
            context=request.context,
            user=user,
            settings=settings_data,
        )
        preflight_step = preflight.as_step()
        steps.append(preflight_step)
        await _emit_step(event_sink, preflight_step)
        if not preflight.allowed:
            return AgentResponse(
                answer=f"当前 AI 权限策略不允许继续执行该请求：{preflight.reason}",
                steps=steps,
                mode="qa",
            )

        config = request.provider_config or settings_to_provider_config(settings_data)
        intent_route = await route_intent_async(request.message, request.context, provider_config=config)
        if isinstance(pending_action, dict) and pending_action.get("skill") and intent_route.intent != "action_prepare":
            intent_route.intent = "action_prepare"
            intent_route.skill = str(pending_action.get("skill"))
            intent_route.target = "action"
            intent_route.context_need = "draft_action"
            intent_route.needs_context = ["pending_action_state", "skill_contract", "tool_contract", "permission_policy"]
            intent_route.reason = "pending_action_followup"
            intent_route.source_message = "\n".join(
                item for item in [str(pending_action.get("source_message") or ""), request.message] if item
            )
            if isinstance(resume_draft, dict) and resume_draft.get("draft_id"):
                intent_route.reason = "resume_ai_draft"
        route_step = intent_route.as_step()
        steps.append(route_step)
        await _emit_step(event_sink, route_step)
        planner_step = {
            "id": "step-planner",
            "type": "plan",
            "status": "completed",
            "intent": "action" if intent_route.intent == "action_prepare" else "qa",
            "skill": intent_route.skill,
            "confidence": intent_route.confidence,
            "reason": intent_route.reason,
        }
        steps.append(planner_step)
        await _emit_step(event_sink, planner_step)
        permission_context_step = {
            "id": "step-action-permission",
            "type": "policy",
            "status": "completed",
            "summary": "Permission and risk policy will gate any draft write before execution.",
            "requires_confirmation": True,
        }
        steps.append(permission_context_step)
        await _emit_step(event_sink, permission_context_step)
        context_need = intent_route.context_need
        evidence = search_ingested_knowledge(request.message, limit=3) if context_need in {"knowledge_rag", "business_query", "semantic_graph", "draft_action"} else []
        if context_need in {"knowledge_rag", "business_query", "semantic_graph", "draft_action"}:
            knowledge_step = {
                "id": "step-knowledge-search",
                "type": "tool",
                "tool": "knowledge.search",
                "status": "completed",
                "result_count": len(evidence),
            }
            steps.append(knowledge_step)
            await _emit_step(event_sink, knowledge_step)
        actions = []
        action_state: dict[str, Any] | None = None
        if intent_route.skill == "low_code.create_form_definition":
            action_context = {
                **(request.context or {}),
                **(pending_action.get("collected_slots") if isinstance(pending_action, dict) and isinstance(pending_action.get("collected_slots"), dict) else {}),
                **intent_route.extracted_context,
            }
            action_state = create_or_update_action_state(
                existing=pending_action if isinstance(pending_action, dict) else None,
                skill=intent_route.skill,
                source_message=intent_route.source_message,
                extracted_context=action_context,
            )
            effective_action_context = (
                action_state.get("collected_slots")
                if isinstance(action_state.get("collected_slots"), dict)
                else action_context
            )
            contract = describe_action_contract(intent_route.skill)
            contract_step = {
                "id": "step-tool-contract",
                "type": "observe",
                "status": "completed",
                "tool": contract["tool"],
                "summary": "Loaded form creation API contract before planning a write.",
                "required": contract["required"],
            }
            steps.append(contract_step)
            await _emit_step(event_sink, contract_step)
            if action_state.get("missing_slots") or not has_minimum_action_requirements(intent_route.skill, intent_route.source_message, effective_action_context):
                missing_step = {
                    "id": "step-requirement-gap",
                    "type": "plan",
                    "status": "completed",
                    "summary": "Need more form design details before preparing a write confirmation.",
                    "missing_slots": action_state.get("missing_slots") or [],
                }
                steps.append(missing_step)
                await _emit_step(event_sink, missing_step)
                return AgentResponse(
                    answer=build_action_guidance_answer(intent_route.skill, assistant_name=profile.assistant_name),
                    evidence=evidence,
                    steps=steps,
                    action_state=action_state,
                    mode="qa",
                )
            actions.append(create_low_code_form_definition_action(intent_route.source_message, evidence=evidence, context=effective_action_context))
        elif intent_route.intent != "action_prepare":
            actions = choose_draft_actions(request.message, evidence=evidence, context=request.context)
            if actions:
                first_action = actions[0]
                evidence_text = "\n".join(
                    str(item.get("snippet") or item.get("chunk_text") or item.get("content") or item.get("summary") or "")
                    for item in evidence
                    if isinstance(item, dict)
                )
                action_source_message = "\n".join(part for part in [request.message, evidence_text] if part)
                action_state = create_or_update_action_state(
                    existing=pending_action if isinstance(pending_action, dict) else None,
                    skill=first_action.skill,
                    source_message=action_source_message,
                    extracted_context={},
                )
                contract = describe_action_contract(first_action.skill)
                contract_step = {
                    "id": "step-tool-contract",
                    "type": "observe",
                    "status": "completed",
                    "tool": contract.get("tool") or first_action.skill,
                    "summary": "Loaded action skill/tool contract before preparing confirmation.",
                    "required": contract.get("required") or [],
                }
                steps.append(contract_step)
                await _emit_step(event_sink, contract_step)
                if action_state.get("missing_slots") or not has_minimum_action_requirements(first_action.skill, action_source_message, request.context):
                    missing_step = {
                        "id": "step-requirement-gap",
                        "type": "plan",
                        "status": "completed",
                        "summary": "Need more action details before preparing a confirmation.",
                        "missing_slots": action_state.get("missing_slots") or [],
                    }
                    steps.append(missing_step)
                    await _emit_step(event_sink, missing_step)
                    return AgentResponse(
                        answer=build_action_guidance_answer(first_action.skill, assistant_name=profile.assistant_name),
                        evidence=evidence,
                        steps=steps,
                        action_state=action_state,
                        mode="qa",
                    )
                actions = choose_draft_actions(
                    request.message,
                    evidence=evidence,
                    context=action_state.get("collected_slots") if isinstance(action_state.get("collected_slots"), dict) else {},
                )
        elif intent_route.skill:
            action_state = create_or_update_action_state(
                existing=pending_action if isinstance(pending_action, dict) else None,
                skill=intent_route.skill,
                source_message=intent_route.source_message or request.message,
                extracted_context={},
            )
            if action_state.get("missing_slots"):
                missing_step = {
                    "id": "step-requirement-gap",
                    "type": "plan",
                    "status": "completed",
                    "summary": "Need more action details before preparing a confirmation.",
                    "missing_slots": action_state.get("missing_slots") or [],
                }
                steps.append(missing_step)
                await _emit_step(event_sink, missing_step)
                return AgentResponse(
                    answer=build_action_guidance_answer(intent_route.skill, assistant_name=profile.assistant_name),
                    evidence=evidence,
                    steps=steps,
                    action_state=action_state,
                    mode="qa",
                )
            actions = choose_draft_actions(
                intent_route.source_message or request.message,
                evidence=evidence,
                context=action_state.get("collected_slots") if isinstance(action_state.get("collected_slots"), dict) else {},
            )
            if not actions:
                actions = [
                    create_contract_draft_action(
                        intent_route.skill,
                        evidence=evidence,
                        context=action_state.get("collected_slots") if isinstance(action_state.get("collected_slots"), dict) else {},
                        source_message=intent_route.source_message or request.message,
                    )
                ]
        if actions:
            if not action_state:
                action_state = create_or_update_action_state(
                    existing=pending_action if isinstance(pending_action, dict) else None,
                    skill=actions[0].skill,
                    source_message=intent_route.source_message or request.message,
                    extracted_context=pending_action.get("collected_slots") if isinstance(pending_action, dict) and isinstance(pending_action.get("collected_slots"), dict) else {},
                )
            skill_step = {
                "id": "step-skill-selection",
                "type": "plan",
                "status": "completed",
                "skills": [action.skill for action in actions],
            }
            confirmation_step = {
                "id": "step-confirmation",
                "type": "policy",
                "status": "waiting_confirmation",
                "summary": "Draft actions require human confirmation before saving or submission.",
            }
            steps.append(skill_step)
            await _emit_step(event_sink, skill_step)
            steps.append(confirmation_step)
            await _emit_step(event_sink, confirmation_step)
            return AgentResponse(
                answer=f"{profile.assistant_name} 已准备好草稿动作，确认前不会写入或提交业务流程。",
                actions=actions,
                evidence=evidence,
                steps=steps,
                action_state={**action_state, "status": "ready_for_confirmation", "missing_slots": []},
                risk_level=_max_risk(actions),
                requires_confirmation=any(action.requires_confirmation for action in actions),
                mode="assisted",
            )

        if not _is_real_model_configured(config):
            model_step = {
                "id": "step-model-config",
                "type": "configure",
                "status": "blocked",
                "provider": config.provider,
                "model": config.chat_model,
                "summary": "Large model provider is not configured.",
            }
            steps.append(model_step)
            await _emit_step(event_sink, model_step)
            return AgentResponse(
                answer="未配置大模型。请先在 AI 设置或后端环境变量中配置可用的大模型 provider、base URL、API Key 和模型名称。",
                evidence=evidence,
                steps=steps,
                mode="qa",
            )

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
                        "用中文自然回答用户当前问题。"
                        "回答前必须遵循平台已完成的身份识别、角色权限和风险策略结果；不要越权推测用户不可访问的数据。"
                        "如果问题可以直接回答，就直接回答；涉及企业事实时优先结合页面上下文和证据。"
                        "可以给出建议和草稿思路，但不要声称已经写入、提交或执行业务动作。"
                    ),
                    user_message=request.message,
                )
            )
            result = await provider.chat(messages, ChatOptions(model=config.chat_model, max_tokens=1200, temperature=0.3))
            answer_step = {
                "id": "step-answer",
                "type": "respond",
                "status": "completed",
                "model": result.model,
                "provider": result.provider,
            }
            steps.append(answer_step)
            await _emit_step(event_sink, answer_step)
            return AgentResponse(
                answer=result.content,
                evidence=evidence,
                steps=steps,
                mode="qa",
            )
        except Exception as exc:  # noqa: BLE001 - page assistant should degrade gracefully
            failed_step = {
                "id": "step-answer",
                "type": "respond",
                "status": "failed",
                "model": config.chat_model,
                "provider": config.provider,
                "fallback_reason": str(exc),
            }
            steps.append(failed_step)
            await _emit_step(event_sink, failed_step)
            return AgentResponse(
                answer=_format_provider_failure(exc),
                evidence=evidence,
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
        intent: str | None = None,
    ) -> tuple[str, str, dict[str, Any]]:
        profile = tenant_profile or default_tenant_profile()
        config = provider_config or settings_to_provider_config(settings_snapshot())
        resolved_intent = intent or self.classify_knowledge_intent(query)
        scoped_evidence = evidence if resolved_intent == "knowledge" else []
        if not _is_real_model_configured(config):
            return (
                "未配置大模型。请先在 AI 设置或后端环境变量中配置可用的大模型 provider、base URL、API Key 和模型名称。",
                "unconfigured-ai-provider",
                {
                    "mode": "model_not_configured",
                    "provider": config.provider,
                    "model": config.chat_model,
                    "intent": resolved_intent,
                    "history_messages": len(history),
                    "evidence_count": len(scoped_evidence),
                    "memory_count": len(memory or []),
                },
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
                _format_provider_failure(exc),
                config.chat_model,
                {
                    "mode": "ai_provider_failed",
                    "provider": config.provider,
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
