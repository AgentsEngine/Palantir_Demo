import React from 'react';
import { AppstoreOutlined, ArrowLeftOutlined, BarChartOutlined, CheckCircleOutlined, DatabaseOutlined, DownloadOutlined, ExperimentOutlined, ExpandOutlined, FieldTimeOutlined, FileSearchOutlined, LineChartOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined, ShopOutlined, ToolOutlined, UploadOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Form, Input, InputNumber, Modal, Progress, Row, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Tooltip, Typography, message } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardPage from '../Dashboard';
import MaintenancePage from '../Maintenance';
import QualityPage from '../Quality';
import QualityImpactWorkbench from '../QualityImpact';
import SupplyChainPage from '../SupplyChain';
import {
  createPlatformDynamicRecord,
  getAppProgramData,
  getPlatformForm,
  listPlatformForms,
  type PlatformForm,
  type PlatformFormField,
} from '@/services/api';
import {
  normalizeViewConfig,
  sortByOrder,
  type ViewConfig,
  type ViewFilterConfig,
} from '@/utils/viewConfig';
import './style.css';

const { RangePicker } = DatePicker;

type ProgramKind = 'business' | 'analysis';

type ProgramRow = Record<string, unknown>;

function isDataColumn(column: ColumnsType<ProgramRow>[number]): column is ColumnType<ProgramRow> {
  return 'dataIndex' in column;
}

interface ProgramDefinition {
  id: string;
  title: string;
  subtitle: string;
  kind: ProgramKind;
  owner: string;
  icon: React.ReactNode;
  metrics: Array<{
    label: string;
    value: string | number;
    suffix?: string;
    tone: 'blue' | 'green' | 'orange' | 'red';
  }>;
  focus: string[];
  columns: ColumnsType<ProgramRow>;
  rows: ProgramRow[];
  viewConfig?: ViewConfig;
}

interface ProgramDataPayload {
  metrics?: ProgramDefinition['metrics'];
  rows?: ProgramRow[];
  viewConfig?: ViewConfig;
  source?: string;
}

const programDefinitions: Record<string, ProgramDefinition> = {
  'production-overview': {
    id: 'production-overview',
    title: '生产总览',
    subtitle: '面向车间调度的产量、节拍、达成率和异常状态汇总。',
    kind: 'analysis',
    owner: '生产运营',
    icon: <LineChartOutlined />,
    metrics: [
      { label: '今日达成率', value: 94.6, suffix: '%', tone: 'green' },
      { label: '计划产量', value: 12840, tone: 'blue' },
      { label: '异常工单', value: 37, tone: 'orange' },
      { label: '平均节拍', value: 48, suffix: 's', tone: 'blue' },
    ],
    focus: ['按班次汇总产量与良率', '对比计划与实际进度', '暴露影响交付的异常点'],
    columns: [
      { title: '班次', dataIndex: 'shift' },
      { title: '产线', dataIndex: 'line' },
      { title: '计划', dataIndex: 'plan', sorter: (a, b) => Number(a.plan) - Number(b.plan) },
      { title: '实际', dataIndex: 'actual', sorter: (a, b) => Number(a.actual) - Number(b.actual) },
      { title: '状态', dataIndex: 'status', render: (value) => <Tag color={value === '正常' ? 'green' : 'orange'}>{value}</Tag> },
    ],
    rows: [],
  },
  'oee-trend-report': {
    id: 'oee-trend-report',
    title: 'OEE 趋势报表',
    subtitle: '聚焦 OEE 的日趋势、目标差异、产线对比和异常波动原因。',
    kind: 'analysis',
    owner: '生产运营',
    icon: <LineChartOutlined />,
    metrics: [
      { label: '本周 OEE', value: 86.8, suffix: '%', tone: 'green' },
      { label: '较目标差异', value: -2.4, suffix: '%', tone: 'orange' },
      { label: '低于目标产线', value: 3, tone: 'red' },
      { label: '最高产线 OEE', value: 91.6, suffix: '%', tone: 'blue' },
    ],
    focus: ['OEE 趋势与目标线', '可用率、性能、质量三因子拆解', '异常日期和产线下钻'],
    columns: [
      { title: '日期', dataIndex: 'date', width: 120 },
      { title: '产线', dataIndex: 'line', width: 140 },
      { title: 'OEE', dataIndex: 'oee', width: 100 },
      { title: '可用率', dataIndex: 'availability', width: 100 },
      { title: '主要原因', dataIndex: 'reason', width: 180 },
    ],
    rows: [],
  },
  'line-status': {
    id: 'line-status',
    title: '产线状态',
    subtitle: '查看每条产线的运行模式、瓶颈工位和实时负荷。',
    kind: 'business',
    owner: '车间班组',
    icon: <FieldTimeOutlined />,
    metrics: [
      { label: '运行产线', value: 214, tone: 'green' },
      { label: '待料产线', value: 21, tone: 'orange' },
      { label: '换型中', value: 18, tone: 'blue' },
      { label: '停线', value: 7, tone: 'red' },
    ],
    focus: ['产线当前工况', '瓶颈工位与节拍差异', '换型和待料影响'],
    columns: [
      { title: '产线', dataIndex: 'line' },
      { title: '当前产品', dataIndex: 'product' },
      { title: '瓶颈工位', dataIndex: 'station' },
      { title: '负荷', dataIndex: 'load', render: (value) => <Progress percent={Number(value)} size="small" /> },
    ],
    rows: [],
  },
  'line-load-analysis': {
    id: 'line-load-analysis',
    title: '产线负荷分析',
    subtitle: '按产线、班次和瓶颈工位分析负荷水平，辅助排产均衡。',
    kind: 'analysis',
    owner: '计划调度',
    icon: <FieldTimeOutlined />,
    metrics: [
      { label: '平均负荷', value: 78.5, suffix: '%', tone: 'blue' },
      { label: '过载产线', value: 2, tone: 'orange' },
      { label: '空闲产能', value: 16.2, suffix: '%', tone: 'green' },
      { label: '瓶颈工位', value: 5, tone: 'red' },
    ],
    focus: ['产线负荷热区', '班次能力差异', '瓶颈工位转移建议'],
    columns: [
      { title: '产线', dataIndex: 'line', width: 140 },
      { title: '班次', dataIndex: 'shift', width: 100 },
      { title: '负荷率', dataIndex: 'load', width: 120, render: (value) => <Progress percent={Number(value)} size="small" /> },
      { title: '瓶颈工位', dataIndex: 'station', width: 160 },
      { title: '建议动作', dataIndex: 'action', width: 180 },
    ],
    rows: [],
  },
  'production-plan-entry': {
    id: 'production-plan-entry',
    title: '生产计划填报',
    subtitle: '维护计划产量、产品、班次和确认状态。',
    kind: 'business',
    owner: '生产计划',
    icon: <AppstoreOutlined />,
    metrics: [
      { label: '待提交计划', value: 46, tone: 'orange' },
      { label: '已确认计划', value: 238, tone: 'green' },
      { label: '待调整批次', value: 34, tone: 'red' },
      { label: '覆盖产线', value: 96, tone: 'blue' },
    ],
    focus: ['计划录入和保存草稿', '班次产量确认', '排产调整原因留痕'],
    columns: [
      { title: '计划单号', dataIndex: 'planNo', width: 150 },
      { title: '产品', dataIndex: 'product', width: 150 },
      { title: '产线', dataIndex: 'line', width: 130 },
      { title: '计划数量', dataIndex: 'quantity', width: 110, sorter: (a, b) => Number(a.quantity) - Number(b.quantity) },
      { title: '状态', dataIndex: 'status', width: 100, render: (value) => <Tag color={value === '已确认' ? 'green' : 'orange'}>{value}</Tag> },
    ],
    rows: [],
  },
  'device-health': {
    id: 'device-health',
    title: '设备健康',
    subtitle: '沉淀关键设备的健康评分、风险因子和维护建议。',
    kind: 'analysis',
    owner: '设备工程',
    icon: <ToolOutlined />,
    metrics: [
      { label: '平均健康度', value: 88.2, suffix: '%', tone: 'green' },
      { label: '高风险设备', value: 4, tone: 'red' },
      { label: '待保养', value: 13, tone: 'orange' },
      { label: '在线设备', value: 216, tone: 'blue' },
    ],
    focus: ['设备健康评分', '振动与温度异常', '保养策略推荐'],
    columns: [
      { title: '设备', dataIndex: 'asset' },
      { title: '健康度', dataIndex: 'health', render: (value) => <Progress percent={Number(value)} size="small" /> },
      { title: '主要风险', dataIndex: 'risk' },
      { title: '建议', dataIndex: 'action' },
    ],
    rows: [],
  },
  'device-health-dashboard': {
    id: 'device-health-dashboard',
    title: '设备健康看板',
    subtitle: '面向预测性维护的总览看板，汇总设备健康度、风险分布、待处理建议和关键设备排行。',
    kind: 'analysis',
    owner: '设备团队',
    icon: <ToolOutlined />,
    metrics: [
      { label: '平均健康度', value: 88.6, suffix: '%', tone: 'green' },
      { label: '高风险设备', value: 5, tone: 'red' },
      { label: '待保养设备', value: 14, tone: 'orange' },
      { label: '在线设备', value: 216, tone: 'blue' },
    ],
    focus: ['设备健康度分布', '高风险设备排行', '保养建议闭环'],
    columns: [
      { title: '设备', dataIndex: 'asset', width: 150 },
      { title: '健康度', dataIndex: 'health', width: 160, render: (value) => <Progress percent={Number(value)} size="small" /> },
      { title: '风险等级', dataIndex: 'level', width: 120 },
      { title: '主要风险', dataIndex: 'risk', width: 180 },
      { title: '建议动作', dataIndex: 'action', width: 180 },
    ],
    rows: [],
  },
  'fault-prediction': {
    id: 'fault-prediction',
    title: '故障预测',
    subtitle: '根据历史维修、传感器趋势和运行时长预测故障窗口。',
    kind: 'analysis',
    owner: '可靠性团队',
    icon: <WarningOutlined />,
    metrics: [
      { label: '预测命中率', value: 82.5, suffix: '%', tone: 'green' },
      { label: '未来 7 天风险', value: 9, tone: 'orange' },
      { label: '严重预警', value: 2, tone: 'red' },
      { label: '模型版本', value: 'v3.4', tone: 'blue' },
    ],
    focus: ['故障概率排序', '预测依据解释', '维护窗口建议'],
    columns: [
      { title: '对象', dataIndex: 'asset' },
      { title: '预测故障', dataIndex: 'fault' },
      { title: '概率', dataIndex: 'probability' },
      { title: '预计窗口', dataIndex: 'window' },
    ],
    rows: [],
  },
  'maintenance-order': {
    id: 'maintenance-order',
    title: '维修工单',
    subtitle: '跟踪维修工单的派发、执行、备件和验收闭环。',
    kind: 'business',
    owner: '维修班组',
    icon: <AppstoreOutlined />,
    metrics: [
      { label: '打开工单', value: 18, tone: 'orange' },
      { label: '今日完成', value: 11, tone: 'green' },
      { label: '待备件', value: 3, tone: 'red' },
      { label: '平均处理', value: 2.6, suffix: 'h', tone: 'blue' },
    ],
    focus: ['工单责任人', '维修进度', '备件与验收状态'],
    columns: [
      { title: '工单号', dataIndex: 'orderNo' },
      { title: '设备', dataIndex: 'asset' },
      { title: '负责人', dataIndex: 'owner' },
      { title: '进度', dataIndex: 'status', render: (value) => <Tag color={value === '已完成' ? 'green' : 'processing'}>{value}</Tag> },
    ],
    rows: [],
  },
  'equipment-inspection': {
    id: 'equipment-inspection',
    title: '点检计划',
    subtitle: '按设备、点检项、周期、责任人和执行状态管理设备点检计划，与告警中心使用同一套业务表格交互模板。',
    kind: 'business',
    owner: '维护执行',
    icon: <FileSearchOutlined />,
    metrics: [
      { label: '计划总数', value: 360, tone: 'blue' },
      { label: '待点检', value: 86, tone: 'orange' },
      { label: '逾期计划', value: 18, tone: 'red' },
      { label: '完成率', value: 93.4, suffix: '%', tone: 'green' },
    ],
    focus: ['点检周期', '责任人', '执行状态'],
    columns: [
      { title: '点检单号', dataIndex: 'planNo', width: 150 },
      { title: '设备', dataIndex: 'asset', width: 160 },
      { title: '点检项', dataIndex: 'item', width: 140 },
      { title: '周期', dataIndex: 'cycle', width: 100 },
      { title: '负责人', dataIndex: 'owner', width: 120 },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (value) => (
          <Tag color={value === '逾期' ? 'red' : value === '已完成' ? 'green' : value === '执行中' ? 'blue' : 'orange'}>
            {String(value)}
          </Tag>
        ),
      },
    ],
    rows: [],
  },
  'failure-trend-analysis': {
    id: 'failure-trend-analysis',
    title: '故障趋势分析',
    subtitle: '按时间、设备类型和故障原因分析维修故障趋势，区别于单台设备预测。',
    kind: 'analysis',
    owner: '维护团队',
    icon: <LineChartOutlined />,
    metrics: [
      { label: '本月故障数', value: 42, tone: 'orange' },
      { label: '环比变化', value: -8.6, suffix: '%', tone: 'green' },
      { label: '重复故障', value: 7, tone: 'red' },
      { label: '平均间隔', value: 18.4, suffix: 'h', tone: 'blue' },
    ],
    focus: ['故障趋势按周分析', '重复故障设备识别', '主要原因与责任区域'],
    columns: [
      { title: '周次', dataIndex: 'week', width: 120 },
      { title: '设备类型', dataIndex: 'type', width: 140 },
      { title: '故障次数', dataIndex: 'count', width: 100 },
      { title: '主要原因', dataIndex: 'reason', width: 180 },
      { title: '趋势', dataIndex: 'trend', width: 100 },
    ],
    rows: [],
  },
  'alert-center': {
    id: 'alert-center',
    title: '告警中心',
    subtitle: '聚合设备、质量、交付和库存告警，支持处置优先级排序。',
    kind: 'business',
    owner: '运营指挥',
    icon: <WarningOutlined />,
    metrics: [
      { label: '未关闭告警', value: 308, tone: 'orange' },
      { label: '严重告警', value: 28, tone: 'red' },
      { label: '已确认', value: 96, tone: 'blue' },
      { label: '已关闭', value: 52, tone: 'green' },
    ],
    focus: ['告警等级', '责任域分派', '处置时效'],
    columns: [
      { title: '告警', dataIndex: 'name' },
      { title: '来源', dataIndex: 'source' },
      { title: '等级', dataIndex: 'level', render: (value) => <Tag color={value === '严重' ? 'red' : value === '中等' ? 'orange' : 'blue'}>{value}</Tag> },
      { title: '状态', dataIndex: 'status' },
    ],
    rows: [],
  },
  'quality-overview': {
    id: 'quality-overview',
    title: '质量总览',
    subtitle: '汇总检验合格率、缺陷分布、返工趋势和关键质量事件。',
    kind: 'analysis',
    owner: '质量部',
    icon: <CheckCircleOutlined />,
    metrics: [
      { label: '一次合格率', value: 97.8, suffix: '%', tone: 'green' },
      { label: '待复检', value: 42, tone: 'orange' },
      { label: '重大事件', value: 1, tone: 'red' },
      { label: 'CPK 均值', value: 1.43, tone: 'blue' },
    ],
    focus: ['批次质量表现', '缺陷趋势', '过程能力监控'],
    columns: [
      { title: '产品族', dataIndex: 'family' },
      { title: '抽检数', dataIndex: 'sample' },
      { title: '合格率', dataIndex: 'yieldRate' },
      { title: '主要缺陷', dataIndex: 'defect' },
    ],
    rows: [],
  },
  'inspection-batch': {
    id: 'inspection-batch',
    title: '检验批次',
    subtitle: '管理来料、过程和出货检验批次的抽检结论。',
    kind: 'business',
    owner: '检验小组',
    icon: <FileSearchOutlined />,
    metrics: [
      { label: '今日批次', value: 67, tone: 'blue' },
      { label: '已放行', value: 51, tone: 'green' },
      { label: '隔离中', value: 6, tone: 'orange' },
      { label: '判退', value: 2, tone: 'red' },
    ],
    focus: ['批次状态', '抽样方案', '放行与隔离记录'],
    columns: [
      { title: '批次号', dataIndex: 'batch' },
      { title: '物料', dataIndex: 'material' },
      { title: '检验类型', dataIndex: 'type' },
      { title: '结论', dataIndex: 'result', render: (value) => <Tag color={value === '放行' ? 'green' : 'orange'}>{value}</Tag> },
    ],
    rows: [],
  },
  'defect-analysis': {
    id: 'defect-analysis',
    title: '缺陷分析',
    subtitle: '对缺陷类型、工位、供应商和责任原因进行分层分析。',
    kind: 'analysis',
    owner: '质量工程',
    icon: <ExperimentOutlined />,
    metrics: [
      { label: '缺陷件数', value: 128, tone: 'orange' },
      { label: '重复缺陷', value: 19, tone: 'red' },
      { label: 'Top1 占比', value: 31.4, suffix: '%', tone: 'blue' },
      { label: '关闭率', value: 86, suffix: '%', tone: 'green' },
    ],
    focus: ['缺陷 Pareto', '责任原因归类', '改善效果跟踪'],
    columns: [
      { title: '缺陷类型', dataIndex: 'defect' },
      { title: '发生工位', dataIndex: 'station' },
      { title: '数量', dataIndex: 'count' },
      { title: '趋势', dataIndex: 'trend' },
    ],
    rows: [],
  },
  'defect-analysis-report': {
    id: 'defect-analysis-report',
    title: '缺陷分析报表',
    subtitle: '按缺陷类型、责任工位和改善状态拆解质量问题，避免与缺陷处理表单共用一个页面。',
    kind: 'analysis',
    owner: '质量团队',
    icon: <ExperimentOutlined />,
    metrics: [
      { label: '本月缺陷数', value: 96, tone: 'orange' },
      { label: '重大缺陷', value: 8, tone: 'red' },
      { label: '重复发生率', value: 12.5, suffix: '%', tone: 'blue' },
      { label: '改善关闭率', value: 84.2, suffix: '%', tone: 'green' },
    ],
    focus: ['缺陷 Pareto 分析', '责任工位归因', '改善闭环趋势'],
    columns: [
      { title: '缺陷类型', dataIndex: 'defect', width: 150 },
      { title: '责任工位', dataIndex: 'station', width: 140 },
      { title: '发生次数', dataIndex: 'count', width: 110 },
      { title: '主要原因', dataIndex: 'reason', width: 180 },
      { title: '改善状态', dataIndex: 'status', width: 120 },
    ],
    rows: [],
  },
  'process-capability-dashboard': {
    id: 'process-capability-dashboard',
    title: '过程能力看板',
    subtitle: '聚焦 CPK、PPK、超限批次和稳定性趋势，是质量监控看板，不再复用质量总览。',
    kind: 'analysis',
    owner: '质量团队',
    icon: <CheckCircleOutlined />,
    metrics: [
      { label: '平均 CPK', value: 1.42, tone: 'green' },
      { label: '低能力工序', value: 4, tone: 'red' },
      { label: '超限批次', value: 6, tone: 'orange' },
      { label: '受控特性', value: 38, tone: 'blue' },
    ],
    focus: ['关键特性能力排名', 'SPC 超限追踪', '低 CPK 工序改善'],
    columns: [
      { title: '工序', dataIndex: 'process', width: 150 },
      { title: '质量特性', dataIndex: 'feature', width: 150 },
      { title: 'CPK', dataIndex: 'cpk', width: 100 },
      { title: 'PPK', dataIndex: 'ppk', width: 100 },
      { title: '状态', dataIndex: 'status', width: 120 },
    ],
    rows: [],
  },  'quality-event': {
    id: 'quality-event',
    title: '料号追踪',
    subtitle: '围绕料号查看供应、检验、库存、生产、交付、异常和知识证据。',
    kind: 'business',
    owner: '质量 / 供应链',
    icon: <CheckCircleOutlined />,
    metrics: [
      { label: '关联对象', value: 16, tone: 'blue' },
      { label: '关系链路', value: 24, tone: 'green' },
      { label: '风险节点', value: 4, tone: 'orange' },
      { label: '证据条目', value: 3, tone: 'blue' },
    ],
    focus: ['料号全链路', 'Neo4j 子图', '异常与证据'],
    columns: [
      { title: '对象编号', dataIndex: 'eventNo' },
      { title: '对象名称', dataIndex: 'subject' },
      { title: '归属', dataIndex: 'owner' },
      { title: '状态', dataIndex: 'stage' },
    ],
    rows: [],
  },
  'supplier-risk': {
    id: 'supplier-risk',
    title: '供应商风险',
    subtitle: '评估供应商交付、质量、产能和地域风险。',
    kind: 'analysis',
    owner: '采购管理',
    icon: <ShopOutlined />,
    metrics: [
      { label: '高风险供应商', value: 5, tone: 'red' },
      { label: '交付准时率', value: 91.2, suffix: '%', tone: 'green' },
      { label: '待整改', value: 8, tone: 'orange' },
      { label: '覆盖品类', value: 23, tone: 'blue' },
    ],
    focus: ['供应商风险评分', '交付与质量波动', '替代来源建议'],
    columns: [
      { title: '供应商', dataIndex: 'supplier' },
      { title: '品类', dataIndex: 'category' },
      { title: '风险', dataIndex: 'risk', render: (value) => <Tag color={value === '高' ? 'red' : 'orange'}>{value}</Tag> },
      { title: '原因', dataIndex: 'reason' },
    ],
    rows: [],
  },
  'supply-overview': {
    id: 'supply-overview',
    title: '供应总览',
    subtitle: '查看供应链库存水位、缺料风险和交付承诺。',
    kind: 'analysis',
    owner: '供应链计划',
    icon: <DatabaseOutlined />,
    metrics: [
      { label: '缺料风险', value: 14, tone: 'orange' },
      { label: '安全库存命中', value: 88.7, suffix: '%', tone: 'green' },
      { label: '在途批次', value: 126, tone: 'blue' },
      { label: '停线风险', value: 1, tone: 'red' },
    ],
    focus: ['库存覆盖天数', '供应承诺差异', '缺料风险预警'],
    columns: [
      { title: '物料组', dataIndex: 'group' },
      { title: '覆盖天数', dataIndex: 'days' },
      { title: '在途', dataIndex: 'transit' },
      { title: '风险等级', dataIndex: 'risk' },
    ],
    rows: [],
  },
  'material-impact': {
    id: 'material-impact',
    title: '物料影响',
    subtitle: '分析物料短缺对工单、产线和客户交付的影响范围。',
    kind: 'analysis',
    owner: '计划协同',
    icon: <DatabaseOutlined />,
    metrics: [
      { label: '受影响工单', value: 21, tone: 'orange' },
      { label: '客户订单', value: 9, tone: 'red' },
      { label: '可替代料', value: 6, tone: 'green' },
      { label: '预计缺口', value: 1840, tone: 'blue' },
    ],
    focus: ['缺料影响链路', '替代料可用性', '客户交期冲击'],
    columns: [
      { title: '物料', dataIndex: 'material' },
      { title: '缺口', dataIndex: 'gap' },
      { title: '影响产线', dataIndex: 'line' },
      { title: '缓解动作', dataIndex: 'action' },
    ],
    rows: [],
  },
  'material-impact-report': {
    id: 'material-impact-report',
    title: '物料影响报表',
    subtitle: '把缺料对产线、工单和客户订单的影响拆开分析，不再复用通用物料影响页。',
    kind: 'analysis',
    owner: '供应链团队',
    icon: <DatabaseOutlined />,
    metrics: [
      { label: '受影响工单', value: 18, tone: 'orange' },
      { label: '停线风险', value: 5, tone: 'red' },
      { label: '可替代物料', value: 12, tone: 'green' },
      { label: '预计缺口', value: 3260, tone: 'blue' },
    ],
    focus: ['缺料影响工单', '客户订单风险', '替代料可用性'],
    columns: [
      { title: '物料', dataIndex: 'material', width: 150 },
      { title: '影响对象', dataIndex: 'target', width: 150 },
      { title: '缺口数量', dataIndex: 'gap', width: 110 },
      { title: '预计影响', dataIndex: 'impact', width: 160 },
      { title: '应对动作', dataIndex: 'action', width: 180 },
    ],
    rows: [],
  },
  'supply-risk-dashboard': {
    id: 'supply-risk-dashboard',
    title: '供应风险看板',
    subtitle: '展示供应风险等级、关键品类和替代方案，是供应链风险看板，不再复用供应链总览。',
    kind: 'analysis',
    owner: '供应链团队',
    icon: <ShopOutlined />,
    metrics: [
      { label: '高风险供应商', value: 6, tone: 'red' },
      { label: '风险品类', value: 14, tone: 'orange' },
      { label: '替代方案覆盖', value: 72.4, suffix: '%', tone: 'green' },
      { label: '待复核风险', value: 9, tone: 'blue' },
    ],
    focus: ['高风险供应商排行', '关键物料风险', '替代方案覆盖缺口'],
    columns: [
      { title: '供应商', dataIndex: 'supplier', width: 160 },
      { title: '风险品类', dataIndex: 'category', width: 140 },
      { title: '风险等级', dataIndex: 'level', width: 110 },
      { title: '主要原因', dataIndex: 'reason', width: 180 },
      { title: '缓解方案', dataIndex: 'mitigation', width: 180 },
    ],
    rows: [],
  },  'risk-review': {
    id: 'risk-review',
    title: '风险复核',
    subtitle: '对供应链风险进行人工复核、定级、分派和关闭。',
    kind: 'business',
    owner: '供应链风控',
    icon: <FileSearchOutlined />,
    metrics: [
      { label: '待复核', value: 17, tone: 'orange' },
      { label: '升级处理', value: 4, tone: 'red' },
      { label: '已关闭', value: 29, tone: 'green' },
      { label: '平均响应', value: 3.4, suffix: 'h', tone: 'blue' },
    ],
    focus: ['风险复核结论', '责任人分派', '处置闭环'],
    columns: [
      { title: '风险单', dataIndex: 'riskNo' },
      { title: '主题', dataIndex: 'subject' },
      { title: '等级', dataIndex: 'level', render: (value) => <Tag color={value === '高' ? 'red' : 'orange'}>{value}</Tag> },
      { title: '处理人', dataIndex: 'owner' },
    ],
    rows: [],
  },
};

const fieldLabelMap: Record<string, string> = {
  riskNo: '风险单',
  subject: '主题',
  level: '等级',
  owner: '处理人',
  material: '料号 / 物料',
  supplier: '供应商',
  category: '品类',
  risk: '风险',
  reason: '原因',
  action: '建议动作',
  status: '状态',
  asset: '设备',
  health: '健康度',
  line: '产线',
  product: '产品',
  count: '数量',
};
const toneClassMap: Record<ProgramDefinition['metrics'][number]['tone'], string> = {
  blue: 'program-stat-blue',
  green: 'program-stat-green',
  orange: 'program-stat-orange',
  red: 'program-stat-red',
};
const routedProgramIds = new Set(['production-overview', 'device-health', 'quality-overview', 'quality-event', 'supply-overview']);

function AppProgramPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [programData, setProgramData] = React.useState<ProgramDataPayload | null>(null);
  const [programLoading, setProgramLoading] = React.useState(false);

  const baseProgram = programId ? programDefinitions[programId] : undefined;
  const loadProgramData = React.useCallback(async () => {
    if (!programId || routedProgramIds.has(programId) || !programDefinitions[programId]) return;
    setProgramLoading(true);
    try {
      const response = await getAppProgramData(programId, 500);
      const payload = response.data as ProgramDataPayload;
      setProgramData(payload?.rows || payload?.metrics ? payload : null);
    } catch {
      setProgramData(null);
    } finally {
      setProgramLoading(false);
    }
  }, [programId]);

  React.useEffect(() => {
    setProgramData(null);
    void loadProgramData();
  }, [loadProgramData]);

  const program = React.useMemo(() => {
    if (!baseProgram) return undefined;
    const serverRows = Array.isArray(programData?.rows) ? programData.rows : [];
    const serverMetrics = Array.isArray(programData?.metrics) ? programData.metrics : [];
    return {
      ...baseProgram,
      metrics: serverMetrics,
      rows: serverRows,
      viewConfig: programData?.viewConfig || baseProgram.viewConfig,
    };
  }, [baseProgram, programData]);

  if (programId === 'production-overview') {
    return <DashboardPage />;
  }

  if (programId === 'device-health') {
    return <MaintenancePage />;
  }

  if (programId === 'quality-overview') {
    return <QualityPage />;
  }

  if (programId === 'quality-event') {
    return <QualityImpactWorkbench />;
  }

  if (programId === 'supply-overview') {
    return <SupplyChainPage />;
  }

  if (!program) {
    return (
      <Card>
        <Empty description="未找到对应表单页面">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
        </Empty>
      </Card>
    );
  }

  const openSettings = () => {
    navigate(`/form-settings/${program.id}`);
  };

  return (
    <div className={`app-program-page app-program-${program.kind}`}>
      {program.kind === 'business' ? (
        <BusinessProgram program={program} onSettings={openSettings} onReload={loadProgramData} loading={programLoading} />
      ) : (
        <>
          <ProgramHeader program={program} onSettings={openSettings} onReload={loadProgramData} loading={programLoading} />
          <AnalysisProgram program={program} onSettings={openSettings} loading={programLoading} />
        </>
      )}
    </div>
  );
}

function ProgramHeader({
  program,
  onSettings,
  onReload,
  loading,
}: {
  program: ProgramDefinition;
  onSettings: () => void;
  onReload: () => void;
  loading?: boolean;
}) {
  return (
    <div className="app-program-header">
      <div className="app-program-title-block">
        <span className="app-program-icon">{program.icon}</span>
        <div>
          <Space size={8} align="center" wrap>
            <Typography.Title level={3}>{program.title}</Typography.Title>
            <Tag color={program.kind === 'analysis' ? 'blue' : 'green'}>
              {program.kind === 'analysis' ? '分析看板' : '业务交互'}
            </Tag>
          </Space>
          <Typography.Text type="secondary">{program.subtitle}</Typography.Text>
        </div>
      </div>
      <Space wrap>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={onReload}>刷新</Button>
        <Button icon={<DownloadOutlined />}>导出</Button>
        <Button icon={<ExpandOutlined />}>全屏</Button>
        <Button icon={<BarChartOutlined />}>切换维度</Button>
        <Button icon={<SettingOutlined />} onClick={onSettings}>设置</Button>
      </Space>
    </div>
  );
}

function programFieldsForView(program: ProgramDefinition) {
  return program.columns
    .map((column) => {
      if (!isDataColumn(column)) return null;
      const dataColumn = column;
      const fieldName = typeof dataColumn.dataIndex === 'string' ? dataColumn.dataIndex : '';
      if (!fieldName) return null;
      return {
        fieldName,
        label: typeof dataColumn.title === 'string' ? dataColumn.title : fieldName,
        fieldType: fieldName.includes('status') || fieldName.includes('level') ? 'enum' : 'text',
        searchable: true,
        sortable: Boolean(dataColumn.sorter),
        visibleInList: true,
      };
    })
    .filter((field): field is NonNullable<typeof field> => Boolean(field));
}

function programValueMatchesFilter(row: ProgramRow, filter: ViewFilterConfig, value: unknown) {
  if (value === undefined || value === null || value === '') return true;
  const actual = row[filter.fieldName];
  if (filter.operator === 'equals') return String(actual) === String(value);
  return String(actual || '').toLowerCase().includes(String(value).toLowerCase());
}

function getRowFormData(row: ProgramRow | null): Record<string, unknown> {
  const formData = row?._formData;
  if (formData && typeof formData === 'object' && !Array.isArray(formData)) {
    return formData as Record<string, unknown>;
  }
  return row || {};
}

function formatDetailValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function readProgramField(row: ProgramRow | null, key: string, fallback = '-') {
  if (!row) return fallback;
  const formData = getRowFormData(row);
  const value = row[key] ?? formData[key];
  if (value === undefined || value === null || value === '') return fallback;
  return formatDetailValue(value);
}

function parseAlertTime(value: unknown) {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatAlertTime(value: unknown) {
  const timestamp = parseAlertTime(value);
  if (!timestamp) return formatDetailValue(value);
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

function getAlertTone(row: ProgramRow | null) {
  const level = readProgramField(row, 'level', '');
  if (level.includes('严重') || level.includes('critical')) return 'critical';
  if (level.includes('中') || level.includes('高') || level.includes('warning')) return 'warning';
  if (level.includes('提醒') || level.includes('minor')) return 'notice';
  return 'normal';
}

function getAlertTagColor(row: ProgramRow | null) {
  const tone = getAlertTone(row);
  if (tone === 'critical') return 'red';
  if (tone === 'warning') return 'orange';
  if (tone === 'notice') return 'blue';
  return 'geekblue';
}

function isAlertClosed(row: ProgramRow | null) {
  const status = readProgramField(row, 'status', '');
  const processStatus = readProgramField(row, 'processStatus', '');
  return status.includes('关闭') || processStatus.includes('完成') || processStatus.includes('closed');
}

function getAlertSlaPercent(row: ProgramRow | null) {
  const occurred = parseAlertTime(row ? readProgramField(row, 'occurredAt', '') : '');
  const due = parseAlertTime(row ? readProgramField(row, 'dueAt', '') : '');
  const completed = parseAlertTime(row ? readProgramField(row, 'completedAt', '') : '');
  if (!occurred || !due || due <= occurred) return isAlertClosed(row) ? 100 : 62;
  const compareAt = completed || Date.now();
  return Math.max(6, Math.min(100, Math.round(((compareAt - occurred) / (due - occurred)) * 100)));
}

function getAlertSlaStatus(row: ProgramRow | null): 'success' | 'normal' | 'exception' {
  if (isAlertClosed(row)) return 'success';
  return getAlertSlaPercent(row) >= 92 ? 'exception' : 'normal';
}

function getAlertEvidenceCount(row: ProgramRow | null) {
  if (!row) return 0;
  const formData = getRowFormData(row);
  const evidence = row.evidence ?? formData.evidence;
  return Array.isArray(evidence) ? evidence.length : evidence ? 1 : 0;
}

function getInteractionEntries(row: ProgramRow | null) {
  const formData = getRowFormData(row);
  const source = formData.interactionLog || row?.interactionLog;
  if (!Array.isArray(source)) {
    return [];
  }
  return source.map((item, index) => {
    if (item && typeof item === 'object') {
      const entry = item as Record<string, unknown>;
      return {
        title: String(entry.action || entry.title || `处理记录 ${index + 1}`),
        description: [entry.time, entry.actor].filter(Boolean).map(String).join(' · ') || '系统记录',
      };
    }
    return { title: String(item), description: '系统记录' };
  });
}

function AlertBusinessProgram({
  program,
  onSettings,
  onReload,
  loading,
}: {
  program: ProgramDefinition;
  onSettings: () => void;
  onReload: () => void;
  loading?: boolean;
}) {
  const [selectedRow, setSelectedRow] = React.useState<ProgramRow | null>(null);
  const [filterValues, setFilterValues] = React.useState<Record<string, unknown>>({});
  const [filterForm] = Form.useForm();
  const viewConfig = React.useMemo(() => normalizeViewConfig(program.viewConfig, programFieldsForView(program)), [program]);
  const activeFilters = React.useMemo(() => sortByOrder(viewConfig.filters).filter((filter) => filter.enabled), [viewConfig.filters]);
  const viewColumns = React.useMemo(() => sortByOrder(viewConfig.table.columns).filter((column) => column.enabled), [viewConfig.table.columns]);
  const filteredRows = React.useMemo(() => program.rows.filter((row) => activeFilters.every((filter) => (
    programValueMatchesFilter(row, filter, filterValues[filter.id] ?? filter.defaultValue)
  ))), [activeFilters, filterValues, program.rows]);
  const selectedKey = selectedRow ? String(selectedRow.key || selectedRow.recordId || selectedRow.alertId || '') : '';

  React.useEffect(() => {
    if (!filteredRows.length) {
      setSelectedRow(null);
      return;
    }
    const stillVisible = selectedRow && filteredRows.some((row) => String(row.key || row.recordId || row.alertId) === selectedKey);
    if (!stillVisible) setSelectedRow(filteredRows[0]);
  }, [filteredRows, selectedKey, selectedRow]);

  const configuredColumns = React.useMemo(() => {
    const columns: ColumnsType<ProgramRow> = viewColumns
      .map<ColumnType<ProgramRow>>((viewColumn) => {
        const source = program.columns.find((column) => isDataColumn(column) && column.dataIndex === viewColumn.fieldName) as ColumnType<ProgramRow> | undefined;
        const renderCell = (value: unknown, record: ProgramRow) => {
          const formData = getRowFormData(record);
          const actual = value ?? formData[viewColumn.fieldName];
          if (actual === undefined || actual === null || actual === '') return viewColumn.emptyText || '-';
          if (viewColumn.fieldName === 'level') return <Tag color={getAlertTagColor(record)}>{String(actual)}</Tag>;
          if (viewColumn.fieldName === 'status' || viewColumn.fieldName === 'processStatus') return <Tag color={isAlertClosed(record) ? 'default' : 'blue'}>{String(actual)}</Tag>;
          if (viewColumn.fieldName === 'occurredAt' || viewColumn.fieldName === 'dueAt') return formatAlertTime(actual);
          if (viewColumn.fieldName === 'title') return <Typography.Text strong>{String(actual)}</Typography.Text>;
          if (viewColumn.renderType === 'tag') return <Tag>{String(actual)}</Tag>;
          return String(actual);
        };
        return {
          ...(source || {}),
          title: viewColumn.label,
          dataIndex: source?.dataIndex || viewColumn.fieldName,
          key: source?.key || viewColumn.fieldName,
          width: viewColumn.width || (viewColumn.fieldName === 'title' ? 240 : 130),
          fixed: viewColumn.fixed,
          sorter: viewColumn.sortable ? source?.sorter || ((a: ProgramRow, b: ProgramRow) => String(a[viewColumn.fieldName] || '').localeCompare(String(b[viewColumn.fieldName] || ''))) : undefined,
          render: source?.render || renderCell,
        };
      });
    return [
      ...columns,
      {
        title: '操作',
        key: 'action',
        fixed: 'right' as const,
        width: 132,
        render: (_: unknown, record: ProgramRow) => (
          <Space onClick={(event) => event.stopPropagation()}>
            <Button type="link" size="small" onClick={() => setSelectedRow(record)}>查看</Button>
            <Button type="link" size="small">处理</Button>
          </Space>
        ),
      },
    ];
  }, [program.columns, viewColumns]);

  const renderFilterControl = (filter: ViewFilterConfig) => {
    const placeholder = filter.placeholder || filter.label;
    if (filter.controlType === 'dateRange') return <RangePicker />;
    if (filter.controlType === 'select' || filter.controlType === 'relation' || filter.operator === 'equals') {
      const options = Array.from(new Set(program.rows.map((row) => row[filter.fieldName] ?? getRowFormData(row)[filter.fieldName]).filter(Boolean))).map((value) => ({ value: String(value), label: String(value) }));
      return <Select allowClear placeholder={placeholder} options={options} />;
    }
    return <Input allowClear prefix={filter.controlType === 'keyword' || filter.fieldName === 'title' ? <SearchOutlined /> : undefined} placeholder={placeholder} />;
  };

  const selectedTitle = readProgramField(selectedRow, 'title', readProgramField(selectedRow, 'name', '告警记录'));
  const interactionEntries = React.useMemo(() => getInteractionEntries(selectedRow), [selectedRow]);

  return (
    <div className="alert-business-page">
      <div className="alert-business-header">
        <div className="alert-business-heading">
          <span className="alert-business-icon"><WarningOutlined /></span>
          <div>
            <Space size={8} align="center" wrap>
              <Typography.Title level={4}>告警中心</Typography.Title>
              <Tag color="green">业务交互</Tag>
            </Space>
            <Typography.Text type="secondary">用于告警登记、确认、派工、处理和关闭；不是独立分析看板。</Typography.Text>
          </div>
        </div>
        <div className="alert-business-actions">
          <Tooltip title="新增告警">
            <Button type="primary" aria-label="新增告警" icon={<PlusOutlined />}>新增告警</Button>
          </Tooltip>
          <Tooltip title="批量处理">
            <Button className="alert-business-batch-action" aria-label="批量处理" icon={<CheckCircleOutlined />} disabled={!selectedRow}>批量处理</Button>
          </Tooltip>
          <Tooltip title="刷新">
            <Button aria-label="刷新" icon={<ReloadOutlined />} loading={loading} onClick={onReload}>刷新</Button>
          </Tooltip>
          <Tooltip title="导出">
            <Button aria-label="导出" icon={<DownloadOutlined />}>导出</Button>
          </Tooltip>
          <Tooltip title="设置">
            <Button aria-label="设置" icon={<SettingOutlined />} onClick={onSettings}>设置</Button>
          </Tooltip>
        </div>
      </div>

      <Form
        className="alert-business-filter-form"
        form={filterForm}
        colon={false}
        layout="horizontal"
        onFinish={(values) => setFilterValues(values)}
      >
        {activeFilters.slice(0, 8).map((filter) => (
          <Form.Item key={filter.id} name={filter.id} label={filter.label} initialValue={filter.defaultValue}>
            {renderFilterControl(filter)}
          </Form.Item>
        ))}
        <Form.Item className="alert-business-filter-actions" label=" ">
          <Space>
            <Button onClick={() => { filterForm.resetFields(); setFilterValues({}); }}>重置</Button>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
          </Space>
        </Form.Item>
      </Form>

      <div className="alert-business-body">
        <section className="alert-business-table-panel">
          <Table<ProgramRow>
            className="alert-business-table"
            rowKey={(record) => String(record.key || record.recordId || record.alertId)}
            size={viewConfig.table.density === 'compact' ? 'small' : 'middle'}
            columns={configuredColumns}
            dataSource={filteredRows}
            loading={loading}
            pagination={{ pageSize: viewConfig.table.pageSize, showSizeChanger: false, showTotal: (total) => `共 ${total} 条记录` }}
            scroll={{ x: 1280, y: '100%' }}
            rowClassName={(record) => String(record.key || record.recordId || record.alertId) === selectedKey ? 'alert-business-row-selected' : ''}
            onRow={(record) => ({
              onClick: () => setSelectedRow(record),
            })}
          />
        </section>

        <aside className="alert-business-record-panel">
          {selectedRow ? (
            <>
              <div className="alert-business-record-head">
                <div>
                  <Typography.Title level={5}>{selectedTitle}</Typography.Title>
                  <Typography.Text type="secondary">{readProgramField(selectedRow, 'alertId', String(selectedKey))}</Typography.Text>
                </div>
                <Tag color={isAlertClosed(selectedRow) ? 'default' : 'processing'}>{readProgramField(selectedRow, 'status', '-')}</Tag>
              </div>

              <Descriptions size="small" column={1} className="alert-business-descriptions">
                <Descriptions.Item label="关联设备">{readProgramField(selectedRow, 'device', '-')}</Descriptions.Item>
                <Descriptions.Item label="告警等级"><Tag color={getAlertTagColor(selectedRow)}>{readProgramField(selectedRow, 'level', '一般')}</Tag></Descriptions.Item>
                <Descriptions.Item label="告警来源">{readProgramField(selectedRow, 'source', '-')}</Descriptions.Item>
                <Descriptions.Item label="发生时间">{formatAlertTime(readProgramField(selectedRow, 'occurredAt', ''))}</Descriptions.Item>
                <Descriptions.Item label="处理时限">{formatAlertTime(readProgramField(selectedRow, 'dueAt', ''))}</Descriptions.Item>
                <Descriptions.Item label="当前处理人">{readProgramField(selectedRow, 'currentHandler', readProgramField(selectedRow, 'owner', '未分配'))}</Descriptions.Item>
              </Descriptions>

              <div className="alert-business-sla">
                <div>
                  <span>SLA 进度</span>
                  <strong>{getAlertSlaPercent(selectedRow)}%</strong>
                </div>
                <Progress percent={getAlertSlaPercent(selectedRow)} status={getAlertSlaStatus(selectedRow)} />
              </div>

              <div className="alert-business-section">
                <div className="alert-business-section-title">处置结论</div>
                <p>{readProgramField(selectedRow, 'resolution', isAlertClosed(selectedRow) ? '已关闭，等待归档复核。' : '等待责任人补充处置结论。')}</p>
              </div>

              <div className="alert-business-section">
                <div className="alert-business-section-title">流程记录</div>
                <Timeline
                  items={(interactionEntries.length ? interactionEntries : [
                    { title: '创建告警', description: formatAlertTime(readProgramField(selectedRow, 'occurredAt', '')) },
                    { title: readProgramField(selectedRow, 'currentNode', '业务处理'), description: readProgramField(selectedRow, 'currentHandler', readProgramField(selectedRow, 'owner', '未分配')) },
                  ]).map((entry, index) => ({
                    color: index === 0 ? 'blue' : isAlertClosed(selectedRow) ? 'green' : 'gray',
                    children: (
                      <div className="workflow-step-item">
                        <strong>{entry.title}</strong>
                        <span>{entry.description}</span>
                      </div>
                    ),
                  }))}
                />
              </div>

              <Space wrap className="alert-business-record-actions">
                <Button type="primary">处理</Button>
                <Button>转派</Button>
                <Button>关闭</Button>
              </Space>
            </>
          ) : (
            <Empty description="请选择一条告警记录" />
          )}
        </aside>
      </div>
    </div>
  );
}

type BusinessCreateField = Pick<
  PlatformFormField,
  'field_name' | 'label' | 'field_type' | 'required' | 'visible_in_form' | 'enum_values' | 'default_value' | 'ui_config' | 'sort_order'
> & {
  editable?: boolean;
};

function isCodeCreateField(field: BusinessCreateField) {
  const uiConfig = field.ui_config || {};
  return (
    field.field_type === 'code'
    || uiConfig.businessType === 'code'
    || uiConfig.controlType === 'code'
    || Boolean(uiConfig.encodingRule)
  );
}

function makeAutoCodeValue(field: BusinessCreateField) {
  const rule = (field.ui_config?.encodingRule || {}) as Record<string, unknown>;
  const prefix = String(rule.prefix || field.field_name.slice(0, 2).toUpperCase());
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const seqLength = Number(rule.sequenceLength || 3);
  const seq = String(Math.floor(Math.random() * (10 ** Math.min(seqLength, 6)))).padStart(seqLength, '0');
  return `${prefix}-${date}-${seq}`;
}

function enumOptionsForCreateField(field: BusinessCreateField) {
  const raw = field.enum_values;
  if (!raw) return [];
  const values = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>).values)
      ? (raw as { values: unknown[] }).values
      : typeof (raw as Record<string, unknown>).source === 'string'
        ? String((raw as Record<string, unknown>).source).split(/[、,，/]/).map((item) => item.trim()).filter(Boolean)
        : Object.entries(raw).map(([value, label]) => ({ value, label }));
  return values.map((item: any) => (
    typeof item === 'string'
      ? { label: item, value: item }
      : { label: String(item.label ?? item.value), value: String(item.value ?? item.label) }
  ));
}

function normalizeBusinessCreateValue(value: unknown) {
  if (value && typeof value === 'object' && 'format' in value && typeof (value as { format?: unknown }).format === 'function') {
    return (value as { format: (pattern?: string) => string }).format('YYYY-MM-DDTHH:mm:ss');
  }
  return value;
}

function businessCreateInitialValues(fields: BusinessCreateField[]) {
  return fields.reduce<Record<string, unknown>>((values, field) => {
    if (field.default_value !== undefined && field.default_value !== null && field.default_value !== '') {
      values[field.field_name] = field.default_value;
    } else if (isCodeCreateField(field)) {
      values[field.field_name] = makeAutoCodeValue(field);
    }
    return values;
  }, {});
}

function renderBusinessCreateField(field: BusinessCreateField) {
  const disabled = field.editable === false || (isCodeCreateField(field) && field.ui_config?.locked !== false);
  const rules = disabled ? [] : [{ required: field.required, message: `请输入${field.label}` }];
  const commonProps = {
    key: field.field_name,
    name: field.field_name,
    label: field.label,
    rules,
  };
  if (field.field_type === 'number' || field.field_type === 'integer' || field.field_type === 'decimal') {
    return (
      <Form.Item {...commonProps}>
        <InputNumber style={{ width: '100%' }} disabled={disabled} placeholder={`请输入${field.label}`} />
      </Form.Item>
    );
  }
  if (field.field_type === 'enum') {
    return (
      <Form.Item {...commonProps}>
        <Select allowClear disabled={disabled} options={enumOptionsForCreateField(field)} placeholder={`请选择${field.label}`} />
      </Form.Item>
    );
  }
  if (field.field_type === 'date' || field.field_type === 'datetime') {
    return (
      <Form.Item {...commonProps}>
        <DatePicker showTime={field.field_type === 'datetime'} style={{ width: '100%' }} disabled={disabled} placeholder={`请选择${field.label}`} />
      </Form.Item>
    );
  }
  if (field.field_type === 'boolean') {
    return (
      <Form.Item {...commonProps}>
        <Select
          disabled={disabled}
          options={[{ value: true, label: '是' }, { value: false, label: '否' }]}
          placeholder={`请选择${field.label}`}
        />
      </Form.Item>
    );
  }
  if (field.field_type === 'text' || field.field_type === 'json') {
    return (
      <Form.Item {...commonProps}>
        <Input.TextArea rows={3} disabled={disabled} placeholder={`请输入${field.label}`} />
      </Form.Item>
    );
  }
  return (
    <Form.Item {...commonProps}>
      <Input disabled={disabled} placeholder={disabled ? '自动生成' : `请输入${field.label}`} />
    </Form.Item>
  );
}

function BusinessProgram({
  program,
  onSettings,
  onReload,
  loading,
}: {
  program: ProgramDefinition;
  onSettings: () => void;
  onReload: () => void;
  loading?: boolean;
}) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<ProgramRow | null>(null);
  const [filterValues, setFilterValues] = React.useState<Record<string, unknown>>({});
  const [createForm] = Form.useForm();
  const [filterForm] = Form.useForm();
  const [runtimeForm, setRuntimeForm] = React.useState<PlatformForm | null>(null);
  const [runtimeFormLoading, setRuntimeFormLoading] = React.useState(false);
  const [createSubmitting, setCreateSubmitting] = React.useState(false);
  const viewConfig = React.useMemo(() => normalizeViewConfig(program.viewConfig, programFieldsForView(program)), [program]);
  const activeFilters = React.useMemo(() => sortByOrder(viewConfig.filters).filter((filter) => filter.enabled), [viewConfig.filters]);
  const viewColumns = React.useMemo(() => sortByOrder(viewConfig.table.columns).filter((column) => column.enabled), [viewConfig.table.columns]);
  const runtimeCreateFields = React.useMemo<BusinessCreateField[]>(() => {
    if (!runtimeForm?.fields?.length) return [];
    const fieldPermissions = runtimeForm.runtime_field_permissions || {};
    return [...runtimeForm.fields]
      .filter((field) => !field.archived && field.visible_in_form && fieldPermissions[field.field_name]?.visible !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((field) => ({
        ...field,
        required: Boolean(fieldPermissions[field.field_name]?.required ?? field.required),
        editable: fieldPermissions[field.field_name]?.editable !== false,
      }));
  }, [program, runtimeForm]);
  const filteredRows = React.useMemo(() => program.rows.filter((row) => activeFilters.every((filter) => (
    programValueMatchesFilter(row, filter, filterValues[filter.id] ?? filter.defaultValue)
  ))), [activeFilters, filterValues, program.rows]);
  const selectedRowTitle = selectedRow
    ? String(selectedRow.name || selectedRow.title || selectedRow.planNo || selectedRow.requestNo || selectedRow.key || '记录详情')
    : '记录详情';
  const detailItems = React.useMemo(() => {
    if (!selectedRow) return [];
    const formData = getRowFormData(selectedRow);
    const visibleFields = viewColumns
      .map((viewColumn) => ({
        key: viewColumn.fieldName,
        label: viewColumn.label,
        value: selectedRow[viewColumn.fieldName] ?? formData[viewColumn.fieldName],
      }))
      .filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
    const visibleKeys = new Set(visibleFields.map((item) => item.key));
    const extraFields = Object.entries(formData)
      .filter(([key, value]) => !key.startsWith('_') && key !== 'key' && !visibleKeys.has(key) && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => ({ key, label: fieldLabelMap[key] || key, value }));
    return [...visibleFields, ...extraFields];
  }, [selectedRow, viewColumns]);
  const interactionEntries = React.useMemo(() => getInteractionEntries(selectedRow), [selectedRow]);
  const progressStatus = selectedRow
    ? String(selectedRow.processStatus || selectedRow.status || '未启动')
    : '未启动';
  const currentNode = selectedRow
    ? String(selectedRow.currentNode || selectedRow.status || '业务记录')
    : '业务记录';
  const currentHandler = selectedRow
    ? String(selectedRow.currentHandler || selectedRow.owner || '未分配')
    : '未分配';
  const configuredColumns = React.useMemo(() => {
    const baseColumns: ColumnsType<ProgramRow> = viewColumns
      .map<ColumnType<ProgramRow>>((viewColumn) => {
        const source = program.columns.find((column) => isDataColumn(column) && column.dataIndex === viewColumn.fieldName) as ColumnType<ProgramRow> | undefined;
        const renderCell = (value: unknown, record: ProgramRow) => {
          const formData = getRowFormData(record);
          const actual = value ?? formData[viewColumn.fieldName];
          if (actual === undefined || actual === null || actual === '') return viewColumn.emptyText || '-';
          if (viewColumn.renderType === 'tag') return <Tag>{String(actual)}</Tag>;
          return String(actual);
        };
        return {
          ...(source || {}),
          title: viewColumn.label,
          dataIndex: source?.dataIndex || viewColumn.fieldName,
          key: source?.key || viewColumn.fieldName,
          width: viewColumn.width,
          fixed: viewColumn.fixed,
          sorter: viewColumn.sortable ? source?.sorter || ((a: ProgramRow, b: ProgramRow) => String(a[viewColumn.fieldName] || '').localeCompare(String(b[viewColumn.fieldName] || ''))) : undefined,
          render: source?.render || renderCell,
        };
      });
    return [...baseColumns, { title: '操作', key: 'action', fixed: 'right' as const, width: 160, render: (_: unknown, record: ProgramRow) => <Space onClick={(event) => event.stopPropagation()}><Button type="link" size="small" onClick={() => setSelectedRow(record)}>详情</Button><Button type="link" size="small">处理</Button></Space> }];
  }, [program.columns, viewColumns]);

  const closeCreateModal = () => {
    setCreateOpen(false);
    createForm.resetFields();
  };

  React.useEffect(() => {
    let cancelled = false;
    const loadRuntimeForm = async () => {
      setRuntimeFormLoading(true);
      try {
        const formsResponse = await listPlatformForms();
        const forms = (formsResponse.data?.data || []) as PlatformForm[];
        const matchedForm = forms.find((form) => form.code === program.id);
        if (!matchedForm) {
          if (!cancelled) setRuntimeForm(null);
          return;
        }
        const detailResponse = await getPlatformForm(matchedForm.id, { schema: 'published' });
        if (!cancelled) {
          const detail = (detailResponse.data?.data || matchedForm) as PlatformForm;
          setRuntimeForm(detail.fields?.length ? detail : null);
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeForm(null);
          console.warn('business form load failed', error);
        }
      } finally {
        if (!cancelled) setRuntimeFormLoading(false);
      }
    };
    void loadRuntimeForm();
    return () => {
      cancelled = true;
    };
  }, [program.id]);

  const openCreateModal = () => {
    if (!runtimeForm) {
      message.warning('当前页面没有绑定后台表单设计，不能新增业务记录');
      return;
    }
    createForm.resetFields();
    createForm.setFieldsValue(businessCreateInitialValues(runtimeCreateFields));
    setCreateOpen(true);
  };

  const submitCreateModal = async () => {
    const values = await createForm.validateFields();
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, normalizeBusinessCreateValue(value)]),
    );
    if (!runtimeForm) {
      message.warning('当前页面还没有绑定后台表单设计，不能写入业务记录');
      return;
    }
    setCreateSubmitting(true);
    try {
      await createPlatformDynamicRecord(runtimeForm.id, payload);
      message.success(`${runtimeForm.name || program.title} 已新增`);
      closeCreateModal();
      onReload();
    } catch (error) {
      console.error('create dynamic record failed', error);
      message.error('新增失败，请检查表单字段和权限配置');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const renderProgramFilterControl = (filter: ViewFilterConfig) => {
    const placeholder = filter.placeholder || filter.label;
    if (filter.controlType === 'dateRange') return <RangePicker />;
    if (filter.controlType === 'select' || filter.controlType === 'relation') {
      const options = Array.from(new Set(program.rows.map((row) => row[filter.fieldName]).filter(Boolean))).map((value) => ({ value: String(value), label: String(value) }));
      return <Select allowClear placeholder={placeholder} options={options} />;
    }
    return <Input allowClear prefix={filter.controlType === 'keyword' ? <SearchOutlined /> : undefined} placeholder={placeholder} />;
  };

  return (
    <>
      <div className="app-business-page">
      <div className="app-business-content">
        <div className="app-business-title-row">
          <Typography.Title level={4}>{program.title}</Typography.Title>
          <Space size={8} wrap>
            <Button type="primary" icon={<PlusOutlined />} loading={runtimeFormLoading} onClick={openCreateModal}>新增</Button>
            <Button icon={<UploadOutlined />}>申请</Button>
            <Button>批量处理</Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={onReload}>刷新</Button>
            <Button icon={<DownloadOutlined />}>导出</Button>
            <Button icon={<SettingOutlined />} onClick={onSettings}>设置</Button>
          </Space>
        </div>
        <Form
          className="app-business-search-grid app-business-configured-search"
          form={filterForm}
          colon={false}
          layout="horizontal"
          onFinish={(values) => setFilterValues(values)}
        >
          {activeFilters.map((filter) => (
            <Form.Item key={filter.id} name={filter.id} label={filter.label} initialValue={filter.defaultValue}>
              {renderProgramFilterControl(filter)}
            </Form.Item>
          ))}
          <Form.Item className="app-business-search-actions" label=" ">
            <Space>
              <Button onClick={() => { filterForm.resetFields(); setFilterValues({}); }}>重置</Button>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>查询</Button>
            </Space>
          </Form.Item>
        </Form>

        <Table<ProgramRow>
          className="app-business-data-table"
          rowKey="key"
          size={viewConfig.table.density === 'compact' ? 'small' : viewConfig.table.density === 'large' ? 'large' : 'middle'}
          columns={configuredColumns}
          dataSource={filteredRows}
          loading={loading}
          pagination={{ pageSize: viewConfig.table.pageSize, showSizeChanger: false, showTotal: (total) => `共 ${total} 条记录` }}
          scroll={{ x: 1100, y: '100%' }}
          rowClassName={(record) => record.key === selectedRow?.key ? 'app-business-row-selected' : ''}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
          })}
        />
      </div>
    </div>

      <Modal
        title={`新增${runtimeForm?.name || program.title}`}
        open={createOpen}
        width={820}
        okText={runtimeForm ? '保存' : '确认'}
        cancelText="取消"
        confirmLoading={createSubmitting}
        onCancel={closeCreateModal}
        onOk={submitCreateModal}
      >
        <Form form={createForm} layout="vertical" className="app-business-create-form">
          <Row gutter={12}>
            {runtimeCreateFields.map((field) => (
              <Col key={field.field_name} xs={24} md={field.field_type === 'text' || field.field_type === 'json' ? 24 : 12}>
                {renderBusinessCreateField(field)}
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>

      <Drawer
        className="workflow-detail-drawer app-business-detail-drawer"
        destroyOnClose
        extra={(
          <Space>
            <Button size="small">处理</Button>
            <Button size="small" type="primary">编辑</Button>
          </Space>
        )}
        onClose={() => setSelectedRow(null)}
        open={Boolean(selectedRow)}
        placement="right"
        title={selectedRowTitle}
        width={460}
      >
        {selectedRow ? (
          <div className="workflow-detail-content app-business-detail-body">
            <div className="workflow-detail-head">
              <FileSearchOutlined />
              <div>
                <Typography.Text strong>{selectedRowTitle}</Typography.Text>
                <Typography.Text type="secondary">{program.title} · 表单记录</Typography.Text>
              </div>
              {selectedRow.status ? <Tag color={String(selectedRow.status).includes('关闭') ? 'default' : 'processing'}>{String(selectedRow.status)}</Tag> : null}
            </div>
            <Tabs
              className="workflow-detail-tabs"
              items={[
                {
                  key: 'form',
                  label: '表单信息',
                  children: (
                    <div className="workflow-tab-page">
                      <Form layout="vertical" className="workflow-business-form">
                        <div className="workflow-form-section-title">业务表单</div>
                        <Row gutter={12}>
                          {detailItems.map((item) => (
                            <Col xs={24} md={12} key={item.key}>
                              <Form.Item label={item.label}>
                                <Input value={formatDetailValue(item.value)} readOnly />
                              </Form.Item>
                            </Col>
                          ))}
                        </Row>
                      </Form>
                    </div>
                  ),
                },
                {
                  key: 'progress',
                  label: '流程进度',
                  children: (
                    <div className="workflow-tab-page">
                      <div className="workflow-progress-summary">
                        <div>
                          <span>当前节点</span>
                          <strong>{currentNode}</strong>
                        </div>
                        <div>
                          <span>当前处理人</span>
                          <strong>{currentHandler}</strong>
                        </div>
                        <Tag color={progressStatus.includes('完成') || progressStatus.includes('关闭') ? 'green' : 'blue'}>{progressStatus}</Tag>
                      </div>
                      <div className="workflow-progress-card">
                        <div className="workflow-form-section-title">处理记录</div>
                        <Timeline
                          items={(interactionEntries.length ? interactionEntries : [
                            { title: '创建业务记录', description: formatDetailValue(selectedRow._createdAt || selectedRow.occurredAt) },
                            { title: currentNode, description: currentHandler },
                          ]).map((entry, index) => ({
                            color: index === 0 ? 'blue' : 'gray',
                            children: (
                              <div className="workflow-step-item">
                                <strong>{entry.title}</strong>
                                <span>{entry.description}</span>
                              </div>
                            ),
                          }))}
                        />
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </Drawer>
    </>
  );
}function AnalysisProgram({ program, onSettings, loading }: { program: ProgramDefinition; onSettings: () => void; loading?: boolean }) {
  return (
    <>
      <Card title="分析筛选" className="app-program-card app-program-filter-card">
        <div className="app-program-filter-grid">
          <RangePicker />
          <Select allowClear placeholder="分析维度" options={[{ value: 'line', label: '按产线' }, { value: 'asset', label: '按设备' }, { value: 'supplier', label: '按供应商' }]} />
          <Select allowClear placeholder="组织范围" options={[{ value: 'factory', label: '当前工厂' }, { value: 'workshop', label: '当前车间' }]} />
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索对象" />
          <Space>
            <Button type="primary" icon={<SearchOutlined />}>分析</Button>
            <Button>重置</Button>
          </Space>
        </div>
      </Card>

      <Row gutter={[12, 12]}>
        {program.metrics.map((metric) => (
          <Col xs={24} sm={12} lg={6} key={metric.label}>
            <Card className={`app-program-stat ${toneClassMap[metric.tone]}`}>
              <Statistic title={metric.label} value={metric.value} suffix={metric.suffix} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} className="app-program-body">
        <Col xs={24} xl={14}>
          <Card title="趋势分析" extra={<Button type="link" size="small">钻取明细</Button>} className="app-program-card app-program-chart-card">
            <div className="app-program-line-chart">
              {[46, 58, 52, 71, 64, 76, 69, 82, 74, 88, 79, 91].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="重点关注" className="app-program-card app-program-chart-card">
            <Space direction="vertical" size={10} className="app-program-focus">
              {program.focus.map((item, index) => (
                <div className="app-program-focus-item" key={item}>
                  <span className="app-program-focus-index">{index + 1}</span>
                  <Typography.Text>{item}</Typography.Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="分布占比" className="app-program-card app-program-chart-card">
            <div className="app-program-donut-wrap">
              <div className="app-program-donut" />
              <Space direction="vertical" size={6}>
                <Tag color="red">高风险 18%</Tag>
                <Tag color="orange">中风险 34%</Tag>
                <Tag color="green">正常 48%</Tag>
              </Space>
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="钻取明细" extra={<Button type="link" size="small">下载图表</Button>} className="app-program-card">
            <Table<ProgramRow>
              rowKey="key"
              size="middle"
              columns={program.columns}
              dataSource={program.rows}
              loading={loading}
              pagination={false}
              scroll={{ x: 760 }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
export default AppProgramPage;
