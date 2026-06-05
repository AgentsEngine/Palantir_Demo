import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
  FormOutlined,
  HistoryOutlined,
  InboxOutlined,
  RightOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { Button, Col, Drawer, Form, Input, Row, Space, Tabs, Tag, Timeline, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export type WorkflowTab = 'pending' | 'running' | 'done' | 'draft' | 'returned';
type WorkflowViewTab = WorkflowTab | 'all';

export type WorkflowCase = {
  id: string;
  title: string;
  app: string;
  form: string;
  status: WorkflowTab;
  priority: '高' | '中' | '低';
  initiator: string;
  currentNode: string;
  updatedAt: string;
  dueAt: string;
  summary: string;
  steps: Array<{ title: string; description: string; state: 'finish' | 'process' | 'wait' | 'error' }>;
};

const statusMeta: Record<WorkflowTab, { label: string; color: string; icon: JSX.Element; description: string }> = {
  pending: { label: '待审批', color: 'orange', icon: <InboxOutlined />, description: '需要当前用户处理' },
  running: { label: '审批中', color: 'blue', icon: <ClockCircleOutlined />, description: '我发起或参与，仍在流转' },
  done: { label: '已审批', color: 'green', icon: <CheckCircleOutlined />, description: '已完成审批闭环' },
  draft: { label: '草稿', color: 'default', icon: <EditOutlined />, description: '我保存但未提交' },
  returned: { label: '退回待修改', color: 'red', icon: <RollbackOutlined />, description: '需要补充后重新提交' },
};

export const workflowCases: WorkflowCase[] = [
  {
    id: 'WF-20260520-001',
    title: '设备维修申请 - 产线 A03 主轴异响',
    app: '设备维护分析',
    form: '设备维修申请',
    status: 'pending',
    priority: '高',
    initiator: '李明',
    currentNode: '维修主管审批',
    updatedAt: '今天 10:32',
    dueAt: '今天 18:00 前',
    summary: '产线 A03 主轴异响，需要确认是否停机维修并协调备件。',
    steps: [
      { title: '提交申请', description: '李明提交维修申请', state: 'finish' },
      { title: '维修主管审批', description: '等待当前用户处理', state: 'process' },
      { title: '设备经理复核', description: '审批通过后进入复核', state: 'wait' },
      { title: '维修执行', description: '生成维修工单', state: 'wait' },
    ],
  },
  {
    id: 'WF-20260520-002',
    title: '质量异常复核 - Q-20260520',
    app: '质量控制',
    form: '质量异常复核',
    status: 'pending',
    priority: '中',
    initiator: '王珊',
    currentNode: '质量主管审批',
    updatedAt: '今天 09:48',
    dueAt: '明天 12:00 前',
    summary: '来料批次出现尺寸波动，需要复核处置方式和供应商责任。',
    steps: [
      { title: '异常登记', description: '质量工程师登记异常', state: 'finish' },
      { title: '质量主管审批', description: '等待当前用户处理', state: 'process' },
      { title: '供应商确认', description: '同步供应商纠正措施', state: 'wait' },
    ],
  },
  {
    id: 'WF-20260519-018',
    title: '物料采购申请 - MRO-1842',
    app: '供应链风险',
    form: '采购申请',
    status: 'running',
    priority: '中',
    initiator: '赵倩',
    currentNode: '财务预算复核',
    updatedAt: '今天 08:15',
    dueAt: '5 月 21 日',
    summary: '维修耗材补库申请已通过部门审批，正在等待预算复核。',
    steps: [
      { title: '提交申请', description: '采购专员提交', state: 'finish' },
      { title: '部门审批', description: '生产经理已通过', state: 'finish' },
      { title: '财务预算复核', description: '财务处理中', state: 'process' },
      { title: '采购下单', description: '复核通过后执行', state: 'wait' },
    ],
  },
  {
    id: 'WF-20260518-011',
    title: '维修工单关闭 - WO-771',
    app: '设备维护分析',
    form: '维修工单关闭',
    status: 'done',
    priority: '低',
    initiator: '陈涛',
    currentNode: '已完成',
    updatedAt: '昨天 17:20',
    dueAt: '已完成',
    summary: '维修任务已完成，备件更换记录和停机时长已归档。',
    steps: [
      { title: '提交关闭申请', description: '维修工程师提交', state: 'finish' },
      { title: '主管确认', description: '主管已确认', state: 'finish' },
      { title: '资料归档', description: '系统完成归档', state: 'finish' },
    ],
  },
  {
    id: 'WF-DRAFT-007',
    title: '供应商评分草稿',
    app: '供应链风险',
    form: '供应商评分',
    status: 'draft',
    priority: '低',
    initiator: '我',
    currentNode: '未提交',
    updatedAt: '今天 11:05',
    dueAt: '未设置',
    summary: '已填写交付表现和质量表现，待补充商务评分。',
    steps: [
      { title: '编辑草稿', description: '当前停留在草稿状态', state: 'process' },
      { title: '提交审批', description: '提交后进入采购经理审批', state: 'wait' },
    ],
  },
  {
    id: 'WF-RETURN-003',
    title: '采购申请退回 - 预算口径待补充',
    app: '供应链风险',
    form: '采购申请',
    status: 'returned',
    priority: '高',
    initiator: '我',
    currentNode: '发起人修改',
    updatedAt: '2 小时前',
    dueAt: '今天 17:00 前',
    summary: '财务退回，要求补充年度预算科目和费用归属说明。',
    steps: [
      { title: '提交申请', description: '采购申请已提交', state: 'finish' },
      { title: '部门审批', description: '生产经理已通过', state: 'finish' },
      { title: '财务复核', description: '因预算口径不清退回', state: 'error' },
      { title: '发起人修改', description: '等待补充后重新提交', state: 'process' },
    ],
  },
  {
    id: 'WF-RETURN-004',
    title: '质量 CAPA 退回 - 根因分析证据不足',
    app: '质量分析',
    form: 'CAPA 跟踪表单',
    status: 'returned',
    priority: '高',
    initiator: '王敏',
    currentNode: '质量工程师补充',
    updatedAt: '今天 09:20',
    dueAt: '今天 18:30 前',
    summary: '质量经理退回，要求补充批次留样照片、5Why 分析和临时围堵措施说明。',
    steps: [
      { title: '提交 CAPA', description: '质量工程师提交纠正预防措施', state: 'finish' },
      { title: '质量经理审核', description: '根因证据不足，退回补充', state: 'error' },
      { title: '质量工程师补充', description: '等待补充根因分析材料', state: 'process' },
      { title: '复核关闭', description: '补充后重新进入审核', state: 'wait' },
    ],
  },
  {
    id: 'WF-RETURN-005',
    title: '设备停机申请退回 - 影响范围未确认',
    app: '设备运行',
    form: '停机维护申请',
    status: 'returned',
    priority: '中',
    initiator: '孙强',
    currentNode: '维修计划修订',
    updatedAt: '今天 08:45',
    dueAt: '明天 10:00 前',
    summary: '生产主管退回，要求确认停机窗口、受影响产线和备件到货状态。',
    steps: [
      { title: '提交停机申请', description: '维修工程师提交维护窗口', state: 'finish' },
      { title: '生产主管审核', description: '影响范围描述不完整', state: 'error' },
      { title: '维修计划修订', description: '补充停机影响和备件状态', state: 'process' },
      { title: '重新审批', description: '修订后重新提交生产确认', state: 'wait' },
    ],
  },
  {
    id: 'WF-RETURN-006',
    title: '供应商准入退回 - 资质附件缺失',
    app: '供应链风险',
    form: '供应商准入评审',
    status: 'returned',
    priority: '中',
    initiator: '刘芳',
    currentNode: '采购专员补件',
    updatedAt: '昨天 16:10',
    dueAt: '明天 15:00 前',
    summary: '风控复核退回，营业执照、体系认证和近三个月交付记录附件不完整。',
    steps: [
      { title: '提交准入评审', description: '采购专员提交供应商资料', state: 'finish' },
      { title: '风控复核', description: '资质附件缺失，退回补件', state: 'error' },
      { title: '采购专员补件', description: '等待上传缺失资质文件', state: 'process' },
      { title: '重新风控复核', description: '资料齐套后继续评审', state: 'wait' },
    ],
  },
  {
    id: 'WF-RETURN-007',
    title: '批次放行退回 - 检验记录未闭环',
    app: '质量分析',
    form: '批次放行审批',
    status: 'returned',
    priority: '高',
    initiator: '赵蕾',
    currentNode: '检验员修正',
    updatedAt: '昨天 14:35',
    dueAt: '今天 16:00 前',
    summary: '质量负责人退回，要求补齐复检记录、异常处置结论和放行风险说明。',
    steps: [
      { title: '提交放行申请', description: '检验员提交批次放行', state: 'finish' },
      { title: '质量负责人审批', description: '检验记录未闭环，退回修改', state: 'error' },
      { title: '检验员修正', description: '补齐复检与风险说明', state: 'process' },
      { title: '放行复审', description: '修改后重新进入负责人审批', state: 'wait' },
    ],
  },
  {
    id: 'WF-RETURN-008',
    title: '工程变更退回 - 生效计划不明确',
    app: '生产态势',
    form: '工程变更申请',
    status: 'returned',
    priority: '低',
    initiator: '黄磊',
    currentNode: '工艺工程师修订',
    updatedAt: '5 月 20 日',
    dueAt: '5 月 23 日前',
    summary: '制造经理退回，要求明确切换批次、旧版物料处理和现场培训计划。',
    steps: [
      { title: '提交变更申请', description: '工艺工程师提交变更方案', state: 'finish' },
      { title: '制造经理审核', description: '生效计划不明确，退回修订', state: 'error' },
      { title: '工艺工程师修订', description: '补充切换批次和培训计划', state: 'process' },
      { title: '变更评审', description: '修订后进入跨部门评审', state: 'wait' },
    ],
  },
];

const orderedTabs: WorkflowTab[] = ['pending', 'running', 'done', 'draft', 'returned'];
const approvalTabs: Array<{ key: WorkflowViewTab; label: string; description: string }> = [
  { key: 'all', label: '全部', description: '全部流程单据' },
  { key: 'pending', label: '待审批', description: '需要当前用户处理' },
  { key: 'running', label: '审批中', description: '正在流转' },
  { key: 'done', label: '已审批', description: '已完成闭环' },
  { key: 'returned', label: '已退回', description: '需补充后提交' },
];

function getPriorityColor(priority: WorkflowCase['priority']) {
  if (priority === '高') return 'red';
  if (priority === '中') return 'orange';
  return 'default';
}

function buildFormFields(item: WorkflowCase) {
  const commonFields = [
    { label: '所属应用', value: item.app },
    { label: '业务表单', value: item.form },
    { label: '单据编号', value: item.id },
    { label: '发起人', value: item.initiator },
  ];

  if (item.form.includes('采购')) {
    return [
      ...commonFields,
      { label: '采购类别', value: 'MRO 备件 / 低值耗材' },
      { label: '预算科目', value: '待补充' },
      { label: '申请金额', value: '¥86,400' },
      { label: '供应商', value: '华东工业备件有限公司' },
      { label: '退回原因', value: item.summary },
    ];
  }

  if (item.form.includes('CAPA') || item.form.includes('质量')) {
    return [
      ...commonFields,
      { label: '问题批次', value: 'BATCH-260520-QA' },
      { label: '异常类型', value: '尺寸波动 / 复检偏差' },
      { label: '责任部门', value: '质量工程组' },
      { label: '围堵措施', value: '待补充临时隔离记录' },
      { label: '退回原因', value: item.summary },
    ];
  }

  if (item.form.includes('停机') || item.form.includes('维护')) {
    return [
      ...commonFields,
      { label: '设备编号', value: 'CNC-A03-01' },
      { label: '计划窗口', value: '待确认' },
      { label: '影响产线', value: 'A03 / A04' },
      { label: '备件状态', value: '待补充到货说明' },
      { label: '退回原因', value: item.summary },
    ];
  }

  if (item.form.includes('供应商')) {
    return [
      ...commonFields,
      { label: '供应商名称', value: '苏州精密材料科技有限公司' },
      { label: '准入类别', value: '关键物料供应商' },
      { label: '缺失附件', value: '营业执照、体系认证、交付记录' },
      { label: '风险等级', value: '中风险' },
      { label: '退回原因', value: item.summary },
    ];
  }

  if (item.form.includes('批次')) {
    return [
      ...commonFields,
      { label: '批次编号', value: 'LOT-260519-A12' },
      { label: '产品型号', value: 'MF-Drive-42' },
      { label: '检验结论', value: '待补充复检闭环' },
      { label: '放行类型', value: '条件放行' },
      { label: '退回原因', value: item.summary },
    ];
  }

  return [
    ...commonFields,
    { label: '变更对象', value: '装配工艺路线 V2.3' },
    { label: '切换批次', value: '待明确' },
    { label: '物料处理', value: '旧版物料处置待补充' },
    { label: '培训计划', value: '待补充现场培训安排' },
    { label: '退回原因', value: item.summary },
  ];
}

export default function WorkflowPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') as WorkflowViewTab | null;
  const validTabs: WorkflowViewTab[] = ['all', ...orderedTabs];
  const initialTab = queryTab && validTabs.includes(queryTab) ? queryTab : 'pending';
  const [activeTab, setActiveTab] = useState<WorkflowViewTab>(initialTab);
  const filteredCases = useMemo(() => (
    activeTab === 'all' ? workflowCases : workflowCases.filter((item) => item.status === activeTab)
  ), [activeTab]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const selectedCase = workflowCases.find((item) => item.id === selectedId);

  const switchTab = (key: string) => {
    const nextTab = key as WorkflowViewTab;
    setActiveTab(nextTab);
    setSearchParams({ tab: nextTab });
    setSelectedId(undefined);
    setDetailOpen(false);
  };

  const openWorkflowDetail = (record: WorkflowCase) => {
    setSelectedId(record.id);
    setDetailOpen(true);
  };

  const renderWorkflowDetail = () => {
    if (!selectedCase) return null;

    const formFields = buildFormFields(selectedCase);
    const detailFields = formFields.slice(0, -1);
    const basicFields = detailFields.slice(0, 4);
    const businessFields = detailFields.slice(4);
    const returnReason = formFields[formFields.length - 1];
    const returnActionPanel = (
      <Form layout="vertical" className="workflow-business-form workflow-opinion-form">
        <Form.Item label={returnReason.label}>
          <Input.TextArea rows={3} value={returnReason.value} readOnly />
        </Form.Item>
        <Form.Item label="本次处理意见">
          <Input.TextArea rows={4} placeholder="请填写审批意见" />
        </Form.Item>
      </Form>
    );
    const formTabPanel = (
      <div className="workflow-tab-page">
        <Form layout="vertical" className="workflow-business-form">
          <Row gutter={12}>
            {basicFields.map((field) => (
              <Col xs={24} md={12} key={field.label}>
                <Form.Item label={field.label}>
                  <Input value={field.value} readOnly />
                </Form.Item>
              </Col>
            ))}
            {businessFields.map((field) => (
              <Col xs={24} md={12} key={field.label}>
                <Form.Item label={field.label}>
                  <Input defaultValue={field.value} />
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </div>
    );
    const progressTabPanel = (
      <div className="workflow-tab-page">
        <div className="workflow-progress-summary">
          <div>
            <span>当前节点</span>
            <strong>{selectedCase.currentNode}</strong>
          </div>
          <div>
            <span>截止时间</span>
            <strong>{selectedCase.dueAt}</strong>
          </div>
          <Tag color={statusMeta[selectedCase.status].color}>{statusMeta[selectedCase.status].label}</Tag>
        </div>

        <div className="workflow-progress-card">
          <div className="workflow-form-section-title">流程流转</div>
          <Timeline
            items={selectedCase.steps.map((step) => ({
              color: step.state === 'finish' ? 'green' : step.state === 'process' ? 'blue' : step.state === 'error' ? 'red' : 'gray',
              children: (
                <div className="workflow-step-item">
                  <strong>{step.title}</strong>
                  <span>{step.description}</span>
                </div>
              ),
            }))}
          />
        </div>
      </div>
    );

    return (
      <div className="workflow-detail-content">
        <div className="workflow-detail-head workflow-approval-detail-head">
          <FileSearchOutlined />
          <div>
            <Typography.Text strong>{selectedCase.id}</Typography.Text>
            <Typography.Text type="secondary">{selectedCase.form} · {selectedCase.app}</Typography.Text>
          </div>
          <Tag color={statusMeta[selectedCase.status].color}>{statusMeta[selectedCase.status].label}</Tag>
        </div>
        <div className="workflow-approval-stamp">{statusMeta[selectedCase.status].label}</div>
        <Tabs
          className="workflow-detail-tabs"
          items={[
            { key: 'form', label: '表单信息', children: formTabPanel },
            { key: 'progress', label: '流程进度', children: progressTabPanel },
          ]}
        />
        {returnActionPanel}
      </div>
    );
  };

  return (
    <div className="workflow-page workflow-approval-page">
      <section className="workflow-approval-topbar">
        <div>
          <Typography.Title level={3}>流程中心</Typography.Title>
          <Typography.Text type="secondary">聚合当前用户相关的待审批、流转中、已完成、草稿和退回事项。</Typography.Text>
        </div>
        <Space>
          <Button icon={<HistoryOutlined />}>刷新</Button>
          <Button type="primary" icon={<FormOutlined />} onClick={() => navigate('/')}>返回工作台</Button>
        </Space>
      </section>

      <Tabs
        className="workflow-approval-tabs"
        activeKey={activeTab}
        onChange={(key) => switchTab(key as WorkflowViewTab)}
        items={approvalTabs.map((item) => {
          const count = item.key === 'all'
            ? workflowCases.length
            : workflowCases.filter((workflow) => workflow.status === item.key).length;
          return {
            key: item.key,
            label: (
              <span className="workflow-approval-tab-label">
                <span>{item.label}</span>
                <em>{count}</em>
              </span>
            ),
          };
        })}
      />

      <div className="workflow-approval-list">
        {filteredCases.map((item) => (
          <button className="workflow-approval-card" key={item.id} onClick={() => openWorkflowDetail(item)}>
            <div className="workflow-approval-card-main">
              <div className="workflow-approval-card-title">
                <strong>{item.title}</strong>
                <Tag color={getPriorityColor(item.priority)}>{item.priority}</Tag>
              </div>
              <p>{item.summary}</p>
              <div className="workflow-approval-card-fields">
                <span><small>单据编号</small><strong>{item.id}</strong></span>
                <span><small>流程类型</small><strong>{item.form}</strong></span>
                <span><small>当前节点</small><strong>{item.currentNode}</strong></span>
                <span><small>发起人</small><strong>{item.initiator}</strong></span>
              </div>
            </div>
            <div className="workflow-approval-card-side">
              <Tag color={statusMeta[item.status].color}>{statusMeta[item.status].label}</Tag>
              <small>{item.updatedAt}</small>
              <Button size="small" type={item.status === 'pending' ? 'primary' : 'default'}>
                {item.status === 'pending' ? '处理' : '查看'} <RightOutlined />
              </Button>
            </div>
          </button>
        ))}
      </div>

      <Drawer
        className="workflow-detail-drawer workflow-approval-drawer"
        title={selectedCase?.title || '流程详情'}
        width="min(560px, calc(100vw - 180px))"
        placement="right"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        extra={selectedCase ? (
          <Space size={6}>
            <Button size="small">审批历史</Button>
            <Button size="small">历史版本</Button>
            <Button size="small">操作日志</Button>
          </Space>
        ) : null}
      >
        {renderWorkflowDetail()}
        {selectedCase ? (
          <div className="workflow-approval-drawer-actions">
            <span />
            <Button danger disabled={selectedCase.status !== 'pending'}>拒绝</Button>
            <Button type="primary" disabled={selectedCase.status !== 'pending'}>同意</Button>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
