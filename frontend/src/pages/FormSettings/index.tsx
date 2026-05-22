import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DragOutlined,
  FileImageOutlined,
  FileSearchOutlined,
  FormOutlined,
  HolderOutlined,
  LinkOutlined,
  LockOutlined,
  NumberOutlined,
  PaperClipOutlined,
  SaveOutlined,
  SearchOutlined,
  SelectOutlined,
  SettingOutlined,
  SwitcherOutlined,
  TableOutlined,
  TagsOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { Button, Input, Modal, Segmented, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import './style.css';

type DesignerTab = 'form' | 'filter' | 'flow' | 'permission';
type ComponentPanel = 'components' | 'fieldTypes';
type ControlSource = 'field' | 'component';
type ControlWidth = 'quarter' | 'half' | 'threeQuarter' | 'full';
type FlowPortSide = 'top' | 'right' | 'bottom' | 'left';
type DropPosition = 'before' | 'after';
type ControlRuleKey = 'visible' | 'readonly' | 'required';

interface ControlRuleCondition {
  sourceField?: string;
  operator?: string;
  value?: string;
  note?: string;
}

interface ControlRule {
  enabled: boolean;
  conditions?: ControlRuleCondition;
}

type ControlRules = Record<ControlRuleKey, ControlRule>;

interface DesignerField {
  key: string;
  name: string;
  type: string;
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

const controlWidthOptions = [
  { value: 'quarter', label: '25%' },
  { value: 'half', label: '50%' },
  { value: 'threeQuarter', label: '75%' },
  { value: 'full', label: '100%' },
];

const ruleLabels: Record<ControlRuleKey, string> = {
  visible: '显示',
  readonly: '只读',
  required: '必输',
};

const ruleOperatorOptions = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notEmpty', label: '不为空' },
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

function makeControlRules(required = false): ControlRules {
  return {
    visible: { enabled: true },
    readonly: { enabled: false },
    required: { enabled: required },
  };
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
      { key: 'riskNo', name: '风险单号', type: '文本 / 自动编号', placeholder: '自动生成 SR-2605-001', locked: true, required: true, listVisible: true, searchable: true, sortable: true, validation: '系统唯一编号，不允许重复' },
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
      { key: 'alertId', name: '告警编号', type: '文本 / 自动编号', placeholder: '自动生成 AL-2605-001', locked: true, required: true, listVisible: true, searchable: true, sortable: true, validation: '系统唯一编号，不允许重复' },
      { key: 'title', name: '告警标题', type: '文本输入', placeholder: '请输入告警标题', required: true, listVisible: true, searchable: true, validation: '2-80 个字符' },
      { key: 'device', name: '关联设备', type: '关联对象', placeholder: '选择设备', required: true, listVisible: true, searchable: true, optionSource: '设备台账' },
      { key: 'level', name: '告警等级', type: '下拉选择', placeholder: '严重 / 一般 / 提醒', required: true, listVisible: true, searchable: true, optionSource: '严重、一般、提醒' },
      { key: 'owner', name: '处理人', type: '人员选择', placeholder: '选择处理人', listVisible: true, searchable: true, optionSource: '组织人员' },
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
    { key: 'id', name: '编号', type: '文本 / 自动编号', placeholder: '自动生成编号', locked: true, required: true, listVisible: true, searchable: true, validation: '系统唯一编号' },
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

const versionOptions = [
  { value: 'v0.1', label: 'v0.1 当前草稿' },
  { value: 'v0.0', label: 'v0.0 已发布' },
  { value: 'history', label: '历史版本' },
];

const componentGroups: Array<{ category: string; items: ComponentDefinition[] }> = [
  {
    category: '文本类',
    items: [
      { key: 'text', category: '文本类', name: '文本控件', desc: '单行文本输入', icon: <FormOutlined />, controlType: 'text' },
      { key: 'textarea', category: '文本类', name: '多行文本', desc: '长文本、备注、说明录入', icon: <FormOutlined />, controlType: 'textarea', defaultWidth: 'full' },
      { key: 'readonly-text', category: '文本类', name: '只读文本', desc: '展示计算值、引用值', icon: <FileSearchOutlined />, controlType: 'readonly-text' },
    ],
  },
  {
    category: '选择类',
    items: [
      { key: 'number', category: '选择类', name: '数值控件', desc: '数量、金额、百分比', icon: <NumberOutlined />, controlType: 'number' },
      { key: 'select', category: '选择类', name: '选择控件', desc: '下拉、单选、多选', icon: <SelectOutlined />, controlType: 'select' },
      { key: 'datetime', category: '选择类', name: '日期控件', desc: '日期、时间、时间范围', icon: <CalendarOutlined />, controlType: 'datetime' },
      { key: 'relation', category: '选择类', name: '对象选择', desc: '人员、设备、供应商、物料', icon: <LinkOutlined />, controlType: 'relation' },
      { key: 'switch', category: '选择类', name: '开关控件', desc: '是否、启用、状态切换', icon: <SwitcherOutlined />, controlType: 'switch' },
      { key: 'upload', category: '选择类', name: '附件控件', desc: '图片、文件、凭证上传', icon: <PaperClipOutlined />, controlType: 'upload', defaultWidth: 'full' },
    ],
  },
  {
    category: '布局类',
    items: [
      { key: 'container', category: '布局类', name: '容器', desc: '分组面板、基础信息区', icon: <HolderOutlined />, controlType: 'container', defaultWidth: 'full' },
      { key: 'two-columns', category: '布局类', name: '多列布局', desc: '两列、三列、高密度字段排版', icon: <HolderOutlined />, controlType: 'two-columns', defaultWidth: 'full' },
      { key: 'tabs', category: '布局类', name: 'Tab 页', desc: '切换页签、次要信息收起', icon: <HolderOutlined />, controlType: 'tabs', defaultWidth: 'full' },
      { key: 'divider', category: '布局类', name: '分割符', desc: '分割线、区块说明', icon: <FileSearchOutlined />, controlType: 'divider', defaultWidth: 'full' },
    ],
  },
  {
    category: '数据类',
    items: [
      { key: 'editable-table', category: '数据类', name: '表格', desc: '可编辑子表、明细行', icon: <TableOutlined />, controlType: 'editable-table', defaultWidth: 'full' },
      { key: 'readonly-table', category: '数据类', name: '关联表格', desc: '只读关联表、分页详情', icon: <TableOutlined />, controlType: 'readonly-table', defaultWidth: 'full' },
      { key: 'summary-card', category: '数据类', name: '数据摘要', desc: '摘要卡、统计值、关联对象概览', icon: <DatabaseOutlined />, controlType: 'summary-card', defaultWidth: 'full' },
    ],
  },
  {
    category: '展示类',
    items: [
      { key: 'status-tag', category: '展示类', name: '状态标签', desc: '状态、等级、结果标识', icon: <TagsOutlined />, controlType: 'status-tag' },
      { key: 'file-preview', category: '展示类', name: '媒体预览', desc: '图片、附件、凭证预览', icon: <FileImageOutlined />, controlType: 'file-preview', defaultWidth: 'full' },
    ],
  },
  {
    category: '业务类',
    items: [
      { key: 'approval-comment', category: '业务类', name: '审批处理', desc: '审批意见、处理说明、签批记录', icon: <UserSwitchOutlined />, controlType: 'approval-comment', defaultWidth: 'full' },
      { key: 'operation-log', category: '业务类', name: '操作记录', desc: '操作日志、变更记录、审计轨迹', icon: <FileSearchOutlined />, controlType: 'operation-log', defaultWidth: 'full' },
      { key: 'status-flow', category: '业务类', name: '状态流转', desc: '流程状态、节点进度、关闭归档', icon: <UserSwitchOutlined />, controlType: 'status-flow', defaultWidth: 'full' },
      { key: 'risk-level', category: '业务类', name: '风险校验', desc: '风险等级、校验提示、异常规则', icon: <TagsOutlined />, controlType: 'risk-level' },
    ],
  },
];

const commonControlKeys = ['text', 'number', 'select', 'datetime', 'upload', 'container', 'editable-table', 'tabs', 'divider'];
const commonControls = commonControlKeys
  .map((key) => componentGroups.flatMap((group) => group.items).find((item) => item.key === key))
  .filter((item): item is ComponentDefinition => Boolean(item));

function fieldInput(field: DesignerField, placeholderOverride?: string, disabled = false) {
  const placeholder = placeholderOverride || field.placeholder;
  if (field.type.includes('下拉') || field.type.includes('人员') || field.type.includes('关联')) {
    return <Select disabled={disabled} placeholder={placeholder} options={[{ value: 'demo', label: placeholder }]} />;
  }
  if (field.type.includes('多行')) {
    return <Input.TextArea disabled={disabled} placeholder={placeholder} autoSize={{ minRows: 2, maxRows: 4 }} />;
  }
  return <Input disabled={disabled} placeholder={placeholder} />;
}

function makeFieldControl(field: DesignerField): LayoutControl {
  return {
    id: `field-${field.key}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source: 'field',
    controlType: 'field',
    name: field.name,
    fieldKey: field.key,
    placeholder: field.placeholder,
    helpText: '',
    width: field.type.includes('多行') ? 'full' : 'half',
    rules: makeControlRules(Boolean(field.required)),
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
    width: component.defaultWidth || 'half',
    rules: makeControlRules(),
  };
}

function cloneControl(control: LayoutControl): LayoutControl {
  return {
    ...control,
    id: `${control.id}-copy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: control.name,
    rules: {
      visible: { ...control.rules.visible, conditions: control.rules.visible.conditions ? { ...control.rules.visible.conditions } : undefined },
      readonly: { ...control.rules.readonly, conditions: control.rules.readonly.conditions ? { ...control.rules.readonly.conditions } : undefined },
      required: { ...control.rules.required, conditions: control.rules.required.conditions ? { ...control.rules.required.conditions } : undefined },
    },
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
        data-rule-action="config"
        size="small"
        icon={<SettingOutlined />}
        onMouseDownCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => runButtonAction(event, onConfig)}
        title={`${title}条件配置`}
      />
      <Button
        data-rule-action="toggle"
        className="designer-rule-check"
        size="small"
        type={enabled ? 'primary' : 'default'}
        icon={<CheckCircleOutlined />}
        onMouseDownCapture={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => runButtonAction(event, onToggle)}
        title={enabled ? `${title}已启用` : `${title}未启用`}
      />
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
  const [layoutControls, setLayoutControls] = useState<LayoutControl[]>(baseConfig.fields.map(makeFieldControl));
  const [selectedControlId, setSelectedControlId] = useState<string>('');
  const [selectedAssetKey, setSelectedAssetKey] = useState<string>(baseConfig.fields[0]?.key || '');
  const [propertyTab, setPropertyTab] = useState<'control' | 'field'>('control');
  const [copiedControl, setCopiedControl] = useState<LayoutControl | null>(null);
  const [history, setHistory] = useState<LayoutControl[][]>([]);
  const [draggedControlId, setDraggedControlId] = useState('');
  const [dropHint, setDropHint] = useState<{ controlId: string; position: DropPosition } | null>(null);
  const [isCanvasDragActive, setCanvasDragActive] = useState(false);
  const [ruleOverrides, setRuleOverrides] = useState<Record<string, boolean>>({});
  const [ruleModal, setRuleModal] = useState<{ controlId: string; ruleKey: ControlRuleKey } | null>(null);
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
    const nextControls = baseConfig.fields.map(makeFieldControl);
    setLayoutControls(nextControls);
    setSelectedControlId(nextControls[0]?.id || '');
    setSelectedAssetKey(baseConfig.fields[0]?.key || '');
    setVersion(baseConfig.version);
    setCopiedControl(null);
    setHistory([]);
    setDraggedControlId('');
    setDropHint(null);
    setCanvasDragActive(false);
    setRuleOverrides({});
    setRuleModal(null);
    const nextFlowNodes = makeFlowNodes(baseConfig.flowSteps);
    setFlowNodes(nextFlowNodes);
    setFlowConnections(makeFlowConnections(nextFlowNodes));
    setPendingFlowPort(null);
  }, [baseConfig.id, baseConfig.version, baseConfig.fields, baseConfig.flowSteps]);

  useEffect(() => {
    if (selectedControlId) {
      setPropertyTab('control');
      return;
    }
    if (selectedAssetKey) setPropertyTab('field');
  }, [selectedAssetKey, selectedControlId]);

  const selectedControl = useMemo(
    () => layoutControls.find((control) => control.id === selectedControlId),
    [layoutControls, selectedControlId],
  );
  const selectedField = useMemo(
    () => baseConfig.fields.find((field) => field.key === (selectedControl?.fieldKey || selectedAssetKey)),
    [baseConfig.fields, selectedAssetKey, selectedControl],
  );

  const updateSelectedControlRule = (ruleKey: ControlRuleKey, patch: Partial<ControlRule>) => {
    if (!selectedControl) return;
    const currentRule = selectedControl.rules[ruleKey];
    updateSelectedControl({
      rules: {
        ...selectedControl.rules,
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
        ...(selectedControl.rules[ruleKey].conditions || {}),
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
          message.info(`已进入「${title}」条件配置，可按字段、角色或流程状态设置规则`);
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
    const rule = selectedControl.rules[ruleKey];
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
      return next;
    });
  };

  const undoLayoutChange = () => {
    setHistory((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      setLayoutControls(previous);
      setSelectedControlId('');
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
  };

  const updateSelectedControl = (patch: Partial<LayoutControl>) => {
    if (!selectedControlId) return;
    commitLayoutChange((current) => current.map((control) => (
      control.id === selectedControlId ? { ...control, ...patch } : control
    )));
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
      return <Select disabled={disabled} placeholder={placeholder} options={[{ value: 'demo', label: placeholder }]} />;
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
    if (control.controlType === 'readonly-text') {
      return <Input disabled value="系统计算或引用值" />;
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
            {fieldInput(field, control.placeholder, control.rules.readonly.enabled)}
            {control.helpText && <small className="designer-control-help">{control.helpText}</small>}
          </label>
        </div>
      );
    }

    if (['text', 'textarea', 'number', 'select', 'relation', 'datetime', 'upload', 'switch', 'readonly-text'].includes(control.controlType)) {
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

  const renderFieldProperties = (field?: DesignerField) => {
    if (!field) {
      return <div className="designer-empty-props">当前控件未绑定字段，可在控件属性中选择绑定字段。</div>;
    }
    return (
      <div className="designer-props">
        <section className="designer-prop-section">
          <strong className="designer-prop-section-title">字段资产</strong>
          <label className="designer-prop-locked"><span>字段编码</span><Input value={field.key} disabled suffix="锁定" /></label>
          <label><span>字段名称</span><Input value={field.name} readOnly /></label>
          <label className="designer-prop-locked"><span>字段类型</span><Input value={field.type} disabled suffix="锁定" /></label>
          <label className={field.locked ? 'designer-prop-locked' : undefined}><span>字段状态</span><Input value={field.locked ? '锁定字段' : '可配置字段'} disabled={field.locked} readOnly suffix={field.locked ? '锁定' : undefined} /></label>
        </section>
        <section className="designer-prop-section">
          <strong className="designer-prop-section-title">数据与校验</strong>
          <label><span>是否必填</span>{genericRuleToggle(Boolean(field.required), '必填')}</label>
          <label><span>默认值</span><Input value={field.defaultValue || '无'} readOnly /></label>
          <label><span>校验规则</span><Input value={field.validation || '未配置'} readOnly /></label>
          <label><span>枚举/关联来源</span><Input value={field.optionSource || '无'} readOnly /></label>
        </section>
        <section className="designer-prop-section">
          <strong className="designer-prop-section-title">列表与检索</strong>
          <label><span>列表展示</span>{genericRuleToggle(Boolean(field.listVisible), '列表展示')}</label>
          <label><span>允许搜索</span>{genericRuleToggle(Boolean(field.searchable), '搜索')}</label>
          <label><span>允许排序</span>{genericRuleToggle(Boolean(field.sortable), '排序')}</label>
        </section>
      </div>
    );
  };

  const activeRule = ruleModal && selectedControl?.id === ruleModal.controlId
    ? selectedControl.rules[ruleModal.ruleKey]
    : null;
  const activeRuleLabel = ruleModal ? ruleLabels[ruleModal.ruleKey] : '';
  const conditionFieldOptions = baseConfig.fields.map((field) => ({ value: field.key, label: field.name }));

  return (
    <div className="form-designer-page">
      <header className="form-designer-toolbar">
        <div className="form-designer-title">
          <Typography.Title level={4}>{baseConfig.name}配置</Typography.Title>
          <span className="designer-title-meta">{baseConfig.status}</span>
          <Select className="form-version-select form-version-title-select" value={version} onChange={setVersion} options={versionOptions} />
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
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/program/${baseConfig.id}`)}>返回表单</Button>
          <Button icon={<SaveOutlined />}>保存草稿</Button>
          <Button type="primary" icon={<CheckCircleOutlined />}>保存配置</Button>
        </Space>
      </header>

      <section className={`form-designer-shell ${activeTab === 'permission' ? 'form-designer-shell-no-left' : ''}`}>
        {activeTab !== 'permission' && (
          <aside className="form-designer-left">
            <div className="designer-panel-head">
              <strong>{activeTab === 'flow' ? '节点' : '控件'}</strong>
              {activeTab !== 'form' && (
                <span>{activeTab === 'flow' ? '流程节点库' : tabs.find((item) => item.key === activeTab)?.label}</span>
              )}
            </div>

          {activeTab === 'form' ? (
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
              {componentPanel === 'components' ? (
                <div className="designer-component-library">
                  <section className="designer-component-group">
                    <div className="designer-group-title">常用控件</div>
                    <div className="designer-component-list">
                      {commonControls.map((item) => (
                        <div
                          className="designer-component"
                          draggable
                          key={item.key}
                          data-desc={item.desc}
                          onClick={() => addComponentToCanvas(item)}
                          onDragStart={(event) => event.dataTransfer.setData('componentKey', item.key)}
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
                  {componentGroups.map((group) => (
                    <details className="designer-component-group designer-component-collapse" key={group.category}>
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
                            onClick={() => addComponentToCanvas(item)}
                            onDragStart={(event) => event.dataTransfer.setData('componentKey', item.key)}
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
                    <strong>字段库</strong>
                    <span>{baseConfig.fields.length} 个</span>
                  </div>
                  <div className="designer-field-list">
                    {baseConfig.fields.map((field) => (
                      <div
                        className={`designer-field ${selectedAssetKey === field.key ? 'designer-field-active' : ''}`}
                        draggable
                        key={field.key}
                        onClick={() => {
                          setSelectedAssetKey(field.key);
                          setSelectedControlId('');
                        }}
                        onDragStart={(event) => event.dataTransfer.setData('fieldKey', field.key)}
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
          ) : activeTab === 'flow' ? (
            <div className="flow-node-library">
              <div className="designer-panel-head designer-panel-head-gap">
                <strong>流程节点</strong>
                <span>{flowNodePalette.length} 类</span>
              </div>
              <div className="flow-node-palette">
                {flowNodePalette.map((item) => (
                  <button className="flow-node-card" key={item.key} onClick={() => addFlowNode(item)} type="button">
                    <span className="flow-node-card-icon">{item.icon}</span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.desc}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
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

          {activeTab !== 'form' && activeTab !== 'flow' && (
            <>
              <div className="designer-panel-head designer-panel-head-gap">
                <strong>{activeTab === 'filter' ? '筛选字段' : '字段库'}</strong>
                <span>{(activeTab === 'filter' ? baseConfig.filters : baseConfig.fields).length} 个</span>
              </div>
              <div className="designer-field-list">
                {(activeTab === 'filter' ? baseConfig.filters : baseConfig.fields).map((field) => (
                  <div
                    className={`designer-field ${selectedAssetKey === field.key ? 'designer-field-active' : ''}`}
                    key={field.key}
                    onClick={() => {
                      setSelectedAssetKey(field.key);
                      setSelectedControlId('');
                    }}
                  >
                    <DragOutlined />
                    <span>{field.name}</span>
                    {field.locked && <Tag color="orange">锁定</Tag>}
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
        )}

        <main className="form-designer-canvas">
          {activeTab === 'form' && (
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
                  {isCanvasDragActive && draggedControlId && !dropHint && <div className="canvas-drop-end-indicator">拖到这里放在末尾</div>}
                </div>
                <div className="create-form-actions">
                  <Button>取消</Button>
                  <Button type="primary">提交</Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'filter' && (
            <div className="canvas-board create-form-canvas">
              <div className="create-form-modal">
                <div className="create-form-modal-head">
                  <strong>{baseConfig.name}数据筛选</strong>
                  <span>配置运行页面上方的数据查询条件。</span>
                </div>
                <div className="create-form-grid">
                  {baseConfig.filters.map((field) => (
                    <label key={field.key}>
                      <span>{field.name}</span>
                      {fieldInput(field)}
                    </label>
                  ))}
                </div>
                <div className="create-form-actions">
                  <Button>重置</Button>
                  <Button type="primary">查询</Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'flow' && (
            <div
              className="canvas-board flow-canvas"
              onPointerMove={moveFlowNode}
              onPointerUp={stopFlowNodeDrag}
              onPointerLeave={stopFlowNodeDrag}
              ref={flowCanvasRef}
            >
              <div className="flow-canvas-guide">
                <strong>流程节点画布</strong>
                <span>从开始节点向下流转，拖拽节点可调整位置。</span>
              </div>
              <svg className="flow-connector-layer" aria-hidden="true">
                <defs>
                  <marker id="flow-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                    <path d="M 0 0 L 8 4 L 0 8 z" />
                  </marker>
                </defs>
                {flowConnections.map((connection) => {
                  const from = flowNodes.find((node) => node.id === connection.fromId);
                  const to = flowNodes.find((node) => node.id === connection.toId);
                  if (!from || !to) return null;
                  return (
                    <path
                      d={getFlowConnectorPath(from, connection.fromSide, to, connection.toSide)}
                      key={connection.id}
                    />
                  );
                })}
              </svg>
              {flowNodes.map((node, index) => (
                <div
                  className={`flow-designer-node flow-designer-node-${node.role}`}
                  key={node.id}
                  onPointerDown={(event) => startFlowNodeDrag(event, node)}
                  style={{ left: node.x, top: node.y }}
                >
                  <span className="flow-node-index">{index + 1}</span>
                  <div>
                    <strong>{node.label}</strong>
                    <small>{node.role === 'start' ? '开始节点' : node.role === 'end' ? '结束归档' : '处理节点'}</small>
                  </div>
                  {getFlowNodePorts(node).map((side) => (
                    <button
                      aria-label={`${node.label}-${side}-port`}
                      className={`flow-port flow-port-${side} ${pendingFlowPort?.nodeId === node.id && pendingFlowPort.side === side ? 'flow-port-active' : ''}`}
                      key={side}
                      onClick={(event) => handleFlowPortClick(event, node, side)}
                      title={`${node.label} ${side} 连接点`}
                      type="button"
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'permission' && (
            <div className="canvas-board permission-canvas">
              <div className="permission-overview">
                <div>
                  <strong>权限设计</strong>
                  <span>按角色配置动作权限、数据范围和字段级控制。</span>
                </div>
                <Tag color="blue">{baseConfig.name}</Tag>
              </div>
              <div className="permission-workbench">
                <aside className="permission-role-rail">
                  <div className="permission-section-title">角色</div>
                  {baseConfig.roles.map((role, index) => (
                    <button className={`permission-role-card ${index === 0 ? 'permission-role-active' : ''}`} key={role} type="button">
                      <span className="permission-role-icon"><UserSwitchOutlined /></span>
                      <span>
                        <strong>{role}</strong>
                        <small>{index === 0 ? '当前选中' : '可切换配置'}</small>
                      </span>
                    </button>
                  ))}
                </aside>
                <div className="permission-main">
                  <section className="permission-card">
                    <div className="permission-section-title">动作权限</div>
                    <div className="permission-action-grid">
                      {[
                        ['查看', true, '基础访问'],
                        ['新增', true, '创建记录'],
                        ['编辑', true, '修改记录'],
                        ['删除', false, '高风险动作'],
                        ['导入', true, '批量写入'],
                        ['导出', true, '数据外发'],
                        ['设置', false, '配置入口'],
                        ['审批', true, '流程处理'],
                      ].map(([name, enabled, desc]) => (
                        <div className={`permission-action ${enabled ? 'permission-action-on' : 'permission-action-off'}`} key={name as string}>
                          <span>{name}</span>
                          <small>{desc}</small>
                          <CheckCircleOutlined />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="permission-card permission-scope-card">
                    <div className="permission-section-title">数据范围</div>
                    <div className="permission-scope-grid">
                      <div><span>范围模式</span><strong>本部门 + 个人创建</strong></div>
                      <div><span>数据条件</span><strong>所属设备组 / 处理人</strong></div>
                      <div><span>敏感数据</span><strong>脱敏显示</strong></div>
                    </div>
                  </section>

                  <section className="permission-card">
                    <div className="permission-section-title">字段权限</div>
                    <div className="permission-field-matrix">
                      <div className="permission-field-head">
                        <span>字段</span><span>可见</span><span>可编辑</span><span>必填</span>
                      </div>
                      {baseConfig.fields.map((field, index) => (
                        <div className="permission-field-row" key={field.key}>
                          <span>{field.name}</span>
                          <Tag color="green">可见</Tag>
                          <Tag color={field.locked ? 'default' : 'blue'}>{field.locked ? '锁定' : index < 2 ? '可编辑' : '只读'}</Tag>
                          <Tag color={field.required ? 'orange' : 'default'}>{field.required ? '必填' : '可选'}</Tag>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </main>

        {activeTab !== 'permission' && (
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
            <Tabs
              className="designer-prop-tabs"
              size="small"
              activeKey={propertyTab}
              onChange={(key) => setPropertyTab(key as 'control' | 'field')}
              items={[
                {
                  key: 'control',
                  label: '控件属性',
                  children: (
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
                          <label className="designer-prop-locked"><span>控件类型</span><Input value={selectedControl.controlType} disabled /></label>
                          <label className="designer-prop-locked">
                            <span>字段来源</span>
                            <Input value={selectedField ? selectedField.name : '未绑定字段'} disabled />
                          </label>
                        </section>
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
                          <strong className="designer-prop-section-title">交互规则</strong>
                          <label><span>显示</span>{controlRuleToggle('visible')}</label>
                          <label><span>只读</span>{controlRuleToggle('readonly')}</label>
                          <label><span>必输</span>{controlRuleToggle('required')}</label>
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
                        <label><span>权限覆盖</span><Input value="跟随表单权限" readOnly /></label>
                      </section>
                      {renderTableProperties()}
                    </div>
                  ),
                },
                {
                  key: 'field',
                  label: '字段属性',
                  children: renderFieldProperties(selectedField),
                },
              ]}
            />
          ) : selectedField ? (
            <Tabs className="designer-prop-tabs" size="small" items={[{ key: 'field', label: '字段属性', children: renderFieldProperties(selectedField) }]} />
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
              </section>
            </div>
          )}
        </aside>
        )}
      </section>

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
