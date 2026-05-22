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
  getKnowledgeOcrPipeline,
  getRelatedKnowledgeCards,
  listKnowledgeChunks,
  listKnowledgeCards,
  listKnowledgeDocuments,
  listKnowledgeSpaces,
  listKnowledgeSources,
  listSemanticDataAssets,
  listSemanticOntologyObjects,
  listSemanticOntologyRelations,
  listSemanticPageContracts,
  searchKnowledge,
  suggestKnowledgeBindings,
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

type KnowledgeSpace = {
  id: string;
  name: string;
  scope: string;
  owner_role: string;
  review_required: boolean;
  description: string;
};

type EvidenceRef = {
  document_id: string;
  source_ref: string;
  document_title?: string;
  document_type?: string;
  source_name?: string;
};

type KnowledgeCard = {
  id: string;
  space_id: string;
  space_name?: string;
  title: string;
  status: string;
  owner: string;
  reviewer: string;
  updated_at: string;
  scenario: string;
  guidance: string[];
  risk_notes: string[];
  evidence_refs: EvidenceRef[];
  linked_objects: LinkedObject[];
  backlinks: string[];
};

type BindingCandidate = {
  text: string;
  object_type: string;
  object_id: string;
  object_name: string;
  confidence: number;
  match_type: string;
  alias: string[];
};

type OcrPipelineStep = {
  key: string;
  title: string;
  owner: string;
  description: string;
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

const fallbackKnowledgeSpaces: KnowledgeSpace[] = [
  { id: 'personal', name: '个人知识库', scope: 'private', owner_role: '当前用户', review_required: false, description: '个人笔记和临时资料，默认不进入工作台引用。' },
  { id: 'team-quality', name: '质量团队知识库', scope: 'team', owner_role: '质量工程师', review_required: true, description: '团队复用的异常经验和项目资料。' },
  { id: 'dept-quality', name: '质量部门知识库', scope: 'department', owner_role: '质量经理', review_required: true, description: '审核后的 SOP、CAPA 和处置策略。' },
  { id: 'enterprise', name: '企业知识库', scope: 'enterprise', owner_role: '平台管理员 / 业务专家', review_required: true, description: '跨部门可复用的正式知识。' },
];

const fallbackKnowledgeCards: KnowledgeCard[] = [
  {
    id: 'card-solder-void',
    space_id: 'dept-quality',
    space_name: '质量部门知识库',
    title: '焊点虚焊处理策略',
    status: 'published',
    owner: '质量经理',
    reviewer: '质量体系负责人',
    updated_at: '2026-05-21 10:20',
    scenario: 'AOI 连续发现 BGA 区域焊点虚焊，缺陷率超过管控线。',
    guidance: ['冻结同批次物料和在制品', '发起 BGA 区域复检', '检查回流炉温区曲线和焊锡膏储运记录', '重复出现时生成 CAPA'],
    risk_notes: ['供应商温控证明未补齐前，不建议释放同仓储批次。'],
    evidence_refs: [
      { document_id: 'doc-sop-rework', source_ref: 'SOP-QA-014 / 3.2-4.1', document_title: 'SOP-QA-014 焊点虚焊复检与冻结流程' },
      { document_id: 'doc-capa-072', source_ref: 'CAPA-072 / Root Cause', document_title: 'CAPA-072 电控模块 V2 虚焊历史处置' },
    ],
    linked_objects: [
      { type: 'Defect', id: 'D-SOLDER-VOID', name: '焊点虚焊' },
      { type: 'MaterialBatch', id: 'MB-7781', name: '焊锡膏 S12' },
      { type: 'Equipment', id: 'SMT-03', name: 'SMT-03 回流炉' },
    ],
    backlinks: ['card-supplier-risk', 'card-reflow-check'],
  },
  {
    id: 'card-supplier-risk',
    space_id: 'dept-quality',
    space_name: '质量部门知识库',
    title: '供应商批次风险判断',
    status: 'published',
    owner: 'SQE 主管',
    reviewer: '采购质量经理',
    updated_at: '2026-05-20 15:35',
    scenario: '供应商报告、来料记录或批次追溯显示温控、运输或仓储证据缺口。',
    guidance: ['隔离同批次和同仓储风险物料', '通知采购和 SQE 补充供应商 8D / 温控证明', '提高后续来料抽检比例'],
    risk_notes: ['供应商报告处于 reviewing 状态时，只能作为处置参考。'],
    evidence_refs: [
      { document_id: 'doc-supplier-beichen', source_ref: '北辰电子材料 5 月来料整改报告', document_title: '北辰电子材料 5 月来料整改报告' },
    ],
    linked_objects: [
      { type: 'Supplier', id: 'SUP-BEICHEN', name: '北辰电子材料' },
      { type: 'MaterialBatch', id: 'MB-7781', name: '焊锡膏 S12' },
    ],
    backlinks: ['card-solder-void'],
  },
  {
    id: 'card-reflow-check',
    space_id: 'team-quality',
    space_name: '质量团队知识库',
    title: '回流焊温区异常排查',
    status: 'reviewing',
    owner: '设备工程师',
    reviewer: '设备主管',
    updated_at: '2026-05-21 09:50',
    scenario: '质量异常前后设备日志出现温区偏移、未停机报警或维护备注。',
    guidance: ['拉取异常前后 30 分钟温控曲线', '比对同班次工单和首件复检记录', '必要时创建设备检查任务'],
    risk_notes: ['轻微偏移未触发停机时，也要与缺陷率和物料批次共同判断。'],
    evidence_refs: [
      { document_id: 'doc-equipment-smt03', source_ref: 'SMT-03 / 2026-05-21 09:12', document_title: 'SMT-03 回流炉温区维护日志' },
    ],
    linked_objects: [
      { type: 'Equipment', id: 'SMT-03', name: 'SMT-03 回流炉' },
      { type: 'WorkOrder', id: 'WO-260521-017', name: '电控模块 V2 工单' },
    ],
    backlinks: ['card-solder-void'],
  },
];

const fallbackBindingCandidates: BindingCandidate[] = [
  { text: '北辰电子材料', object_type: 'Supplier', object_id: 'SUP-BEICHEN', object_name: '北辰电子材料', confidence: 0.96, match_type: 'exact', alias: ['北辰材料', 'Beichen'] },
  { text: 'MB-7781', object_type: 'MaterialBatch', object_id: 'MB-7781', object_name: '焊锡膏 S12', confidence: 0.94, match_type: 'batch_code', alias: ['S12 锡膏'] },
  { text: 'SMT-03', object_type: 'Equipment', object_id: 'SMT-03', object_name: 'SMT-03 回流炉', confidence: 0.91, match_type: 'equipment_code', alias: ['三号回流炉'] },
  { text: '焊点虚焊', object_type: 'Defect', object_id: 'D-SOLDER-VOID', object_name: '焊点虚焊', confidence: 0.88, match_type: 'semantic', alias: ['空焊', 'BGA 焊接不良'] },
];

const fallbackOcrPipeline: OcrPipelineStep[] = [
  { key: 'upload', title: '资料上传', owner: '上传者', description: '接入 PDF、图片、扫描件、Excel 或外部系统附件。' },
  { key: 'ocr', title: 'OCR 与版面识别', owner: '系统', description: '提取文字、表格、页眉页脚和签名区，标记低置信字段。' },
  { key: 'match', title: '主数据匹配', owner: '数据管理员', description: '与 ERP、MES、QMS、设备台账和本体对象匹配。' },
  { key: 'review', title: '审核发布', owner: '业务负责人', description: '确认知识条目、对象绑定、权限范围后发布。' },
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
        ]}
      />
    </div>
  );
}

function boolTag(value: boolean) {
  return value ? <Tag color="success">是</Tag> : <Tag>否</Tag>;
}

export function KnowledgeCenter() {
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [cards, setCards] = useState<KnowledgeCard[]>([]);
  const [bindingCandidates, setBindingCandidates] = useState<BindingCandidate[]>([]);
  const [ocrPipeline, setOcrPipeline] = useState<OcrPipelineStep[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>();
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const [selectedCardId, setSelectedCardId] = useState<string>();
  const [query, setQuery] = useState('焊点虚焊以前怎么处理');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ answer: string; results: KnowledgeChunk[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedSpace = spaces.find((item) => item.id === selectedSpaceId) ?? spaces[0];
  const selectedSource = sources.find((item) => item.id === selectedSourceId) ?? sources[0];
  const visibleCards = selectedSpace?.id
    ? cards.filter((item) => item.space_id === selectedSpace.id)
    : cards;
  const selectedCard = cards.find((item) => item.id === selectedCardId) ?? visibleCards[0] ?? cards[0];
  const sourceDocuments = selectedSourceId
    ? documents.filter((item) => item.source_id === selectedSourceId)
    : documents;
  const linkedObjectCount = new Set(
    cards.flatMap((card) => card.linked_objects.map((obj) => `${obj.type}:${obj.id}`)),
  ).size;

  const applyFallback = () => {
    setSpaces(fallbackKnowledgeSpaces);
    setSources(fallbackKnowledgeSources);
    setDocuments(fallbackKnowledgeDocuments);
    setCards(fallbackKnowledgeCards);
    setOcrPipeline(fallbackOcrPipeline);
    setBindingCandidates(fallbackBindingCandidates);
    setSelectedSpaceId((prev) => prev ?? fallbackKnowledgeSpaces[2]?.id);
    setSelectedSourceId((prev) => prev ?? fallbackKnowledgeSources[0]?.id);
    setSelectedCardId((prev) => prev ?? fallbackKnowledgeCards[0]?.id);
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
      const [spaceRes, sourceRes, documentRes, cardRes, ocrRes] = await Promise.all([
        listKnowledgeSpaces(),
        listKnowledgeSources(),
        listKnowledgeDocuments(),
        listKnowledgeCards(),
        getKnowledgeOcrPipeline(),
      ]);
      const nextSpaces = spaceRes.data?.data ?? [];
      const nextSources = sourceRes.data?.data ?? [];
      const nextDocuments = documentRes.data?.data ?? [];
      const nextCards = cardRes.data?.data ?? [];
      const nextOcr = ocrRes.data?.data ?? [];
      if (nextSources.length && nextDocuments.length && nextCards.length) {
        setSpaces(nextSpaces.length ? nextSpaces : fallbackKnowledgeSpaces);
        setSources(nextSources);
        setDocuments(nextDocuments);
        setCards(nextCards);
        setOcrPipeline(nextOcr.length ? nextOcr : fallbackOcrPipeline);
        setSelectedSpaceId((prev) => prev ?? nextCards[0]?.space_id ?? nextSpaces[0]?.id);
        setSelectedSourceId((prev) => prev ?? nextSources[0]?.id);
        setSelectedCardId((prev) => prev ?? nextCards[0]?.id);
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
    if (!selectedCard) {
      setBindingCandidates([]);
      return;
    }
    const bindingText = [
      selectedCard.title,
      selectedCard.scenario,
      ...selectedCard.linked_objects.map((obj) => `${obj.type} ${obj.id} ${obj.name}`),
    ].join(' ');
    suggestKnowledgeBindings({ text: bindingText, limit: 8 })
      .then((res) => {
        const nextCandidates = res.data?.data ?? [];
        setBindingCandidates(nextCandidates.length ? nextCandidates : fallbackBindingCandidates);
      })
      .catch(() => setBindingCandidates(fallbackBindingCandidates));
  }, [selectedCard?.id]);

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
          <Typography.Text type="secondary">知识空间</Typography.Text>
          <Typography.Title level={4}>{spaces.length}</Typography.Title>
          <span>个人、团队、部门、企业分层治理</span>
        </div>
        <div className="knowledge-stat-card">
          <Typography.Text type="secondary">知识条目</Typography.Text>
          <Typography.Title level={4}>{cards.length}</Typography.Title>
          <span>Obsidian 式业务知识卡片</span>
        </div>
        <div className="knowledge-stat-card">
          <Typography.Text type="secondary">原始资料</Typography.Text>
          <Typography.Title level={4}>{documents.length}</Typography.Title>
          <span>SOP、CAPA、报告、日志作为证据来源</span>
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
            title="知识空间"
            extra={<Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
          >
            <div className="knowledge-source-list">
              {spaces.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === selectedSpace?.id ? 'knowledge-source-item active' : 'knowledge-source-item'}
                  onClick={() => {
                    setSelectedSpaceId(item.id);
                    const firstCard = cards.find((card) => card.space_id === item.id);
                    setSelectedCardId(firstCard?.id);
                  }}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                  <Tag color={item.review_required ? 'warning' : 'success'}>{item.review_required ? '需审核' : '个人'}</Tag>
                </button>
              ))}
            </div>
          </Card>

          <Card className="knowledge-panel-card" title="知识条目">
            <div className="knowledge-document-list">
              {visibleCards.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={item.id === selectedCard?.id ? 'knowledge-document-item active' : 'knowledge-document-item'}
                  onClick={() => setSelectedCardId(item.id)}
                >
                  <Space wrap size={6}>
                    <Tag color="processing">{item.space_name ?? item.space_id}</Tag>
                    <Tag>{item.status}</Tag>
                  </Space>
                  <strong>{item.title}</strong>
                  <small>{item.updated_at}</small>
                </button>
              ))}
              {!visibleCards.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无知识条目" />}
            </div>
          </Card>
        </aside>

        <main className="knowledge-main-panel">
          <Card className="knowledge-document-card">
            {selectedCard ? (
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <div className="knowledge-document-head">
                  <div>
                    <Typography.Text type="secondary">当前知识条目</Typography.Text>
                    <Typography.Title level={4}>{selectedCard.title}</Typography.Title>
                  </div>
                  <Space wrap>
                    <Tag color="processing">{selectedCard.space_name ?? selectedCard.space_id}</Tag>
                    <Tag color={selectedCard.status === 'published' ? 'success' : 'warning'}>{selectedCard.status}</Tag>
                    <Tag>{selectedCard.updated_at}</Tag>
                  </Space>
                </div>
                <Typography.Paragraph>{selectedCard.scenario}</Typography.Paragraph>
                <div className="knowledge-guidance-list">
                  {selectedCard.guidance.map((item) => <span key={item}>{item}</span>)}
                </div>
                <Space direction="vertical" size={4}>
                  <Typography.Text strong>风险提示</Typography.Text>
                  {selectedCard.risk_notes.map((item) => <Typography.Text type="secondary" key={item}>{item}</Typography.Text>)}
                </Space>
                <Space wrap>
                  {selectedCard.linked_objects.map((obj) => (
                    <Tag key={`${obj.type}-${obj.id}`} color="blue">{obj.type}: {obj.name}</Tag>
                  ))}
                </Space>
              </Space>
            ) : (
              <Empty description="请选择知识条目" />
            )}
          </Card>

          <Card className="knowledge-panel-card" title="证据来源与对象绑定">
            {selectedCard ? (
              <div className="knowledge-binding-grid">
                <div>
                  <Typography.Text strong>证据来源</Typography.Text>
                  <div className="knowledge-chunk-list">
                    {selectedCard.evidence_refs.map((ref) => (
                      <Card size="small" key={`${ref.document_id}-${ref.source_ref}`} className="knowledge-chunk-card">
                        <div className="knowledge-chunk-head">
                          <Typography.Text strong>{ref.document_title ?? ref.document_id}</Typography.Text>
                          <Tag color="cyan">source</Tag>
                        </div>
                        <Typography.Text type="secondary">{ref.source_ref}</Typography.Text>
                      </Card>
                    ))}
                  </div>
                </div>
                <div>
                  <Typography.Text strong>AI 推荐绑定 / 数据清洗</Typography.Text>
                  <div className="knowledge-chunk-list">
                    {bindingCandidates.map((item) => (
                      <Card size="small" key={`${item.object_type}-${item.object_id}`} className="knowledge-chunk-card">
                        <div className="knowledge-chunk-head">
                          <Typography.Text strong>{item.object_type}: {item.object_name}</Typography.Text>
                          <Tag color={item.confidence >= 0.9 ? 'success' : 'warning'}>{Math.round(item.confidence * 100)}%</Tag>
                        </div>
                        <Typography.Text type="secondary">
                          命中文本：{item.text} / 匹配方式：{item.match_type} / 别名：{item.alias.join('、')}
                        </Typography.Text>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择知识条目查看证据和绑定" />
            )}
          </Card>
        </main>

        <aside className="knowledge-rag-panel">
          <Card className="knowledge-rag-card" title={<Space><RobotOutlined />RAG 检索测试</Space>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="知识条目优先，RAG 保留为底层检索"
                description="用户看到知识卡片，系统内部仍可用全文、TF-IDF 或向量检索补充证据来源。"
              />
              <Card size="small" className="knowledge-chunk-card">
                <Typography.Text strong>OCR / 清洗 / 发布链路</Typography.Text>
                <div className="knowledge-ocr-steps">
                  {ocrPipeline.map((step) => (
                    <span key={step.key}>
                      <strong>{step.title}</strong>
                      <small>{step.owner}</small>
                    </span>
                  ))}
                </div>
              </Card>
              <Select
                value={selectedSource?.id}
                options={sources.map((item) => ({ label: item.name, value: item.id }))}
                onChange={setSelectedSourceId}
                style={{ width: '100%' }}
                placeholder="查看原始资料来源"
              />
              <div className="knowledge-source-docs">
                {sourceDocuments.slice(0, 3).map((doc) => (
                  <Tag key={doc.id}>{doc.title}</Tag>
                ))}
              </div>
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
