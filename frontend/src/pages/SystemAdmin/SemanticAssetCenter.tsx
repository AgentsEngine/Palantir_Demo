import { useEffect, useMemo, useState } from 'react';
import {
  ApartmentOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FormOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Input, List, Row, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import {
  listKnowledgeChunks,
  listKnowledgeDocuments,
  listKnowledgeSources,
  listSemanticDataAssets,
  listSemanticOntologyObjects,
  listSemanticOntologyRelations,
  listSemanticPageContracts,
  searchKnowledge,
} from '@/services/api';

type DataField = {
  name: string;
  label: string;
  type: string;
  primary_key: boolean;
  searchable: boolean;
  visible: boolean;
  quality: string;
};

type DataTable = {
  id: number;
  name: string;
  label: string;
  rows: number;
  quality_score: number;
  fields: DataField[];
};

type DataAsset = {
  id: number;
  name: string;
  type: string;
  status: string;
  owner: string;
  freshness: string;
  tables: DataTable[];
};

type OntologyField = {
  name: string;
  label: string;
  type: string;
  source_field: string;
  list: boolean;
  form: boolean;
  search: boolean;
};

type OntologyObject = {
  id: string;
  name: string;
  code: string;
  source: string;
  description: string;
  fields: OntologyField[];
};

type OntologyRelation = {
  id: number;
  source: string;
  label: string;
  type: string;
  target: string;
  graph: boolean;
  description: string;
};

type PageContract = {
  route: string;
  title: string;
  entity: string;
  description: string;
  components: string[];
  actions: string[];
};

type KnowledgeSource = {
  id: string;
  name: string;
  type: string;
  owner: string;
  status: string;
  document_count: number;
  description: string;
};

type LinkedObject = {
  type: string;
  id: string;
  name: string;
};

type KnowledgeDocument = {
  id: string;
  source_id: string;
  title: string;
  doc_type: string;
  status: string;
  updated_at: string;
  summary: string;
  linked_objects: LinkedObject[];
};

type KnowledgeChunk = {
  id: string;
  document_id: string;
  document_title?: string;
  source_ref: string;
  chunk_text: string;
  score?: number;
  linked_objects?: LinkedObject[];
};

const fallbackKnowledgeSources: KnowledgeSource[] = [
  {
    id: 'sop',
    name: '质量 SOP',
    type: 'SOP',
    owner: '质量体系',
    status: 'active',
    document_count: 2,
    description: '沉淀检验、冻结、复检和放行规则。',
  },
  {
    id: 'capa',
    name: '历史 CAPA',
    type: 'CAPA',
    owner: '质量经理',
    status: 'active',
    document_count: 2,
    description: '复用历史异常处置经验和纠正预防动作。',
  },
  {
    id: 'supplier',
    name: '供应商报告',
    type: 'SupplierReport',
    owner: '采购质量',
    status: 'active',
    document_count: 1,
    description: '供应商整改、来料波动和批次风险说明。',
  },
  {
    id: 'equipment',
    name: '设备日志',
    type: 'EquipmentLog',
    owner: '生产设备',
    status: 'active',
    document_count: 1,
    description: '设备点检、维护和工艺参数变化记录。',
  },
];

const fallbackKnowledgeDocuments: KnowledgeDocument[] = [
  {
    id: 'doc-sop-rework',
    source_id: 'sop',
    title: 'SOP-QA-014 焊点虚焊复检与冻结流程',
    doc_type: 'SOP',
    status: 'approved',
    updated_at: '2026-05-18',
    summary: '规定 AOI 连续缺陷、批次冻结、抽样复检和 CAPA 触发条件。',
    linked_objects: [
      { type: 'Defect', id: 'D-SOLDER-VOID', name: '焊点虚焊' },
      { type: 'QualityEvent', id: 'QE-20260521-001', name: '电控模块焊点异常' },
    ],
  },
  {
    id: 'doc-capa-072',
    source_id: 'capa',
    title: 'CAPA-072 电控模块 V2 虚焊历史处置',
    doc_type: 'CAPA',
    status: 'closed',
    updated_at: '2026-04-29',
    summary: '历史处置中通过冻结同批次、复检 BGA 区域、校准回流炉曲线完成闭环。',
    linked_objects: [
      { type: 'CAPA', id: 'CAPA-072', name: '电控模块 V2 虚焊 CAPA' },
      { type: 'MaterialBatch', id: 'MB-7781', name: '焊锡膏 S12' },
    ],
  },
  {
    id: 'doc-supplier-beichen',
    source_id: 'supplier',
    title: '北辰电子材料 5 月来料整改报告',
    doc_type: 'SupplierReport',
    status: 'reviewing',
    updated_at: '2026-05-20',
    summary: '供应商承认 S12 焊锡膏储运温控波动，建议同仓批次隔离并提高来料抽检。',
    linked_objects: [
      { type: 'Supplier', id: 'SUP-BEICHEN', name: '北辰电子材料' },
      { type: 'MaterialBatch', id: 'MB-7781', name: '焊锡膏 S12' },
    ],
  },
  {
    id: 'doc-equipment-smt03',
    source_id: 'equipment',
    title: 'SMT-03 回流炉温区维护日志',
    doc_type: 'EquipmentLog',
    status: 'active',
    updated_at: '2026-05-21',
    summary: '温区 4 与温区 5 曾出现短时偏低，建议复核曲线并关联同班次工单。',
    linked_objects: [
      { type: 'Equipment', id: 'SMT-03', name: 'SMT-03 回流炉' },
      { type: 'WorkOrder', id: 'WO-260521-017', name: '电控模块 V2 工单' },
    ],
  },
];

const fallbackKnowledgeChunks: KnowledgeChunk[] = [
  {
    id: 'chunk-sop-rework-1',
    document_id: 'doc-sop-rework',
    document_title: 'SOP-QA-014 焊点虚焊复检与冻结流程',
    source_ref: 'SOP-QA-014 / 3.2',
    chunk_text: 'AOI 连续发现同类焊点虚焊且缺陷率超过管控线时，应冻结同批物料与在制品，并发起质量经理复核。',
    score: 0.94,
    linked_objects: fallbackKnowledgeDocuments[0].linked_objects,
  },
  {
    id: 'chunk-sop-rework-2',
    document_id: 'doc-sop-rework',
    document_title: 'SOP-QA-014 焊点虚焊复检与冻结流程',
    source_ref: 'SOP-QA-014 / 4.1',
    chunk_text: '复检范围优先覆盖 BGA 区域、同批次焊锡膏、同班次工单和同设备生产记录。',
    score: 0.88,
    linked_objects: fallbackKnowledgeDocuments[0].linked_objects,
  },
  {
    id: 'chunk-capa-072-1',
    document_id: 'doc-capa-072',
    document_title: 'CAPA-072 电控模块 V2 虚焊历史处置',
    source_ref: 'CAPA-072 / Root Cause',
    chunk_text: '上次虚焊异常与焊锡膏储存温度波动、回流炉温区偏低共同相关，处置动作包括冻结批次、复检和设备校准。',
    score: 0.91,
    linked_objects: fallbackKnowledgeDocuments[1].linked_objects,
  },
  {
    id: 'chunk-supplier-1',
    document_id: 'doc-supplier-beichen',
    document_title: '北辰电子材料 5 月来料整改报告',
    source_ref: 'SUP-BEICHEN / 2026-05',
    chunk_text: '供应商建议对 S12 焊锡膏同仓储批次进行隔离，待复验通过后再释放。',
    score: 0.83,
    linked_objects: fallbackKnowledgeDocuments[2].linked_objects,
  },
  {
    id: 'chunk-equipment-1',
    document_id: 'doc-equipment-smt03',
    document_title: 'SMT-03 回流炉温区维护日志',
    source_ref: 'SMT-03 / 2026-05-21 09:12',
    chunk_text: '温区 4 出现 6 分钟短时偏低，建议把同时间窗口工单纳入影响分析。',
    score: 0.78,
    linked_objects: fallbackKnowledgeDocuments[3].linked_objects,
  },
];

export default function SemanticAssetCenter() {
  const [assets, setAssets] = useState<DataAsset[]>([]);
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [relations, setRelations] = useState<OntologyRelation[]>([]);
  const [pages, setPages] = useState<PageContract[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number>();
  const [selectedObjectId, setSelectedObjectId] = useState<string>();
  const [loading, setLoading] = useState(false);

  const selectedAsset = useMemo(
    () => assets.find((item) => item.id === selectedAssetId) ?? assets[0],
    [assets, selectedAssetId],
  );
  const selectedObject = useMemo(
    () => objects.find((item) => item.id === selectedObjectId) ?? objects[0],
    [objects, selectedObjectId],
  );
  const objectRelations = relations.filter(
    (item) => item.source === selectedObject?.id || item.target === selectedObject?.id,
  );

  const load = async () => {
    setLoading(true);
    try {
      const [assetRes, objectRes, relationRes, pageRes] = await Promise.all([
        listSemanticDataAssets(),
        listSemanticOntologyObjects(),
        listSemanticOntologyRelations(),
        listSemanticPageContracts(),
      ]);
      const nextAssets = assetRes.data?.data ?? [];
      const nextObjects = objectRes.data?.data ?? [];
      setAssets(nextAssets);
      setObjects(nextObjects);
      setRelations(relationRes.data?.data ?? []);
      setPages(pageRes.data?.data ?? []);
      setSelectedAssetId((prev) => prev ?? nextAssets[0]?.id);
      setSelectedObjectId((prev) => prev ?? nextObjects[0]?.id);
    } catch {
      message.error('读取语义资产失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dataAssetView = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={7}>
        <Card className="semantic-side-card" title="数据资产" extra={<Tag>{assets.length}</Tag>}>
          <List
            loading={loading}
            dataSource={assets}
            renderItem={(item) => (
              <List.Item
                className={item.id === selectedAsset?.id ? 'semantic-list-item active' : 'semantic-list-item'}
                onClick={() => setSelectedAssetId(item.id)}
              >
                <List.Item.Meta
                  avatar={<DatabaseOutlined />}
                  title={<Space><span>{item.name}</span><Tag color="success">{item.status}</Tag></Space>}
                  description={`${item.type} / ${item.owner} / ${item.freshness}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col xs={24} lg={17}>
        <Card
          title={selectedAsset?.name ?? '数据资产'}
          extra={<Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>}
        >
          <Table
            rowKey="id"
            dataSource={selectedAsset?.tables ?? []}
            pagination={false}
            columns={[
              { title: '数据表/数据集', dataIndex: 'label', render: (text, record: DataTable) => <Space direction="vertical" size={0}><strong>{text}</strong><Typography.Text type="secondary">{record.name}</Typography.Text></Space> },
              { title: '记录数', dataIndex: 'rows', width: 110 },
              { title: '质量分', dataIndex: 'quality_score', width: 110, render: (score: number) => <Tag color={score >= 95 ? 'success' : 'warning'}>{score}</Tag> },
              { title: '字段', dataIndex: 'fields', render: (fields: DataField[]) => <Space wrap>{fields.slice(0, 5).map((field) => <Tag key={field.name}>{field.label}</Tag>)}</Space> },
            ]}
            expandable={{
              expandedRowRender: (record) => (
                <Table
                  size="small"
                  rowKey="name"
                  dataSource={record.fields}
                  pagination={false}
                  columns={[
                    { title: '字段', dataIndex: 'label' },
                    { title: '源字段', dataIndex: 'name' },
                    { title: '类型', dataIndex: 'type', render: (type: string) => <Tag>{type}</Tag> },
                    { title: '主键', dataIndex: 'primary_key', render: (v: boolean) => v ? <Tag color="blue">是</Tag> : '-' },
                    { title: '可搜索', dataIndex: 'searchable', render: (v: boolean) => v ? '是' : '否' },
                    { title: '展示', dataIndex: 'visible', render: (v: boolean) => v ? '是' : '否' },
                    { title: '质量', dataIndex: 'quality', render: (v: string) => <Tag color={v === 'good' ? 'success' : 'warning'}>{v}</Tag> },
                  ]}
                />
              ),
            }}
          />
        </Card>
      </Col>
    </Row>
  );

  const ontologyView = (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={7}>
        <Card className="semantic-side-card" title="本体对象" extra={<Tag>{objects.length}</Tag>}>
          <Select
            value={selectedObject?.id}
            style={{ width: '100%', marginBottom: 12 }}
            options={objects.map((item) => ({ label: `${item.name} / ${item.code}`, value: item.id }))}
            onChange={setSelectedObjectId}
          />
          <List
            dataSource={objects}
            renderItem={(item) => (
              <List.Item
                className={item.id === selectedObject?.id ? 'semantic-list-item active' : 'semantic-list-item'}
                onClick={() => setSelectedObjectId(item.id)}
              >
                <List.Item.Meta
                  avatar={<ApartmentOutlined />}
                  title={item.name}
                  description={`${item.code} -> ${item.source}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col xs={24} lg={17}>
        {selectedObject ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card
              title={<Space><NodeIndexOutlined />{selectedObject.name}<Tag>{selectedObject.code}</Tag></Space>}
              extra={<Tag color="processing">绑定数据集：{selectedObject.source}</Tag>}
            >
              <Typography.Paragraph>{selectedObject.description}</Typography.Paragraph>
              <Table
                size="small"
                rowKey="name"
                dataSource={selectedObject.fields}
                pagination={false}
                columns={[
                  { title: '对象字段', dataIndex: 'label' },
                  { title: '字段编码', dataIndex: 'name' },
                  { title: '类型', dataIndex: 'type', render: (type: string) => <Tag>{type}</Tag> },
                  { title: '来源字段', dataIndex: 'source_field' },
                  { title: '列表', dataIndex: 'list', render: boolTag },
                  { title: '表单', dataIndex: 'form', render: boolTag },
                  { title: '搜索', dataIndex: 'search', render: boolTag },
                ]}
              />
            </Card>
            <Card title={<Space><BranchesOutlined />对象关系 / 图谱边</Space>}>
              <Table
                size="small"
                rowKey="id"
                dataSource={objectRelations}
                pagination={false}
                columns={[
                  { title: '源对象', dataIndex: 'source' },
                  { title: '关系', dataIndex: 'label', render: (text, record: OntologyRelation) => <Space><Tag color="blue">{record.type}</Tag>{text}</Space> },
                  { title: '目标对象', dataIndex: 'target' },
                  { title: '进入图谱', dataIndex: 'graph', render: boolTag },
                  { title: '说明', dataIndex: 'description' },
                ]}
              />
            </Card>
          </Space>
        ) : (
          <Empty />
        )}
      </Col>
    </Row>
  );

  const pageView = (
    <Card title={<Space><FormOutlined />页面配置合同</Space>}>
      <Table
        rowKey="route"
        dataSource={pages}
        pagination={false}
        columns={[
          { title: '页面', dataIndex: 'title', render: (text, record: PageContract) => <Space direction="vertical" size={0}><strong>{text}</strong><Typography.Text type="secondary">{record.route}</Typography.Text></Space> },
          { title: '绑定对象', dataIndex: 'entity', render: (entity: string) => <Tag color="processing">{entity}</Tag> },
          { title: '主要组件', dataIndex: 'components', render: (items: string[]) => <Space wrap>{items.map((item) => <Tag key={item}>{item}</Tag>)}</Space> },
          { title: '页面动作', dataIndex: 'actions', render: (items: string[]) => <Space wrap>{items.map((item) => <Tag color="blue" key={item}>{item}</Tag>)}</Space> },
          { title: '说明', dataIndex: 'description' },
        ]}
      />
    </Card>
  );

  return (
    <div className="semantic-center semantic-asset-center">
      <section className="semantic-center-header">
        <div>
          <Typography.Title level={4}>语义资产中心</Typography.Title>
          <Typography.Text type="secondary">
            统一管理结构化数据资产、本体对象、页面合同和非结构化知识库。
          </Typography.Text>
        </div>
        <Space>
          <Tag icon={<FileSearchOutlined />}>Demo Contract</Tag>
          <Button icon={<ReloadOutlined />} onClick={load}>重新读取</Button>
        </Space>
      </section>
      <Tabs
        items={[
          { key: 'data', label: '数据资产中心', children: dataAssetView },
          { key: 'ontology', label: '本体建模中心', children: ontologyView },
          { key: 'pages', label: '页面配置中心', children: pageView },
          { key: 'knowledge', label: '知识库中心', children: <KnowledgeCenter /> },
        ]}
      />
    </div>
  );
}

function boolTag(value: boolean) {
  return value ? <Tag color="success">是</Tag> : <Tag>否</Tag>;
}

function KnowledgeCenter() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>();
  const [query, setQuery] = useState('焊点虚焊以前怎么处理');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ answer: string; results: KnowledgeChunk[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedSource = sources.find((item) => item.id === selectedSourceId) ?? sources[0];
  const visibleDocuments = selectedSourceId
    ? documents.filter((item) => item.source_id === selectedSourceId)
    : documents;
  const selectedDocument = documents.find((item) => item.id === selectedDocumentId) ?? visibleDocuments[0];
  const linkedObjectCount = new Set(
    documents.flatMap((doc) => doc.linked_objects.map((obj) => `${obj.type}:${obj.id}`)),
  ).size;

  const applyFallback = () => {
    setSources(fallbackKnowledgeSources);
    setDocuments(fallbackKnowledgeDocuments);
    setSelectedSourceId((prev) => prev ?? fallbackKnowledgeSources[0]?.id);
    setSelectedDocumentId((prev) => prev ?? fallbackKnowledgeDocuments[0]?.id);
  };

  const runFallbackSearch = () => {
    const keywordBoost = query.includes('虚焊') || query.includes('焊点') ? 0.06 : 0;
    const results = fallbackKnowledgeChunks
      .map((item, index) => ({
        ...item,
        score: Math.max(0.52, (item.score ?? 0.7) - index * 0.02 + keywordBoost),
      }))
      .slice(0, 4);
    setSearchResult({
      answer: '基于本地演示知识库，建议先冻结同批次物料与在制品，再结合历史 CAPA、供应商整改报告和设备日志确认影响范围。',
      results,
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const [sourceRes, documentRes] = await Promise.all([
        listKnowledgeSources(),
        listKnowledgeDocuments(),
      ]);
      const nextSources = sourceRes.data?.data ?? [];
      const nextDocuments = documentRes.data?.data ?? [];
      if (nextSources.length && nextDocuments.length) {
        setSources(nextSources);
        setDocuments(nextDocuments);
        setSelectedSourceId((prev) => prev ?? nextSources[0]?.id);
        setSelectedDocumentId((prev) => prev ?? nextDocuments[0]?.id);
      } else {
        applyFallback();
      }
    } catch {
      applyFallback();
      message.warning('已使用本地知识库演示数据');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selectedDocument?.id) {
      setChunks([]);
      return;
    }
    listKnowledgeChunks(selectedDocument.id)
      .then((res) => {
        const nextChunks = res.data?.data ?? [];
        setChunks(nextChunks.length
          ? nextChunks
          : fallbackKnowledgeChunks.filter((chunk) => chunk.document_id === selectedDocument.id));
      })
      .catch(() => setChunks(fallbackKnowledgeChunks.filter((chunk) => chunk.document_id === selectedDocument.id)));
  }, [selectedDocument?.id]);

  const runSearch = async () => {
    if (!query.trim()) {
      message.warning('请输入检索问题');
      return;
    }
    setSearching(true);
    try {
      const res = await searchKnowledge({ query, limit: 5 });
      const nextResult = res.data?.data ?? null;
      if (nextResult?.results?.length) {
        setSearchResult(nextResult);
      } else {
        runFallbackSearch();
      }
    } catch {
      runFallbackSearch();
      message.warning('已使用本地演示知识库检索');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="knowledge-center">
      <section className="knowledge-overview">
        <div className="knowledge-stat-card">
          <Typography.Text type="secondary">知识源</Typography.Text>
          <Typography.Title level={4}>{sources.length}</Typography.Title>
          <span>按 SOP、CAPA、供应商、设备分域管理</span>
        </div>
        <div className="knowledge-stat-card">
          <Typography.Text type="secondary">知识文档</Typography.Text>
          <Typography.Title level={4}>{documents.length}</Typography.Title>
          <span>沉淀制度、历史经验和外部报告</span>
        </div>
        <div className="knowledge-stat-card">
          <Typography.Text type="secondary">切片证据</Typography.Text>
          <Typography.Title level={4}>{fallbackKnowledgeChunks.length}</Typography.Title>
          <span>用于问答引用和处置建议追溯</span>
        </div>
        <div className="knowledge-stat-card accent">
          <Typography.Text type="secondary">对象关联</Typography.Text>
          <Typography.Title level={4}>{linkedObjectCount || 8}</Typography.Title>
          <span>连接异常、批次、供应商、设备和 CAPA</span>
        </div>
      </section>

      <section className="knowledge-workbench">
        <aside className="knowledge-left-panel">
          <Card
            className="knowledge-panel-card"
            title="知识源"
            extra={<Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
          >
            <div className="knowledge-source-list">
              {sources.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === selectedSource?.id ? 'knowledge-source-item active' : 'knowledge-source-item'}
                  onClick={() => {
                    setSelectedSourceId(item.id);
                    const firstDoc = documents.find((doc) => doc.source_id === item.id);
                    setSelectedDocumentId(firstDoc?.id);
                  }}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                  <Tag>{item.document_count}</Tag>
                </button>
              ))}
            </div>
          </Card>

          <Card className="knowledge-panel-card" title="文档列表">
            <div className="knowledge-document-list">
              {visibleDocuments.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === selectedDocument?.id ? 'knowledge-document-item active' : 'knowledge-document-item'}
                  onClick={() => setSelectedDocumentId(item.id)}
                >
                  <Space wrap size={6}>
                    <Tag color="processing">{item.doc_type}</Tag>
                    <Tag>{item.status}</Tag>
                  </Space>
                  <strong>{item.title}</strong>
                  <small>{item.updated_at}</small>
                </button>
              ))}
              {!visibleDocuments.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无知识文档" />}
            </div>
          </Card>
        </aside>

        <main className="knowledge-main-panel">
          <Card className="knowledge-document-card">
            {selectedDocument ? (
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <div className="knowledge-document-head">
                  <div>
                    <Typography.Text type="secondary">当前文档</Typography.Text>
                    <Typography.Title level={4}>{selectedDocument.title}</Typography.Title>
                  </div>
                  <Space wrap>
                    <Tag color="processing">{selectedDocument.doc_type}</Tag>
                    <Tag color="success">{selectedDocument.status}</Tag>
                    <Tag>{selectedDocument.updated_at}</Tag>
                  </Space>
                </div>
                <Typography.Paragraph>{selectedDocument.summary}</Typography.Paragraph>
                <Space wrap>
                  {selectedDocument.linked_objects.map((obj) => (
                    <Tag key={`${obj.type}-${obj.id}`} color="blue">{obj.type}: {obj.name}</Tag>
                  ))}
                </Space>
              </Space>
            ) : (
              <Empty description="请选择知识文档" />
            )}
          </Card>

          <Card className="knowledge-panel-card" title="文档切片与引用证据">
            {chunks.length ? (
              <div className="knowledge-chunk-list">
                {chunks.map((chunk) => (
                  <Card size="small" key={chunk.id} className="knowledge-chunk-card">
                    <div className="knowledge-chunk-head">
                      <Typography.Text strong>{chunk.source_ref}</Typography.Text>
                      <Tag color="cyan">{Math.round((chunk.score ?? 0.76) * 100)}%</Tag>
                    </div>
                    <Typography.Paragraph type="secondary">{chunk.chunk_text}</Typography.Paragraph>
                  </Card>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择文档查看切片" />
            )}
          </Card>
        </main>

        <aside className="knowledge-rag-panel">
          <Card className="knowledge-rag-card" title={<Space><RobotOutlined />RAG 检索测试</Space>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="本地 TF-IDF 检索"
                description="MVP 阶段返回候选引用、匹配分和对象关联，后续可替换为 embedding + vector store。"
              />
              <Input.TextArea
                value={query}
                rows={4}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入业务问题，例如：焊点虚焊以前怎么处理？"
              />
              <Button block type="primary" icon={<RobotOutlined />} loading={searching} onClick={runSearch}>
                检索知识库
              </Button>
              {searchResult ? (
                <div className="knowledge-result-list">
                  <Typography.Text type="secondary">{searchResult.answer}</Typography.Text>
                  {searchResult.results.map((item) => (
                    <Card size="small" key={item.id} className="knowledge-result-card">
                      <Space wrap>
                        <Tag color="processing">{Math.round((item.score ?? 0) * 100)}%</Tag>
                        <Typography.Text strong>{item.document_title}</Typography.Text>
                      </Space>
                      <Typography.Paragraph>{item.chunk_text}</Typography.Paragraph>
                      <Typography.Text type="secondary">{item.source_ref}</Typography.Text>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="输入问题后查看引用来源" />
              )}
            </Space>
          </Card>
        </aside>
      </section>
    </div>
  );
}
