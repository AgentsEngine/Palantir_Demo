"""Tests for the enterprise AI provider and Agent shell."""

import pytest


@pytest.mark.asyncio
async def test_glm_provider_requires_api_key():
    from app.services.ai.providers import ProviderConfigurationError, make_provider
    from app.services.ai.schemas import AIProviderConfig, ChatMessage

    provider = make_provider(AIProviderConfig(provider="glm", chat_model="glm-5.1"))

    with pytest.raises(ProviderConfigurationError) as exc_info:
        await provider.chat([ChatMessage(role="user", content="ping")])

    assert "glm API key is not configured" in str(exc_info.value)


@pytest.mark.asyncio
async def test_mock_provider_returns_embeddings():
    from app.services.ai.providers import make_provider
    from app.services.ai.schemas import AIProviderConfig

    provider = make_provider(AIProviderConfig(provider="mock", embedding_model="mock-embedding"))
    result = await provider.embed(["material application process"])

    assert result.provider == "mock"
    assert result.model == "mock-embedding"
    assert len(result.embeddings) == 1
    assert len(result.embeddings[0]) == 16


@pytest.mark.asyncio
async def test_agent_returns_confirmed_draft_skill():
    from app.services.ai.orchestrator import run_agent
    from app.services.ai.schemas import AgentRequest

    result = await run_agent(AgentRequest(message="生成维修工单草稿"))

    assert result.mode == "assisted"
    assert result.requires_confirmation is True
    assert result.actions
    assert result.actions[0].skill == "maintenance.create_work_order_draft"
    assert result.actions[0].requires_confirmation is True


def test_policy_blocks_forbidden_action():
    from app.services.ai.policies import apply_policy
    from app.services.ai.schemas import SkillAction

    action = apply_policy(SkillAction(skill="supply.auto_order", title="Auto order"))

    assert action.mode == "blocked"
    assert action.risk_level == "critical"
    assert action.requires_confirmation is True


def test_skill_tool_registry_contracts():
    from app.services.ai.skills import get_skill, list_skills
    from app.services.ai.tool_registry import get_tool, list_tools, validate_tool_call

    assert any(item["name"] == "knowledge.answer_question" for item in list_skills())
    assert any(item["name"] == "forms.create_dynamic_record_draft" for item in list_tools())
    assert get_skill("quality.create_capa_draft").confirmation_policy == "confirm_token"
    assert get_tool("workflow.start").side_effect == "workflow_action"

    allowed, reason = validate_tool_call("quality.create_capa_draft", "forms.create_dynamic_record_draft")
    assert allowed is True
    assert reason == "Allowed"

    allowed, reason = validate_tool_call("knowledge.answer_question", "workflow.start")
    assert allowed is False
    assert reason == "Tool is outside the skill allowlist"


def test_prompt_builder_includes_tenant_context_memory_and_evidence():
    from app.services.ai.prompt_builder import PromptBuildInput, PromptBuilder
    from app.services.ai.schemas import ChatMessage
    from app.services.ai.tenant_profile import TenantProfile

    profile = TenantProfile(
        tenant_id=42,
        slug="acme",
        display_name="ACME Manufacturing",
        product_name="ACME Foundry",
        assistant_name="Atlas",
        industry="discrete manufacturing",
        terminology={"line": "production line"},
    )
    messages = PromptBuilder().build(
        PromptBuildInput(
            mode="knowledge",
            tenant_profile=profile,
            page_context={"page": "knowledge-center", "document_id": "doc-1"},
            evidence=[
                {"title": f"SOP {index}", "snippet": f"Step {index}"}
                for index in range(10)
            ],
            memory=[
                {"memory_id": f"mem-{index}", "summary": f"Remember {index}"}
                for index in range(10)
            ],
            history=[ChatMessage(role="user", content="previous question")],
            output_contract="Return concise JSON.",
            user_message="What changed?",
        )
    )

    assert [message.role for message in messages] == ["system", "user"]
    assert "ACME Manufacturing" in messages[0].content
    assert "ACME Foundry" in messages[0].content
    assert "Atlas" in messages[0].content
    assert "line=production line" in messages[0].content
    assert "[M1] Remember 0" in messages[1].content
    assert "[M8] Remember 7" in messages[1].content
    assert "Remember 8" not in messages[1].content
    assert "[S1] SOP 0" in messages[1].content
    assert "[S8] SOP 7" in messages[1].content
    assert "SOP 8" not in messages[1].content
    assert "previous question" in messages[1].content
    assert "Return concise JSON." in messages[1].content
    assert "What changed?" in messages[1].content


@pytest.mark.asyncio
async def test_load_tenant_profile_uses_session_tenant_with_safe_fallback():
    from app.services.ai.tenant_profile import load_tenant_profile

    class TenantRow:
        name = "Contoso Works"
        slug = "contoso"

    class FakeSession:
        async def get(self, model, tenant_id):
            assert model.__name__ == "Tenant"
            assert tenant_id == 7
            return TenantRow()

    profile = await load_tenant_profile(7, session=FakeSession())

    assert profile.tenant_id == 7
    assert profile.slug == "contoso"
    assert profile.display_name == "Contoso Works"
    assert profile.product_name == "Contoso Works"
    assert profile.assistant_name == "Contoso Works AI"


@pytest.mark.asyncio
async def test_memory_service_append_turn_memory_populates_extended_fields():
    from app.models.relational import AIAgentRun, AIConversation, AIMessage
    from app.services.ai.memory import MemoryService

    class FakeSession:
        def __init__(self):
            self.added = []

        def add(self, item):
            self.added.append(item)

    conversation = AIConversation(
        conversation_id="conv-1",
        user_id="user-1",
        page="quality",
        document_id="doc-1",
        title="Quality chat",
    )
    run = AIAgentRun(
        run_id="run-1",
        conversation_id="conv-1",
        input_message="How do we handle defects?",
    )
    user_message = AIMessage(
        message_id="msg-user",
        conversation_id="conv-1",
        role="user",
        content="How do we handle defects?",
    )
    assistant_message = AIMessage(
        message_id="msg-assistant",
        conversation_id="conv-1",
        role="assistant",
        content="Open a CAPA draft and attach evidence.",
    )
    session = FakeSession()

    memory = await MemoryService().append_turn_memory(
        session,
        conversation=conversation,
        run=run,
        user_message=user_message,
        assistant_message=assistant_message,
        evidence=[{"document_id": "doc-1"}],
        tenant_id=9,
        user_key="operator-9",
        status="active",
    )

    assert session.added == [memory]
    assert memory.memory_id.startswith("mem-")
    assert memory.tenant_id == 9
    assert memory.user_key == "operator-9"
    assert memory.page == "quality"
    assert memory.document_id == "doc-1"
    assert memory.run_id == "run-1"
    assert memory.user_message_id == "msg-user"
    assert memory.assistant_message_id == "msg-assistant"
    assert memory.memory_type == "turn_summary"
    assert memory.content == "Open a CAPA draft and attach evidence."
    assert memory.confidence == 0.7
    assert memory.importance_score == 0.4
    assert memory.visibility == "private"
    assert memory.sensitivity == "normal"
    assert len(memory.content_hash) == 64
    assert memory.value["evidence_count"] == 1
    assert memory.status == "active"


def test_memory_service_serializes_prompt_context_and_markdown():
    from app.models.relational import AIMemoryEntry
    from app.services.ai.memory import MemoryService

    service = MemoryService()
    memory = AIMemoryEntry(
        memory_id="mem-1",
        conversation_id="conv-1",
        tenant_id=3,
        user_key="planner",
        page="knowledge",
        document_id="doc-7",
        run_id="run-7",
        scope="document",
        memory_type="preference",
        key="preferred_view",
        content="Use concise tables.",
        value={"format": "table"},
        tags=["ui"],
        summary="Planner prefers concise tables.",
        importance_score=0.8,
        confidence=0.9,
        visibility="tenant",
        sensitivity="normal",
        status="active",
    )

    serialized = service.serialize(memory)
    prompt_context = service.build_prompt_context([serialized, {"memory_id": "empty"}])
    markdown = service._memory_markdown(serialized)

    assert serialized["tenant_id"] == 3
    assert serialized["user_key"] == "planner"
    assert serialized["memory_type"] == "preference"
    assert serialized["content"] == "Use concise tables."
    assert serialized["tags"] == ["ui"]
    assert serialized["importance_score"] == 0.8
    assert serialized["confidence"] == 0.9
    assert prompt_context == [
        {
            "memory_id": "mem-1",
            "scope": "document",
            "summary": "Planner prefers concise tables.",
            "memory_type": "preference",
        }
    ]
    assert "memory_id: mem-1" in markdown
    assert "tenant_id: 3" in markdown
    assert "readonly: True" in markdown
    assert "Planner prefers concise tables." in markdown
