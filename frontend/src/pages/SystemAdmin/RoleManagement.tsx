import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Tag, Popconfirm,
  Typography, message, Checkbox,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { adminListRoles, adminCreateRole, adminDeleteRole, adminSetPermissions } from '@/services/api';

const RESOURCE_TYPES = [
  { label: '菜单', value: 'menu' },
  { label: '页面', value: 'page' },
  { label: '操作', value: 'action' },
  { label: '数据', value: 'data' },
  { label: '全部', value: 'all' },
];

const ACTIONS = ['view', 'create', 'edit', 'delete', '*'];

interface RoleItem {
  id: number;
  name: string;
  label: string;
  description: string;
  permissions: { resource_type: string; resource_key: string; action: string }[];
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListRoles();
      setRoles(res.data?.data || []);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleCreate = () => {
    Modal.confirm({
      title: '新建角色',
      content: (
        <Form layout="vertical" size="small" style={{ marginTop: 16 }}>
          <Form.Item label="角色名(英文)"><Input id="r-name" placeholder="如 editor" /></Form.Item>
          <Form.Item label="显示名"><Input id="r-label" placeholder="如 编辑者" /></Form.Item>
          <Form.Item label="描述"><Input id="r-desc" placeholder="描述" /></Form.Item>
        </Form>
      ),
      onOk: async () => {
        const name = (document.getElementById('r-name') as HTMLInputElement)?.value?.trim();
        const label = (document.getElementById('r-label') as HTMLInputElement)?.value?.trim();
        const description = (document.getElementById('r-desc') as HTMLInputElement)?.value?.trim();
        if (!name || !label) { message.warning('必填'); return; }
        try {
          await adminCreateRole({ name, label, description });
          message.success('创建成功');
          fetchRoles();
        } catch { message.error('创建失败'); }
      },
    });
  };

  const handleEditPerms = (role: RoleItem) => {
    Modal.confirm({
      title: `编辑权限 — ${role.label}`,
      width: 600,
      content: (
        <div style={{ marginTop: 16 }}>
          <div id="perm-list">
            {role.permissions.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select data-idx={i} data-field="resource_type" defaultValue={p.resource_type}
                  style={{ width: 80, padding: 4 }}>
                  {RESOURCE_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                </select>
                <input data-idx={i} data-field="resource_key" defaultValue={p.resource_key || ''} placeholder="资源标识"
                  style={{ flex: 1, padding: 4, border: '1px solid #d9d9d9', borderRadius: 4 }} />
                <select data-idx={i} data-field="action" defaultValue={p.action}
                  style={{ width: 80, padding: 4 }}>
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>完整权限管理功能开发中</p>
        </div>
      ),
      onOk: async () => {
        const permEls = document.querySelectorAll('#perm-list [data-idx]');
        const perms: any[] = [];
        permEls.forEach(el => {
          const idx = (el as HTMLElement).dataset.idx;
          const field = (el as HTMLElement).dataset.field;
          const existing = perms[parseInt(idx!)] || {};
          existing[field!] = (el as HTMLInputElement | HTMLSelectElement).value;
          perms[parseInt(idx!)] = existing;
        });
        try {
          await adminSetPermissions({ role_id: role.id, permissions: perms.filter(Boolean) });
          message.success('权限已更新');
          fetchRoles();
        } catch { message.error('更新失败'); }
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '角色名', dataIndex: 'name', width: 120 },
    { title: '显示名', dataIndex: 'label', width: 100 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '权限数', width: 80,
      render: (_: any, r: RoleItem) => <Tag color="blue">{r.permissions?.length || 0}</Tag>,
    },
    {
      title: '操作', width: 160,
      render: (_: any, r: RoleItem) => (
        <Space size={4}>
          <Button size="small" onClick={() => handleEditPerms(r)}>编辑权限</Button>
          {r.name !== 'admin' && (
            <Popconfirm title="确定删除？" onConfirm={async () => { await adminDeleteRole(r.id); fetchRoles(); }}>
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
        <Typography.Title level={5} style={{ margin: 0 }}>角色权限管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建角色</Button>
      </div>
      <Table dataSource={roles} columns={columns} rowKey="id" loading={loading} size="small" />
    </div>
  );
}
