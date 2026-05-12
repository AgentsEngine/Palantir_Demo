import React from 'react';
import type { WidgetInstance, DataSourceConfig } from './types';
import KPICardWidget from './KPICardWidget';
import LineChartWidget from './LineChartWidget';
import BarChartWidget from './BarChartWidget';
import PieChartWidget from './PieChartWidget';
import GaugeWidget from './GaugeWidget';
import DataTableWidget from './DataTableWidget';
import TextWidget from './TextWidget';
import WidgetWrapper from './WidgetWrapper';

export { WIDGET_REGISTRY } from './types';
export type { WidgetInstance, ReportConfig, DataSourceConfig } from './types';

export async function fetchDataFromApi(ds: DataSourceConfig): Promise<any> {
  const resp = await fetch(ds.endpoint);
  if (!resp.ok) throw new Error(`API ${ds.endpoint} returned ${resp.status}`);
  return resp.json();
}

interface RegistryProps {
  widget: WidgetInstance;
  isEditing: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function renderWidget({ widget, isEditing, isSelected, onSelect, onDelete }: RegistryProps) {
  const inner = (() => {
    switch (widget.type) {
      case 'kpi-card': return <KPICardWidget widget={widget} isEditing={isEditing} />;
      case 'line-chart': return <LineChartWidget widget={widget} isEditing={isEditing} />;
      case 'bar-chart': return <BarChartWidget widget={widget} isEditing={isEditing} />;
      case 'pie-chart': return <PieChartWidget widget={widget} isEditing={isEditing} />;
      case 'gauge': return <GaugeWidget widget={widget} isEditing={isEditing} />;
      case 'data-table': return <DataTableWidget widget={widget} isEditing={isEditing} />;
      case 'text': return <TextWidget widget={widget} />;
      default: return <div style={{ padding: 16, color: '#999' }}>未知组件: {widget.type}</div>;
    }
  })();

  return (
    <WidgetWrapper
      key={widget.id}
      widget={widget}
      isEditing={isEditing}
      isSelected={isSelected}
      onSelect={onSelect}
      onDelete={onDelete}
    >
      {inner}
    </WidgetWrapper>
  );
}
