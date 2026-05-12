import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Typography,
  Input,
  Button,
  Statistic,
  Empty,
  Spin,
  Divider,
  Descriptions,
  Select,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  NodeIndexOutlined,
  AimOutlined,
  BranchesOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import {
  executeCypher,
  getNeighbors,
  getShortestPath,
  getSubgraph,
  getGraphStats,
} from '@/services/api';

const { Title, Text } = Typography;

interface GraphNode {
  id: number;
  label: string;
  type: string;
  properties: Record<string, unknown>;
}

interface GraphEdge {
  id: number;
  source: number;
  target: number;
  type: string;
  properties: Record<string, unknown>;
}

interface GraphStats {
  node_count: number;
  edge_count: number;
  entity_types: Record<string, number>;
  relation_types: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  factory: '#f5222d',
  workshop: '#fa8c16',
  line: '#faad14',
  equipment: '#52c41a',
  product: '#13c2c2',
  material: '#1677ff',
  order: '#722ed1',
  worker: '#eb2f96',
  supplier: '#2f54eb',
  default: '#8c8c8c',
};

const CYPHER_EXAMPLES = [
  'MATCH (n) RETURN n LIMIT 25',
  'MATCH (n:Equipment) RETURN n',
  'MATCH (a)-[r]->(b) RETURN a, r, b LIMIT 20',
  'MATCH (n {name: "CNC-001"}) RETURN n',
];

export default function GraphExplorerPage() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [searchId, setSearchId] = useState<string>('');
  const [neighbors, setNeighbors] = useState<GraphNode[]>([]);
  const [neighborEdges, setNeighborEdges] = useState<GraphEdge[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [pathResult, setPathResult] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cypherQuery, setCypherQuery] = useState('');
  const [cypherResult, setCyperResult] = useState<Record<string, unknown>[]>([]);
  const [cypherLoading, setCyperLoading] = useState(false);
  const [pathSrc, setPathSrc] = useState<string>('');
  const [pathTgt, setPathTgt] = useState<string>('');

  const canvasRef = useRef<HTMLDivElement>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getGraphStats();
      setStats(res.data ?? null);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Simple div-based graph visualization
  const renderGraphVisualization = () => {
    if (graphNodes.length === 0) return <Empty description="搜索实体以可视化关系图谱" />;

    // Position nodes in a circle layout
    const centerX = 300;
    const centerY = 250;
    const radius = 180;
    const nodePositions: Record<number, { x: number; y: number }> = {};

    graphNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graphNodes.length - Math.PI / 2;
      nodePositions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    return (
      <div
        ref={canvasRef}
        style={{
          position: 'relative',
          width: 600,
          height: 500,
          border: '1px solid #f0f0f0',
          borderRadius: 8,
          margin: '0 auto',
          background: '#fafafa',
        }}
      >
        {/* SVG for edges */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          {graphEdges.map((edge) => {
            const srcPos = nodePositions[edge.source];
            const tgtPos = nodePositions[edge.target];
            if (!srcPos || !tgtPos) return null;
            const midX = (srcPos.x + tgtPos.x) / 2;
            const midY = (srcPos.y + tgtPos.y) / 2;
            return (
              <g key={`edge-${edge.id}`}>
                <line
                  x1={srcPos.x}
                  y1={srcPos.y}
                  x2={tgtPos.x}
                  y2={tgtPos.y}
                  stroke="#bfbfbf"
                  strokeWidth={1.5}
                />
                <text x={midX} y={midY - 6} textAnchor="middle" fontSize={10} fill="#8c8c8c">
                  {edge.type}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Div-based nodes */}
        {graphNodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const color = TYPE_COLORS[node.type] ?? TYPE_COLORS.default;
          return (
            <div
              key={`node-${node.id}`}
              title={`${node.label} (${node.type}) #${node.id}`}
              style={{
                position: 'absolute',
                left: pos.x - 24,
                top: pos.y - 24,
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 600,
                fontSize: 12,
                boxShadow: `0 2px 8px ${color}40`,
                cursor: 'default',
                overflow: 'hidden',
                textAlign: 'center',
                lineHeight: '14px',
                padding: 4,
              }}
            >
              {(node.label ?? node.id).toString().substring(0, 5)}
            </div>
          );
        })}
      </div>
    );
  };

  const handleSearch = async () => {
    const id = parseInt(searchId, 10);
    if (isNaN(id)) {
      message.warning('请输入有效的实体 ID');
      return;
    }
    setLoading(true);
    try {
      const [neighborsRes, subgraphRes] = await Promise.all([
        getNeighbors(id, 20),
        getSubgraph(id, 2),
      ]);
      const neighborData = neighborsRes.data ?? {};
      setNeighbors(neighborData.nodes ?? neighborData.neighbors ?? []);
      setNeighborEdges(neighborData.edges ?? neighborData.relations ?? []);

      const subData = subgraphRes.data ?? {};
      setGraphNodes(subData.nodes ?? []);
      setGraphEdges(subData.edges ?? subData.relationships ?? []);
    } catch {
      message.error('查询失败');
      setNeighbors([]);
      setGraphNodes([]);
      setGraphEdges([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFindPath = async () => {
    const src = parseInt(pathSrc, 10);
    const tgt = parseInt(pathTgt, 10);
    if (isNaN(src) || isNaN(tgt)) {
      message.warning('请输入有效的起止 ID');
      return;
    }
    setLoading(true);
    try {
      const res = await getShortestPath(src, tgt);
      const data = res.data ?? {};
      setPathResult({
        nodes: data.nodes ?? [],
        edges: data.edges ?? data.relationships ?? [],
      });
    } catch {
      message.error('路径查询失败');
      setPathResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCypher = async () => {
    if (!cypherQuery.trim()) return;
    setCyperLoading(true);
    try {
      const res = await executeCypher(cypherQuery);
      const data = res.data;
      setCyperResult(Array.isArray(data) ? data : data?.results ?? data?.rows ?? []);
    } catch {
      message.error('Cypher 查询执行失败');
      setCyperResult([]);
    } finally {
      setCyperLoading(false);
    }
  };

  return (
    <div>
      <Title level={4}>关系图谱</Title>

      {/* Stats Row */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="节点总数"
              value={stats?.node_count ?? 0}
              prefix={<NodeIndexOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="边总数"
              value={stats?.edge_count ?? 0}
              prefix={<BranchesOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="实体类型"
              value={stats?.entity_types ? Object.keys(stats.entity_types).length : 0}
              prefix={<ApartmentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="关系类型"
              value={stats?.relation_types ? Object.keys(stats.relation_types).length : 0}
              prefix={<AimOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Type distribution */}
      {stats?.entity_types && Object.keys(stats.entity_types).length > 0 && (
        <Card title="类型分布" size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            {Object.entries(stats.entity_types).map(([type, count]) => (
              <Tag key={type} color={TYPE_COLORS[type] ?? 'default'}>
                {type}: {count as number}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      <Row gutter={16}>
        {/* Left: Search & Visualization */}
        <Col span={16}>
          <Card
            title="图谱探索"
            size="small"
            extra={
              <Button icon={<ReloadOutlined />} size="small" onClick={fetchStats}>
                刷新统计
              </Button>
            }
          >
            <Space style={{ width: '100%', marginBottom: 16 }} wrap>
              <Input
                placeholder="输入实体 ID"
                prefix={<SearchOutlined />}
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 200 }}
              />
              <Button type="primary" onClick={handleSearch} loading={loading}>
                搜索邻居
              </Button>
            </Space>
            <Spin spinning={loading}>{renderGraphVisualization()}</Spin>
          </Card>

          {/* Cypher Query */}
          <Card title="Cypher 查询" size="small" style={{ marginTop: 16 }}>
            <Input.TextArea
              rows={3}
              value={cypherQuery}
              onChange={(e) => setCypherQuery(e.target.value)}
              placeholder="输入 Cypher 查询语句..."
            />
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                示例：
              </Text>
              <Space wrap size={4}>
                {CYPHER_EXAMPLES.map((q) => (
                  <Tag
                    key={q}
                    style={{ cursor: 'pointer', fontSize: 11 }}
                    color="blue"
                    onClick={() => setCypherQuery(q)}
                  >
                    {q.substring(0, 35)}...
                  </Tag>
                ))}
              </Space>
            </div>
            <Button type="primary" onClick={handleCypher} loading={cypherLoading} style={{ marginTop: 4 }}>
              执行查询
            </Button>
            {cypherResult.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <pre
                  style={{
                    maxHeight: 300,
                    overflow: 'auto',
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  {JSON.stringify(cypherResult, null, 2)}
                </pre>
              </div>
            )}
          </Card>
        </Col>

        {/* Right: Neighbors & Path */}
        <Col span={8}>
          <Card title={`邻居节点 (${neighbors.length})`} size="small">
            {neighbors.length === 0 ? (
              <Empty description="搜索实体查看邻居" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                scroll={{ y: 240 }}
                columns={[
                  {
                    title: 'ID',
                    dataIndex: 'id',
                    width: 50,
                  },
                  {
                    title: '标签',
                    dataIndex: 'label',
                    ellipsis: true,
                  },
                  {
                    title: '类型',
                    dataIndex: 'type',
                    width: 90,
                    render: (type: string) => (
                      <Tag color={TYPE_COLORS[type] ?? 'default'}>{type}</Tag>
                    ),
                  },
                ]}
                dataSource={neighbors}
              />
            )}
          </Card>

          <Card title="最短路径" size="small" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input
                placeholder="起始节点 ID"
                prefix={<AimOutlined />}
                value={pathSrc}
                onChange={(e) => setPathSrc(e.target.value)}
              />
              <Input
                placeholder="目标节点 ID"
                prefix={<AimOutlined />}
                value={pathTgt}
                onChange={(e) => setPathTgt(e.target.value)}
              />
              <Button type="primary" onClick={handleFindPath} loading={loading} block>
                查找路径
              </Button>
            </Space>
            {pathResult && (
              <div style={{ marginTop: 12 }}>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="路径长度">
                    {pathResult.edges.length} 步
                  </Descriptions.Item>
                  <Descriptions.Item label="途经节点">
                    {pathResult.nodes.map((n) => (
                      <Tag key={n.id} color={TYPE_COLORS[n.type] ?? 'default'}>
                        {n.label ?? n.id}
                      </Tag>
                    ))}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </Card>

          {neighborEdges.length > 0 && (
            <Card title="关联边" size="small" style={{ marginTop: 16 }}>
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                scroll={{ y: 200 }}
                columns={[
                  {
                    title: '类型',
                    dataIndex: 'type',
                    render: (type: string) => <Tag>{type}</Tag>,
                  },
                  {
                    title: '源→目标',
                    render: (_: unknown, record: GraphEdge) => (
                      <Text style={{ fontSize: 12 }}>
                        {record.source} → {record.target}
                      </Text>
                    ),
                  },
                ]}
                dataSource={neighborEdges}
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
