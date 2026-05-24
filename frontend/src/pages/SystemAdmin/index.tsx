import {
  ApiOutlined,
  BranchesOutlined,
  ControlOutlined,
  DatabaseOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Space, Table, Tag, Tabs, Typography } from 'antd';
import AppMenuManagement from './AppMenuManagement';
import IdentityAccessManagement from './IdentityAccessManagement';
import SemanticAssetCenter from './SemanticAssetCenter';

export default function SystemAdmin() {
  return (
    <Tabs
      className="system-admin-page"
      defaultActiveKey="app-menu"
      items={[
        { key: 'app-menu', label: '应用与菜单', children: <AppMenuManagement /> },
        { key: 'semantic-assets', label: '数据资产与本体', children: <SemanticAssetCenter /> },
        { key: 'palantir-config', label: '运营闭环配置', children: <PalantirConfigBlueprint /> },
        { key: 'identity-access', label: '用户与权限', children: <IdentityAccessManagement /> },
      ]}
    />
  );
}

export function PalantirConfigBlueprint() {
  const configCards = [
    { title: '业务对象', icon: <NodeIndexOutlined />, desc: 'QualityEvent、Defect、InspectionBatch、MaterialBatch、Supplier、WorkOrder、Equipment、CAPA', tag: 'Foundry' },
    { title: '对象关系', icon: <BranchesOutlined />, desc: '缺陷属于检验批次，批次关联物料和供应商，工单影响客户订单', tag: 'Graph' },
    { title: '业务动作', icon: <ControlOutlined />, desc: '冻结批次、生成 CAPA、发起复检、创建维修工单、通知采购', tag: 'Actions' },
    { title: '角色工作台', icon: <UserSwitchOutlined />, desc: '超级管理员、质量经理、采购、生产主管、普通申请人看到不同入口', tag: 'Gotham' },
    { title: 'AI 权限', icon: <RobotOutlined />, desc: 'AI 只读分析和生成草稿，高风险动作必须由人确认并进入审计', tag: 'AIP' },
    { title: '审计闭环', icon: <SafetyCertificateOutlined />, desc: '记录配置变更、AI 建议、动作确认、流程审批和状态变化', tag: 'Audit' },
  ];

  return (
    <div className="palantir-admin-blueprint">
      <div className="account-section-title">
        <ApiOutlined />
        <div>
          <Typography.Title level={4}>Palantir 式运营闭环配置</Typography.Title>
          <Typography.Text type="secondary">
            这里不是单独的新系统，而是把现有低代码、本体、图谱、AI、流程和权限组合成可配置的业务处置平台。
          </Typography.Text>
        </div>
      </div>

      <Row gutter={[12, 12]}>
        {configCards.map((card) => (
          <Col xs={24} md={12} xl={8} key={card.title}>
            <Card className="palantir-config-card">
              <Space align="start">
                <span className="semantic-summary-icon">{card.icon}</span>
                <div>
                  <Space size={8} wrap>
                    <Typography.Text strong>{card.title}</Typography.Text>
                    <Tag color="processing">{card.tag}</Tag>
                  </Space>
                  <Typography.Paragraph type="secondary">{card.desc}</Typography.Paragraph>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="质量异常闭环样板" className="palantir-config-table">
        <Table
          size="small"
          pagination={false}
          rowKey="step"
          dataSource={[
            { step: '规则触发', current: 'rules + quality', target: '缺陷率超过阈值后生成 QualityEvent' },
            { step: '图谱影响', current: 'graph impact-analysis', target: '追踪缺陷、批次、供应商、工单、设备、客户订单' },
            { step: 'AI 草稿', current: 'ai_assistant / ai_builder', target: '解释风险、生成处置建议，不自动执行' },
            { step: '动作闭环', current: 'quality + workflow', target: '生成 CAPA、冻结批次、发起复检并进入审批' },
            { step: '角色呈现', current: 'applications + roles', target: '不同角色看到不同菜单、数据范围和动作按钮' },
          ]}
          columns={[
            { title: '闭环阶段', dataIndex: 'step', width: 120 },
            { title: '当前承载模块', dataIndex: 'current', width: 180 },
            { title: '配置目标', dataIndex: 'target' },
          ]}
        />
      </Card>
    </div>
  );
}

