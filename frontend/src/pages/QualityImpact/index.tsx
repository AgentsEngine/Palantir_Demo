import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  FileProtectOutlined,
  NodeIndexOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  createCapa,
  executeQualityEventAction,
  getBusinessImpactAnalysis,
  getGraphStats,
  getQualityEventAiSuggestion,
  getQualityEventImpact,
  getRelatedKnowledgeCards,
  listQualityEvents,
} from '@/services/api';

type RiskLevel = 'critical' | 'major' | 'medium' | 'low' | string;

interface QualityEvent {
  id: string;
  title: string;
  severity: RiskLevel;
  status: string;
  source: string;
  occurred_at: string;
  description: string;
  risk_score: number;
  affected: Record<string, number>;
  recommended_actions: string[];
}

interface ImpactNode {
  id: string;
  label: string;
  type: string;
  name: string;
  status: string;
  risk: RiskLevel;
  summary: string;
  actions: string[];
  source_id?: string;
  source_system?: string;
}

interface ImpactEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  relation_type?: string;
}

interface GraphStats {
  total_nodes: number;
  total_relationships: number;
  nodes_by_label?: Array<{ label: string; count: number }>;
  rels_by_type?: Array<{ rel_type: string; count: number }>;
  relationships_by_type?: Array<{ rel_type: string; count: number }>;
}

interface AiSuggestion {
  summary: string;
  evidence: string[];
  recommended_actions: Array<{ action: string; priority: string; owner: string; reason: string }>;
}

interface KnowledgeEvidence {
  id: string;
  title: string;
  status: string;
  space_name?: string;
  scenario: string;
  guidance: string[];
  evidence_refs: Array<{ source_ref: string; document_title?: string; source_name?: string }>;
  linked_objects: Array<{ type: string; id: string; name: string }>;
}

interface GraphContext {
  objectType: string;
  objectId: string;
  title: string;
}

interface GraphPayload {
  event?: QualityEvent;
  root?: Record<string, unknown>;
  nodes?: Array<Record<string, unknown>>;
  edges?: Array<Record<string, unknown>>;
  source?: string;
}

interface PositionedImpactNode extends ImpactNode {
  x: number;
  y: number;
  layoutRole: 'root' | 'neighbor' | 'outer';
}

interface PositionedImpactEdge extends ImpactEdge {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  labelX: number;
  labelY: number;
}

interface NodePosition {
  x: number;
  y: number;
}

const fallbackEvent: QualityEvent = {
  id: 'QE-20260521-001',
  title: '电控模块焊点虚焊异常',
  severity: 'critical',
  status: 'open',
  source: '制程检验 / AOI',
  occurred_at: '2026-05-21T09:40:00',
  description: 'AOI 连续发现电控模块 V2 批次焊点虚焊，缺陷率达到 6.8%，超过 2.0% 管控线。',
  risk_score: 92,
  affected: { orders: 3, work_orders: 5, material_batches: 2, suppliers: 1, customers: 2 },
  recommended_actions: ['生成 CAPA', '冻结批次', '发起复检', '通知采购'],
};

const fallbackNodes: ImpactNode[] = [
  { id: 'event-qe-001', label: '质量异常', type: 'QualityEvent', name: 'QE-20260521-001', status: 'open', risk: 'critical', summary: '电控模块 V2 批次焊点虚焊缺陷率 6.8%。', actions: ['AI 分析影响', '生成 CAPA', '通知相关角色'] },
  { id: 'defect-001', label: '缺陷', type: 'Defect', name: '焊点虚焊', status: 'confirmed', risk: 'critical', summary: 'AOI 与人工复核均确认虚焊，主要集中在 BGA 区域。', actions: ['查看缺陷明细', '发起复检'] },
  { id: 'inspection-iqc-088', label: '检验批次', type: 'InspectionBatch', name: 'IPQC-260521-088', status: 'failed', risk: 'critical', summary: '抽检 120 件，发现 8 件虚焊。', actions: ['复检批次', '导出检验记录'] },
  { id: 'material-batch-mb-7781', label: '物料批次', type: 'MaterialBatch', name: 'MB-7781 / 焊锡膏 S12', status: 'hold', risk: 'major', summary: '同批次焊锡膏用于 5 个工单，建议先冻结待判定库存。', actions: ['冻结批次', '查看库存'] },
  { id: 'supplier-s-023', label: '供应商', type: 'Supplier', name: '北辰电子材料', status: 'watch', risk: 'major', summary: '近期交付批次质量波动，过去 30 天已有 2 次异常。', actions: ['通知采购', '发起供应商复核'] },
  { id: 'workorder-260521-017', label: '工单', type: 'WorkOrder', name: 'WO-260521-017', status: 'in_progress', risk: 'major', summary: '装配 A 线工单，已生产 860 件，待隔离 240 件。', actions: ['暂停工单', '调整排产'] },
  { id: 'equipment-smt-03', label: '设备', type: 'Equipment', name: 'SMT-03 回流焊', status: 'running', risk: 'medium', summary: '温区 5 曲线有轻微偏移，需要设备工程师复核。', actions: ['创建维修工单', '查看传感器趋势'] },
  { id: 'order-so-8821', label: '客户订单', type: 'CustomerOrder', name: 'SO-8821 / 华东客户', status: 'at_risk', risk: 'major', summary: '预计影响 5 月 23 日交付，需确认替代批次。', actions: ['通知销售', '查看交付承诺'] },
  { id: 'capa-072', label: 'CAPA', type: 'CAPA', name: 'CAPA-072', status: 'draft', risk: 'medium', summary: '建议由质量工程师牵头，设备、工艺、采购协同处理。', actions: ['提交审批', '补充原因分析'] },
];

const fallbackEdges: ImpactEdge[] = [
  { id: 'r1', source: 'event-qe-001', target: 'defect-001', label: '发现' },
  { id: 'r2', source: 'defect-001', target: 'inspection-iqc-088', label: '属于' },
  { id: 'r3', source: 'inspection-iqc-088', target: 'material-batch-mb-7781', label: '检验' },
  { id: 'r4', source: 'material-batch-mb-7781', target: 'supplier-s-023', label: '来自' },
  { id: 'r5', source: 'material-batch-mb-7781', target: 'workorder-260521-017', label: '用于' },
  { id: 'r6', source: 'workorder-260521-017', target: 'equipment-smt-03', label: '经过' },
  { id: 'r7', source: 'workorder-260521-017', target: 'order-so-8821', label: '影响' },
  { id: 'r8', source: 'event-qe-001', target: 'capa-072', label: '建议生成' },
];

const fallbackKnowledgeCards: KnowledgeEvidence[] = [
  {
    id: 'card-solder-void',
    title: '焊点虚焊处理策略',
    status: 'published',
    space_name: '质量部门知识库',
    scenario: 'AOI 连续发现 BGA 区域焊点虚焊，缺陷率超过管控线。',
    guidance: ['冻结同批次物料和在制品', '发起 BGA 区域复检', '检查回流炉温区曲线'],
    evidence_refs: [
      { source_ref: 'SOP-QA-014 / 3.2-4.1', document_title: '焊点虚焊复检与冻结流程' },
      { source_ref: 'CAPA-072 / Root Cause', document_title: '电控模块 V2 虚焊历史处置' },
    ],
    linked_objects: [
      { type: 'Defect', id: 'defect-001', name: '焊点虚焊' },
      { type: 'MaterialBatch', id: 'material-batch-mb-7781', name: 'MB-7781 / 焊锡膏 S12' },
    ],
  },
  {
    id: 'card-supplier-risk',
    title: '供应商批次风险判断',
    status: 'published',
    space_name: '质量部门知识库',
    scenario: '供应商报告、来料记录或批次追溯显示温控、运输或仓储证据缺口。',
    guidance: ['隔离同批次风险物料', '通知采购和 SQE 补充 8D', '提高后续来料抽检比例'],
    evidence_refs: [
      { source_ref: '北辰电子材料 5 月来料整改报告', document_title: '供应商整改报告' },
    ],
    linked_objects: [
      { type: 'Supplier', id: 'supplier-s-023', name: '北辰电子材料' },
      { type: 'MaterialBatch', id: 'material-batch-mb-7781', name: 'MB-7781 / 焊锡膏 S12' },
    ],
  },
];

const actionConfig = [
  { key: 'generate_capa', label: '生成 CAPA', icon: <FileProtectOutlined />, danger: false },
  { key: 'freeze_batch', label: '冻结批次', icon: <PauseCircleOutlined />, danger: true },
  { key: 'reinspect', label: '发起复检', icon: <CheckCircleOutlined />, danger: false },
  { key: 'maintenance_order', label: '创建维修工单', icon: <ToolOutlined />, danger: false },
  { key: 'notify_purchase', label: '通知采购', icon: <SendOutlined />, danger: false },
];

const riskColor: Record<string, string> = {
  critical: 'red',
  major: 'orange',
  medium: 'gold',
  low: 'green',
};

const typeIcon: Record<string, JSX.Element> = {
  QualityEvent: <WarningOutlined />,
  Defect: <SafetyCertificateOutlined />,
  InspectionBatch: <CheckCircleOutlined />,
  Inspection: <CheckCircleOutlined />,
  MaterialBatch: <ApiOutlined />,
  Material: <ApiOutlined />,
  Supplier: <ShareAltOutlined />,
  WorkOrder: <ControlOutlined />,
  Equipment: <ToolOutlined />,
  CustomerOrder: <SendOutlined />,
  SalesOrder: <SendOutlined />,
  CAPA: <FileProtectOutlined />,
  KnowledgeCard: <FileProtectOutlined />,
  Operation: <ControlOutlined />,
  ProductBatch: <ApiOutlined />,
  InventoryLot: <PauseCircleOutlined />,
};

const objectTypeLabel: Record<string, string> = {
  QualityEvent: '质量异常',
  Defect: '缺陷',
  InspectionBatch: '检验批次',
  MaterialBatch: '物料批次',
  Supplier: '供应商',
  WorkOrder: '工单',
  Equipment: '设备',
  CustomerOrder: '客户订单',
  CAPA: 'CAPA',
  Operation: '工序',
  ProductBatch: '产品批次',
  InventoryLot: '库存批次',
  Material: '物料',
  Inspection: '检验批次',
  SalesOrder: '客户订单',
};

const relationLabel: Record<string, string> = {
  HAS_DEFECT: '发现',
  FOUND_IN: '发现于',
  INSPECTS: '检验',
  SUPPLIED_BY: '供应',
  USES_BATCH: '使用',
  USES_EQUIPMENT: '经过',
  AFFECTS_ORDER: '影响',
  TRIGGERS: '触发',
  EVIDENCE_FOR: '证据',
  RUNS_OPERATION: '工序',
  PRODUCES_BATCH: '产出',
  STORED_AS: '库存',
  REINSPECTS: '复检',
  MAY_CAUSE: '可能导致',
};

const typeStage: Record<string, number> = {
  Supplier: 14,
  Material: 28,
  MaterialBatch: 28,
  Inspection: 42,
  InspectionBatch: 42,
  Defect: 50,
  QualityEvent: 50,
  CAPA: 58,
  Equipment: 64,
  WorkOrder: 70,
  CustomerOrder: 86,
  SalesOrder: 86,
  KnowledgeItem: 90,
  ProductBatch: 78,
  InventoryLot: 36,
  Operation: 60,
};

function overflowNodeStyle(index: number): CSSProperties {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    left: `${18 + col * 20}%`,
    top: `${84 + row * 8}%`,
    transform: 'translate(-50%, -50%)',
  };
}

function nodePositionStyle(node: PositionedImpactNode, index: number): CSSProperties {
  if (node.x > 0 && node.y > 0) {
    return {
      left: `${node.x}%`,
      top: `${node.y}%`,
      transform: 'translate(-50%, -50%)',
    };
  }
  return overflowNodeStyle(index);
}

function getTypeStage(type: string) {
  return typeStage[type] ?? 50;
}

function clampPosition(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getEdgeDirection(edge: ImpactEdge, selectedId: string, nodeById: Map<string, ImpactNode>, view: GraphViewKey) {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  const sourceStage = getTypeStage(source?.type || '');
  const targetStage = getTypeStage(target?.type || '');

  if (view === 'trace') {
    if (edge.target === selectedId) return 'left';
    if (edge.source === selectedId) return 'right';
  }

  if (edge.source === selectedId) return targetStage >= sourceStage ? 'right' : 'left';
  if (edge.target === selectedId) return sourceStage <= targetStage ? 'left' : 'right';
  return targetStage >= sourceStage ? 'right' : 'left';
}

function buildGraphLayout(
  graphNodes: ImpactNode[],
  graphEdges: ImpactEdge[],
  selectedId: string | undefined,
  view: GraphViewKey,
  positionOverrides: Record<string, NodePosition> = {},
) {
  if (!graphNodes.length) {
    return { layoutNodes: [], layoutEdges: [] };
  }

  const rootId = selectedId && graphNodes.some((node) => node.id === selectedId)
    ? selectedId
    : graphNodes[0].id;
  const nodeById = new Map(graphNodes.map((node) => [node.id, node]));
  const neighborIds = new Set<string>();
  graphEdges.forEach((edge) => {
    if (edge.source === rootId && nodeById.has(edge.target)) neighborIds.add(edge.target);
    if (edge.target === rootId && nodeById.has(edge.source)) neighborIds.add(edge.source);
  });

  const leftNodes: ImpactNode[] = [];
  const rightNodes: ImpactNode[] = [];
  const sameStageNodes: ImpactNode[] = [];
  const outerNodes: ImpactNode[] = [];

  graphNodes.forEach((node) => {
    if (node.id === rootId) return;
    if (!neighborIds.has(node.id)) {
      outerNodes.push(node);
      return;
    }

    const directEdge = graphEdges.find((edge) => (
      (edge.source === rootId && edge.target === node.id) ||
      (edge.target === rootId && edge.source === node.id)
    ));
    const direction = directEdge ? getEdgeDirection(directEdge, rootId, nodeById, view) : 'right';
    const stageDiff = getTypeStage(node.type) - getTypeStage(nodeById.get(rootId)?.type || '');
    if (Math.abs(stageDiff) < 6) {
      sameStageNodes.push(node);
    } else if (direction === 'left') {
      leftNodes.push(node);
    } else {
      rightNodes.push(node);
    }
  });

  const positioned = new Map<string, PositionedImpactNode>();
  const root = nodeById.get(rootId) || graphNodes[0];
  positioned.set(root.id, { ...root, x: 50, y: 50, layoutRole: 'root' });

  const spread = (items: ImpactNode[], x: number, role: PositionedImpactNode['layoutRole']) => {
    const start = items.length <= 2 ? 42 : 30;
    const end = items.length <= 2 ? 58 : 70;
    items.forEach((node, index) => {
      const y = items.length === 1 ? 50 : start + ((end - start) * index) / (items.length - 1);
      positioned.set(node.id, { ...node, x, y, layoutRole: role });
    });
  };

  spread(leftNodes, 30, 'neighbor');
  spread(rightNodes, 70, 'neighbor');
  sameStageNodes.forEach((node, index) => {
    positioned.set(node.id, {
      ...node,
      x: index % 2 === 0 ? 50 : 58,
      y: index < 2 ? 30 : 72,
      layoutRole: 'neighbor',
    });
  });

  outerNodes.forEach((node, index) => {
    const fallback = overflowNodeStyle(index);
    const stage = getTypeStage(node.type);
    const x = Math.max(14, Math.min(86, stage));
    const y = index % 2 === 0 ? 20 + (index % 4) * 12 : 78 - (index % 4) * 10;
    positioned.set(node.id, {
      ...node,
      x: Number.isFinite(x) ? x : parseFloat(String(fallback.left)) || 50,
      y,
      layoutRole: 'outer',
    });
  });

  Object.entries(positionOverrides).forEach(([nodeId, position]) => {
    const node = positioned.get(nodeId);
    if (!node) return;
    positioned.set(nodeId, {
      ...node,
      x: clampPosition(position.x, 8, 92),
      y: clampPosition(position.y, 14, 86),
    });
  });

  const layoutNodes = graphNodes
    .map((node) => positioned.get(node.id))
    .filter(Boolean) as PositionedImpactNode[];
  const layoutEdges = graphEdges
    .map((edge) => {
      const source = positioned.get(edge.source);
      const target = positioned.get(edge.target);
      if (!source || !target) return null;
      return {
        ...edge,
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        labelX: (source.x + target.x) / 2,
        labelY: (source.y + target.y) / 2,
      };
    })
    .filter(Boolean) as PositionedImpactEdge[];

  return { layoutNodes, layoutEdges };
}

function normalizeRisk(level: RiskLevel) {
  return riskColor[level] || 'blue';
}

function pickNodeId(node: Record<string, unknown>, index = 0) {
  return String(node.id || node.object_id || node.source_id || node.name || `graph-node-${index}`);
}

function normalizeGraphNode(node: Record<string, unknown>, index: number): ImpactNode {
  const labels = Array.isArray(node.labels) ? node.labels as string[] : [];
  const type = String(node.type || labels[0] || 'Object');
  const name = String(node.name || node.source_id || node.id || type);
  return {
    id: pickNodeId(node, index),
    label: String(node.label || objectTypeLabel[type] || type),
    type,
    name,
    status: String(node.status || 'unknown'),
    risk: String(node.risk || node.severity || 'medium'),
    summary: String(node.summary || node.description || `${objectTypeLabel[type] || type}：${name}`),
    actions: Array.isArray(node.actions) ? node.actions as string[] : ['查看关系', '展开影响'],
    source_id: typeof node.source_id === 'string' ? node.source_id : undefined,
    source_system: typeof node.source_system === 'string' ? node.source_system : undefined,
  };
}

function normalizeGraphEdge(edge: Record<string, unknown>, index: number): ImpactEdge {
  const relType = String(edge.relation_type || edge.type || edge.label || 'RELATED');
  return {
    id: String(edge.id || `graph-edge-${index}`),
    source: String(edge.source || ''),
    target: String(edge.target || ''),
    label: String(edge.label || relationLabel[relType] || relType),
    relation_type: relType,
  };
}

function normalizeGraphPayload(payload: GraphPayload) {
  const nextNodes = (payload.nodes || []).map((node, index) => normalizeGraphNode(node, index));
  const validNodeIds = new Set(nextNodes.map((node) => node.id));
  const nextEdges = (payload.edges || [])
    .map((edge, index) => normalizeGraphEdge(edge, index))
    .filter((edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target));

  return {
    event: payload.event,
    nodes: nextNodes.length ? nextNodes : fallbackNodes,
    edges: nextEdges.length ? nextEdges : fallbackEdges,
    source: payload.source || 'graph-api',
  };
}

function normalizeMatchValue(value?: string) {
  return (value || '').toLowerCase().replace(/\s+/g, '');
}

const objectTypeAliases: Record<string, string[]> = {
  MaterialBatch: ['Material'],
  InspectionBatch: ['Inspection'],
  CustomerOrder: ['SalesOrder'],
  QualityEvent: ['Defect', 'Inspection'],
};

function pickSelectedNodeIdForContext(nextNodes: ImpactNode[], context: GraphContext) {
  const targetTypes = [context.objectType, ...(objectTypeAliases[context.objectType] || [])]
    .map((item) => normalizeMatchValue(item));
  const targetId = normalizeMatchValue(context.objectId);
  const targetTitle = normalizeMatchValue(context.title);

  const matched = nextNodes.find((node) => {
    const nodeType = normalizeMatchValue(node.type);
    const nodeId = normalizeMatchValue(node.id);
    const sourceId = normalizeMatchValue(node.source_id);
    const name = normalizeMatchValue(node.name);

    return (
      (targetTypes.includes(nodeType) || !targetTypes.length) &&
      (
        nodeId === targetId ||
        sourceId === targetId ||
        name === targetId ||
        name === targetTitle ||
        nodeId.includes(targetId) ||
        targetId.includes(nodeId)
      )
    );
  });

  return matched?.id || nextNodes[0]?.id || fallbackNodes[0].id;
}

function decorateNodesForContext(nextNodes: ImpactNode[], context: GraphContext, eventData?: QualityEvent) {
  if (context.objectType !== 'QualityEvent' || !eventData) {
    return nextNodes;
  }

  let updatedRoot = false;
  return nextNodes.map((node) => {
    if (updatedRoot || node.type !== 'QualityEvent') {
      return node;
    }
    updatedRoot = true;
    return {
      ...node,
      name: eventData.id,
      status: eventData.status,
      risk: eventData.severity,
      summary: eventData.description,
      source_id: eventData.id,
    };
  });
}

const partFilters = ['全部', '焊锡膏', '电控模块', '待判定'];

const objectQuickEntries = [
  { objectType: 'MaterialBatch', objectId: 'MB-7781 / 焊锡膏 S12', title: 'MB-7781 / 焊锡膏 S12', hint: '供应商 / 检验 / 库存 / 工单' },
  { objectType: 'InventoryLot', objectId: 'INV-7781-A / 待判定库存', title: 'INV-7781-A / 待判定库存', hint: '物料批次 / 冻结状态 / 复检' },
  { objectType: 'ProductBatch', objectId: 'PB-260521-A / 电控模块 V2', title: 'PB-260521-A / 电控模块 V2', hint: '工单 / 工序 / 订单 / 异常' },
];

const graphViewOptions = [
  {
    key: 'impact',
    label: '影响',
    desc: '从当前对象看下游影响',
  },
  {
    key: 'trace',
    label: '追溯',
    desc: '向上追溯来源批次',
  },
  {
    key: 'task',
    label: '任务',
    desc: '查看处置任务链路',
  },
  {
    key: 'part',
    label: '料号',
    desc: '按物料/料号展开关系',
  },
] as const;

type GraphViewKey = typeof graphViewOptions[number]['key'];

const closureTimeline = [
  {
    time: '09:40',
    offset: 8,
    width: 18,
    title: '异常发现',
    actor: 'AOI / SPC 规则',
    status: '已完成',
    desc: '电控模块 V2 批次连续出现焊点虚焊，缺陷率超过管控线。',
    color: 'red',
  },
  {
    time: '09:43',
    offset: 30,
    width: 24,
    title: '影响分析',
    actor: '质量经理',
    status: '进行中',
    desc: '图谱已关联检验批次、物料批次、供应商、工单和客户订单。',
    color: 'blue',
  },
  {
    time: '09:47',
    offset: 58,
    width: 22,
    title: 'AI 建议生成',
    actor: 'AIP 辅助层',
    status: '待确认',
    desc: '建议先冻结风险批次，再生成 CAPA，并通知采购确认供应商波动。',
    color: 'gray',
  },
  {
    time: '待办',
    offset: 83,
    width: 12,
    title: 'CAPA / 复检执行',
    actor: '质量工程师',
    status: '未开始',
    desc: '等待质量经理确认动作后进入工作流审批和执行闭环。',
    color: 'gray',
  },
];

export default function QualityImpactWorkbench() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ nodeId: string; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [events, setEvents] = useState<QualityEvent[]>([fallbackEvent]);
  const [event, setEvent] = useState<QualityEvent>(fallbackEvent);
  const [nodes, setNodes] = useState<ImpactNode[]>(fallbackNodes);
  const [edges, setEdges] = useState<ImpactEdge[]>(fallbackEdges);
  const [selectedNodeId, setSelectedNodeId] = useState(fallbackNodes[0].id);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [knowledgeEvidence, setKnowledgeEvidence] = useState<KnowledgeEvidence[]>([]);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [graphSource, setGraphSource] = useState('quality-fallback');
  const [graphView, setGraphView] = useState<GraphViewKey>('impact');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodePositionOverrides, setNodePositionOverrides] = useState<Record<string, NodePosition>>({});
  const [graphContext, setGraphContext] = useState<GraphContext>({
    objectType: 'QualityEvent',
    objectId: fallbackEvent.id,
    title: fallbackEvent.title,
  });

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || nodes[0],
    [nodes, selectedNodeId],
  );

  const visibleEdges = useMemo(
    () => edges.filter((edge) => edge.source === selectedNode?.id || edge.target === selectedNode?.id),
    [edges, selectedNode],
  );

  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>();
    visibleEdges.forEach((edge) => {
      connected.add(edge.source);
      connected.add(edge.target);
    });
    return connected;
  }, [visibleEdges]);

  const canvasNodes = useMemo(() => {
    if (!selectedNode) {
      return nodes;
    }
    const selected = nodes.filter((node) => node.id === selectedNode.id);
    const connected = nodes.filter((node) => node.id !== selectedNode.id && connectedNodeIds.has(node.id));
    const remaining = nodes.filter((node) => node.id !== selectedNode.id && !connectedNodeIds.has(node.id));
    return [...selected, ...connected, ...remaining];
  }, [connectedNodeIds, nodes, selectedNode]);

  const canvasEdges = useMemo(
    () => (visibleEdges.length ? visibleEdges : edges.slice(0, 6)),
    [edges, visibleEdges],
  );

  const { layoutNodes, layoutEdges } = useMemo(
    () => buildGraphLayout(canvasNodes, canvasEdges, selectedNode?.id, graphView, nodePositionOverrides),
    [canvasEdges, canvasNodes, graphView, nodePositionOverrides, selectedNode?.id],
  );

  const activeGraphView = graphViewOptions.find((item) => item.key === graphView) || graphViewOptions[0];

  const contextualTimeline = useMemo(() => {
    if (graphContext.objectType === 'QualityEvent') {
      return closureTimeline;
    }

    const sourceLabel = graphSource.includes('fallback') ? '演示子图' : 'Neo4j 子图';
    return [
      {
        time: '当前',
        offset: 8,
        width: 18,
        title: '对象选中',
        actor: graphContext.title,
        status: '已切换',
        desc: `左侧已切换到 ${graphContext.objectType}，右侧展示该对象详情。`,
        color: 'blue',
      },
      {
        time: '查询',
        offset: 30,
        width: 24,
        title: `${activeGraphView.label}查询`,
        actor: sourceLabel,
        status: loading ? '进行中' : '已返回',
        desc: `后端按 ${graphContext.objectType}:${graphContext.objectId} 查询关系子图。`,
        color: loading ? 'gray' : 'blue',
      },
      {
        time: '渲染',
        offset: 58,
        width: 22,
        title: '画布更新',
        actor: `${nodes.length} 对象 / ${edges.length} 关系`,
        status: '已同步',
        desc: '中间画布、右侧详情和相关证据已经按当前对象刷新。',
        color: 'blue',
      },
      {
        time: '下一步',
        offset: 83,
        width: 12,
        title: '动作处理',
        actor: selectedNode?.name || graphContext.title,
        status: '待确认',
        desc: '用户可继续点击节点展开上下文，或执行 CAPA、冻结、复检、通知等动作。',
        color: 'gray',
      },
    ];
  }, [activeGraphView.label, edges.length, graphContext, graphSource, loading, nodes.length, selectedNode?.name]);

  const loadObjectGraph = async (
    context: GraphContext,
    view: GraphViewKey = graphView,
    eventOverride?: QualityEvent,
  ) => {
    setLoading(true);
    setNodePositionOverrides({});
    try {
      const maxHops = view === 'trace' ? 3 : 2;
      const limit = view === 'task' ? 60 : 80;
      const res = await getBusinessImpactAnalysis({
        object_type: context.objectType,
        object_id: context.objectId,
        max_hops: maxHops,
        limit,
      });
      const normalized = normalizeGraphPayload(res.data?.data || {});
      if (eventOverride || normalized.event) {
        setEvent((eventOverride || normalized.event) as QualityEvent);
      }
      const nextNodes = decorateNodesForContext(normalized.nodes, context, eventOverride || normalized.event);
      setNodes(nextNodes);
      setEdges(normalized.edges);
      setGraphSource(`${normalized.source} / ${view}`);
      setSelectedNodeId(pickSelectedNodeIdForContext(nextNodes, context));
      setGraphContext(context);
      setAiSuggestion(null);
    } catch {
      if (context.objectType === 'QualityEvent') {
        const impactRes = await getQualityEventImpact(context.objectId);
        const normalized = normalizeGraphPayload(impactRes.data?.data || {});
        if (eventOverride || normalized.event) {
          setEvent((eventOverride || normalized.event) as QualityEvent);
        }
        const nextNodes = decorateNodesForContext(normalized.nodes, context, eventOverride || normalized.event);
        setNodes(nextNodes);
        setEdges(normalized.edges);
        setGraphSource(`${normalized.source} / ${view}`);
        setSelectedNodeId(pickSelectedNodeIdForContext(nextNodes, context));
      } else {
        message.warning('图谱查询暂时不可用，已保留当前画布');
      }
      setGraphContext(context);
    } finally {
      setLoading(false);
    }
  };

  const loadEvent = async (eventId = event.id) => {
    setLoading(true);
    try {
      const eventsRes = await listQualityEvents();
      const nextEvents = eventsRes.data?.data || [fallbackEvent];
      const matched = nextEvents.find((item: QualityEvent) => item.id === eventId) || nextEvents[0];
      setEvents(nextEvents);
      setEvent(matched);
      await loadObjectGraph(
        { objectType: 'QualityEvent', objectId: matched.id, title: matched.title },
        graphView,
        matched,
      );
    } catch {
      setEvents([fallbackEvent]);
      setEvent(fallbackEvent);
      setNodes(fallbackNodes);
      setEdges(fallbackEdges);
      setGraphSource('quality-fallback');
      setSelectedNodeId(fallbackNodes[0].id);
    } finally {
      setLoading(false);
    }
  };

  const changeGraphView = (view: GraphViewKey) => {
    setGraphView(view);
    setNodePositionOverrides({});
    loadObjectGraph(graphContext, view);
  };

  const openObjectGraph = (context: GraphContext) => {
    loadObjectGraph(context, graphView);
  };

  const selectGraphNode = (node: ImpactNode) => {
    setSelectedNodeId(node.id);
    setGraphContext({
      objectType: node.type,
      objectId: node.source_id || node.name || node.id,
      title: node.name,
    });
  };

  useEffect(() => {
    loadEvent();
  }, []);

  useEffect(() => {
    getGraphStats()
      .then((res) => setGraphStats(res.data))
      .catch(() => setGraphStats(null));
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      setKnowledgeEvidence([]);
      return;
    }
    getRelatedKnowledgeCards({
      object_type: selectedNode.type,
      object_id: selectedNode.source_id || selectedNode.name,
      limit: 3,
    })
      .then((res) => {
        const nextCards = res.data?.data ?? [];
        setKnowledgeEvidence(nextCards.length ? nextCards : fallbackKnowledgeCards);
      })
      .catch(() => setKnowledgeEvidence(fallbackKnowledgeCards));
  }, [selectedNode?.id, selectedNode?.type]);

  const runAiAnalysis = async () => {
    setLoading(true);
    try {
      const res = await getQualityEventAiSuggestion(event.id);
      setAiSuggestion(res.data?.data || null);
      setAiOpen(true);
    } catch {
      setAiSuggestion({
        summary: '该异常已影响物料、工单和客户订单，建议先隔离批次，再生成 CAPA 闭环。',
        evidence: ['缺陷率超过管控线。', '同批物料用于多个在制工单。', '客户订单存在交付风险。'],
        recommended_actions: [
          { action: '冻结批次', priority: 'P0', owner: '质量经理', reason: '阻断风险继续扩散。' },
          { action: '生成 CAPA', priority: 'P0', owner: '质量工程师', reason: '形成纠正与预防闭环。' },
        ],
      });
      setAiOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action: string) => {
    if (action === 'generate_capa') {
      try {
        await createCapa({
          defect_id: 1,
          action_type: 'corrective',
          description: `${event.title} - CAPA 纠正预防措施`,
          due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          assignee_id: 3,
        });
      } catch {
        // The demo action endpoint below still records a fallback task.
      }
    }

    try {
      const res = await executeQualityEventAction(event.id, {
        action,
        node_id: selectedNode?.id,
        comment: selectedNode?.summary,
      });
      message.success(res.data?.data?.message || '动作已创建');
    } catch {
      message.success('演示动作已创建，已进入待办闭环');
    }
  };

  const moveNodeByPointer = (nodeId: string, event: PointerEvent<HTMLElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clampPosition(((event.clientX - rect.left) / rect.width) * 100, 8, 92);
    const y = clampPosition(((event.clientY - rect.top) / rect.height) * 100, 14, 86);
    dragRef.current = { nodeId, moved: true };
    suppressClickRef.current = true;
    setNodePositionOverrides((prev) => ({
      ...prev,
      [nodeId]: { x, y },
    }));
  };

  const startNodeDrag = (nodeId: string, event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { nodeId, moved: false };
    setDraggingNodeId(nodeId);
  };

  const updateNodeDrag = (nodeId: string, event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.nodeId !== nodeId) return;
    moveNodeByPointer(nodeId, event);
  };

  const finishNodeDrag = (nodeId: string, event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragRef.current?.nodeId === nodeId && !dragRef.current.moved) {
      suppressClickRef.current = false;
    }
    dragRef.current = null;
    setDraggingNodeId(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  return (
    <div className="quality-impact-page">
      <section className="quality-command-hero">
        <div>
          <Typography.Title level={3}>质量异常任务处置台</Typography.Title>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => loadObjectGraph(graphContext, graphView)} loading={loading}>刷新</Button>
          <Button icon={<RobotOutlined />} onClick={runAiAnalysis} loading={loading}>AI 分析影响</Button>
          <Button type="primary" icon={<FileProtectOutlined />} onClick={() => runAction('generate_capa')}>生成 CAPA</Button>
        </Space>
      </section>

      <div className="quality-command-grid">
        <aside className="quality-left-rail">
          <Card className="quality-side-panel quality-task-panel">
            <div className="quality-task-filter">
              {partFilters.map((filter, index) => (
                <button key={filter} className={index === 0 ? 'active' : ''}>{filter}</button>
              ))}
            </div>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <div className="quality-object-entry-title">料号</div>
              {objectQuickEntries.map((item) => (
                <button
                  key={`${item.objectType}-${item.objectId}`}
                  className={`quality-event-card quality-object-entry ${graphContext.objectType === item.objectType && graphContext.objectId === item.objectId ? 'active' : ''}`}
                  onClick={() => openObjectGraph(item)}
                >
                  <span>
                    <Badge color="blue" />
                    <strong>{item.title}</strong>
                  </span>
                  <small>{item.objectType}</small>
                  <em>{item.hint}</em>
                  <Progress percent={graphContext.objectType === item.objectType && graphContext.objectId === item.objectId ? 100 : 36} size="small" strokeColor="#2d7891" />
                </button>
              ))}
            </Space>
          </Card>
        </aside>

        <main className="quality-center-stage">
          <Card className="quality-impact-graph-card">
            <div className="quality-event-summary">
              <Tag color={normalizeRisk(event.severity)}>{event.severity}</Tag>
              <strong>{event.title}</strong>
              <span>{event.description}</span>
            </div>

            <div className="quality-graph-canvas object-relationship-canvas" ref={canvasRef}>
              <div className="object-canvas-topbar">
                <div className="object-canvas-heading">
                  <div>
                    <Typography.Text strong>对象关系画布</Typography.Text>
                    <Typography.Text type="secondary">{activeGraphView.desc}</Typography.Text>
                  </div>
                  <Space size={6} wrap>
                    <Tag color={graphStats ? 'cyan' : 'default'}>
                      Neo4j {graphStats ? `${graphStats.total_nodes} 节点 / ${graphStats.total_relationships} 关系` : '连接中'}
                    </Tag>
                    <Tag color="blue">当前子图 {nodes.length} 对象 / {edges.length} 关系</Tag>
                    <Tag>{graphSource === 'fallback' || graphSource === 'quality-fallback' ? '演示子图' : graphSource}</Tag>
                    <Tag color="processing">选中 {visibleEdges.length} 条邻接关系</Tag>
                  </Space>
                </div>
                <div className="object-canvas-view-switch" aria-label="关系视图切换">
                  {graphViewOptions.map((item) => (
                    <button
                      key={item.key}
                      className={graphView === item.key ? 'active' : ''}
                      onClick={() => changeGraphView(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="object-canvas-lanes" aria-hidden="true">
                <span>供应侧</span>
                <span>来料检验</span>
                <span>质量处置</span>
                <span>生产执行</span>
                <span>交付影响</span>
              </div>
              <svg className="object-canvas-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {layoutEdges.map((edge) => {
                  const bend = Math.max(8, Math.abs(edge.targetX - edge.sourceX) / 2);
                  const sourceControlX = edge.sourceX + (edge.targetX >= edge.sourceX ? bend : -bend);
                  const targetControlX = edge.targetX - (edge.targetX >= edge.sourceX ? bend : -bend);
                  return (
                    <path
                      key={edge.id}
                      d={`M ${edge.sourceX} ${edge.sourceY} C ${sourceControlX} ${edge.sourceY}, ${targetControlX} ${edge.targetY}, ${edge.targetX} ${edge.targetY}`}
                    />
                  );
                })}
              </svg>
              {layoutNodes.map((node, index) => (
                <button
                  key={node.id}
                  className={`quality-graph-node risk-${node.risk} role-${node.layoutRole} ${node.id === selectedNode?.id ? 'selected' : ''} ${connectedNodeIds.has(node.id) ? 'connected' : ''} ${draggingNodeId === node.id ? 'dragging' : ''}`}
                  style={nodePositionStyle(node, index)}
                  onPointerDown={(pointerEvent) => startNodeDrag(node.id, pointerEvent)}
                  onPointerMove={(pointerEvent) => updateNodeDrag(node.id, pointerEvent)}
                  onPointerUp={(pointerEvent) => finishNodeDrag(node.id, pointerEvent)}
                  onPointerCancel={(pointerEvent) => finishNodeDrag(node.id, pointerEvent)}
                  onClick={(clickEvent) => {
                    if (suppressClickRef.current) {
                      clickEvent.preventDefault();
                      return;
                    }
                    selectGraphNode(node);
                  }}
                >
                  <span>{typeIcon[node.type] || <NodeIndexOutlined />}</span>
                  <strong>{node.label}</strong>
                  <small>{node.name}</small>
                </button>
              ))}
              {layoutEdges.map((edge) => (
                <span
                  key={edge.id}
                  className="quality-graph-edge"
                  style={{
                    left: `${edge.labelX}%`,
                    top: `${edge.labelY}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {edge.label}
                </span>
              ))}
              <div className="object-canvas-legend">
                <span><i className="legend-selected" /> 当前对象</span>
                <span><i className="legend-connected" /> 邻接关系</span>
                <span><i className="legend-expand" /> 可继续展开</span>
              </div>
            </div>

          </Card>
        </main>

        <aside className="quality-right-rail">
          <Card className="quality-detail-panel">
            {selectedNode ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div className="quality-node-head">
                  <span>{typeIcon[selectedNode.type] || <NodeIndexOutlined />}</span>
                  <div>
                    <Typography.Text strong>{selectedNode.name}</Typography.Text>
                    <br />
                    <Tag color={normalizeRisk(selectedNode.risk)}>{selectedNode.type}</Tag>
                    <Tag>{selectedNode.status}</Tag>
                  </div>
                </div>
                <Alert type={selectedNode.risk === 'critical' ? 'error' : 'warning'} showIcon message={selectedNode.summary} />
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="对象类型">{selectedNode.type}</Descriptions.Item>
                  <Descriptions.Item label="对象状态">{selectedNode.status}</Descriptions.Item>
                  <Descriptions.Item label="关联关系">{visibleEdges.length} 条</Descriptions.Item>
                </Descriptions>
                <Space wrap>
                  {selectedNode.actions.map((action) => <Tag color="blue" key={action}>{action}</Tag>)}
                </Space>
                <div className="quality-knowledge-panel">
                  <Typography.Text strong>相关知识 / 证据</Typography.Text>
                  {knowledgeEvidence.length ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {knowledgeEvidence.map((item) => (
                        <div className="quality-knowledge-card" key={item.id}>
                          <Space size={6} wrap>
                            <Tag color="processing">{item.space_name ?? '知识条目'}</Tag>
                            <Tag>{item.status}</Tag>
                          </Space>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Typography.Paragraph>{item.scenario}</Typography.Paragraph>
                          <Space wrap size={4}>
                            {item.guidance.slice(0, 3).map((action) => <Tag key={action}>{action}</Tag>)}
                          </Space>
                          <Typography.Text type="secondary">
                            证据：{item.evidence_refs.map((ref) => ref.source_ref).join(' / ')}
                          </Typography.Text>
                        </div>
                      ))}
                    </Space>
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联证据" />
                  )}
                </div>
                <div className="quality-action-stack">
                  {actionConfig.map((action) => (
                    <Button
                      key={action.key}
                      block
                      danger={action.danger}
                      icon={action.icon}
                      onClick={() => runAction(action.key)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </Space>
            ) : (
              <Empty description="请选择图谱对象" />
            )}
          </Card>
        </aside>
      </div>

      <div className="quality-progress-row">
        <Card className="quality-progress-card">
          <div className="quality-timeline-board">
            <div className="quality-time-ruler">
              {['09:40', '09:43', '09:47', '09:50', '09:55', '10:00'].map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <div className="quality-timeline-track">
              <span className="quality-now-line" />
              {contextualTimeline.map((item) => (
                <button
                  key={item.title}
                  className={`quality-timeline-segment segment-${item.color}`}
                  style={{ left: `${item.offset}%`, width: `${item.width}%` }}
                  title={item.desc}
                >
                  <span>{item.time}</span>
                  <strong>{item.title}</strong>
                  <em>{item.actor}</em>
                  <Tag color={item.status === '进行中' ? 'processing' : item.status.includes('已') ? 'success' : 'default'}>
                    {item.status}
                  </Tag>
                </button>
              ))}
            </div>
            <div className="quality-timeline-foot">
              <span>任务处置轴</span>
              <strong>当前停在：影响分析</strong>
              <span>后续动作：确认 AI 建议 → 生成 CAPA → 进入审批</span>
            </div>
          </div>
        </Card>
      </div>

      <Drawer title="AI 影响分析草稿" open={aiOpen} width={520} onClose={() => setAiOpen(false)}>
        {aiSuggestion ? (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Alert type="info" showIcon message={aiSuggestion.summary} />
            <Card size="small" title="证据">
              <Space direction="vertical">
                {aiSuggestion.evidence.map((item) => <Typography.Text key={item}>- {item}</Typography.Text>)}
              </Space>
            </Card>
            <Table
              size="small"
              rowKey="action"
              pagination={false}
              dataSource={aiSuggestion.recommended_actions}
              columns={[
                { title: '优先级', dataIndex: 'priority', width: 70, render: (value) => <Tag color={value === 'P0' ? 'red' : 'orange'}>{value}</Tag> },
                { title: '动作', dataIndex: 'action', width: 100 },
                { title: '负责人', dataIndex: 'owner', width: 100 },
                { title: '原因', dataIndex: 'reason' },
              ]}
            />
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => {
              setAiOpen(false);
              Modal.confirm({
                title: '生成 CAPA 草稿',
                content: 'AI 只生成草稿，不直接替用户完成高风险动作。确认后将进入流程待办。',
                onOk: () => runAction('generate_capa'),
              });
            }}>
              按建议生成 CAPA 草稿
            </Button>
          </Space>
        ) : (
          <Empty description="请先运行 AI 分析" />
        )}
      </Drawer>
    </div>
  );
}
