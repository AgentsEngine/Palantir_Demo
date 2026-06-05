import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  adminCreateRole,
  adminDeleteRole,
  adminListRoleTemplates,
  adminListRoles,
  adminSetPermissions,
  adminSimulatePermission,
} from '@/services/api';

interface PermissionItem {
  id?: number;
  resource_type: string;
  resource_key?: string;
  action: string;
  effect?: string;
  data_scope?: string;
  condition_json?: Record<string, unknown> | null;
  field_rules_json?: Record<string, unknown> | null;
  priority?: number;
  enabled?: boolean;
}

interface RoleItem {
  id: number;
  name: string;
  label: string;
  description?: string;
  permissions: PermissionItem[];
}

const resourceTypes = ['all', 'menu', 'application', 'form', 'workflow', 'report', 'audit', 'data', 'action'];
const actions = ['*', 'view', 'create', 'edit', 'delete', 'approve', 'export', 'publish'];
const dataScopes = ['all', 'self', 'own_org', 'org_tree', 'selected_orgs', 'condition'];

const resourceTypeLabels: Record<string, string> = {
  all: '全部资源',
  menu: '菜单',
  application: '应用',
  form: '表单',
  workflow: '流程',
  report: '报表',
  audit: '审计',
  data: '数据对象',
  action: '操作按钮',
};

const actionLabels: Record<string, string> = {
  '*': '全部动作',
  view: '查看',
  create: '新建',
  edit: '编辑',
  delete: '删除',
  approve: '审批',
  export: '导出',
  publish: '发布',
};

const dataScopeLabels: Record<string, string> = {
  all: '全部数据',
  self: '仅本人',
  own_org: '本部门',
  org_tree: '本部门及下级',
  selected_orgs: '指定组织',
  condition: '按条件规则',
};

const toOptions = (values: string[], labels: Record<string, string>) => (
  values.map((value) => ({ label: `${labels[value] || value} (${value})`, value }))
);

function parseJson(value?: string) {
  if (!value?.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('JSON 格式不正确');
  }
}

function stringifyJson(value: unknown) {
  return value ? JSON.stringify(value, null, 2) : '';
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [simulation, setSimulation] = useState<Record<string, unknown> | null>(null);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [simulateForm] = Form.useForm();

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, templatesRes] = await Promise.all([adminListRoles(), adminListRoleTemplates()]);
      setRoles(rolesRes.data?.data || []);
      setTemplates(templatesRes.data?.data || []);
    } catch {
      message.error('加载角色权限失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const openCreate = () => {
    createForm.resetFields();
    Modal.confirm({
      title: '新建角色',
      width: 520,
      content: (
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="template" label="角色模板">
            <Select
              allowClear
              options={templates.map((item) => ({ label: `${item.label} / ${item.key}`, value: item.key }))}
              onChange={(key) => {
                const tpl = templates.find((item) => item.key === key);
                if (tpl) createForm.setFieldsValue({ name: tpl.key, label: tpl.label, description: tpl.description });
              }}
            />
          </Form.Item>
          <Form.Item name="name" label="角色编码" rules={[{ required: true }]}>
            <Input placeholder="business_admin" />
          </Form.Item>
          <Form.Item name="label" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="业务管理员" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const values = await createForm.validateFields();
        const tpl = templates.find((item) => item.key === values.template);
        const res = await adminCreateRole(values);
        if (tpl?.permissions?.length && res.data?.id) {
          await adminSetPermissions({ role_id: res.data.id, permissions: tpl.permissions });
        }
        message.success('角色已创建');
        fetchRoles();
      },
    });
  };

  const openPermissions = (role: RoleItem) => {
    setEditingRole(role);
    form.setFieldsValue({
      permissions: (role.permissions || []).map((item) => ({
        ...item,
        effect: item.effect || 'allow',
        data_scope: item.data_scope || 'all',
        priority: item.priority ?? 100,
        enabled: item.enabled !== false,
        condition_json_text: stringifyJson(item.condition_json),
        field_rules_json_text: stringifyJson(item.field_rules_json),
      })),
    });
    setDrawerOpen(true);
  };

  const savePermissions = async () => {
    if (!editingRole) return;
    const values = await form.validateFields();
    try {
      const permissions = (values.permissions || []).map((item: any) => ({
        resource_type: item.resource_type,
        resource_key: item.resource_key || '*',
        action: item.action,
        effect: item.effect || 'allow',
        data_scope: item.data_scope || 'all',
        condition_json: parseJson(item.condition_json_text),
        field_rules_json: parseJson(item.field_rules_json_text),
        priority: item.priority ?? 100,
        enabled: item.enabled !== false,
      }));
      await adminSetPermissions({ role_id: editingRole.id, permissions });
      message.success('权限矩阵已保存');
      setDrawerOpen(false);
      fetchRoles();
    } catch (error: any) {
      message.error(error?.message || '保存失败');
    }
  };

  const runSimulation = async () => {
    const values = await simulateForm.validateFields();
    try {
      const payload = {
        ...values,
        user_id: Number(values.user_id),
        form_id: values.form_id ? Number(values.form_id) : undefined,
        record: parseJson(values.record_json) || {},
      };
      const res = await adminSimulatePermission(payload);
      setSimulation(res.data?.data || {});
    } catch (error: any) {
      message.error(error?.message || '模拟失败');
    }
  };

  const permissionCount = useMemo(
    () => roles.reduce((sum, role) => sum + (role.permissions?.length || 0), 0),
    [roles],
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>角色管理</Typography.Title>
          <Typography.Text type="secondary">
            按角色分配应用、表单、字段、数据范围和操作权限，共 {roles.length} 个角色 / {permissionCount} 条权限规则
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchRoles} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建角色</Button>
        </Space>
      </div>

      <Table
        dataSource={roles}
        rowKey="id"
        loading={loading}
        size="small"
        columns={[
          { title: '角色编码', dataIndex: 'name', width: 160 },
          { title: '显示名称', dataIndex: 'label', width: 160 },
          { title: '描述', dataIndex: 'description', ellipsis: true },
          {
            title: '权限',
            width: 120,
            render: (_value, role: RoleItem) => <Tag color="blue">{role.permissions?.length || 0}</Tag>,
          },
          {
            title: '操作',
            width: 180,
            render: (_value, role: RoleItem) => (
              <Space size={6}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openPermissions(role)}>权限矩阵</Button>
                {role.name !== 'admin' && (
                  <Popconfirm title="确定删除该角色？" onConfirm={async () => { await adminDeleteRole(role.id); fetchRoles(); }}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={`配置角色权限 - ${editingRole?.label || ''}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={980}
        extra={<Button type="primary" onClick={savePermissions}>保存</Button>}
      >
        <Tabs
          items={[
            {
              key: 'rules',
              label: '权限规则',
              children: (
                <Form form={form} layout="vertical">
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="配置建议"
                    description="资源 Key 可填具体编码，也可填 * 表示全部。优先级数字越小越先匹配；只要命中拒绝规则，最终就会拒绝。"
                  />
                  <Form.List name="permissions">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => add({
                            resource_type: 'form',
                            resource_key: '*',
                            action: 'view',
                            effect: 'allow',
                            data_scope: 'all',
                            priority: 100,
                            enabled: true,
                          })}
                        >
                          添加权限规则
                        </Button>
                        {fields.map((field) => (
                          <div key={field.key} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
                            <Space wrap align="start">
                              <Form.Item {...field} name={[field.name, 'enabled']} label="启用" valuePropName="checked">
                                <Switch />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'effect']} label="效果" rules={[{ required: true }]}>
                                <Select style={{ width: 110 }} options={[{ label: '允许', value: 'allow' }, { label: '拒绝', value: 'deny' }]} />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'resource_type']} label="资源类型" rules={[{ required: true }]}>
                                <Select style={{ width: 170 }} options={toOptions(resourceTypes, resourceTypeLabels)} />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'resource_key']} label="资源 Key">
                                <Input style={{ width: 170 }} placeholder="* / form_code" />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'action']} label="动作" rules={[{ required: true }]}>
                                <Select style={{ width: 130 }} options={toOptions(actions, actionLabels)} />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'data_scope']} label="数据范围">
                                <Select style={{ width: 170 }} options={toOptions(dataScopes, dataScopeLabels)} />
                              </Form.Item>
                              <Form.Item {...field} name={[field.name, 'priority']} label="优先级">
                                <InputNumber style={{ width: 100 }} min={1} />
                              </Form.Item>
                              <Button danger onClick={() => remove(field.name)}>删除</Button>
                            </Space>
                            <Form.Item
                              {...field}
                              name={[field.name, 'condition_json_text']}
                              label="条件规则"
                              extra='可选。例如：{"rules":[{"field":"org_id","op":"in","value":"$current_org_ids"}]}'
                            >
                              <Input.TextArea rows={3} placeholder='{"rules":[{"field":"org_id","op":"in","value":"$current_org_ids"}]}' />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'field_rules_json_text']}
                              label="字段规则"
                              extra='可选。例如：{"fields":{"cost":{"visible":false,"editable":false}}}'
                            >
                              <Input.TextArea rows={3} placeholder='{"fields":{"cost":{"visible":false,"editable":false}}}' />
                            </Form.Item>
                          </div>
                        ))}
                      </Space>
                    )}
                  </Form.List>
                </Form>
              ),
            },
            {
              key: 'simulation',
              label: '权限模拟',
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="用一个用户和一条资源请求测试最终权限结果"
                    description="模拟会返回 allow/deny、命中的规则和原因，适合排查为什么某个用户看不到表单或不能编辑字段。"
                  />
                  <Form form={simulateForm} layout="inline" style={{ rowGap: 12 }}>
                    <Form.Item name="user_id" label="用户 ID" rules={[{ required: true }]}>
                      <InputNumber min={1} />
                    </Form.Item>
                    <Form.Item name="resource_type" label="资源类型" initialValue="form">
                      <Select style={{ width: 160 }} options={toOptions(resourceTypes, resourceTypeLabels)} />
                    </Form.Item>
                    <Form.Item name="resource_key" label="资源 Key" initialValue="*">
                      <Input style={{ width: 150 }} />
                    </Form.Item>
                    <Form.Item name="action" label="动作" initialValue="view">
                      <Select style={{ width: 130 }} options={toOptions(actions, actionLabels)} />
                    </Form.Item>
                    <Form.Item name="form_id" label="表单 ID">
                      <InputNumber min={1} />
                    </Form.Item>
                    <Form.Item name="field_name" label="字段">
                      <Input style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item name="record_json" label="记录 JSON">
                      <Input style={{ width: 240 }} placeholder='{"org_id":1}' />
                    </Form.Item>
                    <Button onClick={runSimulation}>模拟</Button>
                  </Form>
                  {simulation && (
                    <pre style={{ marginTop: 12, background: '#f7f7f7', padding: 12, borderRadius: 8 }}>
                      {JSON.stringify(simulation, null, 2)}
                    </pre>
                  )}
                </>
              ),
            },
          ]}
        />
      </Drawer>
    </div>
  );
}
