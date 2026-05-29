# Action Contracts

The application loads this file as deployment-level Agent configuration. The Python runtime should treat these as data, not hard-coded product logic.

```json
{
  "maintenance.create_work_order_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["asset", "problem_or_risk", "priority_or_window"],
    "questions": [
      "涉及哪个设备、资产、产线或业务对象？",
      "触发原因、问题或风险是什么？",
      "优先级、时间窗口、截止时间或负责人是否明确？"
    ],
    "slot_terms": {
      "asset": ["设备", "资产", "对象", "产线", "机器", "equipment", "asset", "machine", "line"],
      "problem_or_risk": ["问题", "风险", "故障", "异常", "报警", "problem", "risk", "failure", "issue", "alarm"],
      "priority_or_window": ["优先级", "紧急", "时间", "截止", "小时", "天", "负责人", "priority", "urgent", "due", "window", "owner"]
    },
    "example": "设备：SMT-03；问题：温区 5 曲线漂移；优先级：高，8 小时内处理。"
  },
  "supply.create_purchase_request_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["item", "quantity", "reason"],
    "questions": [
      "申请或采购什么物料、零件或对象？",
      "数量是多少？",
      "申请原因、业务需求或库存风险是什么？"
    ],
    "slot_terms": {
      "item": ["物料", "零件", "对象", "料号", "项目", "item", "material", "part"],
      "quantity": ["数量", "个", "件", "套", "pcs", "qty", "quantity"],
      "reason": ["原因", "需求", "库存", "项目", "短缺", "reason", "need", "stock", "shortage"]
    },
    "example": "物料：焊锡膏 S12；数量：200 件；原因：预计库存不足。"
  },
  "material.create_material_application_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["item", "quantity", "usage"],
    "questions": [
      "申请或领用什么物料、料号或对象？",
      "数量是多少？",
      "用途、工单、产线或关联事项是什么？"
    ],
    "slot_terms": {
      "item": ["物料", "料号", "对象", "零件", "item", "material", "part"],
      "quantity": ["数量", "个", "件", "套", "pcs", "qty", "quantity"],
      "usage": ["用途", "业务", "工单", "产线", "补料", "usage", "line", "purpose", "work order"]
    },
    "example": "物料：电控模块外壳；数量：36 套；用途：WO-260521-017 补料。"
  },
  "quality.create_capa_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["problem", "containment", "owner_or_due_date"],
    "questions": [
      "问题、缺陷或异常是什么？",
      "临时处理、遏制或隔离措施是什么？",
      "责任人、截止时间或完成窗口是否明确？"
    ],
    "slot_terms": {
      "problem": ["问题", "缺陷", "异常", "不良", "风险", "problem", "defect", "issue", "risk", "quality", "capa", "category"],
      "containment": ["临时措施", "遏制", "隔离", "整改", "处理", "containment", "corrective", "action"],
      "owner_or_due_date": ["责任人", "负责人", "截止", "到期", "今天", "本周", "owner", "due"]
    },
    "example": "问题：BGA 虚焊缺陷率上升；临时措施：隔离受影响批次；责任人：QE 王工，今天完成。"
  },
  "low_code.create_form_definition": {
    "planner_tool": "ai.semantic_plan_low_code_form",
    "tool": "forms.create_form_definition",
    "required": ["form.name", "form.code", "fields"],
    "optional": ["form.description", "menu.create", "menu.title", "menu.icon"],
    "field_schema": ["field_name", "label", "field_type", "required", "searchable", "sortable", "enum_values"],
    "supported_field_types": ["boolean", "date", "datetime", "decimal", "enum", "integer", "json", "number", "relation", "string", "text"],
    "semantic_operations": ["create_form", "rename_form", "add_field", "update_field", "remove_field", "confirm", "qa"],
    "delta_schema": {
      "create_form": {"writes": ["form", "fields", "menu"], "requires_confirmation": true},
      "rename_form": {"writes": ["form.name"], "requires_confirmation": true},
      "add_field": {"writes": ["fields"], "requires_confirmation": true},
      "update_field": {"writes": ["fields"], "requires_confirmation": true},
      "remove_field": {"writes": ["fields"], "requires_confirmation": true},
      "confirm": {"writes": [], "requires_existing_draft": true},
      "qa": {"writes": []}
    },
    "questions": [
      "表单名称和用途是什么？",
      "需要哪些字段？哪些字段必填？",
      "是否创建菜单入口？如果创建，菜单名称是什么？",
      "是否有枚举字段、关联字段或特殊字段类型？"
    ],
    "example": "表单名称：物料主数据；字段：物料编码、物料名称、物料类型、安全库存；物料编码和物料名称必填；创建菜单入口。"
  }
}
```
