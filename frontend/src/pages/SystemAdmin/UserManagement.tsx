import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
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

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitItem[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>用户管理</Typography.Title>
          <Typography.Text type="secondary">账号、角色、组织、SSO 绑定、MFA 状态和会话治理。</Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchData} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
        </Space>
      </div>

      <Table
        dataSource={users}
        rowKey="id"
        loading={loading}
        size="small"
        columns={[
          { title: '账号', dataIndex: 'username', width: 130 },
          { title: '姓名', dataIndex: 'display_name', width: 160 },
          { title: '邮箱', dataIndex: 'email', width: 220, ellipsis: true },
          {
            title: '角色',
            dataIndex: 'roles',
            width: 240,
            render: (items: RoleItem[]) => items?.map((role) => <Tag key={role.id} color="blue">{role.label}</Tag>),
          },
          {
            title: '组织',
            dataIndex: 'org_units',
            width: 220,
            render: (items: UserItem['org_units']) => items?.length
              ? items.map((org) => <Tag key={org.id} color={org.is_primary ? 'green' : 'default'}>{org.name}</Tag>)
              : <Typography.Text type="secondary">未分配</Typography.Text>,
          },
          {
            title: '安全状态',
            width: 210,
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
            width: 180,
            render: (_value, record: UserItem) => record.last_login_at || '-',
          },
          {
            title: '操作',
            width: 210,
            render: (_value, record: UserItem) => (
              <Space size={4}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                <Button size="small" onClick={() => openSecurity(record)}>安全</Button>
                <Button size="small" onClick={() => openSessions(record)}>会话</Button>
                {record.username !== 'admin' && (
                  <Popconfirm title="确定删除该用户？" onConfirm={async () => { await adminDeleteUser(record.id); fetchData(); }}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

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
