import { useEffect, useMemo, useState } from 'react';
import {
  ApartmentOutlined,
  BranchesOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FormOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Empty, List, Row, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import {
  listSemanticDataAssets,
  listSemanticOntologyObjects,
  listSemanticOntologyRelations,
  listSemanticPageContracts,
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
    <div className="semantic-center">
      <section className="semantic-center-header">
        <div>
          <Typography.Title level={4}>Semantic Asset Center</Typography.Title>
          <Typography.Text type="secondary">
            Data assets, ontology objects, page contracts, and graph analysis are managed here.
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
