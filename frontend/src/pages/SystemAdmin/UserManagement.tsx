import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  adminCreateUser,
  adminDeleteUser,
  adminListOrgUnits,
  adminListRoles,
  adminListUsers,
  adminUpdateUser,
} from '@/services/api';

interface RoleItem {
  id: number;
  name: string;
  label: string;
}

interface OrgUnitItem {
  id: number;
  parent_id?: number | null;
  code: string;
  name: string;
  org_type: string;
  member_count?: number;
}

interface UserOrgUnit {
  id: number;
  code: string;
  name: string;
  org_type: string;
  position_title?: string;
  is_primary?: boolean;
}

interface UserItem {
  id: number;
  username: string;
  display_name: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  roles: RoleItem[];
  org_units?: UserOrgUnit[];
}

const orgTypeLabel: Record<string, string> = {
  company: '集团',
  factory: '工厂',
  department: '部门',
  team: '班组',
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [form] = Form.useForm();

  const orgOptions = useMemo(
    () => orgUnits.map((org) => ({
      label: `${org.name} · ${orgTypeLabel[org.org_type] || org.org_type}`,
      value: org.id,
    })),
    [orgUnits],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, oRes] = await Promise.all([adminListUsers(), adminListRoles(), adminListOrgUnits()]);
      setUsers(uRes.data?.data || []);
      setRoles((rRes.data?.data || []).map((r: any) => ({ id: r.id, name: r.name, label: r.label })));
      setOrgUnits(oRes.data?.data || []);
    } catch {
      message.error('加载用户与权限数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      org_unit_ids: values.org_unit_ids || [],
      primary_org_unit_id: values.primary_org_unit_id || values.org_unit_ids?.[0],
      role_ids: values.role_ids || [],
    };
    try {
      if (editingUser) {
        const { password, username, ...updates } = payload;
        await adminUpdateUser(editingUser.id, updates);
        message.success('用户已更新');
      } else {
        await adminCreateUser(payload);
        message.success('用户已创建');
      }
      setModalOpen(false);
      fetchData();
    } catch {
      message.error(editingUser ? '更新用户失败' : '创建用户失败');
    }
  };

  const columns = [
    { title: '账号', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'display_name', width: 160 },
    { title: '邮箱', dataIndex: 'email', width: 220, ellipsis: true },
    {
      title: '角色',
      dataIndex: 'roles',
      width: 260,
      render: (items: RoleItem[]) => items?.map((role) => <Tag key={role.id} color="blue">{role.label}</Tag>),
    },
    {
      title: '组织/岗位',
      dataIndex: 'org_units',
      width: 280,
      render: (items: UserOrgUnit[]) => {
        if (!items?.length) return <Typography.Text type="secondary">未分配</Typography.Text>;
        return items.map((org) => (
          <Tag key={org.id} color={org.is_primary ? 'green' : 'default'}>
            {org.name}{org.position_title ? ` · ${org.position_title}` : ''}
          </Tag>
        ));
      },
    },
    {
      title: '管理员',
      dataIndex: 'is_admin',
      width: 90,
      render: (value: boolean) => (value ? <Tag color="red">是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 90,
      render: (value: boolean) => (value ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, record: UserItem) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          {record.username !== 'admin' && (
            <Popconfirm title="确定删除该用户？" onConfirm={async () => { await adminDeleteUser(record.id); fetchData(); }}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>用户管理</Typography.Title>
          <Typography.Text type="secondary">账号在这里绑定角色和组织，角色控制功能，组织用于后续数据范围。</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} size="small" />

      <Modal
        title={editingUser ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onOk={submitUser}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item label="账号" name="username" rules={[{ required: true, message: '请输入账号' }]}>
            <Input disabled={!!editingUser} placeholder="login_name" />
          </Form.Item>
          <Form.Item label="姓名" name="display_name">
            <Input placeholder="显示姓名" />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input placeholder="email@example.com" />
          </Form.Item>
          {!editingUser && (
            <Form.Item label="初始密码" name="password" rules={[{ required: true, message: '请输入初始密码' }]}>
              <Input.Password placeholder="初始密码" />
            </Form.Item>
          )}
          <Form.Item label="角色" name="role_ids">
            <Select mode="multiple" options={roles.map((role) => ({ label: role.label, value: role.id }))} />
          </Form.Item>
          <Form.Item label="所属组织" name="org_unit_ids">
            <Select mode="multiple" options={orgOptions} />
          </Form.Item>
          <Form.Item label="主组织" name="primary_org_unit_id">
            <Select allowClear options={orgOptions} />
          </Form.Item>
          <Form.Item label="岗位" name="position_title">
            <Input placeholder="例如：质量工程师" />
          </Form.Item>
          <Space size={24}>
            <Form.Item label="启用" name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="超级管理员" name="is_admin" valuePropName="checked">
              <Switch disabled={editingUser?.username === 'admin'} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
