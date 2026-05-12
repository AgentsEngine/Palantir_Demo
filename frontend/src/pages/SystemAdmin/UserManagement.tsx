import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Switch, Tag, Popconfirm,
  Typography, message, Select,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminListRoles } from '@/services/api';

interface UserItem {
  id: number;
  username: string;
  display_name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  roles: { id: number; name: string; label: string }[];
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([adminListUsers(), adminListRoles()]);
      setUsers(uRes.data?.data || []);
      setRoles((rRes.data?.data || []).map((r: any) => ({ id: r.id, name: r.name, label: r.label })));
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = () => {
    Modal.confirm({
      title: '新建用户',
      content: (
        <Form layout="vertical" size="small" style={{ marginTop: 16 }}>
          <Form.Item label="用户名"><Input id="u-name" placeholder="登录用户名" /></Form.Item>
          <Form.Item label="显示名"><Input id="u-display" placeholder="如 张三" /></Form.Item>
          <Form.Item label="邮箱"><Input id="u-email" placeholder="email@example.com" /></Form.Item>
          <Form.Item label="密码"><Input.Password id="u-pass" placeholder="密码" /></Form.Item>
          <Form.Item label="角色">
            <Select id="u-roles" mode="multiple" placeholder="选择角色"
              options={roles.map(r => ({ label: r.label, value: r.id }))} />
          </Form.Item>
          <Form.Item label="管理员"><Switch id="u-admin" /></Form.Item>
        </Form>
      ),
      onOk: async () => {
        const username = (document.getElementById('u-name') as HTMLInputElement)?.value?.trim();
        const display_name = (document.getElementById('u-display') as HTMLInputElement)?.value?.trim();
        const email = (document.getElementById('u-email') as HTMLInputElement)?.value?.trim();
        const password = (document.getElementById('u-pass') as HTMLInputElement)?.value;
        const role_ids = (document.getElementById('u-roles') as any)?.value || [];
        const is_admin = (document.getElementById('u-admin') as any)?.checked || false;
        if (!username || !password) { message.warning('用户名和密码必填'); return; }
        try {
          await adminCreateUser({ username, display_name, email, password, is_admin, role_ids });
          message.success('创建成功');
          fetchData();
        } catch { message.error('创建失败'); }
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', width: 100 },
    { title: '显示名', dataIndex: 'display_name', width: 100 },
    { title: '邮箱', dataIndex: 'email', width: 180, ellipsis: true },
    {
      title: '角色', dataIndex: 'roles', width: 200,
      render: (roles: { label: string }[]) => roles?.map((r, i) => <Tag key={i} color="blue">{r.label}</Tag>),
    },
    {
      title: '管理员', dataIndex: 'is_admin', width: 70,
      render: (v: boolean) => v ? <Tag color="red">是</Tag> : '',
    },
    {
      title: '状态', dataIndex: 'is_active', width: 70,
      render: (v: boolean) => v ? <Tag color="green">活跃</Tag> : <Tag>禁用</Tag>,
    },
    {
      title: '操作', width: 80,
      render: (_: any, r: UserItem) => (
        r.username !== 'admin' ? (
          <Popconfirm title="确定删除？" onConfirm={async () => { await adminDeleteUser(r.id); fetchData(); }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>用户管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建用户</Button>
      </div>
      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} size="small" />
    </div>
  );
}
