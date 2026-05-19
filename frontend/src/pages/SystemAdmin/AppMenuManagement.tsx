import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  MenuOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

type AppRecord = {
  key: string;
  name: string;
  code: string;
  owner: string;
  defaultRoute: string;
  status: string;
};

type MenuRecord = {
  key: string;
  name: string;
  path: string;
  location: string;
  status: string;
};

type BindingRecord = {
  key: string;
  app: string;
  menu: string;
  page: string;
  roles: string[];
  location: string;
  status: string;
};

const appRecords: AppRecord[] = [
  { key: 'production', name: '生产态势', code: 'production-dashboard', owner: '生产运营', defaultRoute: '/dashboard', status: '已发布' },
  { key: 'maintenance', name: '预测性维护', code: 'maintenance-analysis', owner: '设备管理', defaultRoute: '/maintenance', status: '已发布' },
  { key: 'quality', name: '质量分析', code: 'quality-control', owner: '质量中心', defaultRoute: '/quality', status: '已发布' },
  { key: 'supply-chain', name: '供应链风险', code: 'supply-risk', owner: '供应链', defaultRoute: '/supply-chain', status: '已发布' },
];

const menuRecords: MenuRecord[] = [
  { key: 'workspace', name: '我的工作台', path: '/', location: '左侧菜单', status: '启用' },
  { key: 'production', name: '生产态势', path: '/dashboard', location: '左侧菜单', status: '启用' },
  { key: 'maintenance', name: '预测性维护', path: '/maintenance', location: '左侧菜单', status: '启用' },
  { key: 'quality', name: '质量分析', path: '/quality', location: '左侧菜单', status: '启用' },
  { key: 'supply-chain', name: '供应链风险', path: '/supply-chain', location: '左侧菜单', status: '启用' },
  { key: 'quick-access', name: '工作台快捷入口', path: '/', location: '工作台卡片', status: '启用' },
];

const bindingRecords: BindingRecord[] = [
  {
    key: 'bind-1',
    app: '生产态势',
    menu: '生产态势',
    page: '/dashboard',
    roles: ['平台管理员', '生产经理'],
    location: '左侧菜单',
    status: '启用',
  },
  {
    key: 'bind-2',
    app: '预测性维护',
    menu: '预测性维护',
    page: '/maintenance',
    roles: ['维修工程师', '生产经理'],
    location: '左侧菜单',
    status: '启用',
  },
  {
    key: 'bind-3',
    app: '预测性维护',
    menu: '工作台快捷入口',
    page: '/maintenance',
    roles: ['维修工程师', '生产经理'],
    location: '工作台卡片',
    status: '启用',
  },
  {
    key: 'bind-4',
    app: '质量分析',
    menu: '质量分析',
    page: '/quality',
    roles: ['质量工程师', '平台管理员'],
    location: '左侧菜单',
    status: '启用',
  },
  {
    key: 'bind-5',
    app: '供应链风险',
    menu: '供应链风险',
    page: '/supply-chain',
    roles: ['供应链经理', '生产经理'],
    location: '左侧菜单',
    status: '启用',
  },
];

const appColumns: ColumnsType<AppRecord> = [
  { title: '应用名称', dataIndex: 'name' },
  { title: '应用编码', dataIndex: 'code' },
  { title: '负责人', dataIndex: 'owner' },
  { title: '默认页面', dataIndex: 'defaultRoute' },
  { title: '状态', dataIndex: 'status', render: (value) => <Tag color="success">{value}</Tag> },
];

const menuColumns: ColumnsType<MenuRecord> = [
  { title: '菜单名称', dataIndex: 'name' },
  { title: '路径', dataIndex: 'path' },
  { title: '位置', dataIndex: 'location' },
  { title: '状态', dataIndex: 'status', render: (value) => <Tag color="processing">{value}</Tag> },
];

const bindingColumns: ColumnsType<BindingRecord> = [
  { title: '应用', dataIndex: 'app', width: 130 },
  { title: '菜单入口', dataIndex: 'menu', width: 150 },
  { title: '页面', dataIndex: 'page', width: 150 },
  {
    title: '可见角色',
    dataIndex: 'roles',
    render: (roles: string[]) => (
      <Space size={[4, 4]} wrap>
        {roles.map((role) => (
          <Tag color="processing" key={role}>{role}</Tag>
        ))}
      </Space>
    ),
  },
  { title: '显示位置', dataIndex: 'location', width: 120 },
  { title: '状态', dataIndex: 'status', width: 90, render: (value) => <Tag color="success">{value}</Tag> },
  { title: '操作', width: 110, render: () => <Button size="small">编辑绑定</Button> },
];

export default function AppMenuManagement() {
  return (
    <div className="app-menu-admin-page">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="admin-relation-card">
            <span><AppstoreOutlined /></span>
            <div>
              <Typography.Text type="secondary">应用</Typography.Text>
              <strong>{appRecords.length}</strong>
              <small>用户切换和访问的业务对象</small>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="admin-relation-card">
            <span><MenuOutlined /></span>
            <div>
              <Typography.Text type="secondary">菜单入口</Typography.Text>
              <strong>{menuRecords.length}</strong>
              <small>左侧菜单、工作台卡片、用户栏入口</small>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card className="admin-relation-card">
            <span><BranchesOutlined /></span>
            <div>
              <Typography.Text type="secondary">绑定关系</Typography.Text>
              <strong>{bindingRecords.length}</strong>
              <small>应用、菜单和角色之间的多对多关系</small>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        className="admin-section-card"
        title="应用与菜单绑定"
        extra={(
          <Space>
            <Button icon={<AppstoreAddOutlined />}>新建应用</Button>
            <Button icon={<PlusOutlined />}>新建菜单</Button>
            <Button type="primary" icon={<BranchesOutlined />}>新增绑定</Button>
          </Space>
        )}
      >
        <Table
          columns={bindingColumns}
          dataSource={bindingRecords}
          rowKey="key"
          pagination={false}
          size="small"
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="admin-section-card" title="应用目录">
            <Table
              columns={appColumns}
              dataSource={appRecords}
              rowKey="key"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="admin-section-card" title="菜单入口">
            <Table
              columns={menuColumns}
              dataSource={menuRecords}
              rowKey="key"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Card className="admin-section-card" title="权限继承规则">
        <div className="admin-rule-strip">
          <span><SafetyCertificateOutlined /> 用户先获得角色</span>
          <span>角色绑定应用</span>
          <span>应用通过绑定关系出现在一个或多个菜单入口</span>
          <span>同一个菜单入口可指向不同应用或页面</span>
        </div>
      </Card>
    </div>
  );
}
