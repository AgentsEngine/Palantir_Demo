import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, Button, Space, Input, Modal, Form, Tag, Spin, message, Popconfirm, Typography, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getPageByName, getModelData, createModelData, updateModelData, deleteModelData } from '@/services/api';

interface FieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  searchable: boolean;
  sortable: boolean;
  visible_in_list: boolean;
  visible_in_form: boolean;
  enum_values?: string;
}

interface PageConfig {
  id: number;
  name: string;
  title: string;
  paradigm: string;
  model_id: number;
  model_name: string;
  config: {
    list_fields?: string[];
    form_fields?: string[];
    search_fields?: string[];
  };
}

export default function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [pageConfig, setPageConfig] = useState<PageConfig | null>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!slug || !pageConfig) return;
    setLoading(true);
    try {
      const res = await getModelData(pageConfig.model_name, { page, page_size: 20, search: search || undefined });
      setData(res.data?.data || []);
      setTotal(res.data?.total || 0);
    } catch { message.error('加载数据失败'); }
    finally { setLoading(false); }
  }, [slug, pageConfig, page, search]);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      try {
        const res = await getPageByName(slug);
        const pc = res.data;
        setPageConfig(pc);
      } catch {
        message.error('页面配置不存在');
      }
    })();
  }, [slug]);

  useEffect(() => { loadData(); }, [loadData]);

  const listFields = pageConfig?.config?.list_fields ||
    fields.filter(f => f.visible_in_list).map(f => f.field_name);

  const tableColumns = listFields.map(field_name => {
    const f = fields.find(x => x.field_name === field_name);
    return {
      title: f?.label || field_name,
      dataIndex: field_name,
      key: field_name,
      ellipsis: true,
      sorter: f?.sortable ? true : undefined,
      render: (val: any) => {
        if (typeof val === 'boolean') return val ? '是' : '否';
        if (f?.field_type === 'enum' && val) return <Tag>{String(val)}</Tag>;
        if (field_name === 'status') {
          const colorMap: Record<string, string> = {
            running: 'green', idle: 'orange', maintenance: 'blue',
            fault: 'red', offline: 'default', active: 'green',
            pending: 'default', in_progress: 'blue', completed: 'green',
          };
          return <Tag color={colorMap[val] || 'default'}>{String(val)}</Tag>;
        }
        return String(val ?? '');
      },
    };
  });

  (tableColumns as any[]).push({
    title: '操作', width: 120, fixed: 'right',
    render: (_val: any, record: any) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => showEditModal(record)} />
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  });

  const showCreateModal = () => {
    const formFields = pageConfig?.config?.form_fields ||
      fields.filter(f => f.visible_in_form).map(f => f.field_name);
    Modal.confirm({
      title: '新建记录',
      width: 600,
      content: (
        <Form layout="vertical" size="small" style={{ marginTop: 16 }}>
          {formFields.map(fn => {
            const f = fields.find(x => x.field_name === fn);
            if (!f) return null;
            if (f.field_type === 'enum' && f.enum_values) {
              const opts = JSON.parse(f.enum_values);
              return (
                <Form.Item key={fn} label={f.label} required={f.required}>
                  <Select id={`df-${fn}`} options={opts.map((o: string) => ({ label: o, value: o }))} placeholder={`选择${f.label}`} />
                </Form.Item>
              );
            }
            return (
              <Form.Item key={fn} label={f.label} required={f.required}>
                <Input id={`df-${fn}`} placeholder={f.label} />
              </Form.Item>
            );
          })}
        </Form>
      ),
      onOk: async () => {
        const body: Record<string, any> = {};
        for (const fn of formFields) {
          const el = document.getElementById(`df-${fn}`) as any;
          if (el) body[fn] = el.value ?? el.checked;
        }
        try {
          await createModelData(pageConfig!.model_name, body);
          message.success('创建成功');
          loadData();
        } catch { message.error('创建失败'); }
      },
    });
  };

  const showEditModal = (record: any) => {
    const formFields = pageConfig?.config?.form_fields ||
      fields.filter(f => f.visible_in_form).map(f => f.field_name);
    Modal.confirm({
      title: '编辑记录',
      width: 600,
      content: (
        <Form layout="vertical" size="small" style={{ marginTop: 16 }}>
          {formFields.map(fn => {
            const f = fields.find(x => x.field_name === fn);
            if (!f) return null;
            return (
              <Form.Item key={fn} label={f.label}>
                <Input id={`df-${fn}`} defaultValue={String(record[fn] ?? '')} />
              </Form.Item>
            );
          })}
        </Form>
      ),
      onOk: async () => {
        const body: Record<string, any> = {};
        for (const fn of formFields) {
          const el = document.getElementById(`df-${fn}`) as HTMLInputElement;
          if (el) body[fn] = el.value;
        }
        try {
          await updateModelData(pageConfig!.model_name, record.id, body);
          message.success('更新成功');
          loadData();
        } catch { message.error('更新失败'); }
      },
    });
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteModelData(pageConfig!.model_name, id);
      message.success('已删除');
      loadData();
    } catch { message.error('删除失败'); }
  };

  if (!pageConfig) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <Typography.Title level={4} style={{ margin: 0 }}>{pageConfig.title}</Typography.Title>
          <Tag color="blue">{pageConfig.model_name}</Tag>
        </Space>
        <Space>
          <Input.Search
            placeholder="搜索..."
            allowClear
            style={{ width: 200 }}
            onSearch={setSearch}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={showCreateModal}>新建</Button>
        </Space>
      </div>

      <Table
        dataSource={data}
        columns={tableColumns}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}
