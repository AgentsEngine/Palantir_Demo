import { useEffect, useMemo, useState } from 'react';
import {
  BellOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Empty, Progress, Row, Skeleton, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listNotifications, listQualityEvents, wfGetStats, wfListInstances } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

interface QualityEvent {
  id: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  description: string;
  risk_score?: number;
  affected?: Record<string, number>;
  recommended_actions?: string[];
  occurred_at?: string | null;
}

interface WorkflowInstance {
  id: number | string;
  title: string;
  status: string;
  current_step?: number;
  resource_type?: string;
  updated_at?: string | null;
  created_at?: string | null;
  workflow_state?: Record<string, unknown>;
  approvals?: Array<{ action?: string | null; approver_id?: number }>;
}

interface NotificationItem {
  id: number | string;
  title: string;
  content?: string | null;
  type?: string;
  is_read?: boolean;
  created_at?: string | null;
  link?: string | null;
}

interface WorkflowStats {
  total_instances?: number;
  instances_by_status?: Record<string, number>;
  unread_notifications?: number;
}

type RoleKey = 'admin' | 'quality' | 'production' | 'user';

function getRoleKey(user: any): RoleKey {
  if (user?.is_admin) return 'admin';
  const roleNames = new Set((user?.roles || []).map((role: any) => role.name));
  if (roleNames.has('quality_inspector') || roleNames.has('quality_engineer')) return 'quality';
  if (roleNames.has('production_manager')) return 'production';
  return 'user';
}

function roleTitle(roleKey: RoleKey) {
  const map = {
    admin: '数据审批工作台',
    quality: '质量经理工作台',
    production: '生产主管工作台',
    user: '我的业务工作台',
  };
  return map[roleKey];
}

function pickData<T>(payload: unknown): T[] {
  const data = payload as { data?: unknown };
  return Array.isArray(data?.data) ? data.data as T[] : [];
}

function formatTime(value?: string | null) {
  if (!value) return '无时间';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function WorkspacePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<QualityEvent[]>([]);
  const [workflowInstances, setWorkflowInstances] = useState<WorkflowInstance[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats>({});
  const [loading, setLoading] = useState(true);
  const roleKey = getRoleKey(user);

  const loadWorkbench = async () => {
    setLoading(true);

    const [qualityRes, workflowRes, statsRes, notificationRes] = await Promise.allSettled([
      listQualityEvents(),
      wfListInstances(),
      wfGetStats(),
      listNotifications({ user_id: user?.id, page_size: 6 }),
    ]);

    if (qualityRes.status === 'fulfilled') {
      const payload = qualityRes.value.data as { source?: string };
      if (payload.source === 'database_unavailable' || payload.source === 'fallback') {
        setEvents([]);
      } else {
        setEvents(pickData<QualityEvent>(payload));
      }
    } else {
      setEvents([]);
    }

    if (workflowRes.status === 'fulfilled') {
      setWorkflowInstances(pickData<WorkflowInstance>(workflowRes.value.data));
    } else {
      setWorkflowInstances([]);
    }

    if (statsRes.status === 'fulfilled') {
      setWorkflowStats(statsRes.value.data || {});
    } else {
      setWorkflowStats({});
    }

    if (notificationRes.status === 'fulfilled') {
      const payload = notificationRes.value.data as { source?: string; unread_count?: number };
      if (payload.source === 'fallback') {
        setNotifications([]);
      } else {
        setNotifications(pickData<NotificationItem>(payload));
      }
    } else {
      setNotifications([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadWorkbench();
  }, [user?.id]);

  const headline = useMemo(() => {
    if (roleKey === 'admin') return '只展示后台数据库与业务接口返回的审批、质量和通知数据';
    if (roleKey === 'quality') return '从数据库质量缺陷、检验和 CAPA 记录生成闭环视图';
    if (roleKey === 'production') return '看清真实流程实例与质量事件对生产的影响';
    return '处理与你相关的真实申请、待办和风险提醒';
  }, [roleKey]);

  const pendingWorkflows = workflowInstances.filter((item) => item.status === 'pending');
  const openEvents = events.filter((item) => item.status !== 'closed');
  const criticalEvents = events.filter((item) => item.severity === 'critical');
  const unreadNotifications = notifications.filter((item) => !item.is_read);
  const totalInstances = workflowStats.total_instances ?? workflowInstances.length;
  const doneCount = (workflowStats.instances_by_status?.approved ?? 0) + (workflowStats.instances_by_status?.done ?? 0);
  const completionRate = totalInstances ? Math.round((doneCount / totalInstances) * 100) : 0;
  const openRate = events.length ? Math.round((openEvents.length / events.length) * 100) : 0;

  const stats = [
    { label: '待处理流程', value: String(pendingWorkflows.length), trend: `流程实例总数 ${totalInstances}`, icon: <FileDoneOutlined />, tone: 'blue' },
    { label: '开放质量事件', value: String(openEvents.length), trend: `质量事件总数 ${events.length}`, icon: <SafetyCertificateOutlined />, tone: 'red' },
    { label: '高危质量事件', value: String(criticalEvents.length), trend: '来自质量缺陷严重度', icon: <ExclamationCircleOutlined />, tone: 'orange' },
    { label: '未读通知', value: String(workflowStats.unread_notifications ?? unreadNotifications.length), trend: `已读取通知 ${notifications.length - unreadNotifications.length}`, icon: <BellOutlined />, tone: 'purple' },
  ];

  const todoItems = [
    ...pendingWorkflows.slice(0, 5).map((item) => ({
      id: `wf-${item.id}`,
      tag: '流程',
      tone: 'blue',
      title: item.title,
      meta: `${item.resource_type || 'workflow'} / 当前步骤 ${item.current_step ?? 0}`,
      time: formatTime(item.updated_at || item.created_at),
      path: '/workflow?tab=pending',
    })),
    ...openEvents.slice(0, Math.max(0, 5 - pendingWorkflows.length)).map((item) => ({
      id: `qe-${item.id}`,
      tag: '质量',
      tone: item.severity === 'critical' ? 'red' : 'orange',
      title: item.title,
      meta: `${item.id} / ${item.source}`,
      time: formatTime(item.occurred_at),
      path: '/program/quality-event',
    })),
  ];

  return (
    <div className="workspace-page personal-workspace-page role-workspace-page">
      <section className="workspace-hero-row role-workspace-hero">
        <div>
          <Typography.Text className="role-workspace-kicker">ManuFoundry Role Workbench</Typography.Text>
          <Typography.Title level={3}>{roleTitle(roleKey)}</Typography.Title>
          <Typography.Text type="secondary">{headline}</Typography.Text>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadWorkbench}>刷新数据</Button>
          <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => navigate('/program/quality-event')}>
            进入质量异常闭环
          </Button>
        </Space>
      </section>

      {loading ? (
        <Skeleton active />
      ) : (
        <>
          <Row gutter={[14, 14]}>
            {stats.map((item) => (
              <Col xs={24} sm={12} xl={6} key={item.label}>
                <div className={`workbench-stat-card workbench-stat-${item.tone}`}>
                  <span>{item.icon}</span>
                  <div>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    <em>{item.trend}</em>
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]} align="stretch" style={{ marginTop: 16 }}>
            <Col xs={24} xl={10}>
              <Card className="workspace-section workbench-task-card" title="今日待办队列" extra={<Tag color="processing">后台接口</Tag>}>
                {todoItems.length ? (
                  <div className="workbench-task-list">
                    {todoItems.map((item) => (
                      <button className="workbench-task-row" key={item.id} onClick={() => navigate(item.path)}>
                        <Tag color={item.tone}>{item.tag}</Tag>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.meta}</small>
                        </div>
                        <em>{item.time}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无后台待办数据" />
                )}
              </Card>
            </Col>

            <Col xs={24} xl={8}>
              <Card className="workspace-section" title="质量事件" extra={<Tag color="processing">质量数据库</Tag>}>
                {events.length ? (
                  <div className="quality-event-list">
                    {events.slice(0, 3).map((event) => (
                      <button className="quality-workspace-event" key={event.id} onClick={() => navigate('/program/quality-event')}>
                        <span>
                          <Tag color={event.severity === 'critical' ? 'red' : 'orange'}>{event.severity}</Tag>
                          <strong>{event.title}</strong>
                        </span>
                        <small>{event.id} / {event.source}</small>
                        <p>{event.description || '数据库未记录描述'}</p>
                        <Progress percent={event.risk_score ?? 0} size="small" strokeColor={(event.risk_score ?? 0) > 85 ? '#c83f49' : '#d48806'} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无质量事件数据" />
                )}
              </Card>
            </Col>

            <Col xs={24} xl={6}>
              <Card className="workspace-section" title="后台指标">
                <div className="workbench-watch-list">
                  <div className="workbench-watch-row">
                    <div>
                      <strong>流程完成率</strong>
                      <small>来自 /workflow/stats</small>
                    </div>
                    <Progress percent={completionRate} size="small" />
                  </div>
                  <div className="workbench-watch-row">
                    <div>
                      <strong>质量事件开放占比</strong>
                      <small>来自 /quality/events</small>
                    </div>
                    <Progress percent={openRate} size="small" strokeColor="#a66f1f" />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Card className="workspace-section" title="最近通知">
            {notifications.length ? (
              <div className="workbench-activity-grid">
                {notifications.slice(0, 6).map((item) => (
                  <button className="workbench-activity-item" key={item.id} onClick={() => item.link && navigate(item.link)}>
                    <span><BellOutlined /></span>
                    <strong>{item.title}</strong>
                    <small>{item.content || formatTime(item.created_at)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无后台通知数据" />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
