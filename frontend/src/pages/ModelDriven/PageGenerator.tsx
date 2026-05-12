import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select, Tag, Popconfirm,
  Typography, message,
} from 'antd';
import { PlusOutlined, ThunderboltOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  listModels, listPages, createPage, generatePage, deletePage,
} from '@/services/api';

const PARADIGMS = [
  { label: '主从列表', value: 'master-detail' },
  { label: '表单流程', value: 'form-flow' },
  { label: '树形层级', value: 'tree-hierarchy' },
];

interface ModelItem {
  id: number;
  name: string;
  label: string;
}

interface PageItem {
  id: number;
  name: string;
  title: string;
  paradigm: string;
  model_id: number;
  model_name: string;
  route_path: string;
  is_published: boolean;
}

export default function PageGenerator() {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsRes, pagesRes] = await Promise.all([listModels(), listPages()]);
      setModels((modelsRes.data?.data || []).map((m: any) => ({ id: m.id, name: m.name, label: m.label })));
      setPages(pagesRes.data?.data || []);
    } catch { message.error('加载数据失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = () => {
    Modal.confirm({
      title: '自动生成页面',
      content: (
        <Form layout="vertical" size="small" style={{ marginTop: 16 }}>
          <Form.Item label="页面名称(英文)"><Input id="pg-name" placeholder="如 equipment-list" /></Form.Item>
          <Form.Item label="页面标题"><Input id="pg-title" placeholder="如 设备管理" /></Form.Item>
          <Form.Item label="选择模型">
            <Select id="pg-model" placeholder="选择模型" options={models.map(m => ({ label: `${m.label} (${m.name})`, value: m.name }))} />
          </Form.Item>
          <Form.Item label="页面范式">
            <Select id="pg-paradigm" options={PARADIGMS} defaultValue="master-detail" />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const name = (document.getElementById('pg-name') as HTMLInputElement)?.value?.trim();
        const title = (document.getElementById('pg-title') as HTMLInputElement)?.value?.trim();
        const model_name = (document.getElementById('pg-model') as any)?.value;
        const paradigm = (document.getElementById('pg-paradigm') as any)?.value || 'master-detail';
        if (!name || !model_name) { message.warning('名称和模型必填'); return; }
        try {
          await generatePage({ name, title: title || name, paradigm, model_name, route_path: `/dynamic/${name}`, is_published: true });
          message.success('页面已生成并发布');
          fetchData();
        } catch { message.error('生成失败'); }
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 140 },
    { title: '标题', dataIndex: 'title', width: 120 },
    {
      title: '范式', dataIndex: 'paradigm', width: 100,
      render: (v: string) => {
        const p = PARADIGMS.find(x => x.value === v);
        return <Tag color="blue">{p?.label || v}</Tag>;
      },
    },
    { title: '模型', dataIndex: 'model_name', width: 100 },
    {
      title: '路由', dataIndex: 'route_path', width: 180,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '已发布', dataIndex: 'is_published', width: 70,
      render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: '操作', width: 100,
      render: (_: any, r: PageItem) => (
        <Popconfirm title="确定删除？" onConfirm={async () => { await deletePage(r.id); fetchData(); }}>
          <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>页面配置</Typography.Title>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>
          自动生成页面
        </Button>
      </div>

      <Table
        dataSource={pages}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}
