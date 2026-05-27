import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  PlatformTenantInvite,
  PlatformTenantItem,
  TenantStatus,
  platformCreateTenant,
  platformCreateTenantInvite,
  platformListTenants,
  platformUpdateTenant,
} from '@/services/api';

const statusColor: Record<TenantStatus, string> = {
  active: 'green',
  suspended: 'orange',
  archived: 'default',
};

const statusLabel: Record<TenantStatus, string> = {
  active: '启用',
  suspended: '停用',
  archived: '归档',
};

const splitDomains = (value?: string): string[] =>
  (value || '')
    .split(/[\s,;，；]+/)
    .map((item) => item.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean);

const toNumberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const getApiError = (error: unknown, fallback: string) => {
  const detail = (error as any)?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};

export default function TenantManagement() {
  const [tenants, setTenants] = useState<PlatformTenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<PlatformTenantItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [inviteForm] = Form.useForm();

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformListTenants();
      setTenants(res.data?.data || []);
    } catch (error) {
      message.error(getApiError(error, '加载租户列表失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('链接已复制');
    } catch {
      message.warning('浏览器不允许自动复制，请手动复制链接');
    }
  };

  const showInviteLink = (invite?: PlatformTenantInvite) => {
    if (!invite?.inviteUrl) return;
    Modal.info({
      title: '邀请链接已生成',
      width: 680,
      content: (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text type="secondary">
            {invite.email} / {invite.role}，邮件{invite.emailDelivered ? '已发送' : '未发送，开发环境可复制链接'}。
          </Typography.Text>
          <Input value={invite.inviteUrl} readOnly suffix={<Button size="small" icon={<CopyOutlined />} onClick={() => copyText(invite.inviteUrl)} />} />
        </Space>
      ),
    });
  };

  const openCreate = () => {
    createForm.resetFields();
    createForm.setFieldsValue({
      config_brandName: 'ManuFoundry',
      config_defaultLanguage: 'zh-CN',
      limit_users: 50,
      limit_applications: 20,
      limit_dynamicRecords: 100000,
    });
    setCreateOpen(true);
  };

  const openEdit = (tenant: PlatformTenantItem) => {
    setSelectedTenant(tenant);
    editForm.setFieldsValue({
      name: tenant.name,
      status: tenant.status,
      domains: tenant.domains?.map((item) => item.domain).join('\n'),
      suspended_reason: tenant.suspendedReason,
      config_brandName: tenant.config?.brandName,
      config_defaultLanguage: tenant.config?.defaultLanguage,
      limit_users: tenant.limits?.users,
      limit_applications: tenant.limits?.applications,
      limit_dynamicRecords: tenant.limits?.dynamicRecords,
    });
    setEditOpen(true);
  };

  const openInvite = (tenant: PlatformTenantItem) => {
    setSelectedTenant(tenant);
    inviteForm.resetFields();
    inviteForm.setFieldsValue({ role: 'member' });
    setInviteOpen(true);
  };

  const createTenant = async () => {
    const values = await createForm.validateFields();
    setSaving(true);
    try {
      const res = await platformCreateTenant({
        name: values.name,
        slug: values.slug,
        domains: splitDomains(values.domains),
        admin_email: values.admin_email || undefined,
        config: {
          brandName: values.config_brandName,
          defaultLanguage: values.config_defaultLanguage,
        },
        limits: {
          users: toNumberOrUndefined(values.limit_users),
          applications: toNumberOrUndefined(values.limit_applications),
          dynamicRecords: toNumberOrUndefined(values.limit_dynamicRecords),
        },
      });
      message.success('租户已创建');
      setCreateOpen(false);
      await loadTenants();
      showInviteLink(res.data?.data?.adminInvite);
    } catch (error) {
      message.error(getApiError(error, '创建租户失败'));
    } finally {
      setSaving(false);
    }
  };

  const updateTenant = async () => {
    if (!selectedTenant) return;
    const values = await editForm.validateFields();
    setSaving(true);
    try {
      await platformUpdateTenant(selectedTenant.id, {
        name: values.name,
        status: values.status,
        domains: splitDomains(values.domains),
        suspended_reason: values.suspended_reason || '',
        config: {
          brandName: values.config_brandName,
          defaultLanguage: values.config_defaultLanguage,
        },
        limits: {
          users: toNumberOrUndefined(values.limit_users),
          applications: toNumberOrUndefined(values.limit_applications),
          dynamicRecords: toNumberOrUndefined(values.limit_dynamicRecords),
        },
      });
      message.success('租户配置已更新');
      setEditOpen(false);
      await loadTenants();
    } catch (error) {
      message.error(getApiError(error, '更新租户失败'));
    } finally {
      setSaving(false);
    }
  };

  const createInvite = async () => {
    if (!selectedTenant) return;
    const values = await inviteForm.validateFields();
    setSaving(true);
    try {
      const res = await platformCreateTenantInvite(selectedTenant.id, {
        email: values.email,
        role: values.role,
      });
      message.success('邀请已生成');
      setInviteOpen(false);
      showInviteLink(res.data?.data);
      await loadTenants();
    } catch (error) {
      message.error(getApiError(error, '生成邀请失败'));
    } finally {
      setSaving(false);
    }
  };

  const tenantOptions = useMemo(
    () => tenants.map((tenant) => ({ label: `${tenant.name} / ${tenant.slug}`, value: tenant.id })),
    [tenants],
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Alert
        type="info"
        showIcon
        message="平台管理员在这里开通租户、绑定邮箱域名，并生成首个租户管理员邀请。"
        description="租户用户登录时会按邮箱域名解析租户；停用租户后，该租户用户无法继续登录。"
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>租户管理</Typography.Title>
          <Typography.Text type="secondary">Shared DB + tenant_id 模式下的租户状态、域名、限额与邀请入口。</Typography.Text>
        </div>
        <Space>
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadTenants} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建租户</Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={tenants}
        columns={[
          {
            title: '租户',
            width: 220,
            render: (_value, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text strong>{record.name}</Typography.Text>
                <Typography.Text type="secondary">{record.slug}</Typography.Text>
              </Space>
            ),
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (status: TenantStatus) => <Tag color={statusColor[status]}>{statusLabel[status] || status}</Tag>,
          },
          {
            title: '邮箱域名',
            width: 260,
            render: (_value, record) => record.domains?.length
              ? record.domains.map((item) => <Tag key={item.id || item.domain} icon={<LinkOutlined />}>{item.domain}</Tag>)
              : <Typography.Text type="secondary">未绑定</Typography.Text>,
          },
          {
            title: '用量',
            width: 230,
            render: (_value, record) => (
              <Space size={6} wrap>
                <Tag>用户 {record.usage?.users ?? 0}/{String(record.limits?.users ?? '-')}</Tag>
                <Tag>应用 {record.usage?.applications ?? 0}/{String(record.limits?.applications ?? '-')}</Tag>
                <Tag>记录 {record.usage?.dynamicRecords ?? 0}/{String(record.limits?.dynamicRecords ?? '-')}</Tag>
              </Space>
            ),
          },
          {
            title: '品牌/语言',
            width: 180,
            render: (_value, record) => (
              <Space direction="vertical" size={0}>
                <Typography.Text>{String(record.config?.brandName ?? '-')}</Typography.Text>
                <Typography.Text type="secondary">{String(record.config?.defaultLanguage ?? '-')}</Typography.Text>
              </Space>
            ),
          },
          {
            title: '操作',
            width: 180,
            render: (_value, record) => (
              <Space size={6}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>配置</Button>
                <Button size="small" icon={<SendOutlined />} disabled={record.status !== 'active'} onClick={() => openInvite(record)}>邀请</Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal title="新建租户" open={createOpen} onOk={createTenant} confirmLoading={saving} onCancel={() => setCreateOpen(false)} destroyOnClose width={720}>
        <TenantForm form={createForm} includeSlug includeAdminEmail />
      </Modal>

      <Modal title="租户配置" open={editOpen} onOk={updateTenant} confirmLoading={saving} onCancel={() => setEditOpen(false)} destroyOnClose width={720}>
        <TenantForm form={editForm} includeStatus />
      </Modal>

      <Modal title="邀请租户用户" open={inviteOpen} onOk={createInvite} confirmLoading={saving} onCancel={() => setInviteOpen(false)} destroyOnClose>
        <Form form={inviteForm} layout="vertical">
          <Form.Item label="租户">
            <Select disabled value={selectedTenant?.id} options={tenantOptions} />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input placeholder="user@example.com" />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true }]}>
            <Select
              options={[
                { label: '租户管理员', value: 'admin' },
                { label: '普通成员', value: 'member' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function TenantForm({
  form,
  includeSlug = false,
  includeAdminEmail = false,
  includeStatus = false,
}: {
  form: ReturnType<typeof Form.useForm>[0];
  includeSlug?: boolean;
  includeAdminEmail?: boolean;
  includeStatus?: boolean;
}) {
  return (
    <Form form={form} layout="vertical">
      <Form.Item label="租户名称" name="name" rules={[{ required: true, message: '请输入租户名称' }]}>
        <Input placeholder="例如：华东制造事业部" />
      </Form.Item>
      {includeSlug && (
        <Form.Item
          label="租户标识"
          name="slug"
          rules={[
            { required: true, message: '请输入租户标识' },
            { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字和中划线' },
          ]}
        >
          <Input placeholder="east-manufacturing" />
        </Form.Item>
      )}
      {includeStatus && (
        <Form.Item label="状态" name="status" rules={[{ required: true }]}>
          <Select
            options={[
              { label: '启用', value: 'active' },
              { label: '停用', value: 'suspended' },
              { label: '归档', value: 'archived' },
            ]}
          />
        </Form.Item>
      )}
      <Form.Item label="邮箱域名" name="domains" tooltip="支持逗号、空格或换行分隔；登录会按邮箱域名解析租户。">
        <Input.TextArea rows={3} placeholder="example.com&#10;factory.example.com" />
      </Form.Item>
      {includeAdminEmail && (
        <Form.Item label="首个管理员邮箱" name="admin_email" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
          <Input placeholder="admin@example.com" />
        </Form.Item>
      )}
      {includeStatus && (
        <Form.Item label="停用原因" name="suspended_reason">
          <Input.TextArea rows={2} placeholder="停用或归档时可填写" />
        </Form.Item>
      )}
      <Space wrap align="start" style={{ width: '100%' }}>
        <Form.Item label="品牌名" name="config_brandName">
          <Input style={{ width: 220 }} placeholder="ManuFoundry" />
        </Form.Item>
        <Form.Item label="默认语言" name="config_defaultLanguage">
          <Select
            style={{ width: 160 }}
            options={[
              { label: '简体中文', value: 'zh-CN' },
              { label: 'English', value: 'en-US' },
            ]}
          />
        </Form.Item>
        <Form.Item label="用户上限" name="limit_users">
          <InputNumber min={1} max={100000} style={{ width: 140 }} />
        </Form.Item>
        <Form.Item label="应用上限" name="limit_applications">
          <InputNumber min={1} max={10000} style={{ width: 140 }} />
        </Form.Item>
        <Form.Item label="动态记录软上限" name="limit_dynamicRecords">
          <InputNumber min={1} max={100000000} style={{ width: 160 }} />
        </Form.Item>
      </Space>
    </Form>
  );
}
