# Skill Registry

```json
{
  "knowledge.answer_question": {
    "name": "knowledge.answer_question",
    "title": "Knowledge Q&A",
    "description": "Search approved knowledge and answer with evidence references.",
    "capability_level": "qa",
    "risk_level": "low",
    "allowed_tools": ["knowledge.search"],
    "required_permissions": ["rag"],
    "confirmation_policy": "none",
    "permission_capability": "rag",
    "domain": "knowledge",
    "output_schema": {"type": "answer", "requires_evidence": true}
  },
  "knowledge.ingest_for_rag": {
    "name": "knowledge.ingest_for_rag",
    "title": "Knowledge ingestion",
    "description": "Convert uploaded assets into Markdown and searchable chunks.",
    "capability_level": "assisted",
    "risk_level": "medium",
    "allowed_tools": ["knowledge.ingest_document", "knowledge.convert_to_markdown", "knowledge.chunk_markdown", "knowledge.embed_chunks"],
    "required_permissions": ["rag"],
    "confirmation_policy": "confirm",
    "permission_capability": "rag",
    "domain": "knowledge",
    "output_schema": {"type": "ingestion_job"}
  },
  "quality.create_capa_draft": {
    "name": "quality.create_capa_draft",
    "title": "CAPA draft",
    "description": "Prepare a corrective action draft from page context and evidence.",
    "capability_level": "assisted",
    "risk_level": "medium",
    "allowed_tools": ["knowledge.search", "quality.get_event", "forms.create_dynamic_record_draft"],
    "required_permissions": ["draft", "quality"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "draft",
    "domain": "quality",
    "output_schema": {"type": "draft_action", "domain": "quality"}
  },
  "maintenance.create_work_order_draft": {
    "name": "maintenance.create_work_order_draft",
    "title": "Maintenance work order draft",
    "description": "Prepare a work order draft with supporting evidence.",
    "capability_level": "assisted",
    "risk_level": "medium",
    "allowed_tools": ["knowledge.search", "inventory.get_stock", "forms.create_dynamic_record_draft"],
    "required_permissions": ["draft", "maintenance"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "draft",
    "domain": "maintenance",
    "output_schema": {"type": "draft_action", "domain": "maintenance"}
  },
  "supply.create_purchase_request_draft": {
    "name": "supply.create_purchase_request_draft",
    "title": "Purchase request draft",
    "description": "Prepare a purchase request draft without creating an external order.",
    "capability_level": "assisted",
    "risk_level": "medium",
    "allowed_tools": ["knowledge.search", "inventory.get_stock", "forms.create_dynamic_record_draft"],
    "required_permissions": ["draft", "supply-chain"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "draft",
    "domain": "supply-chain",
    "output_schema": {"type": "draft_action", "domain": "supply-chain"}
  },
  "material.create_material_application_draft": {
    "name": "material.create_material_application_draft",
    "title": "Material application draft",
    "description": "Prepare a material application draft for human review.",
    "capability_level": "assisted",
    "risk_level": "medium",
    "allowed_tools": ["knowledge.search", "inventory.get_stock", "forms.create_dynamic_record_draft"],
    "required_permissions": ["draft", "supply-chain"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "draft",
    "domain": "supply-chain",
    "output_schema": {"type": "draft_action", "domain": "supply-chain"}
  },
  "analysis.analyze_form_records": {
    "name": "analysis.analyze_form_records",
    "title": "Analyze form records",
    "description": "Query permitted dynamic form records, summarize patterns, cite record evidence, and recommend next actions without writing data.",
    "capability_level": "assisted",
    "risk_level": "low",
    "allowed_tools": ["forms.query_records", "forms.get_record", "knowledge.search"],
    "required_permissions": ["business_query"],
    "confirmation_policy": "none",
    "permission_capability": "business_query",
    "domain": "analysis",
    "output_schema": {
      "type": "analysis_result",
      "requires_evidence": true,
      "recommended_actions": true
    }
  },
  "low_code.suggest_model_or_page": {
    "name": "low_code.suggest_model_or_page",
    "title": "Low-code design suggestion",
    "description": "Suggest data model, page, or workflow configuration changes as a draft.",
    "capability_level": "assisted",
    "risk_level": "high",
    "allowed_tools": ["knowledge.search", "graph.query_impact"],
    "required_permissions": ["config"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "config",
    "domain": "low-code",
    "output_schema": {"type": "configuration_suggestion", "diff_required": true}
  },
  "low_code.create_form_definition": {
    "name": "low_code.create_form_definition",
    "title": "Create low-code form",
    "description": "Guide the user through a low-code form definition plan, interpret conversational changes as structured form deltas, and create the form only after approval.",
    "capability_level": "agentic",
    "risk_level": "high",
    "allowed_tools": ["ai.semantic_plan_low_code_form", "forms.create_form_definition"],
    "required_permissions": ["config"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "config",
    "domain": "low-code",
    "output_schema": {
      "type": "configuration_write",
      "resource": "form",
      "draft_required": true,
      "delta_supported": true,
      "confirmation_checklist": true
    }
  },
  "low_code.add_form_field": {
    "name": "low_code.add_form_field",
    "title": "Add low-code form field",
    "description": "Add one or more fields to an existing low-code form after semantic planning, permission checks, and human confirmation.",
    "capability_level": "agentic",
    "risk_level": "high",
    "allowed_tools": ["ai.semantic_plan_low_code_form", "forms.add_form_field"],
    "required_permissions": ["config"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "config",
    "domain": "low-code",
    "output_schema": {
      "type": "configuration_write",
      "resource": "form_field",
      "draft_required": true,
      "delta_supported": true,
      "confirmation_checklist": true
    }
  },
  "workflow.submit_after_confirmation": {
    "name": "workflow.submit_after_confirmation",
    "title": "Workflow submission",
    "description": "Submit a prepared draft to workflow only after confirmation.",
    "capability_level": "agentic",
    "risk_level": "high",
    "allowed_tools": ["workflow.start", "notifications.create"],
    "required_permissions": ["workflow"],
    "confirmation_policy": "confirm_token",
    "permission_capability": "workflow",
    "domain": "workflow",
    "output_schema": {"type": "workflow_result"}
  }
}
```
