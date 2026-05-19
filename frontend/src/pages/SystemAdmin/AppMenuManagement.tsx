import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  BranchesOutlined,
  DashboardOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  ShopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Empty, Form, Input, List, Row, Select, Space, Spin, Switch, Tag, Typography, message } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  adminListApplications,
  adminListRoles,
  adminUpdateApplication,
  adminUpdateApplicationBindings,
  listMenus,
} from '@/services/api';

type AppRecord = {
  id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  default_route: string;
  sort_order: number;
  status: string;
  is_pinned: boolean;
  menus?: MenuRecord[];
  roles?: RoleRecord[];
};

type MenuRecord = {
  id: number;
  title: string;
  route_path?: string;
  icon?: string;
  is_visible?: boolean;
};

type RoleRecord = {
  id: number;
  name: string;
  label: string;
};

const iconMap: Record<string, ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  ToolOutlined: <ToolOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  ShopOutlined: <ShopOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
};

function renderIcon(name?: string) {
  return iconMap[name || ''] || <AppstoreOutlined />;
}

const fallbackRoles: RoleRecord[] = [
  { id: 1, name: 'admin', label: '平台管理员' },
  { id: 2, name: 'production_manager', label: '生产经理' },
  { id: 3, name: 'quality_engineer', label: '质量工程师' },
];

const fallbackMenus: MenuRecord[] = [
  { id: 1001, title: '生产态势', route_path: '/dashboard', icon: 'DashboardOutlined', is_visible: true },
  { id: 1002, title: '预测性维护', route_path: '/maintenance', icon: 'ToolOutlined', is_visible: true },
  { id: 1003, title: '质量分析', route_path: '/quality', icon: 'SafetyCertificateOutlined', is_visible: true },
  { id: 1004, title: '供应链风险', route_path: '/supply-chain', icon: 'ShopOutlined', is_visible: true },
];

const fallbackApplications: AppRecord[] = [
  { id: 1, name: '生产态势', code: 'production-situation', description: '生产运行、OEE、产线状态和告警工作包。', icon: 'DashboardOutlined', default_route: '/dashboard', sort_order: 1, status: 'published', is_pinned: true, menus: [fallbackMenus[0]], roles: [fallbackRoles[0], fallbackRoles[1]] },
  { id: 2, name: '预测性维护', code: 'predictive-maintenance', description: '设备健康、故障预测和维修工单工作包。', icon: 'ToolOutlined', default_route: '/maintenance', sort_order: 2, status: 'published', is_pinned: true, menus: [fallbackMenus[1]], roles: [fallbackRoles[0], fallbackRoles[1]] },
  { id: 3, name: '质量分析', code: 'quality-analytics', description: '质量事件、SPC、缺陷和 CAPA 工作包。', icon: 'SafetyCertificateOutlined', default_route: '/quality', sort_order: 3, status: 'published', is_pinned: false, menus: [fallbackMenus[2]], roles: [fallbackRoles[0], fallbackRoles[2]] },
  { id: 4, name: '供应链风险', code: 'supply-chain-risk', description: '供应商、物料、交付和风险复核工作包。', icon: 'ShopOutlined', default_route: '/supply-chain', sort_order: 4, status: 'published', is_pinned: false, menus: [fallbackMenus[3]], roles: [fallbackRoles[0], fallbackRoles[1]] },
];

export default function AppMenuManagement() {
  const [form] = Form.useForm();
  const [applications, setApplications] = useState<AppRecord[]>([]);
  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedApp = useMemo(
    () => applications.find((app) => app.id === selectedId) || null,
    [applications, selectedId],
  );

  const menuOptions = useMemo(() => {
    const byId = new Map<number, MenuRecord>();
    menus.forEach((menu) => byId.set(menu.id, menu));
    applications.forEach((app) => app.menus?.forEach((menu) => byId.set(menu.id, menu)));
    return Array.from(byId.values());
  }, [applications, menus]);

  const roleOptions = useMemo(() => {
    const byId = new Map<number, RoleRecord>();
    roles.forEach((role) => byId.set(role.id, role));
    applications.forEach((app) => app.roles?.forEach((role) => byId.set(role.id, role)));
    return Array.from(byId.values());
  }, [applications, roles]);

  const loadData = () => {
    setLoading(true);
    Promise.all([adminListApplications(), listMenus(), adminListRoles()])
      .then(([appsRes, menusRes, rolesRes]) => {
        const appData = (appsRes.data?.data || []).length ? appsRes.data.data : fallbackApplications;
        const menuData = (menusRes.data?.data || []).length ? menusRes.data.data : fallbackMenus;
        const roleData = (rolesRes.data?.data || []).length ? rolesRes.data.data : fallbackRoles;
        setApplications(appData);
        setMenus(menuData);
        setRoles(roleData);
        setSelectedId((current) => current || appData[0]?.id || null);
      })
      .catch(() => message.error('应用配置加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedApp) return;
    form.setFieldsValue({
      name: selectedApp.name,
      code: selectedApp.code,
      description: selectedApp.description,
      icon: selectedApp.icon || 'AppstoreOutlined',
      default_route: selectedApp.default_route,
      sort_order: selectedApp.sort_order,
      status: selectedApp.status,
      is_pinned: selectedApp.is_pinned,
      menu_ids: selectedApp.menus?.map((menu) => menu.id) || [],
      role_ids: selectedApp.roles?.map((role) => role.id) || [],
    });
  }, [form, selectedApp]);

  const saveSelected = async () => {
    if (!selectedApp) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await adminUpdateApplication(selectedApp.id, {
        name: values.name,
        code: values.code,
        description: values.description,
        icon: values.icon,
        default_route: values.default_route,
        sort_order: Number(values.sort_order || 0),
        status: values.status,
        is_pinned: Boolean(values.is_pinned),
      });
      await adminUpdateApplicationBindings(selectedApp.id, {
        menu_ids: values.menu_ids || [],
        role_ids: values.role_ids || [],
      });
      message.success('应用配置已保存');
      loadData();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-menu-admin-page">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={7}>
          <Card
            className="admin-app-list-card"
            title="应用"
            extra={<Button size="small" icon={<AppstoreAddOutlined />}>新建</Button>}
          >
            <Spin spinning={loading}>
              <List
                dataSource={applications}
                locale={{ emptyText: <Empty description="暂无应用" /> }}
                renderItem={(app) => (
                  <List.Item
                    className={`admin-app-list-item ${app.id === selectedId ? 'active' : ''}`}
                    onClick={() => setSelectedId(app.id)}
                  >
                    <span className="application-icon">{renderIcon(app.icon)}</span>
                    <div>
                      <strong>{app.name}</strong>
                      <small>{app.code}</small>
                    </div>
                    <Tag color={app.status === 'published' ? 'success' : 'warning'}>{app.status}</Tag>
                  </List.Item>
                )}
              />
            </Spin>
          </Card>
        </Col>

        <Col xs={24} lg={17}>
          <Card
            className="admin-section-card"
            title={selectedApp ? `${selectedApp.name} / 应用配置` : '应用配置'}
            extra={<Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveSelected}>保存配置</Button>}
          >
            {selectedApp ? (
              <Form form={form} layout="vertical">
                <Row gutter={[16, 0]}>
                  <Col xs={24} md={12}>
                    <Form.Item name="name" label="应用名称" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="code" label="应用编码" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="default_route" label="默认首页" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="icon" label="图标">
                      <Select
                        options={Object.keys(iconMap).map((key) => ({ label: key, value: key }))}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="status" label="状态">
                      <Select
                        options={[
                          { label: '已发布', value: 'published' },
                          { label: '草稿', value: 'draft' },
                          { label: '停用', value: 'disabled' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name="description" label="应用说明">
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="sort_order" label="排序">
                      <Input type="number" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item name="is_pinned" label="固定应用" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[16, 16]}>
                  <Col xs={24} xl={12}>
                    <Card className="admin-binding-card" title={<Space><MenuOutlined />绑定菜单</Space>}>
                      <Form.Item name="menu_ids" label="当前应用左侧菜单">
                        <Select
                          mode="multiple"
                          optionFilterProp="label"
                          options={menuOptions.map((menu) => ({
                            label: `${menu.title}${menu.route_path ? ` / ${menu.route_path}` : ''}`,
                            value: menu.id,
                          }))}
                        />
                      </Form.Item>
                      <Typography.Text type="secondary">切换到该应用后，左侧只显示这里绑定的菜单。</Typography.Text>
                    </Card>
                  </Col>
                  <Col xs={24} xl={12}>
                    <Card className="admin-binding-card" title={<Space><SafetyCertificateOutlined />可见角色</Space>}>
                      <Form.Item name="role_ids" label="拥有这些角色的用户可见该应用">
                        <Select
                          mode="multiple"
                          optionFilterProp="label"
                          options={roleOptions.map((role) => ({
                            label: `${role.label} / ${role.name}`,
                            value: role.id,
                          }))}
                        />
                      </Form.Item>
                      <Typography.Text type="secondary">管理员默认可见全部应用。</Typography.Text>
                    </Card>
                  </Col>
                </Row>
              </Form>
            ) : (
              <Empty description="请选择一个应用" />
            )}
          </Card>

          <Card className="admin-section-card" title="关系规则">
            <div className="admin-rule-strip">
              <span><BranchesOutlined /> 应用是业务工作包</span>
              <span>菜单可以被多个应用复用</span>
              <span>角色决定用户能看到哪些应用</span>
              <span>切换应用后进入默认首页</span>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
