import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ApartmentOutlined,
  BarChartOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EyeOutlined,
  FileDoneOutlined,
  FormOutlined,
  LineChartOutlined,
  LockOutlined,
  SaveOutlined,
  SendOutlined,
  SettingOutlined,
  TableOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';

type ConfigKind = 'metric' | 'chart' | 'table' | 'form' | 'panel' | 'action';

interface PageComponent {
  id: string;
  label: string;
  kind: ConfigKind;
  binding: string;
  group: string;
  required: boolean;
  visible: boolean;
  readonly: boolean;
  width: 'quarter' | 'half' | 'full';
  description: string;
}

interface FlowNode {
  id: string;
  title: string;
  role: string;
  status: 'draft' | 'active' | 'done';
  trigger: string;
}

interface PermissionRow {
  role: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  scope: string;
}

interface PageSchema {
  title: string;
  description: string;
  layout: string;
  components: PageComponent[];
  flows: FlowNode[];
  permissions: PermissionRow[];
}

const componentTypes: { label: string; value: ConfigKind }[] = [
  { label: '指标卡', value: 'metric' },
  { label: '图表', value: 'chart' },
  { label: '数据表格', value: 'table' },
  { label: '业务表单', value: 'form' },
  { label: '信息面板', value: 'panel' },
  { label: '操作按钮', value: 'action' },
];

const defaultPermissions: PermissionRow[] = [
  { role: '平台管理员', view: true, create: true, edit: true, delete: true, export: true, scope: '全部工厂' },
  { role: '生产经理', view: true, create: true, edit: true, delete: false, export: true, scope: '所属工厂' },
  { role: '班组长', view: true, create: true, edit: true, delete: false, export: false, scope: '所属产线' },
  { role: '操作员', view: true, create: true, edit: false, delete: false, export: false, scope: '本人数据' },
];

const pageSchemas: Record<string, PageSchema> = {
  '/': {
    title: '我的工作台',
    description: '对应个人工作台：首页汇总可配置表单、数据资产、配置能力地图和平台状态。',
    layout: '指标区 + 配置列表 + 能力地图 + 平台状态',
    components: [
      component('configurable-forms', '可配置表单', 'metric', 'workspace.forms', '工作台指标', '展示可配置业务表单数量', 'quarter'),
      component('draft-apps', '草稿应用', 'metric', 'workspace.drafts', '工作台指标', '展示待发布配置数量', 'quarter'),
      component('data-assets', '数据资产', 'metric', 'workspace.assets', '工作台指标', '展示已接入数据资产', 'quarter'),
      component('workflow-tasks', '流程任务', 'metric', 'workspace.tasks', '工作台指标', '展示待处理流程任务', 'quarter'),
      component('form-config-list', '表单级低代码配置', 'table', 'workspace.form_configs', '配置入口', '展示设备、质量、供应链、工单等表单配置入口', 'full'),
      component('capability-map', '配置能力地图', 'panel', 'workspace.capabilities', '能力地图', '展示表单设计、数据模型、分析页面、流程权限', 'full'),
      component('platform-signals', '平台状态', 'panel', 'workspace.platform_signals', '平台状态', '展示发布率、同步状态、告警和审批配置', 'half'),
    ],
    flows: [
      flow('open', '打开工作台', '业务用户', 'active', '用户登录后进入首页'),
      flow('configure', '进入配置', '管理员', 'draft', '从工作台或页面设置进入配置态'),
      flow('publish', '发布配置', '管理员', 'draft', '配置通过后发布给对应角色'),
    ],
    permissions: defaultPermissions,
  },
  '/maintenance': {
    title: '预测性维护',
    description: '对应设备维护页面：四个健康指标卡、设备健康总览、健康分析、故障预测和工单管理。',
    layout: '指标区 + 双栏分析区 + 两个全宽表格',
    components: [
      component('total-equipment', '设备总数', 'metric', 'summary.total', '预测性维护指标', '展示设备资产总量', 'quarter'),
      component('healthy-equipment', '健康设备', 'metric', 'summary.healthy', '预测性维护指标', '展示健康状态设备数量', 'quarter'),
      component('warning-equipment', '预警设备', 'metric', 'summary.warning', '预测性维护指标', '展示进入预警状态的设备数量', 'quarter'),
      component('critical-equipment', '严重风险', 'metric', 'summary.critical', '预测性维护指标', '展示高风险或严重异常设备数量', 'quarter'),
      component('equipment-health-overview', '设备健康总览', 'table', 'equipment_health.equipment', '设备健康总览', '设备列表、状态、健康评分和风险等级', 'half'),
      component('equipment-health-analysis', '设备健康分析', 'chart', 'equipment_health.breakdown', '健康分析', '展示振动、温度、压力、电气、磨损雷达图', 'half'),
      component('fault-prediction', '故障预测', 'table', 'fault_predictions.data', '故障预测', '展示故障概率、预测故障和预计天数', 'full'),
      component('work-order-management', '工单管理', 'table', 'work_orders.data', '工单管理', '展示维修工单、优先级、状态和负责人', 'full'),
    ],
    flows: [
      flow('monitor', '设备状态采集', '系统', 'done', '周期同步设备健康数据'),
      flow('predict', '故障预测', 'AI 模型', 'active', '健康评分或传感器异常时触发'),
      flow('dispatch', '生成维修工单', '维修主管', 'draft', '高风险预测自动生成工单'),
      flow('close', '维修关闭', '维修工程师', 'draft', '工单完成后回写设备状态'),
    ],
    permissions: defaultPermissions,
  },
  '/dashboard': {
    title: '生产态势',
    description: '对应生产态势 Dashboard：核心 KPI、OEE 总览、生产趋势和告警列表。',
    layout: '六个 KPI 指标 + 两个图表 + 告警表格',
    components: [
      component('factory-count', '工厂数量', 'metric', 'overview.factories.count', '生产 KPI', '展示纳入统计的工厂数量', 'quarter'),
      component('equipment-total', '设备总数', 'metric', 'overview.equipment.total', '生产 KPI', '展示设备资产总数', 'quarter'),
      component('running-lines', '运行产线', 'metric', 'overview.production_lines.running', '生产 KPI', '展示当前运行产线数量', 'quarter'),
      component('work-orders', '工单总数', 'metric', 'overview.work_orders.total', '生产 KPI', '展示生产工单总量', 'quarter'),
      component('oee-overview', '产线 OEE 总览', 'chart', 'oee.lines', 'OEE 分析', '展示可用率、性能、质量的堆叠柱图', 'full'),
      component('production-trend', '近 7 日生产趋势', 'chart', 'production_stats.daily', '生产趋势', '展示计划产量、实际产量和良率趋势', 'full'),
      component('active-alerts', '实时告警列表', 'table', 'alerts.data', '告警管理', '展示告警等级、类型、标题和消息', 'full'),
    ],
    flows: [
      flow('sync', '同步生产数据', '系统', 'done', '定时同步 overview / OEE / production stats'),
      flow('alert', '告警识别', '规则引擎', 'active', '指标超过阈值时生成告警'),
      flow('assign', '告警分派', '生产经理', 'draft', '高等级告警进入处理流程'),
    ],
    permissions: defaultPermissions,
  },
  '/quality': {
    title: '质量分析',
    description: '对应质量页面：检验批次、缺陷趋势、SPC 控制图和异常复核。',
    layout: '质量指标 + SPC 图表 + 缺陷明细表',
    components: [
      component('inspection-batches', '检验批次', 'metric', 'quality.batches', '质量指标', '展示当前检验批次数量', 'quarter'),
      component('defect-count', '缺陷数量', 'metric', 'quality.defect_count', '质量指标', '展示缺陷记录数量', 'quarter'),
      component('yield-rate', '良率', 'metric', 'quality.yield_rate', '质量指标', '展示质量良率', 'quarter'),
      component('spc-chart', 'SPC 控制图', 'chart', 'quality.spc_points', 'SPC 分析', '展示控制上下限和采样点', 'full'),
      component('defect-table', '缺陷明细', 'table', 'quality.defects', '缺陷管理', '展示缺陷类型、等级和处理状态', 'full'),
    ],
    flows: [
      flow('inspect', '质量检验', '质检员', 'active', '创建检验记录'),
      flow('review', '异常复核', '质量工程师', 'draft', '缺陷超过阈值时触发'),
      flow('correct', '纠正措施', '生产经理', 'draft', '复核通过后生成整改任务'),
    ],
    permissions: defaultPermissions,
  },
  '/supply-chain': {
    title: '供应链风险',
    description: '对应供应链页面：供应商风险、交付趋势、物料异常和处置任务。',
    layout: '风险指标 + 风险图表 + 供应商表格',
    components: [
      component('supplier-count', '供应商数量', 'metric', 'supply.suppliers', '供应链指标', '展示供应商总数', 'quarter'),
      component('risk-suppliers', '高风险供应商', 'metric', 'supply.high_risk', '供应链指标', '展示高风险供应商数量', 'quarter'),
      component('delivery-rate', '准时交付率', 'metric', 'supply.delivery_rate', '供应链指标', '展示准时交付表现', 'quarter'),
      component('risk-radar', '供应风险雷达', 'chart', 'supply.risk_scores', '风险分析', '展示质量、交付、价格和合规风险', 'full'),
      component('supplier-table', '供应商风险明细', 'table', 'supply.supplier_risks', '供应商管理', '展示供应商风险等级和处置建议', 'full'),
    ],
    flows: [
      flow('score', '风险评分', '系统', 'active', '供应商数据更新后重新评分'),
      flow('review', '风险复核', '采购经理', 'draft', '高风险供应商进入复核'),
      flow('mitigate', '处置跟踪', '供应链负责人', 'draft', '复核后生成处置任务'),
    ],
    permissions: defaultPermissions,
  },
};

const fallbackSchema: PageSchema = {
  title: '业务页面',
  description: '当前页面尚未建立专属 schema，先使用通用页面配置组件。',
  layout: '标题栏 + 内容区',
  components: [
    component('page-title', '页面标题', 'panel', 'page.title', '基础结构', '配置页面名称和说明', 'full'),
    component('main-table', '主数据表格', 'table', 'page.records', '主要内容', '配置列表字段、筛选和操作列', 'full'),
  ],
  flows: [flow('submit', '提交', '业务用户', 'active', '用户提交业务记录')],
  permissions: defaultPermissions,
};

function component(
  id: string,
  label: string,
  kind: ConfigKind,
  binding: string,
  group: string,
  description: string,
  width: PageComponent['width'],
): PageComponent {
  return {
    id,
    label,
    kind,
    binding,
    group,
    description,
    width,
    required: false,
    visible: true,
    readonly: false,
  };
}

function flow(id: string, title: string, role: string, status: FlowNode['status'], trigger: string): FlowNode {
  return { id, title, role, status, trigger };
}

export default function AppBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetPage = searchParams.get('target') || '/maintenance';
  const schema = pageSchemas[targetPage] || fallbackSchema;
  const [components, setComponents] = useState<PageComponent[]>(schema.components);
  const [selectedId, setSelectedId] = useState(schema.components[0]?.id ?? '');

  useEffect(() => {
    setComponents(schema.components);
    setSelectedId(schema.components[0]?.id ?? '');
  }, [schema, targetPage]);

  const selected = components.find((item) => item.id === selectedId) ?? components[0];

  const updateSelected = (patch: Partial<PageComponent>) => {
    if (!selected) return;
    setComponents((prev) => prev.map((item) => (item.id === selected.id ? { ...item, ...patch } : item)));
  };

  const tabs = [
    {
      key: 'form',
      label: '表单设置',
      children: (
        <ComponentSettings
          components={components}
          selected={selected}
          selectedId={selectedId}
          layout={schema.layout}
          onSelect={setSelectedId}
          onUpdate={updateSelected}
        />
      ),
    },
    {
      key: 'workflow',
      label: '流程设置',
      children: <WorkflowSettings flowNodes={schema.flows} />,
    },
    {
      key: 'permission',
      label: '权限设置',
      children: <PermissionSettings permissions={schema.permissions} />,
    },
  ];

  return (
    <div className="app-builder-page form-studio-page">
      <section className="builder-header form-studio-header">
        <div>
          <Typography.Title level={3}>{schema.title}配置</Typography.Title>
          <Typography.Paragraph>
            正在配置：{targetPage}。{schema.description}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => navigate(targetPage)}>
            返回业务页
          </Button>
          <Button icon={<SaveOutlined />} onClick={() => message.success('已保存为草稿')}>
            保存草稿
          </Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => message.success('已发布配置')}>
            发布配置
          </Button>
        </Space>
      </section>

      <Card className="studio-tabs-card">
        <Tabs defaultActiveKey="form" items={tabs} />
      </Card>
    </div>
  );
}

function ComponentSettings({
  components,
  selected,
  selectedId,
  layout,
  onSelect,
  onUpdate,
}: {
  components: PageComponent[];
  selected?: PageComponent;
  selectedId: string;
  layout: string;
  onSelect: (id: string) => void;
  onUpdate: (patch: Partial<PageComponent>) => void;
}) {
  return (
    <div className="builder-shell form-settings-shell">
      <aside className="builder-sidebar">
        <PanelTitle icon={<FormOutlined />} title="页面组件" />
        <div className="builder-palette">
          {components.map((item) => (
            <button
              key={item.id}
              className={selectedId === item.id ? 'active' : ''}
              onClick={() => onSelect(item.id)}
            >
              <span><ComponentIcon type={item.kind} /></span>
              <strong>{item.label}</strong>
              <small>{item.binding}</small>
            </button>
          ))}
        </div>
      </aside>

      <main className="builder-canvas form-canvas">
        <div className="canvas-topbar">
          <span>运行页面画布</span>
          <Space size={6}>
            <Tag>{layout}</Tag>
            <Tag>{components.length} components</Tag>
            <Tag color="processing">Draft</Tag>
          </Space>
        </div>
        <Row gutter={[12, 12]}>
          {components.map((item) => (
            <Col xs={24} md={spanForWidth(item.width)} key={item.id}>
              <button
                className={`form-field-preview ${selectedId === item.id ? 'selected' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                <label>
                  {item.label}
                  {item.required && <Tag color="red">必配</Tag>}
                  {!item.visible && <Tag>隐藏</Tag>}
                </label>
                <div className={`field-control field-${item.kind}`}>
                  <ComponentIcon type={item.kind} />
                  <span>{componentTypes.find((type) => type.value === item.kind)?.label}</span>
                </div>
                <small>{item.group} · {item.description}</small>
              </button>
            </Col>
          ))}
        </Row>
      </main>

      <aside className="builder-properties">
        <PanelTitle icon={<SettingOutlined />} title="组件属性" />
        {selected ? (
          <Form layout="vertical" size="small">
            <Form.Item label="组件名称">
              <Input value={selected.label} onChange={(event) => onUpdate({ label: event.target.value })} />
            </Form.Item>
            <Form.Item label="组件类型">
              <Select value={selected.kind} options={componentTypes} onChange={(kind) => onUpdate({ kind })} />
            </Form.Item>
            <Form.Item label="数据绑定">
              <Input value={selected.binding} onChange={(event) => onUpdate({ binding: event.target.value })} />
            </Form.Item>
            <Form.Item label="所属区域">
              <Input value={selected.group} onChange={(event) => onUpdate({ group: event.target.value })} />
            </Form.Item>
            <Form.Item label="宽度">
              <Select
                value={selected.width}
                options={[
                  { label: '1/4', value: 'quarter' },
                  { label: '1/2', value: 'half' },
                  { label: '整行', value: 'full' },
                ]}
                onChange={(width) => onUpdate({ width })}
              />
            </Form.Item>
            <div className="property-switches">
              <Switch checked={selected.required} onChange={(required) => onUpdate({ required })} />
              <span>必配</span>
              <Switch checked={selected.visible} onChange={(visible) => onUpdate({ visible })} />
              <span>可见</span>
              <Switch checked={selected.readonly} onChange={(readonly) => onUpdate({ readonly })} />
              <span>只读</span>
            </div>
          </Form>
        ) : (
          <Typography.Text type="secondary">请选择一个组件进行配置</Typography.Text>
        )}
      </aside>
    </div>
  );
}

function WorkflowSettings({ flowNodes }: { flowNodes: FlowNode[] }) {
  return (
    <div className="studio-two-column">
      <Card className="studio-panel" title="流程节点">
        <div className="flow-canvas">
          {flowNodes.map((node, index) => (
            <div className={`flow-node flow-node-${node.status}`} key={node.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{node.title}</strong>
                <small>{node.role} · {node.trigger}</small>
              </div>
              <Tag color={node.status === 'done' ? 'success' : node.status === 'active' ? 'processing' : 'default'}>
                {node.status === 'done' ? '已完成' : node.status === 'active' ? '进行中' : '待配置'}
              </Tag>
            </div>
          ))}
        </div>
      </Card>
      <Card className="studio-panel" title="节点属性">
        <Form layout="vertical" size="small">
          <Form.Item label="默认处理角色">
            <Select value={flowNodes[0]?.role} options={flowNodes.map((node) => ({ label: node.role, value: node.role }))} />
          </Form.Item>
          <Form.Item label="触发条件">
            <Input value={flowNodes[0]?.trigger} readOnly />
          </Form.Item>
          <Form.Item label="自动动作">
            <Checkbox.Group value={['notify']} options={[
              { label: '发送通知', value: 'notify' },
              { label: '生成任务', value: 'task' },
              { label: '调用接口', value: 'api' },
            ]} />
          </Form.Item>
          <Form.Item label="超时策略">
            <Select value="24h-remind" options={[
              { label: '24 小时未处理自动提醒', value: '24h-remind' },
              { label: '48 小时自动升级', value: '48h-escalate' },
            ]} />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

function PermissionSettings({ permissions }: { permissions: PermissionRow[] }) {
  const columns = [
    { title: '角色', dataIndex: 'role', key: 'role' },
    { title: '查看', dataIndex: 'view', key: 'view', render: renderSwitch },
    { title: '新增', dataIndex: 'create', key: 'create', render: renderSwitch },
    { title: '编辑', dataIndex: 'edit', key: 'edit', render: renderSwitch },
    { title: '删除', dataIndex: 'delete', key: 'delete', render: renderSwitch },
    { title: '导出', dataIndex: 'export', key: 'export', render: renderSwitch },
    { title: '数据范围', dataIndex: 'scope', key: 'scope' },
  ];

  return (
    <div className="permission-settings">
      <Card className="studio-panel" title="角色权限矩阵">
        <Table rowKey="role" columns={columns} dataSource={permissions} pagination={false} size="small" />
      </Card>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card className="studio-panel" title="组件级权限">
            <div className="permission-list">
              <PermissionItem title="指标区" detail="生产经理可见，操作员只读" icon={<LockOutlined />} />
              <PermissionItem title="表格导出" detail="仅管理员和生产经理可导出" icon={<FileDoneOutlined />} />
              <PermissionItem title="异常处置" detail="按流程节点角色控制编辑权" icon={<ThunderboltOutlined />} />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="studio-panel" title="发布范围">
            <div className="permission-list">
              <PermissionItem title="组织范围" detail="按工厂、产线、班组发布" icon={<ApartmentOutlined />} />
              <PermissionItem title="数据范围" detail="按所属工厂、所属产线和本人数据过滤" icon={<DatabaseOutlined />} />
              <PermissionItem title="审计策略" detail="记录组件变更、流程动作和发布版本" icon={<TeamOutlined />} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function spanForWidth(width: PageComponent['width']) {
  if (width === 'quarter') return 6;
  if (width === 'half') return 12;
  return 24;
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="builder-panel-title">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function ComponentIcon({ type }: { type: ConfigKind }) {
  if (type === 'metric') return <DashboardOutlined />;
  if (type === 'chart') return <LineChartOutlined />;
  if (type === 'table') return <TableOutlined />;
  if (type === 'panel') return <BarChartOutlined />;
  if (type === 'action') return <ThunderboltOutlined />;
  return <FormOutlined />;
}

function PermissionItem({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return (
    <div className="permission-item">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function renderSwitch(value: boolean) {
  return <Switch size="small" checked={value} />;
}
