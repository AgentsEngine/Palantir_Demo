# Action Contracts

The application loads this file as deployment-level Agent configuration. The Python runtime should treat these as data, not hard-coded product logic.

```json
{
  "maintenance.create_work_order_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["asset", "problem_or_risk", "priority_or_window"],
    "questions": [
      "涉及哪个对象、设备、资产或业务单元？",
      "触发原因、问题或风险是什么？",
      "优先级、期望时间窗口或负责人是否明确？"
    ],
    "slot_terms": {
      "asset": ["设备", "资产", "对象", "产线", "equipment", "asset", "machine", "line"],
      "problem_or_risk": ["问题", "风险", "故障", "异常", "problem", "risk", "failure", "issue"],
      "priority_or_window": ["优先", "紧急", "时间", "截止", "小时", "天", "priority", "urgent", "due", "window"]
    },
    "example": "对象 A，出现异常风险，优先级高，48 小时内处理。"
  },
  "supply.create_purchase_request_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["item", "quantity", "reason"],
    "questions": ["申请或采购什么对象？", "数量是多少？", "申请原因或需求来源是什么？"],
    "slot_terms": {
      "item": ["物料", "对象", "项目", "item", "material", "part"],
      "quantity": ["数量", "件", "个", "套", "pcs", "qty"],
      "reason": ["原因", "需求", "库存", "项目", "reason", "need", "stock"]
    },
    "example": "申请对象 X 200 件，因为预计库存不足。"
  },
  "material.create_material_application_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["item", "quantity", "usage"],
    "questions": ["申请或领用什么对象？", "数量是多少？", "用途、业务单元或关联事项是什么？"],
    "slot_terms": {
      "item": ["物料", "对象", "料号", "item", "material"],
      "quantity": ["数量", "件", "个", "套", "pcs", "qty"],
      "usage": ["用途", "业务", "工单", "产线", "usage", "line", "purpose"]
    },
    "example": "领用对象 X 36 套，用于某业务单元补充。"
  },
  "quality.create_capa_draft": {
    "tool": "forms.create_dynamic_record_draft",
    "required": ["problem", "containment", "owner_or_due_date"],
    "questions": ["问题是什么？", "临时处理或遏制措施是什么？", "责任人或截止时间是否明确？"],
    "slot_terms": {
      "problem": ["问题", "缺陷", "异常", "不良", "problem", "defect", "issue"],
      "containment": ["遏制", "隔离", "整改", "处理", "containment", "corrective", "action"],
      "owner_or_due_date": ["责任", "负责人", "截止", "今天", "本周", "owner", "due"]
    },
    "example": "问题 X 已确认，先隔离影响范围，负责人本周内完成分析。"
  },
  "low_code.create_form_definition": {
    "tool": "forms.create_form_definition",
    "required": ["form.name", "form.code", "fields"],
    "optional": ["form.description", "menu.create", "menu.title", "menu.icon"],
    "field_schema": ["field_name", "label", "field_type", "required", "searchable", "sortable", "enum_values"],
    "supported_field_types": ["boolean", "date", "datetime", "decimal", "enum", "integer", "json", "number", "relation", "string", "text"],
    "questions": [
      "表单名称和用途是什么？",
      "需要哪些字段？哪些字段必填？",
      "是否创建菜单入口？如果创建，菜单名称是什么？",
      "是否有枚举字段或特殊类型字段？"
    ],
    "example": "表单名称为对象主数据，字段包括编码、名称、类型、状态；编码和名称必填；创建菜单入口。"
  }
}
```
