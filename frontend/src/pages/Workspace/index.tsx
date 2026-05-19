import {
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExperimentOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  FormOutlined,
  LayoutOutlined,
  NodeIndexOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Progress, Row, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';

const workspaceStats = [
  { label: '可配置表单', value: '18', detail: '字段、布局、权限可配置', icon: <FormOutlined /> },
  { label: '草稿应用', value: '7', detail: '2 个待发布', icon: <FileSearchOutlined /> },
  { label: '数据资产', value: '46', detail: '18 个已映射', icon: <DatabaseOutlined /> },
  { label: '流程任务', value: '9', detail: '4 个待审批', icon: <CheckCircleOutlined /> },
];

const formConfigs = [
  {
    name: '设备点检表单',
    domain: '设备维护',
    fields: 24,
    layout: '两栏布局',
    workflow: '点检审批',
    status: '已发布',
    path: '/model-driven?target=/maintenance',
  },
  {
    name: '质量检验表单',
    domain: '质量分析',
    fields: 31,
    layout: '分组表单',
    workflow: '异常复核',
    status: '配置中',
    path: '/model-driven?target=/quality',
  },
  {
    name: '供应商评估表单',
    domain: '供应链风险',
    fields: 18,
    layout: '评分矩阵',
    workflow: '准入审批',
    status: '草稿',
    path: '/model-driven?target=/supply-chain',
  },
  {
    name: '生产态势页面',
    domain: '生产管理',
    fields: 7,
    layout: '指标与图表',
    workflow: '告警处置',
    status: '已发布',
    path: '/model-driven?target=/dashboard',
  },
];

const builderEntries = [
  {
    title: '表单设置',
    subtitle: '配置字段、控件、布局、显隐规则和数据绑定',
    icon: <FormOutlined />,
    path: '/model-driven?target=/maintenance',
    nodes: ['字段', '布局', '规则'],
  },
  {
    title: '数据模型',
    subtitle: '为页面组件绑定实体、字段和关系',
    icon: <NodeIndexOutlined />,
    path: '/ontology',
    nodes: ['Entity', 'Field', 'Relation'],
  },
  {
    title: '分析页面',
    subtitle: '把业务数据组合成指标、图表和报表',
    icon: <BarChartOutlined />,
    path: '/reports',
    nodes: ['KPI', 'Chart', 'Filter'],
  },
  {
    title: '流程与权限',
    subtitle: '配置审批流、角色、发布范围和审计',
    icon: <ThunderboltOutlined />,
    path: '/rules',
    nodes: ['Workflow', 'Role', 'Audit'],
  },
];

const platformSignals = [
  { label: '表单发布率', value: '72%', tone: 'good' },
  { label: '模型同步', value: '12 min ago', tone: 'good' },
  { label: '异常告警', value: '5', tone: 'warn' },
  { label: '待审批配置', value: '4', tone: 'info' },
];

export default function WorkspacePage() {
  const navigate = useNavigate();

  return (
    <div className="workspace-page">
      <Row gutter={[16, 16]}>
        {workspaceStats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.label}>
            <Card className="metric-card" variant="borderless">
              <span className="metric-icon">{stat.icon}</span>
              <div>
                <span className="metric-label">{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.detail}</small>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} xl={16}>
          <Card
            className="workspace-section"
            title="表单级低代码配置"
            extra={<Button type="link" icon={<SettingOutlined />} onClick={() => navigate('/model-driven?target=/')}>配置工作台</Button>}
          >
            <div className="form-config-grid">
              {formConfigs.map((form) => (
                <button className="form-config-card" key={form.name} onClick={() => navigate(form.path)}>
                  <div className="form-config-head">
                    <span>
                      <strong>{form.name}</strong>
                      <small>{form.domain}</small>
                    </span>
                    <Tag color={form.status === '已发布' ? 'success' : form.status === '配置中' ? 'processing' : 'warning'}>
                      {form.status}
                    </Tag>
                  </div>
                  <div className="form-config-meta">
                    <em><EditOutlined /> {form.fields} 个组件</em>
                    <em><LayoutOutlined /> {form.layout}</em>
                    <em><FileDoneOutlined /> {form.workflow}</em>
                  </div>
                  <div className="form-config-actions">
                    <span>配置组件</span>
                    <span>配置流程</span>
                    <span>配置权限</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card
            className="workspace-section"
            title="配置能力地图"
            extra={<Button type="link" onClick={() => navigate('/model-driven?target=/maintenance')}>打开配置中心</Button>}
          >
            <Row gutter={[12, 12]}>
              {builderEntries.map((entry) => (
                <Col xs={24} md={12} key={entry.title}>
                  <button className="builder-tile" onClick={() => navigate(entry.path)}>
                    <span className="builder-tile-icon">{entry.icon}</span>
                    <span>
                      <strong>{entry.title}</strong>
                      <small>{entry.subtitle}</small>
                    </span>
                    <div className="builder-flow">
                      {entry.nodes.map((node) => (
                        <em key={node}>{node}</em>
                      ))}
                    </div>
                  </button>
                </Col>
              ))}
            </Row>
          </Card>

          <Card className="workspace-section canvas-preview-card" title="页面组件配置预览">
            <div className="builder-preview">
              <aside>
                <span>组件库</span>
                <em><DatabaseOutlined /> 指标卡</em>
                <em><BarChartOutlined /> 分析图表</em>
                <em><ExperimentOutlined /> 规则校验</em>
              </aside>
              <main>
                <div className="preview-toolbar">
                  <span>设备维护页面</span>
                  <Tag color="processing">Draft</Tag>
                </div>
                <div className="preview-grid">
                  <div className="preview-kpi">健康设备<strong>128</strong></div>
                  <div className="preview-kpi">预警设备<strong>14</strong></div>
                  <div className="preview-chart" />
                  <div className="preview-table" />
                </div>
              </main>
              <aside>
                <span>配置项</span>
                <em>数据源: equipment_health</em>
                <em>联动: 工厂 / 产线 / 设备</em>
                <em>权限: 生产经理 / 维修员</em>
              </aside>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card className="workspace-section" title="平台状态">
            <div className="signal-list">
              {platformSignals.map((signal) => (
                <div className={`signal-item signal-${signal.tone}`} key={signal.label}>
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                </div>
              ))}
            </div>
            <DividerLine />
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className="health-row">
                <span><SafetyCertificateOutlined /> 配置健康度</span>
                <strong>92</strong>
              </div>
              <Progress percent={92} showInfo={false} strokeColor="#2f5f73" />
              <div className="health-row">
                <span><ClockCircleOutlined /> 最近发布</span>
                <Tag color="success">设备点检表单</Tag>
              </div>
            </Space>
          </Card>

          <Card className="workspace-section launch-card" variant="borderless">
            <RocketOutlined />
            <Typography.Title level={4}>从一个业务页面开始</Typography.Title>
            <Typography.Paragraph>
              先配置页面组件，再绑定数据模型、流程和权限，最后发布成可用的业务页面。
            </Typography.Paragraph>
            <Button block type="primary" onClick={() => navigate('/model-driven?target=/maintenance')}>
              新建页面配置
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function DividerLine() {
  return <div className="divider-line" />;
}
