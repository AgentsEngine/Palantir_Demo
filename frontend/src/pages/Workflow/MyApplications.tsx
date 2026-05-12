import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Typography, message, Button, Space, Popconfirm } from 'antd';
import { wfListInstances, wfCancelInstance } from '@/services/api';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '审批中', color: 'orange' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  cancelled: { label: '已撤销', color: 'default' },
};

export default function MyApplications() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await wfListInstances({});
      setItems(res.data?.data || []);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '申请标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '申请人', dataIndex: 'initiator_name', width: 80 },
    {
      title: '表单数据', dataIndex: 'form_data', width: 250, ellipsis: true,
      render: (v: any) => {
        if (!v) return '-';
        const data = typeof v === 'string' ? JSON.parse(v) : v;
        return Object.entries(data).map(([k, val]) => `${k}: ${val}`).join(' | ');
      },
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => { const s = STATUS_MAP[v] || { label: v, color: 'default' }; return <Tag color={s.color}>{s.label}</Tag>; },
    },
    { title: '提交时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作', width: 80,
      render: (_: any, r: any) => r.status === 'pending' ? (
        <Popconfirm title="确定撤销？" onConfirm={async () => { await wfCancelInstance(r.id); fetchData(); }}>
          <Button size="small">撤销</Button>
        </Popconfirm>
      ) : null,
    },
  ];

  return (
    <div>
      <Typography.Title level={5} style={{ marginBottom: 16 }}>我的申请</Typography.Title>
      <Table dataSource={items} columns={columns} rowKey="id" loading={loading} size="small" />
    </div>
  );
}
