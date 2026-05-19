import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  PushpinOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  StarFilled,
  ToolOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type ApplicationEntry = {
  key: string;
  name: string;
  route: string;
  type: string;
  status: 'published' | 'draft';
  updatedAt: string;
  description: string;
  icon: ReactNode;
  menus: string[];
  roles: string[];
  pinned?: boolean;
};

const applications: ApplicationEntry[] = [
  {
    key: 'production',
    name: '生产态势',
    route: '/dashboard',
    type: 'Dashboard',
    status: 'published',
    updatedAt: '今天 09:20',
    description: '生产效率、OEE、产线告警和班次趋势的统一入口。',
    icon: <DashboardOutlined />,
    menus: ['左侧菜单 / 生产态势', '工作台 / 最近访问'],
    roles: ['平台管理员', '生产经理'],
    pinned: true,
  },
  {
    key: 'maintenance',
    name: '预测性维护',
    route: '/maintenance',
    type: 'Analysis App',
    status: 'published',
    updatedAt: '昨天 18:10',
    description: '设备健康总览、健康分析、故障预测和工单管理。',
    icon: <ToolOutlined />,
    menus: ['左侧菜单 / 预测性维护', '工作台 / 快捷入口'],
    roles: ['维修工程师', '生产经理'],
    pinned: true,
  },
  {
    key: 'quality',
    name: '质量分析',
    route: '/quality',
    type: 'Quality App',
    status: 'published',
    updatedAt: '周一 14:35',
    description: '质量缺陷、检验批次、异常追溯和过程能力分析。',
    icon: <SafetyCertificateOutlined />,
    menus: ['左侧菜单 / 质量分析', '生产应用组'],
    roles: ['质量工程师', '平台管理员'],
  },
  {
    key: 'supply-chain',
    name: '供应链风险',
    route: '/supply-chain',
    type: 'Risk App',
    status: 'published',
    updatedAt: '5 月 18 日',
    description: '供应商交付、库存水位、风险预警和替代方案。',
    icon: <ShopOutlined />,
    menus: ['左侧菜单 / 供应链风险', '管理应用组'],
    roles: ['供应链经理', '生产经理'],
  },
];

const statusText = {
  published: '已发布',
  draft: '草稿',
};

export default function MyApplications() {
  const navigate = useNavigate();
  const pinnedCount = applications.filter((item) => item.pinned).length;

  return (
    <div className="application-switch-page">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="application-summary-card">
            <span className="application-summary-icon"><AppstoreOutlined /></span>
            <div>
              <Typography.Text type="secondary">可访问应用</Typography.Text>
              <strong>{applications.length}</strong>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="application-summary-card">
            <span className="application-summary-icon"><PushpinOutlined /></span>
            <div>
              <Typography.Text type="secondary">固定应用</Typography.Text>
              <strong>{pinnedCount}</strong>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="application-summary-card">
            <span className="application-summary-icon"><ClockCircleOutlined /></span>
            <div>
              <Typography.Text type="secondary">最近同步</Typography.Text>
              <strong>09:20</strong>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        className="application-directory-card"
        title="我的应用"
        extra={<Tag className="system-tag">应用和菜单可多对多绑定</Tag>}
      >
        <Row gutter={[14, 14]}>
          {applications.map((app) => (
            <Col xs={24} lg={12} xl={6} key={app.key}>
              <Card className="application-card" variant="borderless">
                <div className="application-card-head">
                  <span className="application-icon">{app.icon}</span>
                  <Space size={6}>
                    {app.pinned && <StarFilled className="application-star" />}
                    <Tag color={app.status === 'published' ? 'success' : 'warning'}>{statusText[app.status]}</Tag>
                  </Space>
                </div>
                <Typography.Title level={5}>{app.name}</Typography.Title>
                <Typography.Text type="secondary">{app.type}</Typography.Text>
                <Typography.Paragraph className="application-description">
                  {app.description}
                </Typography.Paragraph>

                <div className="application-meta-block">
                  <span>菜单入口</span>
                  <Space size={[4, 4]} wrap>
                    {app.menus.map((menu) => (
                      <Tag key={menu}>{menu}</Tag>
                    ))}
                  </Space>
                </div>
                <div className="application-meta-block">
                  <span>可见角色</span>
                  <Space size={[4, 4]} wrap>
                    {app.roles.map((role) => (
                      <Tag color="processing" key={role}>{role}</Tag>
                    ))}
                  </Space>
                </div>

                <div className="application-card-footer">
                  <Typography.Text type="secondary">更新：{app.updatedAt}</Typography.Text>
                  <Button type="primary" onClick={() => navigate(app.route)}>打开应用</Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
