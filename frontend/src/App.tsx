import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Dropdown,
  Input,
  Layout,
  Menu,
  Modal,
  Space,
  Spin,
  Typography,
  message,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  DashboardOutlined,
  DownloadOutlined,
  DownOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import GlobalSearch from './components/GlobalSearch';
import { useAuthStore } from './stores/authStore';
import {
  listApplicationMenus,
  listApplications,
  wfApproveOrReject,
  wfListNotifications,
  wfMarkAllRead,
  wfMarkNotificationRead,
} from './services/api';

const WorkspacePage = lazy(() => import('./pages/Workspace'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const DataSourcePage = lazy(() => import('./pages/DataSource'));
const OntologyPage = lazy(() => import('./pages/Ontology'));
const GraphExplorerPage = lazy(() => import('./pages/GraphExplorer'));
const PipelinePage = lazy(() => import('./pages/Pipeline'));
const MaintenancePage = lazy(() => import('./pages/Maintenance'));
const QualityPage = lazy(() => import('./pages/Quality'));
const SupplyChainPage = lazy(() => import('./pages/SupplyChain'));
const AIAssistantPage = lazy(() => import('./pages/AIAssistant'));
const ReportCenterPage = lazy(() => import('./pages/ReportCenter'));
const ModelDrivenPage = lazy(() => import('./pages/ModelDriven'));
const DynamicPage = lazy(() => import('./pages/DynamicPage'));
const SystemAdminPage = lazy(() => import('./pages/SystemAdmin'));
const WorkflowPage = lazy(() => import('./pages/Workflow'));
const LoginPage = lazy(() => import('./pages/Login'));
const MyApplicationsPage = lazy(() => import('./pages/Workflow/MyApplications'));
const TemplateMarketPage = lazy(() => import('./pages/TemplateMarket'));
const RuleEnginePage = lazy(() => import('./pages/RuleEngine'));

const { Header, Sider, Content } = Layout;

interface DynamicMenu {
  id: number;
  parent_id: number | null;
  title: string;
  route_path: string;
  icon?: string;
  is_visible: boolean;
  children?: DynamicMenu[];
}

interface ApplicationInfo {
  id: number;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  default_route: string;
  status: string;
  is_pinned?: boolean;
}

const businessMenuItems: MenuProps['items'] = [
  { key: '/', icon: <HomeOutlined />, label: '我的工作台' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '生产态势' },
  { key: '/maintenance', icon: <ToolOutlined />, label: '设备维护' },
  { key: '/quality', icon: <SafetyCertificateOutlined />, label: '质量分析' },
  { key: '/supply-chain', icon: <ShopOutlined />, label: '供应链风险' },
];

const fallbackApplications: ApplicationInfo[] = [
  { id: 1, name: '生产态势', code: 'production-dashboard', description: '生产效率、OEE、产线告警和班次趋势。', icon: 'DashboardOutlined', default_route: '/dashboard', status: 'published', is_pinned: true },
  { id: 2, name: '预测性维护', code: 'maintenance-analysis', description: '设备健康总览、健康分析、故障预测和工单管理。', icon: 'ToolOutlined', default_route: '/maintenance', status: 'published', is_pinned: true },
  { id: 3, name: '质量分析', code: 'quality-control', description: '质量缺陷、检验批次、异常追溯和过程能力分析。', icon: 'SafetyCertificateOutlined', default_route: '/quality', status: 'published' },
  { id: 4, name: '供应链风险', code: 'supply-risk', description: '供应商交付、库存水位、风险预警和替代方案。', icon: 'ShopOutlined', default_route: '/supply-chain', status: 'published' },
];

const fallbackMenusByApplication: Record<number, DynamicMenu[]> = {
  1: [{ id: 1001, parent_id: null, title: '生产态势', icon: 'DashboardOutlined', route_path: '/dashboard', is_visible: true }],
  2: [{ id: 1002, parent_id: null, title: '预测性维护', icon: 'ToolOutlined', route_path: '/maintenance', is_visible: true }],
  3: [{ id: 1003, parent_id: null, title: '质量分析', icon: 'SafetyCertificateOutlined', route_path: '/quality', is_visible: true }],
  4: [{ id: 1004, parent_id: null, title: '供应链风险', icon: 'ShopOutlined', route_path: '/supply-chain', is_visible: true }],
};

const pageTitleMap: Record<string, string> = {
  '/': '我的工作台',
  '/dashboard': '生产态势',
  '/maintenance': '设备维护',
  '/quality': '质量分析',
  '/supply-chain': '供应链风险',
  '/model-driven': '表单配置中心',
  '/ontology': '数据模型',
  '/reports': '报表中心',
  '/templates': '模板市场',
  '/rules': '规则引擎',
  '/ai-assistant': 'AI Assistant',
  '/data-sources': '数据源管理',
  '/graph': '图谱探索',
  '/pipeline': '数据管道',
  '/system-admin': '系统管理',
  '/workflow': '流程中心',
  '/my-applications': '我的应用',
};

function iconFor(name?: string) {
  const icons: Record<string, React.ReactNode> = {
    DashboardOutlined: <DashboardOutlined />,
    ToolOutlined: <ToolOutlined />,
    SafetyCertificateOutlined: <SafetyCertificateOutlined />,
    ShopOutlined: <ShopOutlined />,
    AppstoreOutlined: <AppstoreOutlined />,
    HomeOutlined: <HomeOutlined />,
  };
  return icons[name || ''] || <AppstoreOutlined />;
}

function PageLoader() {
  return (
    <div style={{ padding: 40 }}>
      <Spin size="large" tip="加载工作台...">
        <div style={{ minHeight: 200 }} />
      </Spin>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40 }}>
          <Typography.Title level={4} type="danger">页面渲染失败</Typography.Title>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#fff', padding: 16, borderRadius: 6 }}>
            {this.state.error}
          </pre>
          <Button type="primary" onClick={() => window.location.reload()}>重新加载页面</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function buildDynamicMenuTree(items: DynamicMenu[]): MenuProps['items'] {
  if (items.some((item) => item.children?.length)) {
    return items.map((item) => ({
      key: item.route_path || `dynamic-${item.id}`,
      icon: iconFor(item.icon),
      label: item.title,
      children: item.children?.length ? buildDynamicMenuTree(item.children) : undefined,
    }));
  }
  const map = new Map<number, any>();
  const roots: any[] = [];
  for (const item of items) {
    map.set(item.id, {
      key: item.route_path || `dynamic-${item.id}`,
      icon: iconFor(item.icon),
      label: item.title,
      children: [],
    });
  }
  for (const item of items) {
    const node = map.get(item.id);
    if (!node) continue;
    if (item.parent_id && map.has(item.parent_id)) {
      map.get(item.parent_id).children.push(node);
    } else if (item.route_path) {
      roots.push(node);
    }
  }
  return roots.map((node) => (node.children?.length ? node : { ...node, children: undefined }));
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [collapsed, setCollapsed] = useState(false);
  const [dynamicMenus, setDynamicMenus] = useState<MenuProps['items']>([]);
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [currentApplication, setCurrentApplication] = useState<ApplicationInfo | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    listApplications()
      .then((res) => {
        const apps: ApplicationInfo[] = (res.data?.data || []).length ? res.data.data : fallbackApplications;
        setApplications(apps);
        if (!apps.length) {
          setCurrentApplication(null);
          setDynamicMenus(businessMenuItems);
          return;
        }
        const storedId = Number(localStorage.getItem('mf_current_app_id'));
        const matched = apps.find((app) => app.id === storedId) || apps[0];
        setCurrentApplication(matched);
        localStorage.setItem('mf_current_app_id', String(matched.id));
      })
      .catch(() => {
        const storedId = Number(localStorage.getItem('mf_current_app_id'));
        const matched = fallbackApplications.find((app) => app.id === storedId) || fallbackApplications[0];
        setApplications(fallbackApplications);
        setCurrentApplication(matched);
        localStorage.setItem('mf_current_app_id', String(matched.id));
      });
  }, []);

  useEffect(() => {
    if (!currentApplication) return;
    listApplicationMenus(currentApplication.id)
      .then((res) => {
        const apiItems = res.data?.data || [];
        const items = (apiItems.length ? apiItems : (fallbackMenusByApplication[currentApplication.id] || []))
          .filter((m: DynamicMenu) => m.is_visible !== false);
        setDynamicMenus(buildDynamicMenuTree(items));
      })
      .catch(() => setDynamicMenus(buildDynamicMenuTree(fallbackMenusByApplication[currentApplication.id] || [])));
  }, [currentApplication]);

  const loadNotifications = useCallback(() => {
    if (!user) return;
    wfListNotifications(user.id)
      .then((res) => {
        const data = res.data?.data || [];
        setNotifications(data);
        setUnread(data.filter((n: any) => !n.is_read).length);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const allMenuItems = useMemo<MenuProps['items']>(() => {
    return dynamicMenus?.length ? dynamicMenus : businessMenuItems;
  }, [dynamicMenus]);

  const studioTarget = location.pathname === '/model-driven'
    ? decodeURIComponent(new URLSearchParams(location.search).get('target') || '')
    : '';
  const selectedKey = studioTarget || location.pathname;
  const isStudioPage = location.pathname === '/model-driven';
  const showRuntimePageBar = !isStudioPage;
  const runtimeTitle = location.pathname.startsWith('/dynamic/')
    ? '动态业务表单'
    : pageTitleMap[location.pathname] || '业务页面';

  const configureCurrentPage = () => {
    const target = encodeURIComponent(location.pathname);
    navigate(`/model-driven?target=${target}`);
  };

  const breadcrumbItems = useMemo(() => {
    const title = location.pathname.startsWith('/dynamic/')
      ? '动态业务表单'
      : pageTitleMap[location.pathname] || '业务页面';
    return [
      { title: <a onClick={() => navigate('/')}><HomeOutlined /></a> },
      { title },
    ];
  }, [location.pathname, navigate]);

  const handleApproval = (instId: number, action: string) => {
    const commentRef = React.createRef<any>();
    Modal.confirm({
      title: action === 'approve' ? '审批通过' : '驳回申请',
      content: <Input.TextArea ref={commentRef} rows={3} placeholder="请输入审批意见" />,
      onOk: async () => {
        const comment = commentRef.current?.resizableTextArea?.textArea?.value
          ?? commentRef.current?.input?.value
          ?? '';
        try {
          await wfApproveOrReject(instId, { action, comment });
          message.success(action === 'approve' ? '已审批通过' : '已驳回');
          loadNotifications();
        } catch {
          message.error('审批操作失败');
        }
      },
    });
  };

  const switchApplication = (app: ApplicationInfo) => {
    setCurrentApplication(app);
    localStorage.setItem('mf_current_app_id', String(app.id));
    navigate(app.default_route || '/');
  };

  const applicationMenu: MenuProps = {
    items: applications.map((app) => ({
      key: String(app.id),
      icon: iconFor(app.icon),
      label: (
        <div className="application-switch-item">
          <strong>{app.name}</strong>
          <span>{app.description || app.code}</span>
        </div>
      ),
      onClick: () => switchApplication(app),
    })),
  };

  const notificationMenu: MenuProps = {
    items: [
      { key: 'header', label: <strong>待办通知</strong>, disabled: true },
      { type: 'divider' },
      ...(notifications.length === 0
        ? [{ key: 'empty', label: '暂无通知', disabled: true }]
        : notifications.slice(0, 8).map((n: any) => ({
            key: String(n.id),
            label: (
              <div style={{ opacity: n.is_read ? 0.55 : 1, maxWidth: 320 }}>
                <div style={{ fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
                {n.content && <div style={{ fontSize: 12, color: '#5d6972', marginTop: 2 }}>{n.content}</div>}
                <div style={{ fontSize: 11, color: '#8a97a1', marginTop: 2 }}>{n.created_at?.slice(0, 16)}</div>
                {n.type === 'approval' && !n.is_read && (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApproval(n.related_id || n.id, 'approve');
                      }}
                    >
                      通过
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      style={{ marginLeft: 8 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApproval(n.related_id || n.id, 'reject');
                      }}
                    >
                      驳回
                    </Button>
                  </div>
                )}
              </div>
            ),
          }))
      ),
      { type: 'divider' },
      {
        key: 'mark-all',
        label: '全部标记为已读',
        onClick: async () => {
          if (!user) return;
          await wfMarkAllRead(user.id);
          setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
          setUnread(0);
        },
      },
    ],
    onClick: ({ key }) => {
      if (key === 'header' || key === 'empty' || key === 'mark-all') return;
      wfMarkNotificationRead(Number(key)).catch(() => {});
      setNotifications((prev) => prev.map((n) => (String(n.id) === key ? { ...n, is_read: true } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
    },
  };

  const userMenu: MenuProps = {
    items: [
      { key: 'my-apps', label: '我的应用', icon: <AppstoreOutlined />, onClick: () => navigate('/my-applications') },
      { key: 'templates', label: '模板市场', icon: <AppstoreOutlined />, onClick: () => navigate('/templates') },
      { key: 'form-studio', label: '表单配置中心', icon: <SettingOutlined />, onClick: () => navigate('/model-driven') },
      { type: 'divider' },
      ...(user?.is_admin
        ? [{ key: 'admin', label: '系统管理', icon: <SettingOutlined />, onClick: () => navigate('/system-admin') }]
        : []),
      {
        key: 'logout',
        label: '退出登录',
        icon: <LogoutOutlined />,
        danger: true,
        onClick: () => {
          logout();
          navigate('/login');
        },
      },
    ],
  };

  const siderWidth = collapsed ? 68 : 236;

  return (
    <Layout className="app-shell density-standard">
      <Sider
        width={236}
        collapsedWidth={68}
        collapsed={collapsed}
        trigger={null}
        theme="light"
        className="app-sider"
        style={{ height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0 }}
      >
        <div className="app-brand">
          <span className="app-brand-mark">MF</span>
          {!collapsed && (
            <span className="app-brand-title">
              <strong>ManuFoundry</strong>
              <span>Low-code Analytics</span>
            </span>
          )}
        </div>
        <Menu
          className="app-menu"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={allMenuItems}
          onClick={({ key }) => navigate(String(key))}
        />
      </Sider>

      <Layout style={{ marginLeft: siderWidth, transition: 'margin-left 0.2s' }}>
        <Header className="app-header">
          <Space size={14} align="center">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Dropdown menu={applicationMenu} trigger={['click']} disabled={!applications.length}>
              <Button className="application-switch-button" icon={iconFor(currentApplication?.icon)}>
                <span>{currentApplication?.name || '选择应用'}</span>
                <DownOutlined />
              </Button>
            </Dropdown>
            <Breadcrumb items={breadcrumbItems} />
          </Space>

          <Space size={12} align="center">
            <Button
              className="app-search-button"
              icon={<SearchOutlined />}
              onClick={() => setSearchOpen(true)}
            >
              搜索应用、数据资产或配置 Ctrl+K
            </Button>
            <Dropdown menu={notificationMenu} trigger={['click']}>
              <Badge count={unread} size="small">
                <Button type="text" icon={<BellOutlined />} />
              </Badge>
            </Dropdown>
            <Dropdown menu={userMenu} trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#2f5f73' }} />
                <span style={{ fontSize: 13, color: '#273640' }}>{user?.display_name || '系统管理员'}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content className="app-content">
          <div className="content-surface">
            {showRuntimePageBar && (
              <div className="runtime-page-bar">
                <div>
                  <Typography.Title level={3}>{runtimeTitle}</Typography.Title>
                </div>
                <Space wrap>
                  <Button icon={<PlusOutlined />}>新增</Button>
                  <Button icon={<ReloadOutlined />}>刷新</Button>
                  <Button icon={<DownloadOutlined />}>导出</Button>
                  <Button type="primary" icon={<SettingOutlined />} onClick={configureCurrentPage}>
                    设置
                  </Button>
                </Space>
              </div>
            )}
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<WorkspacePage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/data-sources" element={<DataSourcePage />} />
                  <Route path="/ontology" element={<OntologyPage />} />
                  <Route path="/graph" element={<GraphExplorerPage />} />
                  <Route path="/pipeline" element={<PipelinePage />} />
                  <Route path="/maintenance" element={<MaintenancePage />} />
                  <Route path="/quality" element={<QualityPage />} />
                  <Route path="/supply-chain" element={<SupplyChainPage />} />
                  <Route path="/ai-assistant" element={<AIAssistantPage />} />
                  <Route path="/reports" element={<ReportCenterPage />} />
                  <Route path="/model-driven" element={<ModelDrivenPage />} />
                  <Route path="/dynamic/:slug" element={<DynamicPage />} />
                  <Route path="/system-admin" element={<SystemAdminPage />} />
                  <Route path="/workflow" element={<WorkflowPage />} />
                  <Route path="/my-applications" element={<MyApplicationsPage />} />
                  <Route path="/templates" element={<TemplateMarketPage />} />
                  <Route path="/rules" element={<RuleEnginePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </Content>
      </Layout>

      <Button
        className="ai-floating-button"
        type="primary"
        shape="circle"
        icon={<RobotOutlined />}
        onClick={() => navigate('/ai-assistant')}
        aria-label="AI Assistant"
      />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Layout>
  );
}

export default function App() {
  const { isAuthenticated, restore } = useAuthStore();
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    restore();
    setRestored(true);
  }, [restore]);

  if (!restored) return <PageLoader />;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={isAuthenticated ? <AppContent /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
