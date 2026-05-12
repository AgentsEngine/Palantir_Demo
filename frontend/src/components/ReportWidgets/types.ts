export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DataSourceConfig {
  endpoint: string;
  path?: string;
  params?: Record<string, unknown>;
}

export interface ChartSeriesConfig {
  name: string;
  dataField: string;
}

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  dataSource?: DataSourceConfig;
  style?: Record<string, unknown>;
  chartConfig?: Record<string, unknown>;
}

export interface FilterConfig {
  id: string;
  type: 'date-range' | 'select' | 'number';
  label: string;
  paramName: string;
  defaultValue?: unknown;
  options?: string[];
}

export interface ReportConfig {
  canvas: { gridSize: number };
  widgets: WidgetInstance[];
  filters: FilterConfig[];
}

export type WidgetType =
  | 'kpi-card'
  | 'line-chart'
  | 'bar-chart'
  | 'pie-chart'
  | 'gauge'
  | 'data-table'
  | 'text';

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  { type: 'kpi-card', label: 'KPI 指标卡', icon: 'DashboardOutlined', defaultWidth: 6, defaultHeight: 4 },
  { type: 'line-chart', label: '折线图', icon: 'LineChartOutlined', defaultWidth: 12, defaultHeight: 8 },
  { type: 'bar-chart', label: '柱状图', icon: 'BarChartOutlined', defaultWidth: 12, defaultHeight: 8 },
  { type: 'pie-chart', label: '饼图', icon: 'PieChartOutlined', defaultWidth: 8, defaultHeight: 8 },
  { type: 'gauge', label: '仪表盘', icon: 'DashboardOutlined', defaultWidth: 8, defaultHeight: 8 },
  { type: 'data-table', label: '数据表格', icon: 'TableOutlined', defaultWidth: 24, defaultHeight: 8 },
  { type: 'text', label: '文本标注', icon: 'FontSizeOutlined', defaultWidth: 8, defaultHeight: 4 },
];
