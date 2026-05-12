import React from 'react';
import { Card, Typography } from 'antd';
import {
  DashboardOutlined,
  LineChartOutlined,
  BarChartOutlined,
  PieChartOutlined,
  TableOutlined,
  FontSizeOutlined,
} from '@ant-design/icons';
import type { WidgetType } from '../ReportWidgets/types';
import { WIDGET_REGISTRY } from '../ReportWidgets/types';

const ICON_MAP: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  LineChartOutlined: <LineChartOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  PieChartOutlined: <PieChartOutlined />,
  TableOutlined: <TableOutlined />,
  FontSizeOutlined: <FontSizeOutlined />,
};

interface Props {
  onAddWidget: (type: WidgetType) => void;
}

export default function ComponentPanel({ onAddWidget }: Props) {
  return (
    <div style={{ padding: 12 }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>组件面板</Typography.Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {WIDGET_REGISTRY.map((w) => (
          <Card
            key={w.type}
            size="small"
            hoverable
            style={{ cursor: 'grab' }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('widget-type', w.type);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onAddWidget(w.type)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, color: '#1677ff' }}>{ICON_MAP[w.icon] || <DashboardOutlined />}</span>
              <span style={{ fontSize: 13 }}>{w.label}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
