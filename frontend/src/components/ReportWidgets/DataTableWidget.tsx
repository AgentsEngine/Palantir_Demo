import React, { useEffect, useState } from 'react';
import { Table, Spin, Empty } from 'antd';
import type { WidgetInstance } from './types';
import { fetchDataFromApi } from './WidgetRegistry';

interface Props {
  widget: WidgetInstance;
  isEditing: boolean;
}

export default function DataTableWidget({ widget, isEditing }: Props) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing || !widget.dataSource?.endpoint) return;
    let cancelled = false;
    setLoading(true);
    fetchDataFromApi(widget.dataSource!)
      .then((res) => {
        if (cancelled) return;
        const arr = Array.isArray(res) ? res : (res as any)?.data || [];
        setData(arr);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [widget.dataSource, isEditing]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin /></div>;
  if (!data.length && !isEditing) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Empty description="暂无数据" /></div>;

  const cfg = widget.chartConfig || {};
  const colNames = (cfg.columns as string[]) || (data[0] ? Object.keys(data[0]) : []);

  const columns = colNames.map((col) => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    width: 150,
  }));

  return (
    <Table
      columns={columns}
      dataSource={data.map((d, i) => ({ ...d, key: i }))}
      size="small"
      pagination={{ pageSize: 5, size: 'small' }}
      scroll={{ x: 'max-content' }}
    />
  );
}
