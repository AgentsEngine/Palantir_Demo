import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  adminCreateUser,
  adminDeleteUser,
  adminListOrgUnits,
  adminListRoles,
  adminListUserSessions,
  adminListUsers,
  adminRevokeSession,
  adminUpdateUser,
  adminUpdateUserSecurity,
} from '@/services/api';

interface RoleItem { id: number; name: string; label: string }
interface OrgUnitItem { id: number; name: string; org_type: string }
interface UserItem {
  id: number;
  username: string;
  display_name?: string;
  email?: string;
  is_active: boolean;
  is_admin: boolean;
  roles: RoleItem[];
  org_units?: Array<{ id: number; name: string; position_title?: string; is_primary?: boolean }>;
  locked_until?: string | null;
  force_password_change?: boolean;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  mfa_enabled?: boolean;
  sso_provider?: string | null;
  sso_subject?: string | null;
}

type ImportRow = Record<string, string>;

const csvHeaders = 'username,display_name,email,password,role_names,org_names,is_active';

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitItem[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFiles, setImportFiles] = useState<UploadFile[]>([]);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(100);
  const [form] = Form.useForm();
  const [securityForm] = Form.useForm();

  const orgOptions = useMemo(
    () => orgUnits.map((org) => ({ label: `${org.name} / ${org.org_type}`, value: org.id })),
    [orgUnits],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, oRes] = await Promise.all([adminListUsers(), adminListRoles(), adminListOrgUnits()]);
      setUsers(uRes.data?.data || []);
      setRoles((rRes.data?.data || []).map((role: any) => ({ id: role.id, name: role.name, label: role.label })));
      setOrgUnits(oRes.data?.data || []);
    } catch {
      message.error('加载用户与权限数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!users.length) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId]);

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, is_admin: false, role_ids: [], org_unit_ids: [] });
    setModalOpen(true);
  };

  const openEdit = (record: UserItem) => {
    const primaryOrg = record.org_units?.find((org) => org.is_primary) || record.org_units?.[0];
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      display_name: record.display_name,
      email: record.email,
      is_active: record.is_active,
      is_admin: record.is_admin,
      role_ids: record.roles?.map((role) => role.id) || [],
      org_unit_ids: record.org_units?.map((org) => org.id) || [],
      primary_org_unit_id: primaryOrg?.id,
      position_title: primaryOrg?.position_title,
    });
    setModalOpen(true);
  };

  const submitUser = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      role_ids: values.role_ids || [],
      org_unit_ids: values.org_unit_ids || [],
      primary_org_unit_id: values.primary_org_unit_id || values.org_unit_ids?.[0],
    };
    try {
      if (editingUser) {
        const { password, username, ...updates } = payload;
        void password;
        void username;
        await adminUpdateUser(editingUser.id, updates);
      } else {
        await adminCreateUser(payload);
      }
      message.success(editingUser ? '用户已更新' : '用户已创建');
      setModalOpen(false);
      fetchData();
    } catch {
      message.error(editingUser ? '更新用户失败' : '创建用户失败');
    }
  };

  const openSecurity = (record: UserItem) => {
    setEditingUser(record);
    securityForm.setFieldsValue({
      is_active: record.is_active,
      locked: Boolean(record.locked_until),
      force_password_change: record.force_password_change,
      sso_provider: record.sso_provider,
      sso_subject: record.sso_subject,
    });
    setSecurityOpen(true);
  };

  const submitSecurity = async () => {
    if (!editingUser) return;
    const values = await securityForm.validateFields();
    await adminUpdateUserSecurity(editingUser.id, values);
    message.success('账号安全设置已更新');
    setSecurityOpen(false);
    fetchData();
  };

  const openSessions = async (record: UserItem) => {
    setEditingUser(record);
    try {
      const res = await adminListUserSessions(record.id);
      setSessions(res.data?.data || []);
    } catch {
      setSessions([]);
      message.error('加载会话失败');
    }
    setSessionsOpen(true);
  };

  const deleteUser = async (record: UserItem) => {
    await adminDeleteUser(record.id);
    message.success('用户已删除');
    fetchData();
  };

  const importUsers = async () => {
    const file = importFiles[0]?.originFileObj;
    if (!file) {
      message.warning('请先选择 CSV 文件');
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        message.warning('CSV 中没有可导入的数据');
        return;
      }
      const roleMap = new Map(roles.flatMap((role) => [[role.name, role.id], [role.label, role.id]]));
      const orgMap = new Map(orgUnits.map((org) => [org.name, org.id]));
      let success = 0;
      let failed = 0;
      for (const row of rows) {
        const username = row.username?.trim();
        const password = row.password?.trim();
        if (!username || !password) {
          failed += 1;
          continue;
        }
        const roleIds = splitList(row.role_names).map((name) => roleMap.get(name)).filter((id): id is number => Boolean(id));
        const orgIds = splitList(row.org_names).map((name) => orgMap.get(name)).filter((id): id is number => Boolean(id));
        try {
          await adminCreateUser({
            username,
            password,
            display_name: row.display_name || username,
            email: row.email,
            is_active: row.is_active !== 'false',
            is_admin: false,
            role_ids: roleIds,
            org_unit_ids: orgIds,
            primary_org_unit_id: orgIds[0],
          });
          success += 1;
        } catch {
          failed += 1;
        }
      }
      message.success(`导入完成：成功 ${success} 条，失败 ${failed} 条`);
      setImportOpen(false);
      setImportFiles([]);
      fetchData();
    } finally {
      setImporting(false);
    }
  };

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId],
  );

  const pagedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return users.slice(start, start + userPageSize);
  }, [users, userPage, userPageSize]);

  return (
    <div className="user-management-console">
      <div className="user-management-toolbar">
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>用户管理</Typography.Title>
          <Typography.Text type="secondary">账号、角色、组织、SSO 绑定、MFA 状态和会话治理。</Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchData} />
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>导入</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
        </Space>
      </div>

      <div className="user-management-workbench">
        <div className="user-list-panel">
          <Table
            dataSource={pagedUsers}
            rowKey="id"
            loading={loading}
            size="small"
            className="user-management-table"
            scroll={{ x: 1180, y: 'calc(100vh / var(--app-ui-scale) - 598px)' }}
            pagination={false}
            rowClassName={(record) => (record.id === selectedUserId ? 'user-row-selected' : '')}
            onRow={(record) => ({
              onClick: () => setSelectedUserId(record.id),
            })}
            columns={[
              { title: '账号', dataIndex: 'username', width: 130 },
              { title: '姓名', dataIndex: 'display_name', width: 150 },
              { title: '邮箱', dataIndex: 'email', width: 210, ellipsis: true },
              {
                title: '角色',
                dataIndex: 'roles',
                width: 210,
                render: (items: RoleItem[]) => items?.map((role) => <Tag key={role.id} color="blue">{role.label}</Tag>),
              },
              {
                title: '组织',
                dataIndex: 'org_units',
                width: 200,
                render: (items: UserItem['org_units']) => items?.length
                  ? items.map((org) => <Tag key={org.id} color={org.is_primary ? 'green' : 'default'}>{org.name}</Tag>)
                  : <Typography.Text type="secondary">未分配</Typography.Text>,
              },
              {
                title: '安全状态',
                width: 190,
                render: (_value, record: UserItem) => (
                  <Space size={4} wrap>
                    {record.is_active ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
                    {record.is_admin && <Tag color="red">管理员</Tag>}
                    {record.locked_until && <Tag color="red">锁定</Tag>}
                    {record.force_password_change && <Tag color="orange">强制改密</Tag>}
                    {record.mfa_enabled && <Tag color="blue">MFA</Tag>}
                    {record.sso_subject && <Tag color="purple">SSO</Tag>}
                  </Space>
                ),
              },
              {
                title: '最近登录',
                width: 160,
                render: (_value, record: UserItem) => record.last_login_at || '-',
              },
              {
                title: '操作',
                width: 190,
                fixed: 'right',
                render: (_value, record: UserItem) => (
                  <Space size={4} onClick={(event) => event.stopPropagation()}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                    <Button size="small" onClick={() => openSecurity(record)}>安全</Button>
                    <Button size="small" onClick={() => openSessions(record)}>会话</Button>
                    {record.username !== 'admin' && (
                      <Popconfirm title="确定删除该用户？" onConfirm={() => deleteUser(record)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
          <div className="user-management-pagination">
            <Pagination
              current={userPage}
              pageSize={userPageSize}
              total={users.length}
              showSizeChanger
              pageSizeOptions={[20, 50, 100, 200]}
              showTotal={(total) => `共 ${total} 个用户`}
              onChange={(page, pageSize) => {
                setUserPage(page);
                setUserPageSize(pageSize);
              }}
            />
          </div>
        </div>

        <UserPreviewPanel
          user={selectedUser}
          totalUsers={users.length}
          onEdit={openEdit}
          onSecurity={openSecurity}
          onSessions={openSessions}
          onDelete={deleteUser}
        />
      </div>

      <Modal title={editingUser ? '编辑用户' : '新建用户'} open={modalOpen} onOk={submitUser} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item label="账号" name="username" rules={[{ required: true }]}>
            <Input disabled={!!editingUser} placeholder="login_name" />
          </Form.Item>
          <Form.Item label="姓名" name="display_name"><Input /></Form.Item>
          <Form.Item label="邮箱" name="email"><Input /></Form.Item>
          {!editingUser && (
            <Form.Item label="初始密码" name="password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item label="角色" name="role_ids"><Select mode="multiple" options={roles.map((role) => ({ label: role.label, value: role.id }))} /></Form.Item>
          <Form.Item label="所属组织" name="org_unit_ids"><Select mode="multiple" options={orgOptions} /></Form.Item>
          <Form.Item label="主组织" name="primary_org_unit_id"><Select allowClear options={orgOptions} /></Form.Item>
          <Form.Item label="岗位" name="position_title"><Input /></Form.Item>
          <Space size={24}>
            <Form.Item label="启用" name="is_active" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item label="超级管理员" name="is_admin" valuePropName="checked"><Switch disabled={editingUser?.username === 'admin'} /></Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="导入用户"
        open={importOpen}
        onOk={importUsers}
        onCancel={() => setImportOpen(false)}
        confirmLoading={importing}
        okText="开始导入"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text type="secondary">
            支持 CSV 文件，表头：{csvHeaders}。角色和组织按名称匹配，多个值用英文分号分隔。
          </Typography.Text>
          <Upload.Dragger
            accept=".csv,text/csv"
            beforeUpload={() => false}
            fileList={importFiles}
            maxCount={1}
            onChange={({ fileList }) => setImportFiles(fileList)}
          >
            <p className="ant-upload-drag-icon"><UploadOutlined /></p>
            <p className="ant-upload-text">点击或拖拽 CSV 到这里</p>
          </Upload.Dragger>
        </Space>
      </Modal>

      <Modal title={`账号安全 - ${editingUser?.username || ''}`} open={securityOpen} onOk={submitSecurity} onCancel={() => setSecurityOpen(false)} destroyOnClose>
        <Form form={securityForm} layout="vertical">
          <Form.Item name="password" label="重置密码"><Input.Password placeholder="留空则不修改" /></Form.Item>
          <Space size={24}>
            <Form.Item name="is_active" label="启用账号" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="locked" label="锁定账号" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="force_password_change" label="强制改密" valuePropName="checked"><Switch /></Form.Item>
          </Space>
          <Form.Item name="sso_provider" label="SSO Provider"><Input placeholder="OIDC issuer" /></Form.Item>
          <Form.Item name="sso_subject" label="SSO Subject"><Input placeholder="IdP subject" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`在线会话 - ${editingUser?.username || ''}`} open={sessionsOpen} onCancel={() => setSessionsOpen(false)} footer={null} width={860}>
        <Table
          dataSource={sessions}
          rowKey="session_id"
          size="small"
          columns={[
            { title: '方式', dataIndex: 'login_method', width: 90 },
            { title: 'IP', dataIndex: 'ip_address', width: 130 },
            { title: '过期时间', dataIndex: 'expires_at', width: 180 },
            { title: '撤销时间', dataIndex: 'revoked_at', width: 180, render: (value) => value || '-' },
            {
              title: '操作',
              width: 100,
              render: (_value, record: any) => (
                <Button
                  size="small"
                  disabled={Boolean(record.revoked_at)}
                  onClick={async () => {
                    await adminRevokeSession(record.session_id);
                    if (editingUser) openSessions(editingUser);
                  }}
                >
                  撤销
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}

function splitList(value?: string) {
  return (value || '').split(/[;；]/).map((item) => item.trim()).filter(Boolean);
}

function UserPreviewPanel({
  user,
  totalUsers,
  onEdit,
  onSecurity,
  onSessions,
  onDelete,
}: {
  user: UserItem | null;
  totalUsers: number;
  onEdit: (record: UserItem) => void;
  onSecurity: (record: UserItem) => void;
  onSessions: (record: UserItem) => void;
  onDelete: (record: UserItem) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!user) {
    return (
      <aside className="user-preview-panel">
        <Empty description="选择一个用户查看账号治理信息" />
      </aside>
    );
  }

  const primaryOrg = user.org_units?.find((org) => org.is_primary) || user.org_units?.[0];
  const securityItems = [
    { label: '账号启用', active: user.is_active, tag: user.is_active ? '启用' : '停用', color: user.is_active ? 'green' : 'default' },
    { label: '管理员', active: user.is_admin, tag: user.is_admin ? '是' : '否', color: user.is_admin ? 'red' : 'default' },
    { label: 'MFA', active: Boolean(user.mfa_enabled), tag: user.mfa_enabled ? '已启用' : '未启用', color: user.mfa_enabled ? 'blue' : 'default' },
    { label: 'SSO', active: Boolean(user.sso_subject), tag: user.sso_subject ? '已绑定' : '未绑定', color: user.sso_subject ? 'purple' : 'default' },
  ];

  const tabs = [
    {
      key: 'overview',
      label: '详情',
      children: (
        <div className="user-detail-grid">
          <section className="user-info-card">
            <Typography.Text strong>基本信息</Typography.Text>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="账号">{user.username}</Descriptions.Item>
              <Descriptions.Item label="姓名">{user.display_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{user.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="主组织">{primaryOrg?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="岗位">{primaryOrg?.position_title || '-'}</Descriptions.Item>
              <Descriptions.Item label="最近登录">{user.last_login_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="登录 IP">{user.last_login_ip || '-'}</Descriptions.Item>
            </Descriptions>
          </section>
        </div>
      ),
    },
    {
      key: 'summary',
      label: '账号概览',
      children: (
        <section className="user-impact-card">
          <Typography.Text strong>账号概览</Typography.Text>
          <div className="user-preview-stats">
            <div><span>角色</span><strong>{user.roles?.length || 0}</strong></div>
            <div><span>组织</span><strong>{user.org_units?.length || 0}</strong></div>
            <div><span>全局用户</span><strong>{totalUsers}</strong></div>
            <div><span>安全标记</span><strong>{securityItems.filter((item) => item.active).length}</strong></div>
          </div>
        </section>
      ),
    },
    {
      key: 'access',
      label: `角色组织 (${(user.roles?.length || 0) + (user.org_units?.length || 0)})`,
      children: (
        <div className="user-access-list">
          <section className="user-section-card">
            <Typography.Text strong>角色</Typography.Text>
            <div className="user-tag-cloud">
              {user.roles?.length
                ? user.roles.map((role) => <Tag key={role.id} color="blue">{role.label}</Tag>)
                : <Typography.Text type="secondary">未分配角色</Typography.Text>}
            </div>
          </section>
          <section className="user-section-card">
            <Typography.Text strong>组织</Typography.Text>
            <div className="user-org-list">
              {user.org_units?.length ? user.org_units.map((org) => (
                <div key={org.id}>
                  <span>{org.name}</span>
                  <Tag color={org.is_primary ? 'green' : 'default'}>{org.is_primary ? '主组织' : '成员'}</Tag>
                  <small>{org.position_title || '-'}</small>
                </div>
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未分配组织" />}
            </div>
          </section>
        </div>
      ),
    },
    {
      key: 'security',
      label: '安全',
      children: (
        <div className="user-security-list">
          {securityItems.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <Tag color={item.color}>{item.tag}</Tag>
            </div>
          ))}
          <section className="user-section-card">
            <Typography.Text strong>治理状态</Typography.Text>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="锁定">{user.locked_until || '未锁定'}</Descriptions.Item>
              <Descriptions.Item label="强制改密">{user.force_password_change ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="SSO Provider">{user.sso_provider || '-'}</Descriptions.Item>
              <Descriptions.Item label="SSO Subject">{user.sso_subject || '-'}</Descriptions.Item>
            </Descriptions>
          </section>
        </div>
      ),
    },
  ];

  return (
    <aside className="user-preview-panel">
      <div className="user-preview-head">
        <div>
          <Space size={6} wrap>
            <Typography.Title level={5}>{user.display_name || user.username}</Typography.Title>
            {user.is_active ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
            {user.is_admin && <Tag color="red">管理员</Tag>}
          </Space>
          <Typography.Text type="secondary">{user.username} / {user.email || '未配置邮箱'}</Typography.Text>
        </div>
      </div>

      <Tabs
        className="user-preview-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabs}
      />

      <section className="user-action-card">
        <Typography.Text strong>快速操作</Typography.Text>
        <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(user)}>编辑</Button>
          <Button size="small" onClick={() => onSecurity(user)}>安全</Button>
          <Button size="small" onClick={() => onSessions(user)}>会话</Button>
          {user.username !== 'admin' && (
            <Popconfirm title="确定删除该用户？" onConfirm={() => onDelete(user)}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      </section>
    </aside>
  );
}

function parseCsv(text: string): ImportRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const [headers = [], ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header.trim(), record[index]?.trim() || ''])));
}
