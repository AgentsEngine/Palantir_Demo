import React from 'react';
import { Form, Input, InputNumber, Select, Switch, Divider, Typography, Space, Button, message } from 'antd';
import type { WidgetInstance } from '../ReportWidgets/types';

interface Props {
  widget: WidgetInstance | null;
  onChange: (updated: WidgetInstance) => void;
}

const API_ENDPOINTS = [
  { label: '运营总览', value: '/api/v1/dashboard/overview' },
  { label: '生产统计', value: '/api/v1/dashboard/production' },
  { label: 'OEE 分析', value: '/api/v1/dashboard/oee' },
  { label: '告警列表', value: '/api/v1/dashboard/alerts' },
  { label: '设备健康', value: '/api/v1/maintenance/equipment-health' },
  { label: '故障预测', value: '/api/v1/maintenance/predictions' },
  { label: '工单列表', value: '/api/v1/maintenance/work-orders' },
  { label: 'SPC 数据', value: '/api/v1/quality/spc/temperature' },
  { label: '缺陷列表', value: '/api/v1/quality/defects' },
  { label: '帕累托分析', value: '/api/v1/quality/defects/pareto' },
  { label: '供应商', value: '/api/v1/supply-chain/suppliers' },
  { label: '库存', value: '/api/v1/supply-chain/inventory' },
  { label: '风险评估', value: '/api/v1/supply-chain/risk-assessment' },
  { label: '供应链分析', value: '/api/v1/supply-chain/analytics' },
];

export default function ConfigPanel({ widget, onChange }: Props) {
  if (!widget) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>
        选择画布中的组件进行配置
      </div>
    );
  }

  const ds = widget.dataSource || { endpoint: '', path: '', params: {} };

  const handleFieldChange = (field: string, value: unknown) => {
    onChange({ ...widget, [field]: value });
  };

  const handleDsChange = (field: string, value: unknown) => {
    onChange({
      ...widget,
      dataSource: { ...widget.dataSource, [field]: value } as any,
    });
  };

  const handleStyleChange = (field: string, value: unknown) => {
    onChange({
      ...widget,
      style: { ...(widget.style || {}), [field]: value },
    });
  };

  const handlePositionChange = (field: string, value: number) => {
    onChange({
      ...widget,
      position: { ...widget.position, [field]: value },
    });
  };

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>属性配置</Typography.Text>

      <Form layout="vertical" size="small">
        <Form.Item label="标题">
          <Input value={widget.title} onChange={(e) => handleFieldChange('title', e.target.value)} />
        </Form.Item>

        <Divider orientation="left" plain style={{ margin: '8px 0', fontSize: 12 }}>位置</Divider>

        <Space size={8}>
          <Form.Item label="X">
            <InputNumber min={0} max={24} value={widget.position.x} onChange={(v) => v != null && handlePositionChange('x', v)} />
          </Form.Item>
          <Form.Item label="Y">
            <InputNumber min={0} value={widget.position.y} onChange={(v) => v != null && handlePositionChange('y', v)} />
          </Form.Item>
          <Form.Item label="宽">
            <InputNumber min={2} max={24} value={widget.position.w} onChange={(v) => v != null && handlePositionChange('w', v)} />
          </Form.Item>
          <Form.Item label="高">
            <InputNumber min={2} max={20} value={widget.position.h} onChange={(v) => v != null && handlePositionChange('h', v)} />
          </Form.Item>
        </Space>

        <Divider orientation="left" plain style={{ margin: '8px 0', fontSize: 12 }}>数据源</Divider>

        <Form.Item label="API 端点">
          <Select
            showSearch
            allowClear
            placeholder="选择或输入 API 端点"
            value={ds.endpoint || undefined}
            onChange={(v) => handleDsChange('endpoint', v || '')}
            options={API_ENDPOINTS}
            filterOption={(input, option) => (option?.label ?? '').includes(input)}
          />
        </Form.Item>
        <Form.Item label="自定义端点">
          <Input
            placeholder="如 /api/v1/dashboard/overview"
            value={ds.endpoint || ''}
            onChange={(e) => handleDsChange('endpoint', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="数据路径">
          <Input
            placeholder="如 equipment.total"
            value={ds.path || ''}
            onChange={(e) => handleDsChange('path', e.target.value)}
          />
        </Form.Item>

        {widget.type === 'kpi-card' && (
          <>
            <Divider orientation="left" plain style={{ margin: '8px 0', fontSize: 12 }}>样式</Divider>
            <Form.Item label="颜色">
              <Input
                type="color"
                value={(widget.style?.color as string) || '#1677ff'}
                onChange={(e) => handleStyleChange('color', e.target.value)}
                style={{ width: 60, padding: 2 }}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </div>
  );
}
