import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOutlined,
  ApartmentOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DragOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileSearchOutlined,
  FormOutlined,
  HistoryOutlined,
  HolderOutlined,
  LayoutOutlined,
  LinkOutlined,
  LockOutlined,
  MobileOutlined,
  NumberOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
  SelectOutlined,
  SettingOutlined,
  SwitcherOutlined,
  TabletOutlined,
  TableOutlined,
  TagsOutlined,
  UndoOutlined,
  UserOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Checkbox, Input, InputNumber, Modal, Popover, Segmented, Select, Space, Switch, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import {
  adminListOrgUnits,
  adminListRoles,
  createPlatformForm,
  createPlatformFormField,
  deletePlatformFormPermission,
  listPlatformFormLayouts,
  listPlatformFormPermissions,
  listPlatformForms,
  listWorkflowBindings,
  previewPlatformFormPublish,
  publishPlatformForm,
  updatePlatformForm,
  updateWorkflowBinding,
  upsertPlatformFormPermission,
  upsertPlatformFormLayout,
  upsertWorkflowBinding,
  wfCreateDefinition,
  wfGetDefinition,
  wfUpdateDefinition,
  type PlatformForm,
  type PlatformFormPublishReport,
} from '@/services/api';
import {
  controlTypeForField,
  defaultOperatorForControl,
  makeDefaultViewConfig,
  normalizeViewConfig,
  renderTypeForField,
  sortByOrder,
  type ViewColumnRenderType,
  type ViewConfig,
  type ViewControlType,
  type ViewFilterConfig,
  type ViewFilterOperator,
  type ViewTableColumnConfig,
} from '@/utils/viewConfig';
import ProfessionalFlowDesigner, {
  createDefaultFlowConfig,
  validateFlowDesignerConfig,
  type FlowDesignerConfig,
  type FlowDesignerEdge,
  type FlowDesignerNode,
} from './ProfessionalFlowDesigner';
import './style.css';

type DesignerTab = 'form' | 'filter' | 'flow' | 'permission';
type ComponentPanel = 'components' | 'fieldTypes';
type ControlSource = 'field' | 'component';
type ControlWidth = 'quarter' | 'half' | 'threeQuarter' | 'full';
type FlowPortSide = 'top' | 'right' | 'bottom' | 'left';
type DropPosition = 'before' | 'after';
type ControlRuleKey =
  | 'visible'
  | 'readonly'
  | 'required'
  | 'unique'
  | 'masked'
  | 'copyable'
  | 'optionSort';
type PreviewMode = 'create' | 'edit' | 'list';
type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
type PublishCheckLevel = 'error' | 'warning' | 'suggestion';
type EncodingResetCycle = 'none' | 'day' | 'month' | 'year' | 'dependency';
type EncodingSegmentType = 'fixed' | 'date' | 'field' | 'masterData' | 'organization' | 'sequence';
type EncodingPadding = 'none' | 'leftZero' | 'rightZero' | 'truncate';
type EncodingGenerationMode = 'auto' | 'manual' | 'autoEditable';
type EncodingGenerationTiming = 'create' | 'save' | 'submit' | 'workflowNode';
type EncodingUniquenessScope = 'form' | 'global' | 'organization' | 'dependency';
type ReferenceSourceKind = 'static' | 'dictionary' | 'masterData' | 'businessForm' | 'organization' | 'externalApi';
type FieldBusinessType =
  | 'text'
  | 'longText'
  | 'number'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'person'
  | 'relation'
  | 'attachment'
  | 'code';

interface ControlRuleCondition {
  sourceField?: string;
  operator?: string;
  value?: string;
  strategy?: string;
  parameter?: string;
  note?: string;
}

interface ControlRule {
  enabled: boolean;
  conditions?: ControlRuleCondition;
}

type ControlRules = Record<ControlRuleKey, ControlRule>;

interface EncodingSegment {
  id: string;
  name: string;
  type: EncodingSegmentType;
  length: number;
  value?: string;
  sourceField?: string;
  sourceAttribute?: string;
  datePattern?: string;
  resetCycle?: EncodingResetCycle;
  padding?: EncodingPadding;
  sequenceStart?: number;
  sequenceStep?: number;
  regenerateOnChange?: boolean;
  lockAfterGenerated?: boolean;
}

interface EncodingRule {
  enabled: boolean;
  template: string;
  dependencies: string[];
  resetCycle: EncodingResetCycle;
  sequenceLength: number;
  fixedLength?: number;
  prefix?: string;
  datePattern?: string;
  dependencySegmentLength?: number;
  regenerateOnDependencyChange: boolean;
  allowManualOverride: boolean;
  unique: boolean;
  segments?: EncodingSegment[];
  generationMode?: EncodingGenerationMode;
  generationTiming?: EncodingGenerationTiming;
  uniquenessScope?: EncodingUniquenessScope;
}

interface DesignerField {
  key: string;
  name: string;
  type: string;
  businessType?: FieldBusinessType;
  placeholder: string;
  locked?: boolean;
  required?: boolean;
  listVisible?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  defaultValue?: string;
  validation?: string;
  optionSource?: string;
}

interface DesignerConfig {
  id: string;
  name: string;
  createTitle: string;
  kind: 'business' | 'analysis';
  appName: string;
  dataSource: string;
  primaryKey: string;
  status: string;
  version: string;
  description: string;
  fields: DesignerField[];
  filters: DesignerField[];
  flowSteps: string[];
  roles: string[];
}

interface ComponentDefinition {
  key: string;
  category: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  controlType: string;
  defaultWidth?: ControlWidth;
}

interface LayoutControl {
  id: string;
  source: ControlSource;
  controlType: string;
  name: string;
  desc?: string;
  fieldKey?: string;
  placeholder?: string;
  helpText?: string;
  optionSource?: string;
  dataSourceKind?: ReferenceSourceKind;
  encodingRule?: EncodingRule;
  width: ControlWidth;
  rules: ControlRules;
}

interface FlowNode {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
}

interface FlowConnection {
  id: string;
  fromId: string;
  fromSide: FlowPortSide;
  toId: string;
  toSide: FlowPortSide;
}

interface FlowNodeDefinition {
  key: string;
  name: string;
  desc: string;
  role: string;
  icon: React.ReactNode;
}

interface BusinessSection {
  key: string;
  title: string;
  desc: string;
  fieldKeys: string[];
}

interface PublishCheckItem {
  level: PublishCheckLevel;
  title: string;
  detail: string;
}

interface WorkflowDesignerMeta {
  draftWorkflowId?: number;
  publishedWorkflowId?: number;
  publishedAt?: string;
  publishedVersion?: number;
}

interface ViewConfigMeta {
  draftVersion?: number;
  publishedVersion?: number;
  draftSavedAt?: string;
  publishedAt?: string;
  status?: 'draft' | 'published';
}

interface PermissionDesignDraft {
  page: Record<string, boolean>;
  actions: Record<string, boolean>;
  fields: Record<string, {
    visible: boolean;
    editable: boolean;
    required: boolean;
    exportable: boolean;
  }>;
  data: {
    scope: string;
    orgUnits: number[];
    sensitiveFields: string;
    ownership: Record<string, boolean>;
  };
}

type PermissionDraftMap = Record<string, PermissionDesignDraft>;

interface WorkflowDefinitionPayload {
  id: number;
  name: string;
  description?: string;
  config?: Partial<FlowDesignerConfig> & Record<string, unknown>;
  form_config?: Record<string, unknown>;
  status?: string;
  version?: number;
}

interface WorkflowBindingPayload {
  id: number;
  form_id: number;
  workflow_id: number;
  trigger_action: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

const permissionActionDefinitions = [
  { key: 'view', name: '查看', desc: '打开页面、查看列表和详情', risk: 'low' },
  { key: 'create', name: '新增', desc: '创建业务记录或提交申请', risk: 'medium' },
  { key: 'edit', name: '编辑', desc: '修改已存在的告警记录', risk: 'medium' },
  { key: 'delete', name: '删除', desc: '移除记录，高风险动作', risk: 'high' },
  { key: 'import', name: '导入', desc: '批量写入告警数据', risk: 'high' },
  { key: 'export', name: '导出', desc: '下载列表或报表数据', risk: 'high' },
  { key: 'approve', name: '审批', desc: '处理流程节点和关闭告警', risk: 'medium' },
] as const;

function makePermissionDesignDraft(roleKind: 'system' | 'manager' | 'operator', orgUnits: number[]): PermissionDesignDraft {
  return {
    page: {
      menu: true,
      enter: true,
      detail: true,
      designTab: roleKind !== 'operator',
      preview: roleKind !== 'operator',
      publish: roleKind === 'system',
    },
    actions: {
      view: true,
      create: roleKind !== 'operator',
      edit: roleKind !== 'operator',
      delete: roleKind === 'system',
      import: roleKind !== 'operator',
      export: roleKind !== 'operator',
      approve: roleKind !== 'operator',
    },
    fields: {},
    data: {
      scope: roleKind === 'system' ? 'all' : roleKind === 'manager' ? 'org_tree' : 'assigned',
      orgUnits: orgUnits.slice(0, 2),
      sensitiveFields: roleKind === 'system' ? 'full' : 'mask',
      ownership: {
        createdByMe: true,
        assignedToMe: true,
        sameOrg: roleKind !== 'operator',
        crossOrg: roleKind === 'system',
        statistics: roleKind === 'system',
      },
    },
  };
}

function permissionDraftsFromConfig(config?: Record<string, unknown> | null): PermissionDraftMap {
  const permissionDesign = config?.permissionDesign;
  if (!permissionDesign || typeof permissionDesign !== 'object') return {};
  const roles = (permissionDesign as { roles?: unknown }).roles;
  return roles && typeof roles === 'object' ? roles as PermissionDraftMap : {};
}

function sanitizePermissionDesignDraft(draft: PermissionDesignDraft): PermissionDesignDraft {
  const actions = Object.fromEntries(
    Object.entries(draft.actions || {}).filter(([key]) => key !== 'configure'),
  ) as Record<string, boolean>;
  const data = draft.data || {
    scope: 'assigned',
    orgUnits: [],
    sensitiveFields: 'mask',
    ownership: {},
  };
  const orgUnits = Array.from(new Set(
    (Array.isArray(data.orgUnits) ? data.orgUnits : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  ));
  return {
    page: draft.page || {},
    actions,
    fields: draft.fields || {},
    data: {
      ...data,
      orgUnits,
    },
  };
}

const controlWidthOptions = [
  { value: 'quarter', label: '25%' },
  { value: 'half', label: '50%' },
  { value: 'threeQuarter', label: '75%' },
  { value: 'full', label: '100%' },
];

const previewModeOptions = [
  { value: 'create', label: '新建记录' },
  { value: 'edit', label: '编辑记录' },
  { value: 'list', label: '列表页' },
];

const previewDeviceOptions = [
  { value: 'desktop', label: '桌面', icon: <LayoutOutlined /> },
  { value: 'tablet', label: '平板', icon: <TabletOutlined /> },
  { value: 'mobile', label: '手机', icon: <MobileOutlined /> },
];

const controlTypeOptions = [
  { value: 'code', label: '编码' },
  { value: 'text', label: '文本输入' },
  { value: 'textarea', label: '多行文本' },
  { value: 'number', label: '数值输入' },
  { value: 'select', label: '下拉选择' },
  { value: 'relation', label: '对象/人员选择' },
  { value: 'datetime', label: '日期时间' },
  { value: 'upload', label: '附件上传' },
  { value: 'switch', label: '开关切换' },
  { value: 'readonly-text', label: '只读展示' },
];

const fieldBusinessTypeOptions: Array<{ value: FieldBusinessType; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'longText', label: '多行文本' },
  { value: 'number', label: '数值' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'enum', label: '枚举/下拉' },
  { value: 'person', label: '人员' },
  { value: 'relation', label: '关联对象' },
  { value: 'attachment', label: '附件' },
  { value: 'code', label: '编码' },
];

const encodingResetCycleOptions = [
  { value: 'none', label: '不重置' },
  { value: 'day', label: '按天重置' },
  { value: 'month', label: '按月重置' },
  { value: 'year', label: '按年重置' },
  { value: 'dependency', label: '按依赖字段重置' },
];

const encodingDatePatternOptions = [
  { value: 'YYMM', label: 'YYMM（4位）' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD（8位）' },
  { value: 'YYYY', label: 'YYYY（4位）' },
  { value: 'MMDD', label: 'MMDD（4位）' },
  { value: 'none', label: '不使用日期段' },
];

const encodingSegmentTypeOptions: Array<{ value: EncodingSegmentType; label: string }> = [
  { value: 'fixed', label: '固定文本' },
  { value: 'date', label: '日期时间' },
  { value: 'field', label: '表单字段' },
  { value: 'masterData', label: '基础档案' },
  { value: 'organization', label: '组织信息' },
  { value: 'sequence', label: '流水号' },
];

const encodingPaddingOptions: Array<{ value: EncodingPadding; label: string }> = [
  { value: 'none', label: '不补位' },
  { value: 'leftZero', label: '左侧补 0' },
  { value: 'rightZero', label: '右侧补 0' },
  { value: 'truncate', label: '超长截断' },
];

const encodingGenerationModeOptions: Array<{ value: EncodingGenerationMode; label: string }> = [
  { value: 'auto', label: '自动生成' },
  { value: 'autoEditable', label: '自动生成后可改' },
  { value: 'manual', label: '手工录入' },
];

const encodingGenerationTimingOptions: Array<{ value: EncodingGenerationTiming; label: string }> = [
  { value: 'create', label: '新建时生成' },
  { value: 'save', label: '保存草稿时生成' },
  { value: 'submit', label: '提交时生成' },
  { value: 'workflowNode', label: '流程节点生成' },
];

const encodingUniquenessScopeOptions: Array<{ value: EncodingUniquenessScope; label: string }> = [
  { value: 'form', label: '当前表单唯一' },
  { value: 'global', label: '全局唯一' },
  { value: 'organization', label: '组织内唯一' },
  { value: 'dependency', label: '依赖范围内唯一' },
];

const referenceSourceKindOptions: Array<{ value: ReferenceSourceKind; label: string }> = [
  { value: 'static', label: '静态选项' },
  { value: 'dictionary', label: '数据字典' },
  { value: 'masterData', label: '基础档案' },
  { value: 'businessForm', label: '业务表单' },
  { value: 'organization', label: '用户组织' },
  { value: 'externalApi', label: '外部接口' },
];

const referenceSourceRegistry: Record<ReferenceSourceKind, {
  setup: string;
  placeholder: string;
  objects: Array<{ value: string; label: string }>;
  valueFields: Array<{ value: string; label: string }>;
  labelFields: Array<{ value: string; label: string }>;
  preview: string[];
}> = {
  static: {
    setup: '当前字段配置中维护，适合只服务本字段的小枚举',
    placeholder: '例如：系统监测、人工上报、外部接口',
    objects: [{ value: 'inline_options', label: '字段私有选项' }],
    valueFields: [{ value: 'value', label: '选项值' }],
    labelFields: [{ value: 'label', label: '选项名称' }],
    preview: ['系统监测', '人工上报', '外部接口'],
  },
  dictionary: {
    setup: '系统管理 / 数据字典与基础档案 / 数据字典',
    placeholder: '选择数据字典，例如 alert_level',
    objects: [
      { value: 'alert_source', label: '告警来源' },
      { value: 'alert_level', label: '告警等级' },
      { value: 'alert_status', label: '告警状态' },
      { value: 'priority', label: '优先级' },
    ],
    valueFields: [{ value: 'item_value', label: '字典项编码' }],
    labelFields: [{ value: 'item_label', label: '字典项名称' }],
    preview: ['严重', '一般', '提醒'],
  },
  masterData: {
    setup: '系统管理 / 数据字典与基础档案 / 基础档案',
    placeholder: '选择基础档案，例如 equipment_master',
    objects: [
      { value: 'equipment_master', label: '设备档案' },
      { value: 'production_line_master', label: '产线档案' },
      { value: 'material_master', label: '物料档案' },
      { value: 'supplier_master', label: '供应商档案' },
      { value: 'alert_type_master', label: '告警类型档案' },
    ],
    valueFields: [
      { value: 'id', label: '内部 ID' },
      { value: 'code', label: '档案编码' },
      { value: 'equipment_no', label: '设备编号' },
    ],
    labelFields: [
      { value: 'name', label: '档案名称' },
      { value: 'equipment_name', label: '设备名称' },
    ],
    preview: ['SMT-03 回流焊', '空压站 2#', 'Assembly-A 主线'],
  },
  businessForm: {
    setup: '系统管理 / 应用与菜单 / 表单资产',
    placeholder: '选择业务表单，例如 alert-center',
    objects: [
      { value: 'alert-center', label: '告警中心' },
      { value: 'risk-review', label: '风险复核' },
      { value: 'maintenance-order', label: '维修工单' },
    ],
    valueFields: [{ value: 'id', label: '记录 ID' }, { value: 'code', label: '业务编号' }],
    labelFields: [{ value: 'title', label: '标题' }, { value: 'name', label: '名称' }],
    preview: ['AL-20260529-001', 'AL-20260529-002'],
  },
  organization: {
    setup: '系统管理 / 用户与权限 / 组织管理、用户管理、角色管理',
    placeholder: '选择组织、角色或人员范围',
    objects: [
      { value: 'users', label: '用户' },
      { value: 'roles', label: '角色' },
      { value: 'org_units', label: '组织' },
    ],
    valueFields: [{ value: 'user_id', label: '用户 ID' }, { value: 'role_id', label: '角色 ID' }],
    labelFields: [{ value: 'display_name', label: '姓名' }, { value: 'role_label', label: '角色名称' }],
    preview: ['李明', '孙浩', '周强'],
  },
  externalApi: {
    setup: '数据源管理 / REST API 或系统管理 / 数据资产与本体',
    placeholder: '选择已接入的 API 数据源',
    objects: [
      { value: 'mes-alert-api', label: 'MES 告警接口' },
      { value: 'erp-material-api', label: 'ERP 物料接口' },
    ],
    valueFields: [{ value: 'id', label: '接口返回 ID' }, { value: 'code', label: '接口返回编码' }],
    labelFields: [{ value: 'name', label: '接口返回名称' }, { value: 'label', label: '接口返回标签' }],
    preview: ['外部接口项 A', '外部接口项 B'],
  },
};

const ruleLabels: Record<ControlRuleKey, string> = {
  visible: '默认显示',
  readonly: '默认只读',
  required: '默认必输',
  unique: '唯一校验',
  masked: '默认脱敏',
  copyable: '允许复制',
  optionSort: '选项排序',
};

const ruleOperatorOptions = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notEmpty', label: '不为空' },
];

const ruleStrategyOptions: Partial<Record<ControlRuleKey, Array<{ value: string; label: string }>>> = {
  unique: [
    { value: 'form', label: '当前表单唯一' },
    { value: 'global', label: '全局唯一' },
    { value: 'compound', label: '组合字段唯一' },
  ],
  masked: [
    { value: 'role', label: '按角色脱敏' },
    { value: 'partial', label: '保留首尾' },
    { value: 'hidden', label: '全量隐藏' },
  ],
  copyable: [
    { value: 'normal', label: '允许复制文本' },
    { value: 'maskedCopy', label: '复制时脱敏' },
    { value: 'disabled', label: '禁止复制' },
  ],
  optionSort: [
    { value: 'sourceOrder', label: '按数据源顺序' },
    { value: 'labelAsc', label: '按显示名称升序' },
    { value: 'valueAsc', label: '按编码/值升序' },
    { value: 'custom', label: '自定义排序' },
  ],
};

const viewControlOptions: Array<{ value: ViewControlType; label: string }> = [
  { value: 'keyword', label: '关键词' },
  { value: 'text', label: '文本输入' },
  { value: 'select', label: '下拉选择' },
  { value: 'dateRange', label: '日期范围' },
  { value: 'date', label: '单日期' },
  { value: 'number', label: '数字' },
  { value: 'relation', label: '关联对象' },
];

const viewFilterOperatorOptions: Array<{ value: ViewFilterOperator; label: string }> = [
  { value: 'contains', label: '包含' },
  { value: 'equals', label: '等于' },
  { value: 'between', label: '范围内' },
  { value: 'gte', label: '大于等于' },
  { value: 'lte', label: '小于等于' },
];

const viewColumnRenderOptions: Array<{ value: ViewColumnRenderType; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'tag', label: '标签' },
  { value: 'date', label: '日期' },
  { value: 'number', label: '数字' },
  { value: 'progress', label: '进度条' },
];

const FLOW_NODE_WIDTH = 220;
const FLOW_NODE_HEIGHT = 72;

function controlWidthLabel(width: ControlWidth) {
  const option = controlWidthOptions.find((item) => item.value === width);
  return option?.label || '50%';
}

function controlWidthClass(width: ControlWidth) {
  return `control-width-${width}`;
}

function makeControlRules(required = false, field?: DesignerField): ControlRules {
  return {
    visible: { enabled: true },
    readonly: { enabled: Boolean(field?.locked) },
    required: { enabled: required },
    unique: { enabled: isEncodingField(field) },
    masked: { enabled: false },
    copyable: { enabled: true },
    optionSort: { enabled: false },
  };
}

function normalizeControlRules(rules?: Partial<ControlRules>, field?: DesignerField): ControlRules {
  const defaults = makeControlRules(Boolean(field?.required), field);
  return (Object.keys(defaults) as ControlRuleKey[]).reduce((next, ruleKey) => ({
    ...next,
    [ruleKey]: {
      ...defaults[ruleKey],
      ...(rules?.[ruleKey] || {}),
      conditions: rules?.[ruleKey]?.conditions ? { ...rules[ruleKey]?.conditions } : defaults[ruleKey].conditions,
    },
  }), {} as ControlRules);
}

function inferBusinessTypeFromLegacyType(type = ''): FieldBusinessType {
  if (type === 'code' || type.includes('编码')) return 'code';
  if (type.includes('日期')) return 'datetime';
  if (type.includes('数字') || type.includes('数值')) return 'number';
  if (type.includes('下拉') || type.includes('选择')) return 'enum';
  if (type.includes('人员')) return 'person';
  if (type.includes('关联')) return 'relation';
  if (type.includes('附件')) return 'attachment';
  if (type.includes('多行')) return 'longText';
  return 'text';
}

function getFieldBusinessType(field?: DesignerField): FieldBusinessType {
  if (!field) return 'text';
  return field.businessType || inferBusinessTypeFromLegacyType(field.type);
}

function getFieldBusinessTypeLabel(field?: DesignerField) {
  const businessType = getFieldBusinessType(field);
  return fieldBusinessTypeOptions.find((item) => item.value === businessType)?.label || '文本';
}

const fieldStorageTypeLabels: Record<string, string> = {
  string: '文本 string',
  text: '长文本 text',
  number: '数值 number',
  integer: '整数 integer',
  decimal: '小数 decimal',
  float: '浮点 float',
  boolean: '布尔 boolean',
  date: '日期 date',
  datetime: '日期时间 datetime',
  enum: '枚举 enum',
  relation: '关联 relation',
  json: 'JSON json',
};

function getFieldStorageTypeLabel(field?: DesignerField) {
  if (!field) return '未绑定字段';
  const storageType = mapDesignerFieldType(field);
  return fieldStorageTypeLabels[storageType] || storageType;
}

function isEncodingField(field?: DesignerField) {
  return getFieldBusinessType(field) === 'code';
}

function makeEncodingRule(field?: DesignerField): EncodingRule {
  const prefix = field?.key.toLowerCase().includes('alert') ? 'AL' : field?.key.toLowerCase().includes('risk') ? 'SR' : 'NO';
  const defaultSegments: EncodingSegment[] = [
    {
      id: 'segment-prefix',
      name: '业务前缀',
      type: 'fixed',
      length: prefix.length,
      value: prefix,
      padding: 'none',
      lockAfterGenerated: true,
    },
    {
      id: 'segment-date',
      name: '年月',
      type: 'date',
      length: 4,
      datePattern: 'YYMM',
      padding: 'none',
      lockAfterGenerated: true,
    },
    {
      id: 'segment-sequence',
      name: '流水号',
      type: 'sequence',
      length: 3,
      resetCycle: 'month',
      padding: 'leftZero',
      sequenceStart: 1,
      sequenceStep: 1,
      lockAfterGenerated: true,
    },
  ];
  return {
    enabled: true,
    template: `{PREFIX}-{YYMM}-{SEQ3}`,
    prefix,
    datePattern: 'YYMM',
    dependencies: [],
    resetCycle: 'month',
    sequenceLength: 3,
    fixedLength: 13,
    dependencySegmentLength: 2,
    regenerateOnDependencyChange: true,
    allowManualOverride: false,
    unique: true,
    segments: defaultSegments,
    generationMode: 'auto',
    generationTiming: 'create',
    uniquenessScope: 'form',
  };
}

function makeEncodingSegment(type: EncodingSegmentType = 'fixed', fields: DesignerField[] = []): EncodingSegment {
  const firstSourceField = fields.find((field) => !isEncodingField(field));
  const base: EncodingSegment = {
    id: `segment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: encodingSegmentTypeOptions.find((item) => item.value === type)?.label || '编码段',
    type,
    length: type === 'sequence' ? 3 : type === 'date' ? 4 : 2,
    padding: type === 'sequence' ? 'leftZero' : 'truncate',
    lockAfterGenerated: true,
  };
  if (type === 'fixed') return { ...base, name: '固定文本', value: 'AL', length: 2, padding: 'none' };
  if (type === 'date') return { ...base, name: '日期', datePattern: 'YYMM', length: 4, padding: 'none' };
  if (type === 'sequence') return { ...base, name: '流水号', resetCycle: 'month', sequenceStart: 1, sequenceStep: 1 };
  if (type === 'organization') return { ...base, name: '组织编码', sourceAttribute: 'org_code', length: 3 };
  return { ...base, name: type === 'masterData' ? '档案编码' : '字段取值', sourceField: firstSourceField?.key, sourceAttribute: 'code' };
}

function getLegacyEncodingSegments(rule: EncodingRule): EncodingSegment[] {
  const segments: EncodingSegment[] = [];
  if (rule.prefix) {
    segments.push({
      id: 'legacy-prefix',
      name: '业务前缀',
      type: 'fixed',
      length: rule.prefix.length,
      value: rule.prefix,
      padding: 'none',
    });
  }
  if (rule.datePattern && rule.datePattern !== 'none') {
    segments.push({
      id: 'legacy-date',
      name: '日期',
      type: 'date',
      length: getDateSegmentLength(rule.datePattern),
      datePattern: rule.datePattern,
      padding: 'none',
    });
  }
  rule.dependencies.forEach((sourceField, index) => {
    segments.push({
      id: `legacy-field-${sourceField}`,
      name: index === 0 ? '依赖字段' : `依赖字段 ${index + 1}`,
      type: 'field',
      length: rule.dependencySegmentLength || 2,
      sourceField,
      sourceAttribute: 'code',
      padding: 'truncate',
      regenerateOnChange: true,
    });
  });
  segments.push({
    id: 'legacy-sequence',
    name: '流水号',
    type: 'sequence',
    length: rule.sequenceLength || 3,
    resetCycle: rule.resetCycle,
    padding: 'leftZero',
    sequenceStart: 1,
    sequenceStep: 1,
  });
  return segments;
}

function getEncodingSegments(rule?: EncodingRule): EncodingSegment[] {
  if (!rule) return [];
  if (rule.segments?.length) return rule.segments;
  return getLegacyEncodingSegments(rule);
}

function getEncodingSegmentTypeLabel(type: EncodingSegmentType) {
  return encodingSegmentTypeOptions.find((item) => item.value === type)?.label || '编码段';
}

function renderDateSample(pattern?: string) {
  if (pattern === 'YYYYMMDD') return '20260602';
  if (pattern === 'YYYY') return '2026';
  if (pattern === 'MMDD') return '0602';
  if (pattern === 'none') return '';
  return '2606';
}

function fitSegmentSample(value: string, length: number, padding?: EncodingPadding) {
  if (!length || length <= 0) return '';
  if (value.length === length) return value;
  if (value.length > length) return padding === 'truncate' ? value.slice(0, length) : value;
  if (padding === 'leftZero') return value.padStart(length, '0');
  if (padding === 'rightZero') return value.padEnd(length, '0');
  return value;
}

function renderEncodingSegmentSample(segment: EncodingSegment, fields: DesignerField[] = []) {
  const length = segment.length || 0;
  if (segment.type === 'fixed') return fitSegmentSample(segment.value || '', length, segment.padding);
  if (segment.type === 'date') return fitSegmentSample(renderDateSample(segment.datePattern), length, segment.padding);
  if (segment.type === 'sequence') return fitSegmentSample(String(segment.sequenceStart || 1), length, segment.padding || 'leftZero');
  if (segment.type === 'organization') return fitSegmentSample(segment.sourceAttribute === 'org_name' ? '制造部' : 'MF', length, segment.padding);
  const sourceField = fields.find((field) => field.key === segment.sourceField);
  return fitSegmentSample(sourceField?.key?.toUpperCase() || 'FIELD', length, segment.padding);
}

function renderEncodingSample(rule?: EncodingRule, fields: DesignerField[] = []) {
  if (!rule?.enabled) return '不自动生成';
  const segments = getEncodingSegments(rule);
  if (!segments.length) return '请新增编码段';
  return segments.map((segment) => renderEncodingSegmentSample(segment, fields)).join('');
}

function getDateSegmentLength(pattern?: string) {
  if (!pattern || pattern === 'none') return 0;
  return pattern.length;
}

function getEncodingComposition(rule?: EncodingRule, fields: DesignerField[] = []) {
  if (!rule?.enabled) return '未启用自动编码';
  const segments = getEncodingSegments(rule);
  if (!segments.length) return '尚未配置编码段';
  const parts = segments.map((segment) => {
    const field = fields.find((item) => item.key === segment.sourceField);
    const source = field ? `：${field.name}` : '';
    return `${segment.name || getEncodingSegmentTypeLabel(segment.type)}${source} ${segment.length || 0} 位`;
  });
  const expected = segments.reduce((total, segment) => total + (segment.length || 0), 0);
  return `${parts.join(' + ')} = ${expected} 位`;
}

const flowNodePalette: FlowNodeDefinition[] = [
  { key: 'start', name: '开始节点', desc: '流程入口，仅保留一个', role: 'start', icon: <CheckCircleOutlined /> },
  { key: 'approve', name: '审批节点', desc: '人工审核、同意或驳回', role: 'task', icon: <UserSwitchOutlined /> },
  { key: 'handle', name: '处理节点', desc: '业务办理、补充资料', role: 'task', icon: <SettingOutlined /> },
  { key: 'dispatch', name: '分发节点', desc: '按规则分派责任人', role: 'task', icon: <LinkOutlined /> },
  { key: 'condition', name: '条件分支', desc: '按字段或规则走不同路径', role: 'task', icon: <TagsOutlined /> },
  { key: 'cc', name: '抄送节点', desc: '通知相关角色或人员', role: 'task', icon: <UserOutlined /> },
  { key: 'automation', name: '自动任务', desc: '调用接口、写入数据、触发消息', role: 'task', icon: <DatabaseOutlined /> },
  { key: 'end', name: '结束节点', desc: '流程归档出口', role: 'end', icon: <LockOutlined /> },
];

const configs: Record<string, DesignerConfig> = {
  'risk-review': {
    id: 'risk-review',
    name: '风险复核',
    createTitle: '新增风险复核单',
    kind: 'business',
    appName: '供应链风险',
    dataSource: 'risk_reviews',
    primaryKey: 'riskNo',
    status: '草稿',
    version: 'v0.1',
    description: '用于新增风险复核业务数据，而不是配置整个运行页面。',
    fields: [
      { key: 'riskNo', name: '风险单号', type: '文本 / 自动编号', businessType: 'code', placeholder: '自动生成 SR-2605-001', locked: true, required: true, listVisible: true, searchable: true, sortable: true, validation: '系统唯一编号，不允许重复' },
      { key: 'subject', name: '风险主题', type: '文本输入', placeholder: '请输入风险主题', required: true, listVisible: true, searchable: true, validation: '2-80 个字符' },
      { key: 'level', name: '风险等级', type: '下拉选择', placeholder: '高 / 中 / 低', required: true, listVisible: true, searchable: true, optionSource: '高、中、低' },
      { key: 'owner', name: '处理人', type: '人员选择', placeholder: '选择处理人', required: true, listVisible: true, searchable: true, optionSource: '组织人员' },
      { key: 'reason', name: '风险原因', type: '多行文本', placeholder: '描述风险原因和影响范围', listVisible: false, validation: '最多 500 字' },
    ],
    filters: [
      { key: 'keyword', name: '业务编号 / 主题', type: '搜索输入', placeholder: '请输入关键词' },
      { key: 'status', name: '状态', type: '下拉选择', placeholder: '请选择状态' },
      { key: 'level', name: '等级', type: '下拉选择', placeholder: '请选择等级' },
      { key: 'owner', name: '负责人', type: '人员选择', placeholder: '请选择负责人' },
    ],
    flowSteps: ['提交复核', '风险定级', '责任分派', '处理关闭'],
    roles: ['采购管理', '计划管理', '仓储管理', '系统管理员'],
  },
  'alert-center': {
    id: 'alert-center',
    name: '告警中心',
    createTitle: '新增设备告警',
    kind: 'business',
    appName: '预测性维护',
    dataSource: 'equipment_alerts',
    primaryKey: 'alertId',
    status: '已发布',
    version: 'v0.1',
    description: '用于新增设备告警数据，字段和风险复核不同。',
    fields: [
      { key: 'alertId', name: '告警编号', type: '文本 / 自动编号', businessType: 'code', placeholder: '自动生成 AL-2605-001', locked: true, required: true, listVisible: true, searchable: true, sortable: true, validation: '系统唯一编号，不允许重复' },
      { key: 'title', name: '告警标题', type: '文本输入', placeholder: '请输入告警标题', required: true, listVisible: true, searchable: true, validation: '2-80 个字符' },
      { key: 'device', name: '关联设备', type: '关联对象', placeholder: '选择设备', required: true, listVisible: true, searchable: true, optionSource: '设备台账' },
      { key: 'level', name: '告警等级', type: '下拉选择', placeholder: '严重 / 一般 / 提醒', required: true, listVisible: true, searchable: true, optionSource: '严重、一般、提醒' },
      { key: 'source', name: '告警来源', type: '下拉选择', placeholder: '系统监测 / 人工上报 / 外部接口', required: true, listVisible: true, searchable: true, optionSource: '系统监测、人工上报、外部接口' },
      { key: 'occurredAt', name: '发生时间', type: '日期控件', placeholder: '选择告警发生时间', required: true, listVisible: true, sortable: true },
      { key: 'owner', name: '处理人', type: '人员选择', placeholder: '选择处理人', listVisible: true, searchable: true, optionSource: '组织人员' },
      { key: 'dueAt', name: '处理时限', type: '日期控件', placeholder: '选择处理截止时间', listVisible: true, sortable: true, validation: '严重告警必须配置处理时限' },
      { key: 'status', name: '告警状态', type: '下拉选择', placeholder: '待处理 / 处理中 / 已关闭', listVisible: true, searchable: true, optionSource: '待处理、处理中、已关闭' },
      { key: 'resolution', name: '处理结论', type: '多行文本', placeholder: '填写处理过程和关闭结论', listVisible: false, validation: '关闭告警时必填' },
      { key: 'evidence', name: '附件证据', type: '附件控件', placeholder: '上传现场图片、日志或凭证', listVisible: false, validation: '严重告警建议必填' },
    ],
    filters: [
      { key: 'keyword', name: '告警编号 / 标题', type: '搜索输入', placeholder: '请输入关键词' },
      { key: 'device', name: '设备', type: '关联对象', placeholder: '请选择设备' },
      { key: 'level', name: '等级', type: '下拉选择', placeholder: '请选择等级' },
      { key: 'status', name: '状态', type: '下拉选择', placeholder: '请选择状态' },
    ],
    flowSteps: ['告警登记', '维护确认', '维修处理', '关闭归档'],
    roles: ['设备管理员', '维修工程师', '生产经理', '系统管理员'],
  },
};

const defaultConfig: DesignerConfig = {
  id: 'unknown',
  name: '表单设置',
  createTitle: '新增业务记录',
  kind: 'business',
  appName: '当前应用',
  dataSource: 'business_records',
  primaryKey: 'id',
  status: '草稿',
  version: 'v0.1',
  description: '用于配置新增业务数据的表单。',
  fields: [
    { key: 'id', name: '编号', type: '文本 / 自动编号', businessType: 'code', placeholder: '自动生成编号', locked: true, required: true, listVisible: true, searchable: true, validation: '系统唯一编号' },
    { key: 'name', name: '名称', type: '文本输入', placeholder: '请输入名称', required: true, listVisible: true, searchable: true },
    { key: 'status', name: '状态', type: '下拉选择', placeholder: '请选择状态', listVisible: true, searchable: true },
  ],
  filters: [
    { key: 'keyword', name: '关键词', type: '搜索输入', placeholder: '请输入关键词' },
    { key: 'status', name: '状态', type: '下拉选择', placeholder: '请选择状态' },
  ],
  flowSteps: ['提交', '审批', '归档'],
  roles: ['系统管理员'],
};

const tabs = [
  { key: 'form', label: '表单设计', icon: <FormOutlined /> },
  { key: 'filter', label: '数据筛选', icon: <SearchOutlined /> },
  { key: 'flow', label: '流程设计', icon: <UserSwitchOutlined /> },
  { key: 'permission', label: '权限设计', icon: <LockOutlined /> },
];

const componentGroups: Array<{ category: string; items: ComponentDefinition[] }> = [
  {
    category: '基础输入',
    items: [
      { key: 'text', category: '基础输入', name: '文本控件', desc: '单行文本输入', icon: <FormOutlined />, controlType: 'text' },
      { key: 'textarea', category: '基础输入', name: '多行文本', desc: '长文本、备注、说明录入', icon: <FormOutlined />, controlType: 'textarea', defaultWidth: 'full' },
      { key: 'number', category: '基础输入', name: '数值控件', desc: '数量、金额、百分比', icon: <NumberOutlined />, controlType: 'number' },
      { key: 'code', category: '基础输入', name: '编码控件', desc: '自动编号、业务编号、流水号', icon: <NumberOutlined />, controlType: 'code' },
      { key: 'readonly-text', category: '基础输入', name: '只读文本', desc: '展示计算值、引用值', icon: <FileSearchOutlined />, controlType: 'readonly-text' },
    ],
  },
  {
    category: '选择器',
    items: [
      { key: 'select', category: '选择器', name: '选择控件', desc: '下拉、单选、多选', icon: <SelectOutlined />, controlType: 'select' },
      { key: 'relation', category: '选择器', name: '对象选择', desc: '人员、设备、供应商、物料', icon: <LinkOutlined />, controlType: 'relation' },
      { key: 'datetime', category: '选择器', name: '日期控件', desc: '日期、时间、时间范围', icon: <CalendarOutlined />, controlType: 'datetime' },
      { key: 'switch', category: '选择器', name: '开关控件', desc: '是否、启用、状态切换', icon: <SwitcherOutlined />, controlType: 'switch' },
      { key: 'upload', category: '选择器', name: '附件控件', desc: '图片、文件、凭证上传', icon: <PaperClipOutlined />, controlType: 'upload', defaultWidth: 'full' },
    ],
  },
  {
    category: '布局容器',
    items: [
      { key: 'container', category: '布局容器', name: '容器', desc: '分组面板、基础信息区', icon: <HolderOutlined />, controlType: 'container', defaultWidth: 'full' },
      { key: 'two-columns', category: '布局容器', name: '多列布局', desc: '两列、三列、高密度字段排版', icon: <HolderOutlined />, controlType: 'two-columns', defaultWidth: 'full' },
      { key: 'tabs', category: '布局容器', name: 'Tab 页', desc: '切换页签、次要信息收起', icon: <HolderOutlined />, controlType: 'tabs', defaultWidth: 'full' },
      { key: 'divider', category: '布局容器', name: '分割符', desc: '分割线、区块说明', icon: <FileSearchOutlined />, controlType: 'divider', defaultWidth: 'full' },
    ],
  },
  {
    category: '数据展示',
    items: [
      { key: 'editable-table', category: '数据展示', name: '表格', desc: '可编辑子表、明细行', icon: <TableOutlined />, controlType: 'editable-table', defaultWidth: 'full' },
      { key: 'readonly-table', category: '数据展示', name: '关联表格', desc: '只读关联表、分页详情', icon: <TableOutlined />, controlType: 'readonly-table', defaultWidth: 'full' },
      { key: 'summary-card', category: '数据展示', name: '数据摘要', desc: '摘要卡、统计值、关联对象概览', icon: <DatabaseOutlined />, controlType: 'summary-card', defaultWidth: 'full' },
      { key: 'status-tag', category: '数据展示', name: '状态标签', desc: '状态、等级、结果标识', icon: <TagsOutlined />, controlType: 'status-tag' },
      { key: 'file-preview', category: '数据展示', name: '媒体预览', desc: '图片、附件、凭证预览', icon: <FileImageOutlined />, controlType: 'file-preview', defaultWidth: 'full' },
    ],
  },
  {
    category: '业务控件',
    items: [
      { key: 'approval-comment', category: '业务控件', name: '审批处理', desc: '审批意见、处理说明、签批记录', icon: <UserSwitchOutlined />, controlType: 'approval-comment', defaultWidth: 'full' },
      { key: 'operation-log', category: '业务控件', name: '操作记录', desc: '操作日志、变更记录、审计轨迹', icon: <FileSearchOutlined />, controlType: 'operation-log', defaultWidth: 'full' },
      { key: 'status-flow', category: '业务控件', name: '状态流转', desc: '流程状态、节点进度、关闭归档', icon: <UserSwitchOutlined />, controlType: 'status-flow', defaultWidth: 'full' },
      { key: 'risk-level', category: '业务控件', name: '风险校验', desc: '风险等级、校验提示、异常规则', icon: <TagsOutlined />, controlType: 'risk-level' },
    ],
  },
];

const commonControlKeys = ['text', 'number', 'code', 'select', 'relation', 'datetime'];
const commonControls = commonControlKeys
  .map((key) => componentGroups.flatMap((group) => group.items).find((item) => item.key === key))
  .filter((item): item is ComponentDefinition => Boolean(item));

const alertBusinessSections: BusinessSection[] = [
  { key: 'basic', title: '基础信息', desc: '识别告警、说明主题和来源', fieldKeys: ['alertId', 'title', 'source', 'occurredAt'] },
  { key: 'device', title: '设备信息', desc: '定位设备、等级和影响范围', fieldKeys: ['device', 'level'] },
  { key: 'handle', title: '告警处理', desc: '明确责任人、时限、状态和结论', fieldKeys: ['owner', 'dueAt', 'status', 'resolution'] },
  { key: 'evidence', title: '附件证据', desc: '上传现场图片、日志和处理凭证', fieldKeys: ['evidence'] },
  { key: 'approval', title: '审批/流转信息', desc: '展示流程状态、操作记录和关闭轨迹', fieldKeys: [] },
];

const fieldTemplates: DesignerField[] = [
  { key: 'templateCode', name: '业务编号', type: '文本 / 自动编号', businessType: 'code', placeholder: '自动生成唯一编号', locked: true, required: true, listVisible: true, searchable: true, sortable: true },
  { key: 'templateTitle', name: '标题', type: '文本输入', placeholder: '请输入标题', required: true, listVisible: true, searchable: true },
  { key: 'templateStatus', name: '状态', type: '下拉选择', placeholder: '待处理 / 处理中 / 已关闭', listVisible: true, searchable: true, optionSource: '待处理、处理中、已关闭' },
  { key: 'templateLevel', name: '等级', type: '下拉选择', placeholder: '高 / 中 / 低', listVisible: true, searchable: true, optionSource: '高、中、低' },
  { key: 'templateOwner', name: '责任人', type: '人员选择', placeholder: '选择责任人', listVisible: true, searchable: true, optionSource: '组织人员' },
  { key: 'templateTime', name: '时间', type: '日期控件', placeholder: '选择时间', listVisible: true, sortable: true },
  { key: 'templateAttachment', name: '附件', type: '附件控件', placeholder: '上传附件', listVisible: false },
  { key: 'templateRemark', name: '备注', type: '多行文本', placeholder: '填写备注说明', listVisible: false },
];

const recommendedRules = [
  '选择关联设备后自动带出产线、设备位置和默认处理人',
  '告警等级为“严重”时，附件证据和处理时限必填',
  '告警状态为“已关闭”时，处理结论必填',
  '超过处理时限时自动标记为逾期并提醒责任人',
];

function getFlowNodeAssigneeLabel(node?: FlowDesignerNode) {
  if (!node) return '未选择流程节点';
  if (node.type === 'startEvent') return '发起人';
  if (node.type === 'endEvent') return '流程归档';
  if (node.assigneeSource === 'field') return `${node.assigneeValue || '未配置'}字段`;
  if (node.assigneeSource === 'departmentOwner') return '部门负责人';
  if (node.assigneeSource === 'initiatorManager') return '发起人上级';
  return node.assigneeValue || '未配置处理人';
}

function getPreviewNodeNote(node?: FlowDesignerNode) {
  if (!node) return '请选择流程节点，预览会按该节点的处理人和字段权限展示运行效果。';
  const permissions = Object.values(node.fieldPermissions || {});
  const editableCount = permissions.filter((permission) => permission.editable).length;
  const requiredCount = permissions.filter((permission) => permission.required).length;
  return `当前节点：${node.label}；处理人：${getFlowNodeAssigneeLabel(node)}；可编辑 ${editableCount} 个字段，必填 ${requiredCount} 个字段。`;
}

function optionSourceToOptions(source?: string, fallback?: string) {
  const raw = source || fallback || '';
  const values = raw
    .split(/[、,/，|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const normalized = values.length ? values : (fallback ? [fallback] : ['待配置选项']);
  return normalized.map((item) => ({ value: item, label: item }));
}

function inferFieldControlType(field?: DesignerField) {
  if (!field) return 'text';
  const businessType = getFieldBusinessType(field);
  if (businessType === 'code') return 'code';
  if (businessType === 'enum') return 'select';
  if (businessType === 'person' || businessType === 'relation') return 'relation';
  if (businessType === 'date' || businessType === 'datetime') return 'datetime';
  if (businessType === 'attachment') return 'upload';
  if (businessType === 'longText') return 'textarea';
  if (businessType === 'number') return 'number';
  return 'text';
}

function isDataSourceControlType(controlType?: string) {
  return controlType === 'select' || controlType === 'relation';
}

function inferReferenceSourceKind(field?: DesignerField, controlType?: string): ReferenceSourceKind {
  const businessType = getFieldBusinessType(field);
  if (businessType === 'person') return 'organization';
  if (businessType === 'relation' || controlType === 'relation') {
    if (field?.optionSource?.includes('组织') || field?.optionSource?.includes('人员')) return 'organization';
    return 'masterData';
  }
  if (businessType === 'enum') return 'dictionary';
  return 'static';
}

function getReferenceConfig(kind?: ReferenceSourceKind) {
  return referenceSourceRegistry[kind || 'static'];
}

function fieldInput(field: DesignerField, placeholderOverride?: string, disabled = false, optionSourceOverride?: string, controlTypeOverride?: string) {
  const placeholder = placeholderOverride || field.placeholder;
  const controlType = controlTypeOverride && controlTypeOverride !== 'field' ? controlTypeOverride : inferFieldControlType(field);
  if (controlType === 'select' || controlType === 'relation') {
    return <Select disabled={disabled} placeholder={placeholder} options={optionSourceToOptions(optionSourceOverride || field.optionSource, placeholder)} />;
  }
  if (controlType === 'datetime') {
    return <Input disabled={disabled} placeholder={placeholder} prefix={<CalendarOutlined />} />;
  }
  if (controlType === 'upload') {
    return <Button disabled={disabled} icon={<PaperClipOutlined />}>{placeholder || '选择文件'}</Button>;
  }
  if (controlType === 'textarea') {
    return <Input.TextArea disabled={disabled} placeholder={placeholder} autoSize={{ minRows: 2, maxRows: 4 }} />;
  }
  if (controlType === 'number') {
    return <Input disabled={disabled} placeholder={placeholder} suffix="#" />;
  }
  if (controlType === 'switch') {
    return <Segmented disabled={disabled} options={['否', '是']} value="否" />;
  }
  if (controlType === 'readonly-text' || controlType === 'code') {
    return <Input disabled value={placeholder || field.name} />;
  }
  return <Input disabled={disabled} placeholder={placeholder} />;
}

function designerFieldsToViewFields(fields: DesignerField[]) {
  return fields.map((field) => ({
    fieldName: field.key,
    label: field.name,
    fieldType: field.type,
    searchable: field.searchable,
    sortable: field.sortable,
    visibleInList: field.listVisible,
  }));
}

function makeDesignerViewConfig(config: DesignerConfig): ViewConfig {
  return makeDefaultViewConfig(
    designerFieldsToViewFields(config.fields),
    config.filters.map((filter) => filter.key),
  );
}

function makeProfessionalFlowConfig(config: DesignerConfig): FlowDesignerConfig {
  return createDefaultFlowConfig({
    formId: config.id,
    formName: config.name,
    version: config.version,
    steps: config.flowSteps,
    fields: config.fields.map((field) => ({
      key: field.key,
      name: field.name,
      type: field.type,
      required: field.required,
    })),
  });
}

function normalizeProfessionalFlowConfig(
  source: Partial<FlowDesignerConfig> & Record<string, unknown>,
  fallback: FlowDesignerConfig,
): FlowDesignerConfig {
  const categoryByType = (type: string): FlowDesignerNode['category'] => {
    if (type.includes('Gateway')) return 'gateway';
    if (type.includes('Task')) return 'task';
    if (type.includes('Process') || type.includes('Activity')) return 'subprocess';
    if (type.includes('Object') || type.includes('Message')) return 'data';
    if (type.includes('Boundary') || type.includes('compensation')) return 'boundary';
    return 'event';
  };
  const bpmnByType: Record<string, string> = {
    startEvent: 'bpmn:StartEvent',
    endEvent: 'bpmn:EndEvent',
    userTask: 'bpmn:UserTask',
    serviceTask: 'bpmn:ServiceTask',
    manualTask: 'bpmn:ManualTask',
    ccTask: 'bpmn:SendTask',
    exclusiveGateway: 'bpmn:ExclusiveGateway',
    parallelGateway: 'bpmn:ParallelGateway',
    joinGateway: 'bpmn:ParallelGateway',
  };
  const executableTypes = new Set(['startEvent', 'endEvent', 'userTask', 'serviceTask', 'manualTask', 'ccTask', 'exclusiveGateway', 'parallelGateway', 'joinGateway']);
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : fallback.nodes;
  const nodes = rawNodes
    .filter(Boolean)
    .map((raw, index) => {
      const node = raw as Partial<FlowDesignerNode> & { data?: Record<string, unknown>; assigneeType?: string };
      const fallbackNode = fallback.nodes[index] || fallback.nodes[0];
      const type = String(node.type || node.data?.type || fallbackNode?.type || 'manualTask');
      const x = Number(node.x);
      const y = Number(node.y);
      return {
        id: String(node.id || `flow-node-${index + 1}`),
        type,
        category: node.category || categoryByType(type),
        label: String(node.label || node.data?.label || fallbackNode?.label || `节点 ${index + 1}`),
        description: String(node.description || node.data?.description || fallbackNode?.description || ''),
        executable: typeof node.executable === 'boolean' ? node.executable : executableTypes.has(type),
        x: Number.isFinite(x) ? x : 420,
        y: Number.isFinite(y) ? y : 90 + index * 120,
        assigneeSource: node.assigneeSource || (node.assigneeType as FlowDesignerNode['assigneeSource']) || fallbackNode?.assigneeSource,
        assigneeValue: node.assigneeValue || fallbackNode?.assigneeValue,
        approvalMode: node.approvalMode || fallbackNode?.approvalMode,
        slaHours: node.slaHours ?? fallbackNode?.slaHours,
        notificationEnabled: node.notificationEnabled ?? fallbackNode?.notificationEnabled,
        errorPolicy: node.errorPolicy || fallbackNode?.errorPolicy,
        retryTimes: node.retryTimes ?? fallbackNode?.retryTimes,
        bpmnType: node.bpmnType || bpmnByType[type] || fallbackNode?.bpmnType,
        fieldPermissions: node.fieldPermissions || fallbackNode?.fieldPermissions,
      } satisfies FlowDesignerNode;
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const rawEdges = Array.isArray(source.edges) ? source.edges : fallback.edges;
  const edges = rawEdges
    .filter(Boolean)
    .map((raw, index) => {
      const edge = raw as Partial<FlowDesignerEdge> & { fromId?: string; toId?: string };
      return {
        id: String(edge.id || `flow-edge-${index + 1}`),
        source: String(edge.source || edge.fromId || ''),
        sourceSide: edge.sourceSide || 'bottom',
        target: String(edge.target || edge.toId || ''),
        targetSide: edge.targetSide || 'top',
        label: String(edge.label || ''),
        condition: edge.condition,
        priority: Number.isFinite(Number(edge.priority)) ? Number(edge.priority) : index + 1,
        isDefault: Boolean(edge.isDefault),
      } satisfies FlowDesignerEdge;
    })
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const rawStateMapping = (source.stateMapping || {}) as Partial<FlowDesignerConfig['stateMapping']> & Record<string, unknown>;
  return {
    ...fallback,
    ...source,
    nodes,
    edges,
    triggerBindings: Array.isArray(source.triggerBindings) && source.triggerBindings.length ? source.triggerBindings : fallback.triggerBindings,
    stateMapping: {
      statusField: String(rawStateMapping.statusField || rawStateMapping.processStatus || fallback.stateMapping.statusField),
      currentNodeField: String(rawStateMapping.currentNodeField || rawStateMapping.currentNode || fallback.stateMapping.currentNodeField),
      currentAssigneeField: String(rawStateMapping.currentAssigneeField || rawStateMapping.currentHandler || fallback.stateMapping.currentAssigneeField),
      completedAtField: String(rawStateMapping.completedAtField || rawStateMapping.completedAt || fallback.stateMapping.completedAtField),
    },
    advancedModeConfig: {
      ...fallback.advancedModeConfig,
      ...((source.advancedModeConfig || {}) as Partial<FlowDesignerConfig['advancedModeConfig']>),
    },
  };
}

function getWorkflowDesignerMeta(form?: PlatformForm | null): WorkflowDesignerMeta {
  const config = form?.config || {};
  const meta = config.workflowDesigner;
  return meta && typeof meta === 'object' ? meta as WorkflowDesignerMeta : {};
}

function getViewConfigMeta(form?: PlatformForm | null): ViewConfigMeta {
  const config = form?.config || {};
  const meta = config.viewConfigMeta;
  return meta && typeof meta === 'object' ? meta as ViewConfigMeta : {};
}

function getStoredViewConfig(form: PlatformForm | null | undefined, designerConfig: DesignerConfig): ViewConfig | null {
  const config = form?.config || {};
  const stored = config.viewConfigDraft || config.viewConfig;
  if (!stored || typeof stored !== 'object') return null;
  return normalizeViewConfig(
    stored as Partial<ViewConfig>,
    designerFieldsToViewFields(designerConfig.fields),
    designerConfig.filters.map((filter) => filter.key),
  );
}

function mapDesignerFieldType(field: DesignerField) {
  const businessType = getFieldBusinessType(field);
  if (businessType === 'code') return 'string';
  if (businessType === 'date' || businessType === 'datetime') return 'datetime';
  if (businessType === 'number') return 'number';
  if (businessType === 'enum') return 'enum';
  if (businessType === 'attachment') return 'json';
  if (businessType === 'longText') return 'text';
  return 'string';
}

function makeWorkflowFormConfig(config: DesignerConfig) {
  return {
    formCode: config.id,
    formName: config.name,
    fields: config.fields.map((field, index) => ({
      name: field.key,
      label: field.name,
      type: mapDesignerFieldType(field),
      required: Boolean(field.required),
      sortOrder: index,
    })),
  };
}

function makeWorkflowConfigPayload(flowConfig: FlowDesignerConfig, form: PlatformForm, config: DesignerConfig) {
  return {
    ...flowConfig,
    formId: form.id,
    formCode: form.code,
    formName: config.name,
    savedAt: new Date().toISOString(),
    fieldPermissions: Object.fromEntries(
      flowConfig.nodes.map((node) => [node.id, node.fieldPermissions || {}]),
    ),
  };
}

function makeFieldControl(field: DesignerField): LayoutControl {
  return {
    id: `field-${field.key}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source: 'field',
    controlType: inferFieldControlType(field),
    name: field.name,
    fieldKey: field.key,
    placeholder: field.placeholder,
    helpText: '',
    optionSource: field.optionSource,
    dataSourceKind: inferReferenceSourceKind(field, inferFieldControlType(field)),
    encodingRule: isEncodingField(field) ? makeEncodingRule(field) : undefined,
    width: getFieldBusinessType(field) === 'longText' ? 'full' : 'half',
    rules: makeControlRules(Boolean(field.required), field),
  };
}

function makeComponentControl(component: ComponentDefinition): LayoutControl {
  return {
    id: `component-${component.key}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source: 'component',
    controlType: component.controlType,
    name: component.name,
    desc: component.desc,
    placeholder: component.desc,
    helpText: '',
    optionSource: ['select', 'relation'].includes(component.controlType) ? component.desc : undefined,
    width: component.defaultWidth || 'half',
    rules: makeControlRules(),
  };
}

function cloneControl(control: LayoutControl): LayoutControl {
  const clonedRules = normalizeControlRules(control.rules);
  return {
    ...control,
    id: `${control.id}-copy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: control.name,
    rules: clonedRules,
  };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return ['input', 'textarea', 'select'].includes(tagName) || target.isContentEditable || Boolean(target.closest('.ant-select'));
}

function RuleToggleControl({
  enabled,
  onConfig,
  onToggle,
  title,
}: {
  enabled: boolean;
  onConfig: () => void;
  onToggle: () => void;
  title: string;
}) {
  const runButtonAction = (event: React.MouseEvent<HTMLElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  return (
    <div className="designer-rule-toggle" data-rule-title={title} onClick={(event) => event.stopPropagation()}>
      <Button
        className="designer-rule-config-button"
        data-rule-action="config"
        size="small"
        type="text"
        icon={<SettingOutlined />}
        onMouseDownCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => runButtonAction(event, onConfig)}
        title={`${title} config`}
      />
      <button
        type="button"
        className={`designer-rule-check ${enabled ? 'designer-rule-check-on' : ''}`}
        data-rule-action="toggle"
        onMouseDownCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => runButtonAction(event, onToggle)}
        title={enabled ? `${title} enabled` : `${title} disabled`}
      >
        <span className="designer-rule-check-box" aria-hidden="true" />
      </button>
    </div>
  );
}

function makeFlowNodes(steps: string[]): FlowNode[] {
  return steps.map((step, index) => ({
    id: `flow-${index}`,
    label: step,
    role: index === 0 ? 'start' : index === steps.length - 1 ? 'end' : 'task',
    x: 300,
    y: 112 + index * 126,
  }));
}

function makeFlowConnections(nodes: FlowNode[]): FlowConnection[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `${node.id}-${nodes[index + 1].id}`,
    fromId: node.id,
    fromSide: 'bottom',
    toId: nodes[index + 1].id,
    toSide: 'top',
  }));
}

function getFlowNodePorts(node: FlowNode): FlowPortSide[] {
  if (node.role === 'start') return ['right', 'bottom', 'left'];
  if (node.role === 'end') return ['top', 'right', 'left'];
  return ['top', 'right', 'bottom', 'left'];
}

function getFlowPortPoint(node: FlowNode, side: FlowPortSide) {
  const points: Record<FlowPortSide, { x: number; y: number }> = {
    top: { x: node.x + FLOW_NODE_WIDTH / 2, y: node.y },
    right: { x: node.x + FLOW_NODE_WIDTH, y: node.y + FLOW_NODE_HEIGHT / 2 },
    bottom: { x: node.x + FLOW_NODE_WIDTH / 2, y: node.y + FLOW_NODE_HEIGHT },
    left: { x: node.x, y: node.y + FLOW_NODE_HEIGHT / 2 },
  };
  return points[side];
}

function getFlowPortVector(side: FlowPortSide) {
  const vectors: Record<FlowPortSide, { x: number; y: number }> = {
    top: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };
  return vectors[side];
}

function roundedOrthogonalPath(points: Array<{ x: number; y: number }>, radius = 14) {
  const compactPoints = points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
  if (compactPoints.length < 2) return '';
  const commands = [`M ${compactPoints[0].x} ${compactPoints[0].y}`];
  for (let index = 1; index < compactPoints.length - 1; index += 1) {
    const previous = compactPoints[index - 1];
    const current = compactPoints[index];
    const next = compactPoints[index + 1];
    const prevLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const nextLength = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const cornerRadius = Math.min(radius, prevLength / 2, nextLength / 2);
    const before = {
      x: current.x + Math.sign(previous.x - current.x) * cornerRadius,
      y: current.y + Math.sign(previous.y - current.y) * cornerRadius,
    };
    const after = {
      x: current.x + Math.sign(next.x - current.x) * cornerRadius,
      y: current.y + Math.sign(next.y - current.y) * cornerRadius,
    };
    commands.push(`L ${before.x} ${before.y}`);
    commands.push(`Q ${current.x} ${current.y} ${after.x} ${after.y}`);
  }
  const end = compactPoints[compactPoints.length - 1];
  commands.push(`L ${end.x} ${end.y}`);
  return commands.join(' ');
}

function getFlowConnectorPath(from: FlowNode, fromSide: FlowPortSide, to: FlowNode, toSide: FlowPortSide) {
  const start = getFlowPortPoint(from, fromSide);
  const end = getFlowPortPoint(to, toSide);
  const offset = 32;
  const fromVector = getFlowPortVector(fromSide);
  const toVector = getFlowPortVector(toSide);
  const startLead = { x: start.x + fromVector.x * offset, y: start.y + fromVector.y * offset };
  const endLead = { x: end.x + toVector.x * offset, y: end.y + toVector.y * offset };
  const fromIsVertical = fromSide === 'top' || fromSide === 'bottom';
  const bridge = fromIsVertical
    ? [
        { x: startLead.x, y: (startLead.y + endLead.y) / 2 },
        { x: endLead.x, y: (startLead.y + endLead.y) / 2 },
      ]
    : [
        { x: (startLead.x + endLead.x) / 2, y: startLead.y },
        { x: (startLead.x + endLead.x) / 2, y: endLead.y },
      ];
  return roundedOrthogonalPath([start, startLead, ...bridge, endLead, end]);
}

export default function FormSettingsPage() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DesignerTab>('form');
  const [componentPanel, setComponentPanel] = useState<ComponentPanel>('components');
  const [version, setVersion] = useState('v0.1');
  const baseConfig = (formId && configs[formId]) || { ...defaultConfig, id: formId || defaultConfig.id };
  const [viewConfig, setViewConfig] = useState<ViewConfig>(() => makeDesignerViewConfig(baseConfig));
  const [expandedViewRow, setExpandedViewRow] = useState<string>('filter-0');
  const [filterFieldPickerOpen, setFilterFieldPickerOpen] = useState(false);
  const [tableFieldPickerOpen, setTableFieldPickerOpen] = useState(false);
  const [draggedViewFilterId, setDraggedViewFilterId] = useState('');
  const [draggedViewColumnId, setDraggedViewColumnId] = useState('');
  const [layoutControls, setLayoutControls] = useState<LayoutControl[]>(baseConfig.fields.map(makeFieldControl));
  const [selectedControlId, setSelectedControlId] = useState<string>('');
  const [selectedAssetKey, setSelectedAssetKey] = useState<string>(baseConfig.fields[0]?.key || '');
  const [copiedControl, setCopiedControl] = useState<LayoutControl | null>(null);
  const [history, setHistory] = useState<LayoutControl[][]>([]);
  const [future, setFuture] = useState<LayoutControl[][]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('create');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [previewFlowNodeId, setPreviewFlowNodeId] = useState('');
  const [publishCheckOpen, setPublishCheckOpen] = useState(false);
  const [serverPublishReport, setServerPublishReport] = useState<PlatformFormPublishReport | null>(null);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [draggedControlId, setDraggedControlId] = useState('');
  const [dropHint, setDropHint] = useState<{ controlId: string; position: DropPosition } | null>(null);
  const [isCanvasDragActive, setCanvasDragActive] = useState(false);
  const [ruleOverrides, setRuleOverrides] = useState<Record<string, boolean>>({});
  const [ruleModal, setRuleModal] = useState<{ controlId: string; ruleKey: ControlRuleKey } | null>(null);
  const [encodingSegmentEditor, setEncodingSegmentEditor] = useState<{
    open: boolean;
    index?: number;
    draft: EncodingSegment;
  }>(() => ({ open: false, draft: makeEncodingSegment('fixed', baseConfig.fields) }));
  const [professionalFlowConfig, setProfessionalFlowConfig] = useState<FlowDesignerConfig>(() => makeProfessionalFlowConfig(baseConfig));
  const [platformForm, setPlatformForm] = useState<PlatformForm | null>(null);
  const [workflowMeta, setWorkflowMeta] = useState<WorkflowDesignerMeta>({});
  const [isPersistingFlow, setPersistingFlow] = useState(false);
  const [isPersistingPermissions, setPersistingPermissions] = useState(false);
  const [identityRoleRecords, setIdentityRoleRecords] = useState<Array<{ id: number; name: string; label: string }>>([]);
  const [identityRoles, setIdentityRoles] = useState<string[]>([]);
  const [identityOrgUnits, setIdentityOrgUnits] = useState<Array<{ id: number; name: string; code?: string; status?: string }>>([]);
  const [permissionDrafts, setPermissionDrafts] = useState<PermissionDraftMap>({});
  const permissionRoles = identityRoles.length ? identityRoles : baseConfig.roles;
  const permissionOrgUnits = identityOrgUnits.filter((org) => org.status !== 'inactive');
  const permissionOrgUnitIds = permissionOrgUnits.map((org) => org.id);
  const permissionOrgUnitOptions = permissionOrgUnits.map((org) => ({
    value: org.id,
    label: org.code ? `${org.name} / ${org.code}` : org.name,
  }));
  const [selectedPermissionRole, setSelectedPermissionRole] = useState('');
  const [fieldPermissionQuery, setFieldPermissionQuery] = useState('');
  const [fieldPermissionFilter, setFieldPermissionFilter] = useState<'all' | 'hidden' | 'editable' | 'required' | 'exportable'>('all');
  const [fieldPermissionPage, setFieldPermissionPage] = useState(1);
  const activePermissionRole = selectedPermissionRole || permissionRoles[0] || '未配置角色';
  const activePermissionRoleIndex = Math.max(permissionRoles.indexOf(activePermissionRole), 0);
  const activePermissionRoleKind = activePermissionRoleIndex === 0 ? 'system' : activePermissionRoleIndex < 4 ? 'manager' : 'operator';
  const activePermissionDraft = permissionDrafts[activePermissionRole] || makePermissionDesignDraft(activePermissionRoleKind, permissionOrgUnitIds);
  const getRoleFieldPermission = (field: DesignerField, index: number) => {
    const configured = activePermissionDraft.fields?.[field.key];
    return configured || {
      visible: true,
      editable: !field.locked && (activePermissionRoleKind === 'system' || index < 5),
      required: Boolean(field.required),
      exportable: activePermissionRoleKind !== 'operator' || index <= 4,
    };
  };
  const updateActivePermissionDraft = (updater: (draft: PermissionDesignDraft) => PermissionDesignDraft) => {
    setPermissionDrafts((current) => {
      const baseDraft = current[activePermissionRole] || activePermissionDraft;
      return { ...current, [activePermissionRole]: updater(baseDraft) };
    });
    setHasUnsavedChanges(true);
  };
  const updateRoleFieldPermission = (field: DesignerField, index: number, patch: Partial<ReturnType<typeof getRoleFieldPermission>>) => {
    const currentPermission = getRoleFieldPermission(field, index);
    updateActivePermissionDraft((draft) => ({
      ...draft,
      fields: {
        ...(draft.fields || {}),
        [field.key]: { ...currentPermission, ...patch },
      },
    }));
  };
  const previewFlowNodes = useMemo(
    () => professionalFlowConfig.nodes.filter((node) => node.executable || node.type === 'startEvent' || node.type === 'endEvent'),
    [professionalFlowConfig.nodes],
  );
  const selectedPreviewFlowNode = useMemo(
    () => previewFlowNodes.find((node) => node.id === previewFlowNodeId) || previewFlowNodes[0],
    [previewFlowNodeId, previewFlowNodes],
  );
  const previewFlowNodeOptions = useMemo(
    () => previewFlowNodes.map((node) => ({
      value: node.id,
      label: `${node.label} · ${getFlowNodeAssigneeLabel(node)}`,
    })),
    [previewFlowNodes],
  );
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>(() => makeFlowNodes(baseConfig.flowSteps));
  const [flowConnections, setFlowConnections] = useState<FlowConnection[]>(() => makeFlowConnections(makeFlowNodes(baseConfig.flowSteps)));
  const [pendingFlowPort, setPendingFlowPort] = useState<{ nodeId: string; side: FlowPortSide } | null>(null);
  const flowCanvasRef = useRef<HTMLDivElement | null>(null);
  const draggingFlowNodeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([adminListRoles(), adminListOrgUnits()])
      .then(([roleRes, orgRes]) => {
        const roleRecords = (roleRes.data?.data || []).map((role: any) => ({
          id: Number(role.id),
          name: String(role.name || ''),
          label: String(role.label || role.name || ''),
        })).filter((role: { id: number; label: string }) => Number.isFinite(role.id) && role.label);
        setIdentityRoleRecords(roleRecords);
        setIdentityRoles(roleRecords.map((role: { label: string }) => role.label));
        setIdentityOrgUnits((orgRes.data?.data || [])
          .map((org: any) => ({
            id: Number(org.id),
            name: String(org.name || ''),
            code: org.code ? String(org.code) : undefined,
            status: org.status ? String(org.status) : undefined,
          }))
          .filter((org: { id: number; name: string }) => Number.isFinite(org.id) && org.name));
      })
      .catch(() => {
        setIdentityRoles([]);
        setIdentityOrgUnits([]);
      });
  }, []);

  useEffect(() => {
    if (permissionRoles.length && !permissionRoles.includes(activePermissionRole)) {
      setSelectedPermissionRole(permissionRoles[0]);
    }
  }, [activePermissionRole, permissionRoles]);

  useEffect(() => {
    const nextControls = baseConfig.fields.map(makeFieldControl);
    setLayoutControls(nextControls);
    setSelectedControlId(nextControls[0]?.id || '');
    setSelectedAssetKey(baseConfig.fields[0]?.key || '');
    setViewConfig(makeDesignerViewConfig(baseConfig));
    setExpandedViewRow('filter-0');
    setFilterFieldPickerOpen(false);
    setTableFieldPickerOpen(false);
    setDraggedViewFilterId('');
    setDraggedViewColumnId('');
    setVersion(baseConfig.version);
    setCopiedControl(null);
    setHistory([]);
    setFuture([]);
    setLibrarySearch('');
    setHasUnsavedChanges(false);
    setPreviewOpen(false);
    setPublishCheckOpen(false);
    setVersionPanelOpen(false);
    setPreviewFlowNodeId('');
    setDraggedControlId('');
    setDropHint(null);
    setCanvasDragActive(false);
    setRuleOverrides({});
    setRuleModal(null);
    setProfessionalFlowConfig(makeProfessionalFlowConfig(baseConfig));
    setPlatformForm(null);
    setWorkflowMeta({});
    setPermissionDrafts({});
    const nextFlowNodes = makeFlowNodes(baseConfig.flowSteps);
    setFlowNodes(nextFlowNodes);
    setFlowConnections(makeFlowConnections(nextFlowNodes));
    setPendingFlowPort(null);
  }, [baseConfig.id, baseConfig.version, baseConfig.fields, baseConfig.flowSteps]);

  useEffect(() => {
    if (!previewFlowNodeOptions.length) {
      if (previewFlowNodeId) setPreviewFlowNodeId('');
      return;
    }
    if (!previewFlowNodeOptions.some((item) => item.value === previewFlowNodeId)) {
      setPreviewFlowNodeId(previewFlowNodeOptions[0].value);
    }
  }, [previewFlowNodeId, previewFlowNodeOptions]);

  useEffect(() => {
    let cancelled = false;
    const loadPersistedFlow = async () => {
      try {
        const formsResponse = await listPlatformForms();
        const forms = (formsResponse.data?.data || []) as PlatformForm[];
        const matchedForm = forms.find((form) => form.code === baseConfig.id);
        if (!matchedForm || cancelled) return;
        setPlatformForm(matchedForm);
        setPermissionDrafts(permissionDraftsFromConfig(matchedForm.config));
        let persistedViewConfig = getStoredViewConfig(matchedForm, baseConfig);
        if (!persistedViewConfig) {
          try {
            const layoutsResponse = await listPlatformFormLayouts(matchedForm.id);
            const layouts = (layoutsResponse.data?.data || []) as Array<{ layout_type?: string; config?: Record<string, unknown> }>;
            const viewLayout = layouts.find((layout) => layout.layout_type === 'view');
            const layoutConfig = viewLayout?.config || {};
            const layoutView = layoutConfig.draft || layoutConfig.published;
            if (layoutView) {
              persistedViewConfig = normalizeViewConfig(
                layoutView,
                designerFieldsToViewFields(baseConfig.fields),
                baseConfig.filters.map((filter) => filter.key),
              );
            }
          } catch (error) {
            console.warn('view layout load failed', error);
          }
        }
        if (persistedViewConfig && !cancelled) {
          setViewConfig(persistedViewConfig);
        }
        const meta = getWorkflowDesignerMeta(matchedForm);
        setWorkflowMeta(meta);
        const workflowId = meta.draftWorkflowId || meta.publishedWorkflowId;
        if (!workflowId) return;
        const definitionResponse = await wfGetDefinition(workflowId);
        if (cancelled) return;
        const definition = definitionResponse.data as WorkflowDefinitionPayload;
        if (definition.config?.nodes && definition.config?.edges) {
          const defaultFlow = makeProfessionalFlowConfig(baseConfig);
          const nextConfig = normalizeProfessionalFlowConfig({
            ...definition.config,
            version: definition.version ? `v${definition.version}` : String(definition.config.version || defaultFlow.version),
          }, defaultFlow);
          setProfessionalFlowConfig(nextConfig);
          setVersion(nextConfig.version);
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.warn('workflow designer load failed', error);
        if (!cancelled) {
          message.warning('未能加载后端流程草稿，当前使用本地默认配置');
        }
      }
    };
    loadPersistedFlow();
    return () => {
      cancelled = true;
    };
  }, [baseConfig.id, baseConfig.name, baseConfig.version, baseConfig.fields, baseConfig.flowSteps]);

  const selectedControl = useMemo(
    () => layoutControls.find((control) => control.id === selectedControlId),
    [layoutControls, selectedControlId],
  );
  const selectedField = useMemo(
    () => {
      const targetKey = selectedControl?.fieldKey || selectedAssetKey;
      if (activeTab === 'filter') {
        return baseConfig.filters.find((field) => field.key === targetKey) || baseConfig.fields.find((field) => field.key === targetKey);
      }
      return baseConfig.fields.find((field) => field.key === targetKey);
    },
    [activeTab, baseConfig.fields, baseConfig.filters, selectedAssetKey, selectedControl],
  );
  const selectedEffectiveControlType = selectedControl
    ? selectedControl.controlType === 'field'
      ? inferFieldControlType(selectedField)
      : selectedControl.controlType
    : '';
  const selectedControlUsesDataSource = Boolean(
    selectedControl && isDataSourceControlType(selectedEffectiveControlType),
  );
  const selectedControlUsesOptionSort = Boolean(selectedControl && selectedControlUsesDataSource);
  const selectedReferenceSourceKind = selectedControl?.dataSourceKind || inferReferenceSourceKind(selectedField, selectedEffectiveControlType);
  const selectedReferenceConfig = getReferenceConfig(selectedReferenceSourceKind);
  const selectedControlUsesEncoding = Boolean(
    selectedControl && (selectedEffectiveControlType === 'code' || isEncodingField(selectedField)),
  );
  const selectedEncodingRule = selectedControlUsesEncoding
    ? selectedControl?.encodingRule || makeEncodingRule(selectedField)
    : undefined;
  const selectedEncodingSegments = useMemo(
    () => getEncodingSegments(selectedEncodingRule),
    [selectedEncodingRule],
  );
  const normalizedLibrarySearch = librarySearch.trim().toLowerCase();
  const matchesLibrarySearch = (text: string) => !normalizedLibrarySearch || text.toLowerCase().includes(normalizedLibrarySearch);
  const filteredCommonControls = commonControls.filter((item) => matchesLibrarySearch(`${item.name} ${item.desc} ${item.category}`));
  const filteredComponentGroups = componentGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => matchesLibrarySearch(`${group.category} ${item.name} ${item.desc}`)),
    }))
    .filter((group) => !normalizedLibrarySearch || group.items.length > 0 || matchesLibrarySearch(group.category));
  const filteredFields = baseConfig.fields.filter((field) => matchesLibrarySearch(`${field.name} ${field.key} ${field.type} ${field.optionSource || ''}`));
  const libraryFields = activeTab === 'filter' ? baseConfig.filters : baseConfig.fields;
  const filteredLibraryFields = libraryFields.filter((field) => matchesLibrarySearch(`${field.name} ${field.key} ${field.type} ${field.optionSource || ''}`));
  const alertSections = baseConfig.id === 'alert-center' ? alertBusinessSections : [
    { key: 'default', title: '基础信息', desc: '当前表单的主要录入字段', fieldKeys: baseConfig.fields.map((field) => field.key) },
  ];
  const searchableFieldCount = baseConfig.fields.filter((field) => field.searchable).length;
  const requiredControlsInCanvas = layoutControls.filter((control) => control.rules.required.enabled).length;
  const hiddenRequiredControls = layoutControls.filter((control) => !control.rules.visible.enabled && control.rules.required.enabled);
  const publishChecks = useMemo<PublishCheckItem[]>(() => {
    const canvasFieldKeys = new Set(layoutControls.map((control) => control.fieldKey).filter(Boolean));
    const missingRequired = baseConfig.fields.filter((field) => field.required && !canvasFieldKeys.has(field.key));
    const enumWithoutSource = baseConfig.fields.filter((field) => field.type.includes('下拉') && !field.optionSource);
    const relationWithoutSource = baseConfig.fields.filter((field) => field.type.includes('关联') && !field.optionSource);
    const enabledFilters = viewConfig.filters.filter((filter) => filter.enabled);
    const enabledColumns = viewConfig.table.columns.filter((column) => column.enabled);
    const flowValidation = validateFlowDesignerConfig(professionalFlowConfig);
    const flowErrors = flowValidation.filter((item) => item.level === 'error');
    const flowWarnings = flowValidation.filter((item) => item.level === 'warning');
    const invalidViewFields = [
      ...enabledFilters.filter((filter) => !baseConfig.fields.some((field) => field.key === filter.fieldName)).map((filter) => filter.label),
      ...enabledColumns.filter((column) => !baseConfig.fields.some((field) => field.key === column.fieldName)).map((column) => column.label),
    ];
    const checks: PublishCheckItem[] = [
      {
        level: missingRequired.length ? 'error' : 'suggestion',
        title: '必填字段覆盖',
        detail: missingRequired.length ? `以下必填字段不在表单中：${missingRequired.map((field) => field.name).join('、')}` : '所有必填字段都已放入表单画布。',
      },
      {
        level: enumWithoutSource.length ? 'error' : 'suggestion',
        title: '枚举选项完整性',
        detail: enumWithoutSource.length ? `以下枚举字段缺少选项：${enumWithoutSource.map((field) => field.name).join('、')}` : '枚举字段均已配置选项来源。',
      },
      {
        level: relationWithoutSource.length ? 'warning' : 'suggestion',
        title: '关联数据源',
        detail: relationWithoutSource.length ? `以下关联字段需要补充数据源：${relationWithoutSource.map((field) => field.name).join('、')}` : '关联字段均有数据来源。',
      },
      {
        level: searchableFieldCount ? 'suggestion' : 'warning',
        title: '搜索体验',
        detail: searchableFieldCount ? `已配置 ${searchableFieldCount} 个可搜索字段。` : '建议至少配置一个可搜索字段。',
      },
      {
        level: hiddenRequiredControls.length ? 'error' : 'suggestion',
        title: '规则冲突',
        detail: hiddenRequiredControls.length ? `以下控件同时隐藏且必填：${hiddenRequiredControls.map((control) => control.name).join('、')}` : '未发现隐藏且必填的规则冲突。',
      },
      {
        level: enabledFilters.length ? 'suggestion' : 'warning',
        title: '筛选条件',
        detail: enabledFilters.length ? `已启用 ${enabledFilters.length} 个运行页筛选条件。` : '建议至少启用一个运行页筛选条件。',
      },
      {
        level: enabledColumns.length ? 'suggestion' : 'error',
        title: '数据展示列',
        detail: enabledColumns.length ? `已启用 ${enabledColumns.length} 个表格展示列。` : '运行页表格至少需要一个展示列。',
      },
      {
        level: invalidViewFields.length ? 'error' : 'suggestion',
        title: '视图字段绑定',
        detail: invalidViewFields.length ? `以下筛选或列绑定字段不存在：${invalidViewFields.join('、')}` : '筛选条件和表格列均已绑定有效字段。',
      },
      {
        level: baseConfig.id === 'alert-center' ? 'suggestion' : 'warning',
        title: '严重告警处理规则',
        detail: baseConfig.id === 'alert-center' ? '已启用推荐规则：严重告警要求附件证据和处理时限。' : '建议按业务场景配置高风险记录的强制处理规则。',
      },
    ];
    checks.push({
      level: flowErrors.length ? 'error' : flowWarnings.length ? 'warning' : 'suggestion',
      title: '流程设计完整性',
      detail: flowErrors.length
        ? `流程存在 ${flowErrors.length} 个阻断项：${flowErrors.map((item) => item.title).join('、')}`
        : flowWarnings.length
          ? `流程存在 ${flowWarnings.length} 个警告项：${flowWarnings.map((item) => item.title).join('、')}`
          : '流程结构、节点规则和触发绑定已通过核心发布校验。',
    });
    return checks;
  }, [baseConfig.fields, baseConfig.id, hiddenRequiredControls, layoutControls, professionalFlowConfig, searchableFieldCount, viewConfig]);
  const serverPublishChecks = useMemo<PublishCheckItem[]>(() => {
    if (!serverPublishReport) return [];
    const items = serverPublishReport.items.map((item) => ({
      level: item.level === 'blocking' ? 'error' : item.level === 'warning' ? 'warning' : 'suggestion',
      title: item.label ? `${item.label} / ${item.type}` : item.type,
      detail: `${item.detail}${item.affected_count ? ` (${item.affected_count} affected)` : ''}`,
    } as PublishCheckItem));
    if (!items.length) {
      items.push({
        level: 'suggestion',
        title: 'Backend impact report',
        detail: `No blocking schema impact found across ${serverPublishReport.record_count} existing records.`,
      });
    }
    return items;
  }, [serverPublishReport]);
  const combinedPublishChecks = useMemo(
    () => [...publishChecks, ...serverPublishChecks],
    [publishChecks, serverPublishChecks],
  );
  const publishErrorCount = combinedPublishChecks.filter((item) => item.level === 'error').length;
  const publishWarningCount = combinedPublishChecks.filter((item) => item.level === 'warning').length;

  const updateSelectedControlRule = (ruleKey: ControlRuleKey, patch: Partial<ControlRule>) => {
    if (!selectedControl) return;
    const normalizedRules = normalizeControlRules(selectedControl.rules, selectedField);
    const currentRule = normalizedRules[ruleKey];
    updateSelectedControl({
      rules: {
        ...normalizedRules,
        [ruleKey]: {
          ...currentRule,
          ...patch,
          conditions: patch.conditions === undefined ? currentRule.conditions : patch.conditions,
        },
      },
    });
  };

  const updateSelectedRuleCondition = (ruleKey: ControlRuleKey, patch: Partial<ControlRuleCondition>) => {
    if (!selectedControl) return;
    updateSelectedControlRule(ruleKey, {
      conditions: {
        ...(normalizeControlRules(selectedControl.rules, selectedField)[ruleKey].conditions || {}),
        ...patch,
      },
    });
  };

  const genericRuleToggle = (defaultEnabled: boolean, title: string, key = title) => {
    const scope = selectedControl?.id || selectedField?.key || baseConfig.id;
    const ruleKey = `${activeTab}:${scope}:${key}`;
    const enabled = ruleOverrides[ruleKey] ?? defaultEnabled;
    return (
      <RuleToggleControl
        enabled={enabled}
        onConfig={() => {
          setRuleOverrides((current) => ({ ...current, [ruleKey]: current[ruleKey] ?? defaultEnabled }));
          message.info(`已进入「${title}」默认规则配置，可按字段值或流程状态设置规则；角色差异请到权限设计配置`);
        }}
        onToggle={() => {
          setRuleOverrides((current) => {
            const nextEnabled = !(current[ruleKey] ?? defaultEnabled);
            message.success(`${title}已${nextEnabled ? '启用' : '关闭'}`);
            return { ...current, [ruleKey]: nextEnabled };
          });
        }}
        title={title}
      />
    );
  };

  const controlRuleToggle = (ruleKey: ControlRuleKey) => {
    if (!selectedControl) return null;
    const rule = normalizeControlRules(selectedControl.rules, selectedField)[ruleKey];
    const title = ruleLabels[ruleKey];
    return (
      <RuleToggleControl
        enabled={rule.enabled}
        onConfig={() => setRuleModal({ controlId: selectedControl.id, ruleKey })}
        onToggle={() => updateSelectedControlRule(ruleKey, { enabled: !rule.enabled })}
        title={title}
      />
    );
  };

  const markUnsaved = () => setHasUnsavedChanges(true);

  const updateViewConfig = (updater: (current: ViewConfig) => ViewConfig) => {
    setViewConfig((current) => updater(current));
    markUnsaved();
  };

  const updateViewFilter = (id: string, patch: Partial<ViewFilterConfig>) => {
    updateViewConfig((current) => ({
      ...current,
      filters: current.filters.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)),
    }));
  };

  const updateViewColumn = (id: string, patch: Partial<ViewTableColumnConfig>) => {
    updateViewConfig((current) => ({
      ...current,
      table: {
        ...current.table,
        columns: current.table.columns.map((column) => (column.id === id ? { ...column, ...patch } : column)),
      },
    }));
  };

  const moveViewItem = (kind: 'filter' | 'column', id: string, direction: -1 | 1) => {
    updateViewConfig((current) => {
      const source = kind === 'filter' ? sortByOrder(current.filters) : sortByOrder(current.table.columns);
      const index = source.findIndex((item) => item.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= source.length) return current;
      const next = [...source];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      const reordered = next.map((item, sortOrder) => ({ ...item, sortOrder }));
      return kind === 'filter'
        ? { ...current, filters: reordered as ViewFilterConfig[] }
        : { ...current, table: { ...current.table, columns: reordered as ViewTableColumnConfig[] } };
    });
  };

  const reorderViewFilters = (draggedId: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    updateViewConfig((current) => {
      const source = sortByOrder(current.filters);
      const fromIndex = source.findIndex((filter) => filter.id === draggedId);
      const toIndex = source.findIndex((filter) => filter.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...source];
      const [dragged] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, dragged);
      return {
        ...current,
        filters: next.map((filter, sortOrder) => ({ ...filter, sortOrder })),
      };
    });
  };

  const reorderViewColumns = (draggedId: string, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    updateViewConfig((current) => {
      const source = sortByOrder(current.table.columns);
      const fromIndex = source.findIndex((column) => column.id === draggedId);
      const toIndex = source.findIndex((column) => column.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...source];
      const [dragged] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, dragged);
      return {
        ...current,
        table: {
          ...current.table,
          columns: next.map((column, sortOrder) => ({ ...column, sortOrder })),
        },
      };
    });
  };

  const syncViewFiltersByFields = (fieldNames: string[]) => {
    updateViewConfig((current) => {
      const selected = new Set(fieldNames);
      const existingByField = new Map(current.filters.map((filter) => [filter.fieldName, filter]));
      const filters = fieldNames
        .map((fieldName, index) => {
          const existing = existingByField.get(fieldName);
          if (existing) {
            return { ...existing, enabled: true, sortOrder: index };
          }
          const field = baseConfig.fields.find((item) => item.key === fieldName);
          const controlType = controlTypeForField(field?.type);
          return {
            id: `filter-${fieldName}-${Date.now()}-${index}`,
            fieldName,
            label: field?.name || fieldName,
            controlType,
            operator: defaultOperatorForControl(controlType),
            placeholder: controlType === 'keyword' || controlType === 'text' ? `请输入${field?.name || fieldName}` : `请选择${field?.name || fieldName}`,
            enabled: true,
            advanced: index > 3,
            sortOrder: index,
          } satisfies ViewFilterConfig;
        })
        .filter((filter) => selected.has(filter.fieldName));
      return { ...current, filters };
    });
  };

  const syncViewColumnsByFields = (fieldNames: string[]) => {
    updateViewConfig((current) => {
      const selected = new Set(fieldNames);
      const existingByField = new Map(current.table.columns.map((column) => [column.fieldName, column]));
      const columns = fieldNames
        .map((fieldName, index) => {
          const existing = existingByField.get(fieldName);
          if (existing) {
            return { ...existing, enabled: true, sortOrder: index };
          }
          const field = baseConfig.fields.find((item) => item.key === fieldName);
          return {
            id: `column-${fieldName}-${Date.now()}-${index}`,
            fieldName,
            label: field?.name || fieldName,
            enabled: true,
            width: index === 0 ? 180 : 140,
            sortable: Boolean(field?.sortable),
            renderType: renderTypeForField(field?.type),
            emptyText: '-',
            sortOrder: index,
          } satisfies ViewTableColumnConfig;
        })
        .filter((column) => selected.has(column.fieldName));
      return {
        ...current,
        table: {
          ...current.table,
          columns,
        },
      };
    });
  };

  const ensurePlatformForm = async () => {
    if (platformForm) return platformForm;
    const formsResponse = await listPlatformForms();
    const forms = (formsResponse.data?.data || []) as PlatformForm[];
    const matchedForm = forms.find((form) => form.code === baseConfig.id);
    if (matchedForm) {
      setPlatformForm(matchedForm);
      setPermissionDrafts(permissionDraftsFromConfig(matchedForm.config));
      setWorkflowMeta(getWorkflowDesignerMeta(matchedForm));
      return matchedForm;
    }

    const createResponse = await createPlatformForm({
      name: baseConfig.name,
      code: baseConfig.id,
      description: baseConfig.description,
      table_name: baseConfig.dataSource,
      storage_mode: 'dynamic',
      status: 'active',
      config: {
        workflowDesigner: {},
        source: 'form-settings',
        viewConfig,
        viewConfigDraft: viewConfig,
        viewConfigMeta: {
          draftVersion: 1,
          publishedVersion: 1,
          draftSavedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
          status: 'published',
        },
      },
    });
    const createdForm = createResponse.data?.data as PlatformForm;
    await Promise.all(baseConfig.fields.map((field, index) => createPlatformFormField(createdForm.id, {
      field_name: field.key,
      label: field.name,
      field_type: mapDesignerFieldType(field),
      business_type: getFieldBusinessType(field),
      control_type: inferFieldControlType(field),
      data_source: field.optionSource,
      encoding_rule: isEncodingField(field) ? makeEncodingRule(field) : undefined,
      required: Boolean(field.required),
      visible_in_list: field.listVisible !== false,
      visible_in_form: true,
      searchable: Boolean(field.searchable),
      sortable: Boolean(field.sortable),
      default_value: field.defaultValue,
      enum_values: field.optionSource ? { source: field.optionSource } : undefined,
      validation: field.validation ? { message: field.validation } : undefined,
      ui_config: {
        placeholder: field.placeholder,
        locked: Boolean(field.locked),
        designerType: field.type,
        businessType: getFieldBusinessType(field),
        controlType: inferFieldControlType(field),
      },
      sort_order: index,
    })));
    setPlatformForm(createdForm);
    setWorkflowMeta({});
    return createdForm;
  };

  const savePermissionDesign = async () => {
    const role = identityRoleRecords.find((item) => item.label === activePermissionRole || item.name === activePermissionRole);
    if (!role) {
      message.warning('请先在用户与权限中创建并同步角色');
      return;
    }
    setPersistingPermissions(true);
    try {
      const form = await ensurePlatformForm();
      const existingResponse = await listPlatformFormPermissions(form.id);
      const existing = (existingResponse.data?.data || []) as Array<{ id: number; role_id: number }>;
      await Promise.all(
        existing
          .filter((permission) => permission.role_id === role.id)
          .map((permission) => deletePlatformFormPermission(form.id, permission.id)),
      );

      const draft = activePermissionDraft;
      const actionPermissions = permissionActionDefinitions.map((definition) => {
        const enabled = draft.actions[definition.key] !== false;
        return [definition.key, enabled] as const;
      });
      await Promise.all(actionPermissions.map(([action, enabled]) => (
        upsertPlatformFormPermission(form.id, {
          role_id: role.id,
          action,
          effect: enabled ? 'allow' : 'deny',
        })
      )));

      const fieldPermissions = baseConfig.fields.flatMap((field, index) => {
        const permission = getRoleFieldPermission(field, index);
        const permissions = [
          { action: 'view', effect: permission.visible ? 'allow' : 'deny' },
          { action: 'edit', effect: permission.visible && permission.editable && !field.locked ? 'allow' : 'deny' },
          { action: 'export', effect: permission.visible && permission.exportable ? 'allow' : 'deny' },
        ];
        if (permission.required) permissions.push({ action: 'create', effect: 'allow' });
        return permissions.map((permission) => ({
          role_id: role.id,
          action: permission.action,
          effect: permission.effect,
          field_name: field.key,
        }));
      });
      await Promise.all(fieldPermissions.map((permission) => upsertPlatformFormPermission(form.id, permission)));
      const nextPermissionDrafts = Object.fromEntries(
        Object.entries({ ...permissionDrafts, [activePermissionRole]: draft })
          .map(([roleName, roleDraft]) => [roleName, sanitizePermissionDesignDraft(roleDraft)]),
      ) as PermissionDraftMap;
      const nextConfig = {
        ...(form.config || {}),
        permissionDesign: {
          ...((form.config?.permissionDesign as Record<string, unknown>) || {}),
          version: 1,
          updatedAt: new Date().toISOString(),
          roles: nextPermissionDrafts,
        },
      };
      const updatedResponse = await updatePlatformForm(form.id, { config: nextConfig });
      const updatedForm = (updatedResponse.data?.data || { ...form, config: nextConfig }) as PlatformForm;
      setPlatformForm(updatedForm);
      setPermissionDrafts(nextPermissionDrafts);
      setHasUnsavedChanges(false);
      message.success('权限配置已保存到后台数据库');
    } catch (error) {
      console.error('save permissions failed', error);
      message.error('保存权限失败');
    } finally {
      setPersistingPermissions(false);
    }
  };

  const updateFormWorkflowMeta = async (form: PlatformForm, nextMeta: WorkflowDesignerMeta) => {
    const nextConfig = { ...(form.config || {}), workflowDesigner: nextMeta };
    const response = await updatePlatformForm(form.id, { config: nextConfig });
    const updatedForm = (response.data?.data || { ...form, config: nextConfig }) as PlatformForm;
    setPlatformForm(updatedForm);
    setWorkflowMeta(nextMeta);
    return updatedForm;
  };

  const updateFormViewConfig = async (
    form: PlatformForm,
    nextViewConfig: ViewConfig,
    mode: 'draft' | 'published',
  ) => {
    const currentConfig = { ...(form.config || {}) } as Record<string, unknown>;
    const currentMeta = getViewConfigMeta(form);
    const now = new Date().toISOString();
    const draftVersion = Number(currentMeta.draftVersion || currentMeta.publishedVersion || 0);
    const publishedVersion = Number(currentMeta.publishedVersion || 0);
    const nextMeta: ViewConfigMeta = mode === 'draft'
      ? {
          ...currentMeta,
          draftVersion: draftVersion + 1,
          draftSavedAt: now,
          status: 'draft',
        }
      : {
          ...currentMeta,
          draftVersion: Math.max(draftVersion, publishedVersion + 1),
          publishedVersion: publishedVersion + 1,
          draftSavedAt: now,
          publishedAt: now,
          status: 'published',
        };
    const nextConfig: Record<string, unknown> = mode === 'draft'
      ? {
          ...currentConfig,
          viewConfigDraft: nextViewConfig,
          viewConfigMeta: nextMeta,
        }
      : {
          ...currentConfig,
          viewConfig: nextViewConfig,
          viewConfigDraft: nextViewConfig,
          viewConfigMeta: nextMeta,
        };
    const response = await updatePlatformForm(form.id, { config: nextConfig });
    const updatedForm = (response.data?.data || { ...form, config: nextConfig }) as PlatformForm;
    await upsertPlatformFormLayout(form.id, 'view', {
      layout_type: 'view',
      config: {
        draft: nextConfig.viewConfigDraft,
        published: nextConfig.viewConfig,
        meta: nextConfig.viewConfigMeta,
      },
    });
    setPlatformForm(updatedForm);
    return updatedForm;
  };

  const saveWorkflowDefinition = async (status: 'draft' | 'published', form: PlatformForm, workflowId?: number) => {
    const payload = {
      name: professionalFlowConfig.name || `${baseConfig.name}流程`,
      description: `${baseConfig.name} 表单内嵌流程设计`,
      status,
      config: makeWorkflowConfigPayload(professionalFlowConfig, form, baseConfig),
      form_config: makeWorkflowFormConfig(baseConfig),
    };
    if (workflowId) {
      const response = await wfUpdateDefinition(workflowId, payload);
      return {
        id: workflowId,
        version: Number(response.data?.version || 1),
        status: String(response.data?.status || status),
      };
    }
    const response = await wfCreateDefinition(payload);
    return {
      id: Number(response.data?.id),
      version: Number(response.data?.version || 1),
      status: String(response.data?.status || status),
    };
  };

  const saveDraft = async () => {
    if (isPersistingFlow) return;
    setPersistingFlow(true);
    try {
      const form = await ensurePlatformForm();
      const formWithView = await updateFormViewConfig(form, viewConfig, 'draft');
      const meta = getWorkflowDesignerMeta(formWithView);
      const saved = await saveWorkflowDefinition('draft', formWithView, meta.draftWorkflowId);
      await updateFormWorkflowMeta(formWithView, { ...meta, draftWorkflowId: saved.id });
      setVersion(`v${saved.version}`);
      setHasUnsavedChanges(false);
      message.success('草稿已保存，数据筛选配置和流程草稿都不会影响已发布运行页');
    } catch (error) {
      console.error('workflow draft save failed', error);
      message.error('草稿保存失败，请检查后端服务或登录状态');
    } finally {
      setPersistingFlow(false);
    }
  };

  const publishConfig = async () => {
    if (isPersistingFlow) return;
    setPersistingFlow(true);
    try {
      const form = await ensurePlatformForm();
      const formWithView = await updateFormViewConfig(form, viewConfig, 'draft');
      const response = await previewPlatformFormPublish(formWithView.id);
      setServerPublishReport(response.data?.data as PlatformFormPublishReport);
      setPublishCheckOpen(true);
    } catch (error) {
      console.error('form publish preview failed', error);
      message.error('发布影响报告生成失败，请检查后端服务或登录状态');
    } finally {
      setPersistingFlow(false);
    }
  };

  const confirmPublish = async () => {
    if (publishErrorCount > 0) {
      message.error('请先处理发布确认中的阻断项');
      return;
    }
    if (isPersistingFlow) return;
    setPersistingFlow(true);
    try {
      const form = await ensurePlatformForm();
      const formWithView = await updateFormViewConfig(form, viewConfig, 'draft');
      const meta = getWorkflowDesignerMeta(formWithView);
      const saved = await saveWorkflowDefinition('published', formWithView, meta.draftWorkflowId || meta.publishedWorkflowId);
      const publishedAt = new Date().toISOString();
      const updatedForm = await updateFormWorkflowMeta(formWithView, {
        ...meta,
        draftWorkflowId: saved.id,
        publishedWorkflowId: saved.id,
        publishedAt,
        publishedVersion: saved.version,
      });
      const bindingsResponse = await listWorkflowBindings(updatedForm.id);
      const existingBindings = (bindingsResponse.data?.data || []) as WorkflowBindingPayload[];
      await Promise.all(professionalFlowConfig.triggerBindings.map((binding) => {
        const payload = {
          workflow_id: saved.id,
          trigger_action: binding.action,
          enabled: binding.enabled,
          config: {
            label: binding.label,
            workflowVersion: saved.version,
            publishedAt,
            stateMapping: professionalFlowConfig.stateMapping,
          },
        };
        const existing = existingBindings.find((item) => item.trigger_action === binding.action);
        return existing
          ? updateWorkflowBinding(updatedForm.id, existing.id, payload)
          : upsertWorkflowBinding(updatedForm.id, payload);
      }));
      const formVersionResponse = await publishPlatformForm(updatedForm.id);
      const schemaVersion = Number(formVersionResponse.data?.data?.version || saved.version);
      setServerPublishReport((formVersionResponse.data?.data?.impact_report || null) as PlatformFormPublishReport | null);
      setVersion(`v${schemaVersion}`);
      setPublishCheckOpen(false);
      setHasUnsavedChanges(false);
      message.success('配置已发布，运行页会读取新的数据筛选和表格配置');
    } catch (error) {
      console.error('workflow publish failed', error);
      const report = (error as any)?.response?.data?.detail?.report as PlatformFormPublishReport | undefined;
      if (report) {
        setServerPublishReport(report);
        message.error('发布被后端影响报告阻断，请先处理不兼容字段变更');
        return;
      }
      message.error('发布失败，请检查流程定义或绑定接口');
    } finally {
      setPersistingFlow(false);
    }
  };

  const warnBeforeLeave = () => {
    if (!hasUnsavedChanges) {
      navigate(`/program/${baseConfig.id}`);
      return;
    }
    Modal.confirm({
      title: '当前有未保存修改',
      content: '离开后本次表单设置调整将不会保留。建议先保存草稿或发布配置。',
      okText: '仍然离开',
      cancelText: '继续配置',
      onOk: () => navigate(`/program/${baseConfig.id}`),
    });
  };

  const applyTwoColumnLayout = () => {
    commitLayoutChange((current) => current.map((control) => ({ ...control, width: 'half' })));
    message.success('已应用两列布局');
  };

  const applyCompactLayout = () => {
    commitLayoutChange((current) => current.map((control) => ({
      ...control,
      width: control.controlType === 'textarea' || control.controlType === 'upload' ? 'full' : 'quarter',
    })));
    message.success('已应用紧凑布局');
  };

  const applyBusinessSectionLayout = () => {
    const controls: LayoutControl[] = [];
    alertSections.forEach((section) => {
      controls.push({
        id: `section-${section.key}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        source: 'component',
        controlType: 'divider',
        name: section.title,
        desc: section.desc,
        width: 'full',
        rules: makeControlRules(),
      });
      section.fieldKeys
        .map((fieldKey) => baseConfig.fields.find((field) => field.key === fieldKey))
        .filter((field): field is DesignerField => Boolean(field))
        .forEach((field) => controls.push(makeFieldControl(field)));
    });
    commitLayoutChange(() => controls);
    setSelectedControlId(controls.find((control) => control.fieldKey)?.id || '');
    message.success('已按告警业务分组重新排版');
  };

  const batchUpdateVisibleControls = (patch: Partial<LayoutControl>) => {
    commitLayoutChange((current) => current.map((control) => (
      control.source === 'field' ? { ...control, ...patch } : control
    )));
  };

  const batchSetRequired = () => {
    commitLayoutChange((current) => current.map((control) => (
      control.source === 'field'
        ? { ...control, rules: { ...control.rules, required: { ...control.rules.required, enabled: true } } }
        : control
    )));
    message.success('已将画布中的字段批量设为必填');
  };

  const addTemplateField = (template: DesignerField) => {
    const field = { ...template, key: `${template.key}-${Date.now()}` };
    const control = makeFieldControl(field);
    commitLayoutChange((current) => [...current, control]);
    setSelectedControlId(control.id);
    message.success(`已添加常用字段模板：${template.name}`);
  };

  const redoLayoutChange = () => {
    setFuture((current) => {
      const nextState = current[current.length - 1];
      if (!nextState) return current;
      setHistory((previous) => [...previous.slice(-19), layoutControls]);
      setLayoutControls(nextState);
      setSelectedControlId('');
      message.success('已重做画布操作');
      return current.slice(0, -1);
    });
  };

  const startFlowNodeDrag = (event: React.PointerEvent<HTMLDivElement>, node: FlowNode) => {
    if ((event.target as HTMLElement).closest('.flow-port')) return;
    const canvas = flowCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.offsetWidth || 1;
    const scaleY = rect.height / canvas.offsetHeight || 1;
    draggingFlowNodeRef.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      scaleX,
      scaleY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveFlowNode = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = draggingFlowNodeRef.current;
    const canvas = flowCanvasRef.current;
    if (!dragState || !canvas) return;
    const nextX = dragState.originX + (event.clientX - dragState.startX) / dragState.scaleX;
    const nextY = dragState.originY + (event.clientY - dragState.startY) / dragState.scaleY;
    const maxX = Math.max(40, canvas.offsetWidth - FLOW_NODE_WIDTH - 24);
    const maxY = Math.max(60, canvas.offsetHeight - FLOW_NODE_HEIGHT - 24);
    setFlowNodes((current) => current.map((node) => (
      node.id === dragState.id
        ? { ...node, x: Math.min(Math.max(28, nextX), maxX), y: Math.min(Math.max(72, nextY), maxY) }
        : node
    )));
  };

  const stopFlowNodeDrag = () => {
    draggingFlowNodeRef.current = null;
  };

  const addFlowNode = (definition: FlowNodeDefinition) => {
    setFlowNodes((current) => {
      const node: FlowNode = {
        id: `flow-${definition.key}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        label: definition.name,
        role: definition.role,
        x: 300,
        y: 112,
      };
      const endIndex = current.findIndex((item) => item.role === 'end');
      const next = definition.role === 'end' || endIndex < 0
        ? [...current, node]
        : [...current.slice(0, endIndex), node, ...current.slice(endIndex)];
      const arranged = next.map((item, index) => ({ ...item, x: item.x || 300, y: 112 + index * 126 }));
      setFlowConnections(makeFlowConnections(arranged));
      setPendingFlowPort(null);
      return arranged;
    });
  };

  const handleFlowPortClick = (event: React.MouseEvent<HTMLElement>, node: FlowNode, side: FlowPortSide) => {
    event.stopPropagation();
    setPendingFlowPort((current) => {
      if (!current) return { nodeId: node.id, side };
      if (current.nodeId === node.id && current.side === side) return null;
      const nextConnection: FlowConnection = {
        id: `${current.nodeId}-${current.side}-${node.id}-${side}-${Date.now()}`,
        fromId: current.nodeId,
        fromSide: current.side,
        toId: node.id,
        toSide: side,
      };
      setFlowConnections((connections) => [
        ...connections.filter((connection) => !(connection.fromId === current.nodeId && connection.fromSide === current.side && connection.toId === node.id && connection.toSide === side)),
        nextConnection,
      ]);
      return null;
    });
  };

  const commitLayoutChange = (updater: (current: LayoutControl[]) => LayoutControl[]) => {
    setLayoutControls((current) => {
      const next = updater(current);
      setHistory((previous) => [...previous.slice(-19), current]);
      setFuture([]);
      markUnsaved();
      return next;
    });
  };

  const undoLayoutChange = () => {
    setHistory((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      setFuture((next) => [...next.slice(-19), layoutControls]);
      setLayoutControls(previous);
      setSelectedControlId('');
      markUnsaved();
      message.success('已撤回上一步画布操作');
      return current.slice(0, -1);
    });
  };

  const addFieldToCanvas = (field: DesignerField) => {
    const control = makeFieldControl(field);
    commitLayoutChange((current) => [...current, control]);
    setSelectedControlId(control.id);
    setSelectedAssetKey(field.key);
  };

  const addComponentToCanvas = (component: ComponentDefinition) => {
    const control = makeComponentControl(component);
    commitLayoutChange((current) => [...current, control]);
    setSelectedControlId(control.id);
    message.success(`已添加${component.name}`);
  };

  const updateSelectedControl = (patch: Partial<LayoutControl>) => {
    if (!selectedControlId) return;
    commitLayoutChange((current) => current.map((control) => (
      control.id === selectedControlId ? { ...control, ...patch } : control
    )));
  };

  const updateSelectedEncodingRule = (patch: Partial<EncodingRule>) => {
    if (!selectedControlId) return;
    const currentRule = selectedControl?.encodingRule || makeEncodingRule(selectedField);
    updateSelectedControl({ encodingRule: { ...currentRule, ...patch } });
  };

  const syncEncodingSegments = (segments: EncodingSegment[]) => {
    const dependencies = Array.from(new Set(
      segments
        .filter((segment) => segment.type === 'field' || segment.type === 'masterData')
        .map((segment) => segment.sourceField)
        .filter(Boolean) as string[],
    ));
    const sequenceSegment = segments.find((segment) => segment.type === 'sequence');
    updateSelectedEncodingRule({
      segments,
      dependencies,
      sequenceLength: sequenceSegment?.length || selectedEncodingRule?.sequenceLength || 3,
      resetCycle: sequenceSegment?.resetCycle || selectedEncodingRule?.resetCycle || 'month',
      regenerateOnDependencyChange: segments.some((segment) => segment.regenerateOnChange),
    });
  };

  const openEncodingSegmentEditor = (segment?: EncodingSegment, index?: number) => {
    setEncodingSegmentEditor({
      open: true,
      index,
      draft: segment ? { ...segment } : makeEncodingSegment('fixed', baseConfig.fields),
    });
  };

  const closeEncodingSegmentEditor = () => {
    setEncodingSegmentEditor((current) => ({ ...current, open: false }));
  };

  const updateEncodingSegmentDraft = (patch: Partial<EncodingSegment>) => {
    setEncodingSegmentEditor((current) => ({
      ...current,
      draft: { ...current.draft, ...patch },
    }));
  };

  const saveEncodingSegmentDraft = () => {
    if (!selectedControlUsesEncoding || !selectedEncodingRule) return;
    const draft = encodingSegmentEditor.draft;
    if (!draft.name?.trim()) {
      message.warning('请填写编码段名称');
      return;
    }
    if (!draft.length || draft.length < 1) {
      message.warning('编码段位数至少为 1');
      return;
    }
    const nextSegments = [...selectedEncodingSegments];
    if (typeof encodingSegmentEditor.index === 'number') {
      nextSegments[encodingSegmentEditor.index] = draft;
    } else {
      nextSegments.push(draft);
    }
    syncEncodingSegments(nextSegments);
    closeEncodingSegmentEditor();
  };

  const removeEncodingSegment = (index: number) => {
    syncEncodingSegments(selectedEncodingSegments.filter((_, segmentIndex) => segmentIndex !== index));
  };

  const moveLayoutControl = (sourceId: string, targetId: string, position: DropPosition = 'before') => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    commitLayoutChange((current) => {
      const sourceIndex = current.findIndex((control) => control.id === sourceId);
      const targetIndex = current.findIndex((control) => control.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      const nextTargetIndex = next.findIndex((control) => control.id === targetId);
      const insertIndex = position === 'after' ? nextTargetIndex + 1 : nextTargetIndex;
      next.splice(Math.max(0, insertIndex), 0, source);
      return next;
    });
    setSelectedControlId(sourceId);
    const source = layoutControls.find((control) => control.id === sourceId);
    if (source?.fieldKey) setSelectedAssetKey(source.fieldKey);
  };

  const moveLayoutControlToEnd = (sourceId: string) => {
    if (!sourceId) return;
    commitLayoutChange((current) => {
      const sourceIndex = current.findIndex((control) => control.id === sourceId);
      if (sourceIndex < 0 || sourceIndex === current.length - 1) return current;
      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      next.push(source);
      return next;
    });
    setSelectedControlId(sourceId);
    const source = layoutControls.find((control) => control.id === sourceId);
    if (source?.fieldKey) setSelectedAssetKey(source.fieldKey);
  };

  const duplicateControl = (control?: LayoutControl | null) => {
    if (!control) return;
    const copied = cloneControl(control);
    setCopiedControl(control);
    commitLayoutChange((current) => [...current, copied]);
    setSelectedControlId(copied.id);
  };

  const copyControlToClipboard = (control?: LayoutControl | null) => {
    if (!control) return;
    setCopiedControl(control);
    message.success('已复制控件，可使用 Ctrl+V 粘贴');
  };

  const pasteCopiedControl = () => {
    if (!copiedControl) {
      message.warning('还没有复制控件');
      return;
    }
    const pasted = cloneControl(copiedControl);
    commitLayoutChange((current) => [...current, pasted]);
    setSelectedControlId(pasted.id);
  };

  const removeControl = (controlId?: string) => {
    const targetId = controlId || selectedControlId;
    const target = layoutControls.find((control) => control.id === targetId);
    if (!target) {
      message.warning('请先选择画布控件');
      return;
    }
    commitLayoutChange((current) => current.filter((control) => control.id !== targetId));
    setSelectedControlId('');
    message.success('已从画布移出控件，字段资产仍然保留');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeTab !== 'form' || isEditableTarget(event.target)) return;
      const metaKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (metaKey && key === 'c') {
        event.preventDefault();
        copyControlToClipboard(selectedControl);
      }
      if (metaKey && key === 'v') {
        event.preventDefault();
        pasteCopiedControl();
      }
      if (metaKey && key === 'z') {
        event.preventDefault();
        undoLayoutChange();
      }
      if (metaKey && key === 'y') {
        event.preventDefault();
        redoLayoutChange();
      }
      if (!metaKey && (event.key === 'Delete' || event.key === 'Backspace') && selectedControl) {
        event.preventDefault();
        removeControl(selectedControl.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, copiedControl, selectedControl, selectedControlId, layoutControls]);

  const renderControlActions = (control: LayoutControl) => (
    <span className="designer-control-actions" onClick={(event) => event.stopPropagation()}>
      <Button size="small" type="text" title="复制" icon={<CopyOutlined />} onClick={() => duplicateControl(control)} />
      <Button size="small" type="text" danger title="移出画布" icon={<DeleteOutlined />} onClick={() => removeControl(control.id)} />
    </span>
  );

  const getCanvasControlDragProps = (control: LayoutControl) => ({
    draggable: true,
    onDragStart: (event: React.DragEvent<HTMLDivElement>) => {
      event.dataTransfer.setData('layoutControlId', control.id);
      event.dataTransfer.effectAllowed = 'move';
      setDraggedControlId(control.id);
      setCanvasDragActive(true);
      setSelectedControlId(control.id);
      if (control.fieldKey) setSelectedAssetKey(control.fieldKey);
    },
    onDragEnd: () => {
      setDraggedControlId('');
      setDropHint(null);
      setCanvasDragActive(false);
    },
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const rect = event.currentTarget.getBoundingClientRect();
      const position: DropPosition = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
      setDropHint({ controlId: control.id, position });
    },
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setDropHint((current) => (current?.controlId === control.id ? null : current));
      }
    },
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = event.dataTransfer.getData('layoutControlId');
      moveLayoutControl(sourceId, control.id, dropHint?.controlId === control.id ? dropHint.position : 'before');
      setDraggedControlId('');
      setDropHint(null);
      setCanvasDragActive(false);
    },
  });

  const renderControlLabel = (control: LayoutControl) => (
    <span className={control.rules.required.enabled ? 'designer-required-label' : undefined}>{control.name}</span>
  );

  const renderComponentInput = (control: LayoutControl) => {
    const disabled = control.rules.readonly.enabled;
    const placeholder = control.placeholder || control.desc || `请输入${control.name}`;
    if (control.controlType === 'textarea') {
      return <Input.TextArea disabled={disabled} placeholder={placeholder} autoSize={{ minRows: 2, maxRows: 4 }} />;
    }
    if (control.controlType === 'number') {
      return <Input disabled={disabled} placeholder={placeholder} suffix="#" />;
    }
    if (['select', 'relation'].includes(control.controlType)) {
      return <Select disabled={disabled} placeholder={placeholder} options={optionSourceToOptions(control.optionSource, placeholder)} />;
    }
    if (control.controlType === 'datetime') {
      return <Input disabled={disabled} placeholder={placeholder} prefix={<CalendarOutlined />} />;
    }
    if (control.controlType === 'upload') {
      return <Button disabled={disabled} icon={<PaperClipOutlined />}>选择文件</Button>;
    }
    if (control.controlType === 'switch') {
      return <Segmented disabled={disabled} options={['否', '是']} value="否" />;
    }
    if (control.controlType === 'readonly-text' || control.controlType === 'code') {
      return <Input disabled value={control.controlType === 'code' ? '自动生成编号' : '系统计算或引用值'} />;
    }
    return <Input disabled={disabled} placeholder={placeholder} />;
  };

  const renderCanvasControl = (control: LayoutControl) => {
    const field = baseConfig.fields.find((item) => item.key === control.fieldKey);
    const dragClass = `${draggedControlId === control.id ? 'canvas-control-dragging' : ''} ${dropHint?.controlId === control.id ? `canvas-drop-${dropHint.position}` : ''}`;
    const ruleClass = `${!control.rules.visible.enabled ? 'canvas-control-hidden-preview' : ''} ${control.rules.readonly.enabled ? 'canvas-control-readonly-preview' : ''}`;
    if (control.source === 'field' && field) {
      return (
        <div
          {...getCanvasControlDragProps(control)}
          className={`designer-field-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
          key={control.id}
          onClick={() => {
            setSelectedControlId(control.id);
            setSelectedAssetKey(field.key);
          }}
        >
          {renderControlActions(control)}
          <label>
            {renderControlLabel(control)}
            {fieldInput(field, control.placeholder, control.rules.readonly.enabled, control.optionSource, control.controlType)}
            {control.helpText && <small className="designer-control-help">{control.helpText}</small>}
          </label>
        </div>
      );
    }

    if (['text', 'textarea', 'number', 'select', 'relation', 'datetime', 'upload', 'switch', 'readonly-text', 'code'].includes(control.controlType)) {
      return (
        <div
          {...getCanvasControlDragProps(control)}
          className={`designer-field-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
          key={control.id}
          onClick={() => setSelectedControlId(control.id)}
        >
          {renderControlActions(control)}
          <label>
            {renderControlLabel(control)}
            {renderComponentInput(control)}
            {control.helpText && <small className="designer-control-help">{control.helpText}</small>}
          </label>
        </div>
      );
    }

    if (control.controlType === 'container' || control.controlType === 'two-columns') {
      const isColumns = control.controlType === 'two-columns';
      return (
        <div
          {...getCanvasControlDragProps(control)}
          className={`designer-layout-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
          key={control.id}
          onClick={() => setSelectedControlId(control.id)}
        >
          {renderControlActions(control)}
          <div className="designer-layout-control-head">
            <strong>{control.name}</strong>
            <small>{isColumns ? '多列字段区域' : '字段分组容器'}</small>
          </div>
          <div className={isColumns ? 'designer-layout-columns-preview' : 'designer-layout-container-preview'}>
            {isColumns ? (
              <>
                <span>左列字段</span>
                <span>右列字段</span>
              </>
            ) : (
              <span>拖入字段或控件到该分组</span>
            )}
          </div>
          <small>{control.desc}</small>
        </div>
      );
    }

    if (control.controlType === 'editable-table' || control.controlType === 'readonly-table') {
      return (
        <div
          {...getCanvasControlDragProps(control)}
          className={`designer-table-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
          key={control.id}
          onClick={() => setSelectedControlId(control.id)}
        >
          {renderControlActions(control)}
          <strong className={control.rules.required.enabled ? 'designer-required-label' : undefined}>{control.name}</strong>
          <div className="designer-mini-table">
            <span>列配置</span>
            <span>数据来源</span>
            <span>{control.controlType === 'editable-table' ? '可新增/删除行' : '分页/点击详情'}</span>
          </div>
        </div>
      );
    }

    if (control.controlType === 'divider') {
      return (
        <div
          {...getCanvasControlDragProps(control)}
          className={`designer-divider-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
          key={control.id}
          onClick={() => setSelectedControlId(control.id)}
        >
          {renderControlActions(control)}
          <span>{control.name}</span>
        </div>
      );
    }

    if (control.controlType === 'tabs') {
      return (
        <div
          {...getCanvasControlDragProps(control)}
          className={`designer-tabs-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
          key={control.id}
          onClick={() => setSelectedControlId(control.id)}
        >
          {renderControlActions(control)}
          <div className="designer-tabs-preview">
            <span className="designer-tab-active">基础信息</span>
            <span>扩展信息</span>
            <span>操作记录</span>
          </div>
          <small>{control.desc}</small>
        </div>
      );
    }

    if (['summary-card', 'status-tag', 'file-preview', 'approval-comment', 'operation-log', 'status-flow', 'risk-level'].includes(control.controlType)) {
      return (
        <div
          {...getCanvasControlDragProps(control)}
          className={`designer-business-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
          key={control.id}
          onClick={() => setSelectedControlId(control.id)}
        >
          {renderControlActions(control)}
          <strong>{control.name}</strong>
          <span>{control.desc}</span>
        </div>
      );
    }

    return (
      <div
        {...getCanvasControlDragProps(control)}
        className={`designer-placeholder-control ${controlWidthClass(control.width)} ${selectedControlId === control.id ? 'canvas-field-active' : ''} ${dragClass} ${ruleClass}`}
        key={control.id}
        onClick={() => setSelectedControlId(control.id)}
      >
        {renderControlActions(control)}
        <strong className={control.rules.required.enabled ? 'designer-required-label' : undefined}>{control.name}</strong>
        <span>{control.desc || '纯 UI 控件，可在右侧绑定字段或配置展示方式。'}</span>
      </div>
    );
  };

  const renderTableProperties = () => {
    if (!selectedControl || !['editable-table', 'readonly-table'].includes(selectedControl.controlType)) return null;
    const editable = selectedControl.controlType === 'editable-table';
    return (
      <section className="designer-prop-section">
        <strong className="designer-prop-section-title">{editable ? '子表属性' : '关联表属性'}</strong>
        <label><span>数据来源</span><Input value={editable ? `${baseConfig.dataSource}_items` : 'related_records'} readOnly /></label>
        <label><span>{editable ? '列配置' : '展示列'}</span><Input value={editable ? '物料、数量、单位、备注' : '编号、名称、状态、时间'} readOnly /></label>
        <label><span>{editable ? '允许新增行' : '分页显示'}</span>{genericRuleToggle(true, editable ? '新增行' : '分页')}</label>
        <label><span>{editable ? '允许删除行' : '点击查看详情'}</span>{genericRuleToggle(true, editable ? '删除行' : '详情')}</label>
        <label><span>{editable ? '行校验规则' : '排序规则'}</span><Input value={editable ? '明细行不能为空，数量必须大于 0' : '按时间倒序'} readOnly /></label>
      </section>
    );
  };

  const activeRule = ruleModal && selectedControl?.id === ruleModal.controlId
    ? normalizeControlRules(selectedControl.rules, selectedField)[ruleModal.ruleKey]
    : null;
  const activeRuleLabel = ruleModal ? ruleLabels[ruleModal.ruleKey] : '';
  const activeRuleStrategyOptions = ruleModal ? ruleStrategyOptions[ruleModal.ruleKey] || [] : [];
  const conditionFieldOptions = baseConfig.fields.map((field) => ({ value: field.key, label: field.name }));
  const getPreviewFieldPermission = (fieldKey?: string) => (
    fieldKey ? selectedPreviewFlowNode?.fieldPermissions?.[fieldKey] : undefined
  );
  const previewControls = layoutControls.filter((control) => {
    if (!control.rules.visible.enabled) return false;
    if (control.source !== 'field') return true;
    const permission = getPreviewFieldPermission(control.fieldKey);
    return permission?.visible !== false;
  });
  const renderPreviewContent = () => {
    if (previewMode === 'list') {
      const columns = baseConfig.fields.filter((field) => field.listVisible).slice(0, previewDevice === 'mobile' ? 3 : 6);
      return (
        <div className="designer-preview-table">
          <div className="designer-preview-table-head">
            {columns.map((field) => <span key={field.key}>{field.name}</span>)}
          </div>
          {[1, 2, 3].map((row) => (
            <div className="designer-preview-table-row" key={row}>
              {columns.map((field) => <span key={field.key}>{field.placeholder || field.name}</span>)}
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="designer-preview-form">
        {previewControls.map((control) => {
          const field = baseConfig.fields.find((item) => item.key === control.fieldKey);
          const permission = getPreviewFieldPermission(control.fieldKey);
          const readonlyByNode = permission ? !permission.editable : false;
          const requiredByNode = permission?.required ?? false;
          const required = control.rules.required.enabled || requiredByNode;
          const readonly = control.rules.readonly.enabled || readonlyByNode;
          return (
            <div className={`designer-preview-control ${controlWidthClass(previewDevice === 'mobile' ? 'full' : control.width)}`} key={control.id}>
              <span className={required ? 'designer-required-label' : undefined}>{control.name}</span>
              {control.source === 'field' && field
                ? fieldInput(field, control.placeholder, readonly, control.optionSource, control.controlType)
                : renderComponentInput({ ...control, rules: { ...control.rules, readonly: { ...control.rules.readonly, enabled: readonly } } })}
              {field && permission && (
                <small className="designer-preview-node-permission">
                  {permission.editable ? '当前节点可编辑' : '当前节点只读'}{permission.required ? ' / 必填' : ''}
                </small>
              )}
              {control.helpText && <small>{control.helpText}</small>}
            </div>
          );
        })}
      </div>
    );
  };

  const viewFieldOptions = baseConfig.fields.map((field) => ({ value: field.key, label: `${field.name} (${field.key})` }));
  const sortedViewFilters = sortByOrder(viewConfig.filters);
  const sortedViewColumns = sortByOrder(viewConfig.table.columns);
  const enabledViewColumns = sortedViewColumns.filter((column) => column.enabled);
  const viewConfigMeta = getViewConfigMeta(platformForm);

  const renderViewFilterControl = (filter: ViewFilterConfig) => {
    const placeholder = filter.placeholder || filter.label;
    if (filter.controlType === 'select' || filter.controlType === 'relation') {
      return <Select allowClear disabled placeholder={placeholder} options={[{ value: 'demo', label: placeholder }]} />;
    }
    if (filter.controlType === 'dateRange') {
      return <Input disabled prefix={<CalendarOutlined />} placeholder="开始日期  →  结束日期" />;
    }
    return <Input disabled prefix={filter.controlType === 'keyword' ? <SearchOutlined /> : undefined} placeholder={placeholder} />;
  };

  const renderViewFilterRow = (filter: ViewFilterConfig, index: number) => {
    return (
      <div
        className={`view-config-row ${draggedViewFilterId === filter.id ? 'view-config-row-dragging' : ''}`}
        draggable
        key={filter.id}
        onDragEnd={() => setDraggedViewFilterId('')}
        onDragOver={(event) => {
          if (!draggedViewFilterId || draggedViewFilterId === filter.id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          setDraggedViewFilterId(filter.id);
        }}
        onDrop={(event) => {
          event.preventDefault();
          reorderViewFilters(draggedViewFilterId, filter.id);
          setDraggedViewFilterId('');
        }}
      >
        <div
          className="view-config-row-main view-filter-config-main"
        >
          <label className="view-filter-config-form-item">
            <span className="view-filter-config-label">{filter.label}</span>
            <span className="view-filter-config-control">{renderViewFilterControl(filter)}</span>
          </label>
        </div>
      </div>
    );
  };

  const renderViewColumnRow = (column: ViewTableColumnConfig, index: number) => {
    const expanded = expandedViewRow === column.id;
    return (
      <div className={`view-config-row ${expanded ? 'view-config-row-expanded' : ''}`} key={column.id}>
        <button className="view-config-row-main" type="button" onClick={() => setExpandedViewRow(expanded ? '' : column.id)}>
          <span className="view-config-order">{index + 1}</span>
          <span className="view-config-primary">
            <strong>{column.label}</strong>
            <small>{column.fieldName} · {viewColumnRenderOptions.find((item) => item.value === column.renderType)?.label} · {column.width || 140}px</small>
          </span>
          <Tag color={column.enabled ? 'green' : 'default'}>{column.enabled ? '展示' : '隐藏'}</Tag>
          {column.sortable && <Tag color="blue">可排序</Tag>}
          {column.fixed && <Tag color="purple">固定{column.fixed === 'left' ? '左侧' : '右侧'}</Tag>}
        </button>
        <Space size={4} className="view-config-row-actions">
          <Button size="small" onClick={() => moveViewItem('column', column.id, -1)} disabled={index === 0}>上移</Button>
          <Button size="small" onClick={() => moveViewItem('column', column.id, 1)} disabled={index === sortedViewColumns.length - 1}>下移</Button>
          <Switch size="small" checked={column.enabled} onChange={(enabled) => updateViewColumn(column.id, { enabled })} />
        </Space>
        {expanded && (
          <div className="view-config-inline-editor view-config-inline-editor-wide">
            <label><span>绑定字段</span><Select value={column.fieldName} options={viewFieldOptions} onChange={(fieldName) => {
              const field = baseConfig.fields.find((item) => item.key === fieldName);
              updateViewColumn(column.id, { fieldName, label: field?.name || column.label });
            }} /></label>
            <label><span>列标题</span><Input value={column.label} onChange={(event) => updateViewColumn(column.id, { label: event.target.value })} /></label>
            <label><span>列宽</span><InputNumber min={80} max={420} value={column.width || 140} onChange={(width) => updateViewColumn(column.id, { width: Number(width || 140) })} /></label>
            <label><span>渲染类型</span><Select value={column.renderType} options={viewColumnRenderOptions} onChange={(renderType) => updateViewColumn(column.id, { renderType })} /></label>
            <label><span>固定列</span><Select value={column.fixed || 'none'} options={[{ value: 'none', label: '不固定' }, { value: 'left', label: '固定左侧' }, { value: 'right', label: '固定右侧' }]} onChange={(value) => updateViewColumn(column.id, { fixed: value === 'none' ? undefined : value as 'left' | 'right' })} /></label>
            <label><span>空值展示</span><Input value={column.emptyText} onChange={(event) => updateViewColumn(column.id, { emptyText: event.target.value })} /></label>
            <label><span>允许排序</span><Switch checked={column.sortable} onChange={(sortable) => updateViewColumn(column.id, { sortable })} /></label>
          </div>
        )}
      </div>
    );
  };

  const renderDataViewDesigner = () => (
    <div className="data-view-designer">
      <section className="view-config-section">
        <div className="view-config-section-head">
          <div><strong>筛选区</strong><span>配置查询条件、操作符、默认值和常用/高级位置。</span></div>
          <Button
            aria-label="新增筛选项"
            icon={<PlusOutlined />}
            onClick={() => setFilterFieldPickerOpen(true)}
            size="small"
            title="新增筛选项"
            type="text"
          />
        </div>
        <div className="view-config-filter-shell">
          <div className="view-config-list view-config-filter-grid">
            {sortedViewFilters.map(renderViewFilterRow)}
          </div>
          <Space className="view-config-filter-actions">
            <Button size="small">重置</Button>
            <Button icon={<SearchOutlined />} size="small" type="primary">查询</Button>
          </Space>
        </div>
      </section>

      <section className="view-config-section">
        <div className="view-config-section-head">
          <div><strong>数据列表区</strong><span>配置表格列、操作、排序、分页和行交互。</span></div>
          <Button
            aria-label="新增列表字段"
            icon={<PlusOutlined />}
            onClick={() => setTableFieldPickerOpen(true)}
            size="small"
            title="新增列表字段"
            type="text"
          />
        </div>
        <div className="view-config-table-shell">
          <div className="view-config-table-preview">
            <div
              className="view-config-table-head-row"
              style={{ gridTemplateColumns: `${enabledViewColumns.map((column) => `${column.width || 140}px`).join(' ')} 128px` }}
            >
              {enabledViewColumns.map((column) => (
                <div
                  className={`view-config-table-head-cell ${draggedViewColumnId === column.id ? 'view-config-table-cell-dragging' : ''}`}
                  draggable
                  key={column.id}
                  onDragEnd={() => setDraggedViewColumnId('')}
                  onDragOver={(event) => {
                    if (!draggedViewColumnId || draggedViewColumnId === column.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    setDraggedViewColumnId(column.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    reorderViewColumns(draggedViewColumnId, column.id);
                    setDraggedViewColumnId('');
                  }}
                  title="拖拽调整列顺序"
                >
                  {column.label}
                </div>
              ))}
              <div className="view-config-table-head-cell view-config-table-action-cell">操作</div>
            </div>
            <div className="view-config-table-empty">
              暂无数据
            </div>
          </div>
        </div>
      </section>

    </div>
  );

  const toolbarToolPanel = (
    <div className="designer-top-tool-panel">
      <section>
        <strong>配置引导</strong>
        <span>拖入字段/控件，选中后在右侧配置属性，发布时会同步做业务校验。</span>
        <div className="designer-top-tool-tags">
          <Tag color="blue">字段 {baseConfig.fields.length}</Tag>
          <Tag color="green">控件 {layoutControls.length}</Tag>
          <Tag color={publishErrorCount ? 'red' : 'success'}>阻断 {publishErrorCount}</Tag>
        </div>
      </section>
      <section>
        <strong>快捷排版</strong>
        <div className="designer-top-tool-grid">
          <Button size="small" icon={<LayoutOutlined />} onClick={applyTwoColumnLayout}>两列</Button>
          <Button size="small" icon={<TableOutlined />} onClick={applyCompactLayout}>紧凑</Button>
          <Button size="small" icon={<ApartmentOutlined />} onClick={applyBusinessSectionLayout}>业务分组</Button>
          <Button size="small" icon={<CheckSquareOutlined />} onClick={batchSetRequired}>批量必填</Button>
          <Button size="small" onClick={() => batchUpdateVisibleControls({ width: 'full' })}>全宽</Button>
          <Button size="small" icon={<UndoOutlined />} disabled={!history.length} onClick={undoLayoutChange}>撤销</Button>
        </div>
      </section>
      <section>
        <strong>业务区块</strong>
        <div className="designer-top-tool-sections">
          {alertSections.map((section) => (
            <button key={section.key} type="button" onClick={applyBusinessSectionLayout}>
              <span>{section.title}</span>
              <small>{section.desc}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );

  const activeTabKey: string = activeTab;
  const permissionActionRows = permissionActionDefinitions.map((item) => ({ ...item, enabled: activePermissionDraft.actions[item.key] !== false }));
  const enabledPermissionActionCount = permissionActionRows.filter((item) => item.enabled).length;
  const editablePermissionFieldCount = baseConfig.fields.filter((field, index) => getRoleFieldPermission(field, index).editable).length;
  const requiredPermissionFieldCount = baseConfig.fields.filter((field, index) => getRoleFieldPermission(field, index).required).length;
  const permissionFieldPageSize = 60;
  const filteredPermissionFields = baseConfig.fields
    .map((field, index) => ({ field, index, permission: getRoleFieldPermission(field, index) }))
    .filter(({ field, permission }) => {
      const query = fieldPermissionQuery.trim().toLowerCase();
      const matchesQuery = !query || field.name.toLowerCase().includes(query) || field.key.toLowerCase().includes(query);
      const matchesFilter =
        fieldPermissionFilter === 'all'
        || (fieldPermissionFilter === 'hidden' && !permission.visible)
        || (fieldPermissionFilter === 'editable' && permission.editable)
        || (fieldPermissionFilter === 'required' && permission.required)
        || (fieldPermissionFilter === 'exportable' && permission.exportable);
      return matchesQuery && matchesFilter;
    });
  const fieldPermissionPageCount = Math.max(1, Math.ceil(filteredPermissionFields.length / permissionFieldPageSize));
  const safeFieldPermissionPage = Math.min(fieldPermissionPage, fieldPermissionPageCount);
  const pagedPermissionFields = filteredPermissionFields.slice(
    (safeFieldPermissionPage - 1) * permissionFieldPageSize,
    safeFieldPermissionPage * permissionFieldPageSize,
  );
  return (
    <div className="form-designer-page">
      <header className="form-designer-toolbar">
        <div className="form-designer-title">
          <Typography.Title level={4}>{baseConfig.name}配置</Typography.Title>
          <span className="designer-title-meta">{baseConfig.status}</span>
        </div>
        <Tabs
          className="form-designer-tabs"
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as DesignerTab);
            setSelectedControlId('');
          }}
          items={tabs.map((item) => ({ key: item.key, label: <span>{item.icon}{item.label}</span> }))}
        />
        <Space className="form-designer-actions" size={4} wrap={false}>
          {hasUnsavedChanges && <Tag className="designer-unsaved-tag" color="orange">未保存</Tag>}
          <Button size="small" type="text" title="返回表单" aria-label="返回表单" icon={<ArrowLeftOutlined />} onClick={warnBeforeLeave} />
          <Button size="small" type="text" title="预览" aria-label="预览" icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)} />
          <Button
            className="designer-version-action"
            size="small"
            title="版本管理"
            aria-label="版本管理"
            icon={<HistoryOutlined />}
            onClick={() => setVersionPanelOpen(true)}
          >
            {version} 当前草稿
          </Button>
          <Button size="small" type="text" title="保存草稿" aria-label="保存草稿" icon={<SaveOutlined />} loading={isPersistingFlow} onClick={saveDraft} />
          <Popover content={toolbarToolPanel} placement="bottomRight" trigger="click">
            <Button size="small" type="text" title="工具" aria-label="工具" icon={<SettingOutlined />} />
          </Popover>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={isPersistingFlow} onClick={publishConfig}>发布配置</Button>
        </Space>
      </header>

      <section className={`form-designer-shell ${activeTab === 'permission' || activeTab === 'filter' || activeTab === 'flow' ? 'form-designer-shell-no-left' : ''} ${activeTab === 'filter' ? 'form-designer-shell-data-view' : ''} ${activeTab === 'permission' ? 'form-designer-shell-permission' : ''}`}>
        {!(['permission', 'filter', 'flow'] as DesignerTab[]).includes(activeTab) && (
          <aside className="form-designer-left">
            <div className="designer-panel-head">
              <strong>控件</strong>
              {activeTab !== 'form' && (
                <span>{tabs.find((item) => item.key === activeTab)?.label}</span>
              )}
            </div>
            {(activeTab === 'form' || activeTab === 'filter') && (
              <div className="designer-library-search">
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="搜索字段、控件或分类"
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                />
                <small>字段库绑定业务数据，控件库负责展示和布局。</small>
              </div>
            )}

          {(activeTab === 'form' || activeTab === 'filter') ? (
            <>
              <Segmented
                block
                className="designer-library-switch"
                value={componentPanel}
                onChange={(value) => setComponentPanel(value as ComponentPanel)}
                options={[
                  { label: '控件库', value: 'components' },
                  { label: '字段库', value: 'fieldTypes' },
                ]}
              />
              <div className="designer-quick-panel">
                <div className="designer-group-title">快捷排版</div>
                <div className="designer-side-guide">
                  <strong>配置引导</strong>
                  <span>{activeTab === 'filter' ? '配置运行页查询条件，选中后在右侧查看属性，发布时会同步做业务校验。' : '拖入字段/控件，选中后在右侧配置属性，发布时会同步做业务校验。'}</span>
                  <div>
                    <Tag color="blue">{activeTab === 'filter' ? '筛选字段' : '字段'} {libraryFields.length}</Tag>
                    <Tag color="green">{activeTab === 'filter' ? '筛选项' : '控件'} {activeTab === 'filter' ? baseConfig.filters.length : layoutControls.length}</Tag>
                    <Tag color={publishErrorCount ? 'red' : 'success'}>阻断 {publishErrorCount}</Tag>
                  </div>
                </div>
                <div className="designer-quick-grid">
                  <Button size="small" icon={<LayoutOutlined />} onClick={applyTwoColumnLayout}>两列</Button>
                  <Button size="small" icon={<TableOutlined />} onClick={applyCompactLayout}>紧凑</Button>
                  <Button size="small" icon={<ApartmentOutlined />} onClick={applyBusinessSectionLayout}>业务分组</Button>
                </div>
                <div className="designer-quick-grid">
                  <Button size="small" icon={<CheckSquareOutlined />} onClick={batchSetRequired}>批量必填</Button>
                  <Button size="small" onClick={() => batchUpdateVisibleControls({ width: 'full' })}>全宽</Button>
                  <Button size="small" icon={<UndoOutlined />} disabled={!history.length} onClick={undoLayoutChange}>撤销</Button>
                </div>
                <div className="designer-side-sections">
                  {alertSections.map((section) => (
                    <button key={section.key} type="button" onClick={applyBusinessSectionLayout}>
                      <strong>{section.title}</strong>
                      <small>{section.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
              {componentPanel === 'components' ? (
                <div className="designer-component-library">
                  <section className="designer-component-group">
                    <div className="designer-group-title">快捷添加</div>
                    <div className="designer-component-list">
                      {filteredCommonControls.map((item) => (
                        <div
                          className="designer-component"
                          draggable
                          key={item.key}
                          data-desc={item.desc}
                          onClick={() => activeTab === 'filter' ? message.info('筛选页先选择字段，再在右侧查看或调整属性') : addComponentToCanvas(item)}
                          onDragEnd={() => setCanvasDragActive(false)}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('componentKey', item.key);
                            setCanvasDragActive(true);
                          }}
                        >
                          <span className="designer-component-icon">{item.icon}</span>
                          <div>
                            <strong>{item.name}</strong>
                            <small>{item.desc}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  {filteredComponentGroups.map((group) => (
                    <details className="designer-component-group designer-component-collapse" key={group.category} open={!normalizedLibrarySearch}>
                      <summary className="designer-group-title">
                        <span>{group.category}</span>
                        <small>{group.items.length} 个</small>
                      </summary>
                      <div className="designer-component-list">
                        {group.items.map((item) => (
                          <div
                            className="designer-component"
                            draggable
                            key={item.key}
                            data-desc={item.desc}
                            onClick={() => activeTab === 'filter' ? message.info('筛选页先选择字段，再在右侧查看或调整属性') : addComponentToCanvas(item)}
                            onDragEnd={() => setCanvasDragActive(false)}
                            onDragStart={(event) => {
                              event.dataTransfer.setData('componentKey', item.key);
                              setCanvasDragActive(true);
                            }}
                          >
                            <span className="designer-component-icon">{item.icon}</span>
                            <div>
                              <strong>{item.name}</strong>
                              <small>{item.desc}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <>
                  <div className="designer-panel-head designer-panel-head-gap">
                    <strong>{activeTab === 'filter' ? '筛选字段' : '字段库'}</strong>
                    <span>{filteredLibraryFields.length} / {libraryFields.length} 个</span>
                  </div>
                  {activeTab === 'form' && <div className="designer-template-grid">
                    {fieldTemplates.filter((field) => matchesLibrarySearch(`${field.name} ${field.type}`)).map((field) => (
                      <button key={field.key} type="button" onClick={() => addTemplateField(field)}>
                        <span>{field.name}</span>
                        <small>{field.type}</small>
                      </button>
                    ))}
                  </div>}
                  <div className="designer-field-list">
                    {filteredLibraryFields.map((field) => (
                      <div
                        className={`designer-field ${selectedAssetKey === field.key ? 'designer-field-active' : ''}`}
                        draggable={activeTab === 'form'}
                        key={field.key}
                        onClick={() => {
                          setSelectedAssetKey(field.key);
                          setSelectedControlId('');
                        }}
                        onDragStart={(event) => activeTab === 'form' && event.dataTransfer.setData('fieldKey', field.key)}
                      >
                        <DragOutlined />
                        <span>{field.name}</span>
                        {field.locked && <Tag color="orange">锁定</Tag>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="designer-component-list">
              <div className="designer-component">
                <span className="designer-component-icon">{tabs.find((item) => item.key === activeTab)?.icon}</span>
                <div>
                  <strong>{tabs.find((item) => item.key === activeTab)?.label}</strong>
                  <small>这里配置页面级规则，不拖入表单新增画布。</small>
                </div>
              </div>
            </div>
          )}
        </aside>
        )}

        <main className="form-designer-canvas">
          {activeTabKey === 'form' && (
            <div
              className="canvas-board create-form-canvas"
              onClick={() => setSelectedControlId('')}
              onDragEnter={() => setCanvasDragActive(true)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setCanvasDragActive(false);
                  setDropHint(null);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setCanvasDragActive(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const layoutControlId = event.dataTransfer.getData('layoutControlId');
                if (layoutControlId) {
                  moveLayoutControlToEnd(layoutControlId);
                  setDraggedControlId('');
                  setDropHint(null);
                  setCanvasDragActive(false);
                  return;
                }
                const fieldKey = event.dataTransfer.getData('fieldKey');
                const componentKey = event.dataTransfer.getData('componentKey');
                const field = baseConfig.fields.find((item) => item.key === fieldKey);
                const component = componentGroups.flatMap((group) => group.items).find((item) => item.key === componentKey);
                if (field) addFieldToCanvas(field);
                if (component) addComponentToCanvas(component);
                setCanvasDragActive(false);
              }}
            >
              <div className="create-form-modal" onClick={(event) => event.stopPropagation()}>
                <div className={`create-form-grid ${isCanvasDragActive ? 'canvas-drag-active' : ''}`}>
                  {layoutControls.map(renderCanvasControl)}
                  {isCanvasDragActive && !dropHint && <div className="canvas-drop-end-indicator">拖到这里放在末尾</div>}
                </div>
                <div className="create-form-actions">
                  <Button>取消</Button>
                  <Button type="primary">提交</Button>
                </div>
              </div>
            </div>
          )}

          {activeTabKey === 'filter' && (
            <div className="data-view-canvas">
              {renderDataViewDesigner()}
            </div>
          )}

          {activeTabKey === 'flow' && (
            <ProfessionalFlowDesigner
              config={professionalFlowConfig}
              fields={baseConfig.fields.map((field) => ({
                key: field.key,
                name: field.name,
                type: field.type,
                required: field.required,
              }))}
              roles={permissionRoles}
              onChange={(nextConfig) => {
                setProfessionalFlowConfig(nextConfig);
                markUnsaved();
              }}
            />
          )}

          {activeTabKey === 'permission' && (
            <div className="permission-canvas">
              <div className="permission-workbench">
                <aside className="permission-role-rail">
                  <div className="permission-rail-head">
                    <div>
                      <div className="permission-section-title">1. 选择授权对象</div>
                      <small>来自用户与权限中心的角色</small>
                    </div>
                    <Space size={6}>
                      <Tag>{permissionRoles.length}</Tag>
                      <Button
                        aria-label="保存权限"
                        icon={<SaveOutlined />}
                        loading={isPersistingPermissions}
                        onClick={savePermissionDesign}
                        size="small"
                        title="保存权限"
                        type="text"
                      />
                    </Space>
                  </div>
                  <Input size="small" prefix={<SearchOutlined />} placeholder="搜索角色" />
                  {permissionRoles.map((role, index) => (
                    <button
                      className={`permission-role-card ${role === activePermissionRole ? 'permission-role-active' : ''}`}
                      key={role}
                      type="button"
                      onClick={() => setSelectedPermissionRole(role)}
                    >
                      <span className="permission-role-icon"><UserSwitchOutlined /></span>
                      <span>
                        <strong>{role}</strong>
                        <small>{role === activePermissionRole ? '正在配置' : index === 0 ? '最高权限模板' : '点击切换配置'}</small>
                      </span>
                      <Tag color={role === activePermissionRole ? 'blue' : 'default'}>{index === 0 ? '全局' : '业务'}</Tag>
                    </button>
                  ))}
                </aside>

                <div className="permission-main">
                  <section className="permission-card permission-scope-card">
                    <div className="permission-card-head">
                      <div>
                        <div className="permission-section-title">1. 数据权限</div>
                        <span>决定角色可以看到哪些组织、记录和敏感信息</span>
                      </div>
                      <ApartmentOutlined />
                    </div>
                    <div className="permission-data-config">
                      <label>
                        <span>数据范围</span>
                        <Select
                          size="small"
                          value={activePermissionDraft.data.scope}
                          onChange={(scope) => updateActivePermissionDraft((draft) => ({
                            ...draft,
                            data: { ...draft.data, scope },
                          }))}
                          options={[
                            { value: 'all', label: '全部组织' },
                            { value: 'org_tree', label: '本组织及下级' },
                            { value: 'org', label: '仅本组织' },
                            { value: 'assigned', label: '本人创建 / 分派给我' },
                            { value: 'custom', label: '自定义范围' },
                          ]}
                        />
                      </label>
                      <label>
                        <span>组织来源</span>
                        <Select
                          mode="multiple"
                          size="small"
                          value={(activePermissionDraft.data.orgUnits || [])
                            .map((value) => Number(value))
                            .filter((value) => Number.isInteger(value) && value > 0)}
                          onChange={(orgUnits) => updateActivePermissionDraft((draft) => ({
                            ...draft,
                            data: { ...draft.data, orgUnits },
                          }))}
                          maxTagCount="responsive"
                          options={permissionOrgUnitOptions}
                        />
                      </label>
                      <label>
                        <span>敏感字段</span>
                        <Select
                          size="small"
                          value={activePermissionDraft.data.sensitiveFields}
                          onChange={(sensitiveFields) => updateActivePermissionDraft((draft) => ({
                            ...draft,
                            data: { ...draft.data, sensitiveFields },
                          }))}
                          options={[
                            { value: 'full', label: '完整显示' },
                            { value: 'mask', label: '详情与导出脱敏' },
                            { value: 'hide', label: '完全隐藏' },
                          ]}
                        />
                      </label>
                    </div>
                    <div className="permission-data-checks">
                      {[
                        ['createdByMe', '本人创建'],
                        ['assignedToMe', '分派给我'],
                        ['sameOrg', '同组织记录'],
                        ['crossOrg', '跨组织记录'],
                        ['statistics', '统计汇总数据'],
                      ].map(([key, label]) => (
                        <Checkbox
                          key={key}
                          checked={activePermissionDraft.data.ownership[key] !== false}
                          onChange={(event) => updateActivePermissionDraft((draft) => ({
                            ...draft,
                            data: {
                              ...draft.data,
                              ownership: { ...draft.data.ownership, [key]: event.target.checked },
                            },
                          }))}
                        >
                          {label}
                        </Checkbox>
                      ))}
                    </div>
                  </section>

                  <section className="permission-card permission-action-card">
                    <div className="permission-card-head">
                      <div>
                        <div className="permission-section-title">2. 动作权限</div>
                        <span>控制按钮、接口动作和批量操作入口</span>
                      </div>
                      <Tag color="green">{enabledPermissionActionCount} / {permissionActionRows.length} 已启用</Tag>
                    </div>
                    <div className="permission-action-grid">
                      {permissionActionRows.map((item) => (
                        <Tooltip
                          key={item.key}
                          title={`${item.desc}；风险等级：${item.risk === 'high' ? '高' : item.risk === 'medium' ? '中' : '低'}`}
                          placement="top"
                        >
                          <label className={`permission-toggle-row permission-action-toggle-row ${item.enabled ? 'permission-action-toggle-on' : 'permission-action-toggle-off'}`}>
                            <strong>{item.name}</strong>
                            <Switch
                              size="small"
                              checked={item.enabled}
                              onChange={(checked) => updateActivePermissionDraft((draft) => ({
                                ...draft,
                                actions: { ...draft.actions, [item.key]: checked },
                              }))}
                            />
                          </label>
                        </Tooltip>
                      ))}
                    </div>
                  </section>

                  <section className="permission-card permission-field-card">
                    <div className="permission-card-head">
                      <div>
                        <div className="permission-section-title">3. 角色字段权限</div>
                        <span>按字段搜索和筛选后批量处理当前角色的运行时覆盖；字段默认参数仍在字段设置里维护</span>
                      </div>
                      <Space size={6}>
                        <Tag color="green">字段 {baseConfig.fields.length}</Tag>
                        <Tag color="blue">可编辑 {editablePermissionFieldCount}</Tag>
                        <Tag color="orange">角色必填 {requiredPermissionFieldCount}</Tag>
                        <Button size="small">批量设置</Button>
                      </Space>
                    </div>
                    <div className="permission-field-tools">
                      <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="搜索字段名称或编码"
                        value={fieldPermissionQuery}
                        onChange={(event) => {
                          setFieldPermissionQuery(event.target.value);
                          setFieldPermissionPage(1);
                        }}
                      />
                      <Select
                        value={fieldPermissionFilter}
                        onChange={(value) => {
                          setFieldPermissionFilter(value);
                          setFieldPermissionPage(1);
                        }}
                        options={[
                          { value: 'all', label: '全部字段' },
                          { value: 'hidden', label: '隐藏字段' },
                          { value: 'editable', label: '可编辑' },
                          { value: 'required', label: '角色必填' },
                          { value: 'exportable', label: '允许导出' },
                        ]}
                      />
                      <span>{filteredPermissionFields.length} 个匹配字段</span>
                    </div>
                    <div className="permission-field-matrix">
                      <div className="permission-field-head">
                        <span>字段</span><span>可见</span><span>编辑</span><span>必填</span><span>导出</span>
                      </div>
                      <div className="permission-field-list">
                      {pagedPermissionFields.map(({ field, index, permission }) => {
                        return (
                          <div className="permission-field-row" key={field.key}>
                            <span title={`${field.name} / ${field.key}`}>
                              <strong>{field.name}</strong>
                              <small>{field.key}</small>
                            </span>
                            <Switch
                              size="small"
                              checked={permission.visible}
                              onChange={(checked) => updateRoleFieldPermission(field, index, {
                                visible: checked,
                                editable: checked ? permission.editable : false,
                                required: checked ? permission.required : false,
                              })}
                            />
                            <Switch
                              size="small"
                              checked={permission.visible && permission.editable}
                              disabled={field.locked || !permission.visible}
                              onChange={(checked) => updateRoleFieldPermission(field, index, { editable: checked })}
                            />
                            <Switch
                              size="small"
                              checked={permission.visible && permission.required}
                              disabled={!permission.visible}
                              onChange={(checked) => updateRoleFieldPermission(field, index, { required: checked })}
                            />
                            <Switch
                              size="small"
                              checked={permission.visible && permission.exportable}
                              disabled={!permission.visible}
                              onChange={(checked) => updateRoleFieldPermission(field, index, { exportable: checked })}
                            />
                          </div>
                        );
                      })}
                      </div>
                      <div className="permission-field-pager">
                        <span>
                          第 {safeFieldPermissionPage} / {fieldPermissionPageCount} 页，每页 {permissionFieldPageSize} 个字段
                        </span>
                        <Space size={6}>
                          <Button
                            size="small"
                            disabled={safeFieldPermissionPage <= 1}
                            onClick={() => setFieldPermissionPage((page) => Math.max(1, page - 1))}
                          >
                            上一页
                          </Button>
                          <Button
                            size="small"
                            disabled={safeFieldPermissionPage >= fieldPermissionPageCount}
                            onClick={() => setFieldPermissionPage((page) => Math.min(fieldPermissionPageCount, page + 1))}
                          >
                            下一页
                          </Button>
                        </Space>
                      </div>
                    </div>
                  </section>

                </div>
              </div>
            </div>
          )}
        </main>

        {!(['permission', 'filter', 'flow'] as DesignerTab[]).includes(activeTab) && (
        <aside className="form-designer-right">
          <div className="designer-panel-head">
            <strong>属性</strong>
            <span>当前：{selectedControl ? '控件' : selectedField ? '字段' : '画布'}</span>
          </div>
          <div className="designer-prop-summary">
            <span className="designer-prop-summary-badge">{selectedControl ? '控件' : selectedField ? '字段' : '画布'}</span>
            <strong>{selectedControl?.name || selectedField?.name || baseConfig.name}</strong>
            <small>
              {selectedControl
                ? `${selectedControl.controlType} · ${controlWidthLabel(selectedControl.width)}`
                : selectedField
                  ? `${selectedField.type} · ${selectedField.locked ? '锁定字段' : '可配置字段'}`
                  : `${baseConfig.dataSource} · ${baseConfig.primaryKey}`}
            </small>
          </div>

          {selectedControl ? (
            <div className="designer-props">
                        <section className="designer-prop-section">
                          <strong className="designer-prop-section-title">控件身份</strong>
                          <label>
                            <span>控件名称</span>
                            <Input
                              value={selectedControl.name}
                              onChange={(event) => updateSelectedControl({ name: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>控件类型</span>
                            <Select
                              value={selectedEffectiveControlType}
                              options={controlTypeOptions}
                              onChange={(controlType) => {
                                const nextWidth = controlType === 'textarea' || controlType === 'upload' ? 'full' : selectedControl.width;
                                updateSelectedControl({ controlType, width: nextWidth as ControlWidth });
                              }}
                            />
                          </label>
                          <label className="designer-prop-locked">
                            <span>字段来源</span>
                            <Input value={selectedField ? selectedField.name : '未绑定字段'} disabled />
                          </label>
                          <label className="designer-prop-locked">
                            <span>字段类型</span>
                            <Input value={getFieldStorageTypeLabel(selectedField)} disabled suffix="数据库字段" />
                          </label>
                          {selectedControlUsesEncoding && (
                            <label className="designer-prop-locked">
                              <span>业务特性</span>
                              <Input value="编码" disabled suffix="控件能力" />
                            </label>
                          )}
                      </section>
                      {selectedControlUsesDataSource && (
                        <section className="designer-prop-section">
                          <strong className="designer-prop-section-title">数据源与选项</strong>
                          <label>
                            <span>来源类型</span>
                            <Select
                              value={selectedReferenceSourceKind}
                              options={referenceSourceKindOptions}
                              onChange={(dataSourceKind) => {
                                const config = getReferenceConfig(dataSourceKind);
                                updateSelectedControl({
                                  dataSourceKind,
                                  optionSource: config.objects[0]?.value,
                                });
                              }}
                            />
                          </label>
                          <label>
                            <span>配置位置</span>
                            <Input
                              value={selectedReferenceConfig.setup}
                              readOnly
                            />
                          </label>
                          {selectedReferenceSourceKind === 'static' ? (
                            <label>
                              <span>选项值</span>
                              <Input
                                allowClear
                                placeholder={selectedReferenceConfig.placeholder}
                                value={selectedControl.optionSource || selectedField?.optionSource || ''}
                                onChange={(event) => updateSelectedControl({ optionSource: event.target.value })}
                              />
                            </label>
                          ) : (
                            <label>
                              <span>引用对象</span>
                              <Select
                                value={selectedControl.optionSource || selectedReferenceConfig.objects[0]?.value}
                                options={selectedReferenceConfig.objects}
                                placeholder={selectedReferenceConfig.placeholder}
                                onChange={(optionSource) => updateSelectedControl({ optionSource })}
                              />
                            </label>
                          )}
                          <label>
                            <span>值字段</span>
                            <Select
                              value={selectedReferenceConfig.valueFields[0]?.value}
                              options={selectedReferenceConfig.valueFields}
                            />
                          </label>
                          <label>
                            <span>显示字段</span>
                            <Select
                              value={selectedReferenceConfig.labelFields[0]?.value}
                              options={selectedReferenceConfig.labelFields}
                            />
                          </label>
                          <label>
                            <span>选项预览</span>
                            <Select
                              value={
                                selectedReferenceSourceKind === 'static'
                                  ? optionSourceToOptions(selectedControl.optionSource || selectedField?.optionSource, selectedControl.placeholder || selectedField?.placeholder)[0]?.value
                                  : selectedReferenceConfig.preview[0]
                              }
                              options={
                                selectedReferenceSourceKind === 'static'
                                  ? optionSourceToOptions(selectedControl.optionSource || selectedField?.optionSource, selectedControl.placeholder || selectedField?.placeholder)
                                  : selectedReferenceConfig.preview.map((item) => ({ value: item, label: item }))
                              }
                            />
                          </label>
                        </section>
                      )}
                      <section className="designer-prop-section">
                        <strong className="designer-prop-section-title">布局</strong>
                          <label className="designer-prop-row-wide">
                            <span>控件宽度</span>
                            <div className="designer-width-picker">
                            {controlWidthOptions.map((option) => (
                              <button
                                className={`designer-width-option ${selectedControl.width === option.value ? 'designer-width-option-active' : ''}`}
                                key={option.value}
                                onClick={() => updateSelectedControl({ width: option.value as ControlWidth })}
                                type="button"
                              >
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </label>
                      </section>
                        <section className="designer-prop-section">
                          <strong className="designer-prop-section-title">默认交互规则</strong>
                          <label><span>默认显示</span>{controlRuleToggle('visible')}</label>
                          <label><span>默认只读</span>{controlRuleToggle('readonly')}</label>
                          <label><span>默认必输</span>{controlRuleToggle('required')}</label>
                          <label><span>唯一校验</span>{controlRuleToggle('unique')}</label>
                          <label><span>默认脱敏</span>{controlRuleToggle('masked')}</label>
                          <label><span>允许复制</span>{controlRuleToggle('copyable')}</label>
                          {selectedControlUsesOptionSort && <label><span>选项排序</span>{controlRuleToggle('optionSort')}</label>}
                          {hiddenRequiredControls.length > 0 && <Tag color="red">存在隐藏且必填冲突</Tag>}
                        </section>
                        <section className="designer-prop-section">
                          <strong className="designer-prop-section-title">提示与联动</strong>
                          <label>
                            <span>占位提示</span>
                            <Input
                              allowClear
                              placeholder={selectedField?.placeholder || selectedControl.desc || '请输入占位提示'}
                              value={selectedControl.placeholder || ''}
                              onChange={(event) => updateSelectedControl({ placeholder: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>帮助说明</span>
                            <Input
                              allowClear
                              placeholder="可在此补充录入说明"
                              value={selectedControl.helpText || ''}
                              onChange={(event) => updateSelectedControl({ helpText: event.target.value })}
                            />
                          </label>
                          <label><span>变更触发</span>{genericRuleToggle(false, '变更触发')}</label>
                          <label><span>联动刷新</span><Input value="未绑定联动规则" readOnly /></label>
                          <label><span>异常提示</span><Input value="使用字段校验提示" readOnly /></label>
                        <label><span>角色差异</span><Input value="在权限设计中统一配置" readOnly /></label>
                      </section>
                      {selectedControlUsesEncoding && selectedEncodingRule && (
                        <section className="designer-prop-section">
                          <strong className="designer-prop-section-title">编码规则</strong>
                          <label>
                            <span>生成方式</span>
                            <Select
                              value={selectedEncodingRule.generationMode || 'auto'}
                              options={encodingGenerationModeOptions}
                              onChange={(generationMode) => updateSelectedEncodingRule({
                                generationMode,
                                allowManualOverride: generationMode === 'autoEditable' || generationMode === 'manual',
                              })}
                            />
                          </label>
                          <label>
                            <span>生成时机</span>
                            <Select
                              value={selectedEncodingRule.generationTiming || 'create'}
                              options={encodingGenerationTimingOptions}
                              onChange={(generationTiming) => updateSelectedEncodingRule({ generationTiming })}
                            />
                          </label>
                          <label>
                            <span>唯一范围</span>
                            <Select
                              value={selectedEncodingRule.uniquenessScope || 'form'}
                              options={encodingUniquenessScopeOptions}
                              onChange={(uniquenessScope) => updateSelectedEncodingRule({ uniquenessScope, unique: uniquenessScope !== 'dependency' || selectedEncodingSegments.length > 0 })}
                            />
                          </label>
                          <div className="designer-prop-row-wide encoding-segment-list">
                            <Button
                              block
                              icon={<PlusOutlined />}
                              onClick={() => openEncodingSegmentEditor()}
                              size="small"
                            >
                              新增编码段
                            </Button>
                            {selectedEncodingSegments.map((segment, index) => (
                              <div className="encoding-segment-card" key={segment.id}>
                                <button
                                  className="encoding-segment-main"
                                  onClick={() => openEncodingSegmentEditor(segment, index)}
                                  type="button"
                                >
                                  <strong>{segment.name || getEncodingSegmentTypeLabel(segment.type)}</strong>
                                  <small>
                                    {getEncodingSegmentTypeLabel(segment.type)} · {segment.length || 0} 位 · 示例 {renderEncodingSegmentSample(segment, baseConfig.fields) || '-'}
                                  </small>
                                </button>
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => removeEncodingSegment(index)}
                                  size="small"
                                  type="text"
                                />
                              </div>
                            ))}
                          </div>
                          <label><span>组成说明</span><Input value={getEncodingComposition(selectedEncodingRule, baseConfig.fields)} readOnly /></label>
                          <label><span>编码示例</span><Input value={renderEncodingSample(selectedEncodingRule, baseConfig.fields)} readOnly /></label>
                        </section>
                      )}
                      {renderTableProperties()}
                    </div>
          ) : (
            <div className="designer-props">
              <section className="designer-prop-section">
                <strong className="designer-prop-section-title">画布属性</strong>
                <label><span>表单名称</span><Input value={baseConfig.name} readOnly /></label>
                <label><span>新增标题</span><Input value={baseConfig.createTitle} readOnly /></label>
                <label><span>数据表</span><Input value={baseConfig.dataSource} readOnly /></label>
                <label><span>主键字段</span><Input value={baseConfig.primaryKey} readOnly /></label>
                <label><span>默认列数</span><Select value="2" options={[{ value: '1', label: '单列' }, { value: '2', label: '两列' }, { value: '3', label: '三列' }]} /></label>
                <label><span>字段间距</span><Select value="12" options={[{ value: '8', label: '紧凑' }, { value: '12', label: '标准' }, { value: '16', label: '宽松' }]} /></label>
                <label><span>表单说明</span><Input value={baseConfig.description} readOnly /></label>
                <label><span>发布状态</span><Input value={hasUnsavedChanges ? '当前草稿有未保存修改' : '草稿与已发布版本一致'} readOnly /></label>
                <label><span>发布校验</span><Input value={`${publishErrorCount} 个阻断项 / ${publishWarningCount} 个提醒`} readOnly /></label>
              </section>
              <section className="designer-prop-section">
                <strong className="designer-prop-section-title">推荐联动</strong>
                {recommendedRules.map((rule) => <div className="designer-rule-pill" key={rule}>{rule}</div>)}
              </section>
            </div>
          )}
        </aside>
        )}
      </section>

      <Modal
        centered
        className="encoding-segment-modal"
        okText="保存编码段"
        onCancel={closeEncodingSegmentEditor}
        onOk={saveEncodingSegmentDraft}
        open={encodingSegmentEditor.open}
        title={typeof encodingSegmentEditor.index === 'number' ? '编辑编码段' : '新增编码段'}
        width={560}
      >
        <div className="encoding-segment-form">
          <label>
            <span>段类型</span>
            <Select
              value={encodingSegmentEditor.draft.type}
              options={encodingSegmentTypeOptions}
              onChange={(type) => {
                const nextSegment = makeEncodingSegment(type, baseConfig.fields);
                updateEncodingSegmentDraft({
                  ...nextSegment,
                  id: encodingSegmentEditor.draft.id,
                  name: encodingSegmentEditor.draft.name || nextSegment.name,
                });
              }}
            />
          </label>
          <label>
            <span>段名称</span>
            <Input
              value={encodingSegmentEditor.draft.name}
              onChange={(event) => updateEncodingSegmentDraft({ name: event.target.value })}
            />
          </label>
          <label>
            <span>位数</span>
            <InputNumber
              min={1}
              max={64}
              value={encodingSegmentEditor.draft.length}
              onChange={(length) => updateEncodingSegmentDraft({ length: Number(length || 1) })}
            />
          </label>
          <label>
            <span>补位方式</span>
            <Select
              value={encodingSegmentEditor.draft.padding || 'none'}
              options={encodingPaddingOptions}
              onChange={(padding) => updateEncodingSegmentDraft({ padding })}
            />
          </label>
          {encodingSegmentEditor.draft.type === 'fixed' && (
            <label>
              <span>固定值</span>
              <Input
                value={encodingSegmentEditor.draft.value || ''}
                placeholder="例如 AL、WO、QC"
                onChange={(event) => updateEncodingSegmentDraft({ value: event.target.value })}
              />
            </label>
          )}
          {encodingSegmentEditor.draft.type === 'date' && (
            <label>
              <span>日期格式</span>
              <Select
                value={encodingSegmentEditor.draft.datePattern || 'YYMM'}
                options={encodingDatePatternOptions}
                onChange={(datePattern) => updateEncodingSegmentDraft({
                  datePattern,
                  length: getDateSegmentLength(datePattern) || encodingSegmentEditor.draft.length,
                })}
              />
            </label>
          )}
          {(encodingSegmentEditor.draft.type === 'field' || encodingSegmentEditor.draft.type === 'masterData') && (
            <>
              <label>
                <span>依据字段</span>
                <Select
                  allowClear
                  value={encodingSegmentEditor.draft.sourceField}
                  options={baseConfig.fields
                    .filter((field) => field.key !== selectedField?.key)
                    .map((field) => ({ value: field.key, label: `${field.name} / ${field.key}` }))}
                  placeholder="选择字段变化时影响编码"
                  onChange={(sourceField) => updateEncodingSegmentDraft({ sourceField, regenerateOnChange: Boolean(sourceField) })}
                />
              </label>
              <label>
                <span>取值属性</span>
                <Select
                  value={encodingSegmentEditor.draft.sourceAttribute || 'code'}
                  options={[
                    { value: 'code', label: '编码' },
                    { value: 'id', label: 'ID' },
                    { value: 'shortName', label: '简称' },
                    { value: 'custom', label: '自定义属性' },
                  ]}
                  onChange={(sourceAttribute) => updateEncodingSegmentDraft({ sourceAttribute })}
                />
              </label>
            </>
          )}
          {encodingSegmentEditor.draft.type === 'organization' && (
            <label>
              <span>组织属性</span>
              <Select
                value={encodingSegmentEditor.draft.sourceAttribute || 'org_code'}
                options={[
                  { value: 'org_code', label: '组织编码' },
                  { value: 'factory_code', label: '工厂编码' },
                  { value: 'department_code', label: '部门编码' },
                  { value: 'org_name', label: '组织简称' },
                ]}
                onChange={(sourceAttribute) => updateEncodingSegmentDraft({ sourceAttribute })}
              />
            </label>
          )}
          {encodingSegmentEditor.draft.type === 'sequence' && (
            <>
              <label>
                <span>起始值</span>
                <InputNumber
                  min={0}
                  max={999999}
                  value={encodingSegmentEditor.draft.sequenceStart || 1}
                  onChange={(sequenceStart) => updateEncodingSegmentDraft({ sequenceStart: Number(sequenceStart || 1) })}
                />
              </label>
              <label>
                <span>步长</span>
                <InputNumber
                  min={1}
                  max={100}
                  value={encodingSegmentEditor.draft.sequenceStep || 1}
                  onChange={(sequenceStep) => updateEncodingSegmentDraft({ sequenceStep: Number(sequenceStep || 1) })}
                />
              </label>
              <label>
                <span>重置周期</span>
                <Select
                  value={encodingSegmentEditor.draft.resetCycle || 'month'}
                  options={encodingResetCycleOptions}
                  onChange={(resetCycle) => updateEncodingSegmentDraft({ resetCycle })}
                />
              </label>
            </>
          )}
          <label>
            <span>字段变化重算</span>
            <Checkbox
              checked={Boolean(encodingSegmentEditor.draft.regenerateOnChange)}
              onChange={(event) => updateEncodingSegmentDraft({ regenerateOnChange: event.target.checked })}
            />
          </label>
          <label>
            <span>生成后锁定</span>
            <Checkbox
              checked={encodingSegmentEditor.draft.lockAfterGenerated !== false}
              onChange={(event) => updateEncodingSegmentDraft({ lockAfterGenerated: event.target.checked })}
            />
          </label>
          <div className="encoding-segment-preview">
            <span>段示例</span>
            <strong>{renderEncodingSegmentSample(encodingSegmentEditor.draft, baseConfig.fields) || '-'}</strong>
          </div>
        </div>
      </Modal>

      <Modal
        centered
        className="view-filter-field-modal"
        okText="完成"
        onCancel={() => setFilterFieldPickerOpen(false)}
        onOk={() => setFilterFieldPickerOpen(false)}
        open={filterFieldPickerOpen}
        title="选择筛选字段"
        width={720}
      >
        <div className="view-filter-field-modal-note">勾选表单字段后，会自动出现在筛选区；取消勾选会从筛选区移除。</div>
        <Checkbox.Group
          className="view-filter-field-grid"
          value={sortedViewFilters.map((filter) => filter.fieldName)}
          onChange={(values) => syncViewFiltersByFields(values.map(String))}
        >
          {baseConfig.fields.map((field) => (
            <label className="view-filter-field-option" key={field.key}>
              <Checkbox value={field.key} />
              <span>
                <strong>{field.name}</strong>
                <small>{field.key} · {field.type}</small>
              </span>
            </label>
          ))}
        </Checkbox.Group>
      </Modal>

      <Modal
        centered
        className="view-filter-field-modal"
        okText="完成"
        onCancel={() => setTableFieldPickerOpen(false)}
        onOk={() => setTableFieldPickerOpen(false)}
        open={tableFieldPickerOpen}
        title="选择列表字段"
        width={720}
      >
        <div className="view-filter-field-modal-note">勾选表单字段后，会自动出现在数据列表区；取消勾选会从列表区移除。</div>
        <Checkbox.Group
          className="view-filter-field-grid"
          value={sortedViewColumns.map((column) => column.fieldName)}
          onChange={(values) => syncViewColumnsByFields(values.map(String))}
        >
          {baseConfig.fields.map((field) => (
            <label className="view-filter-field-option" key={field.key}>
              <Checkbox value={field.key} />
              <span>
                <strong>{field.name}</strong>
                <small>{field.key} · {field.type}</small>
              </span>
            </label>
          ))}
        </Checkbox.Group>
      </Modal>

      <Modal
        centered
        className="designer-preview-modal"
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        open={previewOpen}
        title="表单预览"
        width={980}
      >
        <div className="designer-preview-toolbar">
          <Segmented value={previewMode} onChange={(value) => setPreviewMode(value as PreviewMode)} options={previewModeOptions} />
          <Segmented value={previewDevice} onChange={(value) => setPreviewDevice(value as PreviewDevice)} options={previewDeviceOptions.map((item) => ({ value: item.value, label: <span>{item.icon}{item.label}</span> }))} />
          <Select
            className="designer-preview-node-select"
            value={selectedPreviewFlowNode?.id}
            onChange={setPreviewFlowNodeId}
            options={previewFlowNodeOptions}
            placeholder="选择流程节点"
          />
        </div>
        <div className="designer-role-note">{getPreviewNodeNote(selectedPreviewFlowNode)}</div>
        <div className={`designer-preview-shell designer-preview-${previewDevice}`}>
          <div className="designer-preview-surface">
            <div className="designer-preview-head">
              <strong>{baseConfig.createTitle}</strong>
              <Tag color="blue">{previewModeOptions.find((item) => item.value === previewMode)?.label}</Tag>
            </div>
            {renderPreviewContent()}
          </div>
        </div>
      </Modal>

      <Modal
        centered
        className="designer-check-modal"
        okText={publishErrorCount ? '处理阻断项' : '确认发布'}
        onCancel={() => setPublishCheckOpen(false)}
        onOk={confirmPublish}
        open={publishCheckOpen}
        confirmLoading={isPersistingFlow}
        title="发布确认"
      >
        <div className="designer-publish-note">
          发布时会执行当前业务表单配置的必要校验；不同业务可拥有不同规则，日常编辑不单独打扰。
        </div>
        <div className="designer-check-summary">
          <Tag color={publishErrorCount ? 'red' : 'success'}>{publishErrorCount} 个阻断项</Tag>
          <Tag color={publishWarningCount ? 'orange' : 'default'}>{publishWarningCount} 个提醒</Tag>
          <Tag color="blue">{combinedPublishChecks.filter((item) => item.level === 'suggestion').length} 个建议</Tag>
        </div>
        <div className="designer-check-list">
          {combinedPublishChecks.map((item) => (
            <div className={`designer-check-item designer-check-${item.level}`} key={item.title}>
              <span>{item.level === 'error' ? <AlertOutlined /> : item.level === 'warning' ? <WarningOutlined /> : <CheckCircleOutlined />}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        centered
        footer={null}
        onCancel={() => setVersionPanelOpen(false)}
        open={versionPanelOpen}
        title="草稿与已发布版本"
      >
        <div className="designer-version-panel">
          <div><span>已发布版本</span><strong>数据视图 v{viewConfigMeta.publishedVersion || 0}{viewConfigMeta.publishedAt ? ` · ${viewConfigMeta.publishedAt.slice(0, 10)}` : ''}</strong></div>
          <div><span>当前草稿</span><strong>{hasUnsavedChanges || viewConfigMeta.status === 'draft' ? `存在未发布修改 · 草稿 v${viewConfigMeta.draftVersion || 1}` : '无差异'}</strong></div>
          <div><span>变更摘要</span><strong>筛选条件、表格列、流程配置和业务发布规则</strong></div>
          <Space wrap>
            <Button onClick={saveDraft} loading={isPersistingFlow} icon={<SaveOutlined />}>保存草稿</Button>
            <Button danger onClick={() => { setHasUnsavedChanges(false); setVersionPanelOpen(false); message.success('已回滚到上一发布版本'); }}>回滚上一版</Button>
            <Button type="primary" onClick={() => { setVersionPanelOpen(false); void publishConfig(); }}>发布当前草稿</Button>
          </Space>
        </div>
      </Modal>

      <Modal
        centered
        className="designer-rule-modal"
        destroyOnClose
        okText="保存规则"
        onCancel={() => setRuleModal(null)}
        onOk={() => {
          message.success(`${activeRuleLabel}规则已保存`);
          setRuleModal(null);
        }}
        open={Boolean(activeRule)}
        title={`${activeRuleLabel}规则`}
      >
        {ruleModal && activeRule && (
          <div className="designer-rule-form">
            <label>
              <span>规则启用</span>
              <Segmented
                block
                value={activeRule.enabled ? 'enabled' : 'disabled'}
                onChange={(value) => updateSelectedControlRule(ruleModal.ruleKey, { enabled: value === 'enabled' })}
                options={[
                  { value: 'enabled', label: '启用' },
                  { value: 'disabled', label: '关闭' },
                ]}
              />
            </label>
            {activeRuleStrategyOptions.length > 0 && (
              <label>
                <span>规则策略</span>
                <Select
                  value={activeRule.conditions?.strategy || activeRuleStrategyOptions[0]?.value}
                  onChange={(value) => updateSelectedRuleCondition(ruleModal.ruleKey, { strategy: value })}
                  options={activeRuleStrategyOptions}
                />
              </label>
            )}
            {activeRuleStrategyOptions.length > 0 && (
              <label>
                <span>策略参数</span>
                <Input
                  allowClear
                  placeholder="例如：组合唯一字段、脱敏保留位数、导出审批说明"
                  value={activeRule.conditions?.parameter || ''}
                  onChange={(event) => updateSelectedRuleCondition(ruleModal.ruleKey, { parameter: event.target.value })}
                />
              </label>
            )}
            <label>
              <span>条件来源字段</span>
              <Select
                allowClear
                placeholder="不选则始终生效"
                value={activeRule.conditions?.sourceField}
                onChange={(value) => updateSelectedRuleCondition(ruleModal.ruleKey, { sourceField: value })}
                options={conditionFieldOptions}
              />
            </label>
            <label>
              <span>判断方式</span>
              <Select
                value={activeRule.conditions?.operator || 'equals'}
                onChange={(value) => updateSelectedRuleCondition(ruleModal.ruleKey, { operator: value })}
                options={ruleOperatorOptions}
              />
            </label>
            <label>
              <span>条件值</span>
              <Input
                placeholder="例如：严重、已提交、当前用户"
                value={activeRule.conditions?.value || ''}
                onChange={(event) => updateSelectedRuleCondition(ruleModal.ruleKey, { value: event.target.value })}
              />
            </label>
            <label>
              <span>说明文本</span>
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder="说明这条规则什么时候生效"
                value={activeRule.conditions?.note || ''}
                onChange={(event) => updateSelectedRuleCondition(ruleModal.ruleKey, { note: event.target.value })}
              />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
