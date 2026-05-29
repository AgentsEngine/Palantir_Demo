import { useEffect, useMemo, useState } from 'react';
import {
  ApartmentOutlined,
  DatabaseOutlined,
  PlusOutlined,
  ProfileOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Form, Input, Modal, Row, Segmented, Select, Space, Table, Tabs, Tag, Typography, message } from 'antd';

type DictionaryItem = {
  id: string;
  dictCode: string;
  dictName: string;
  scope: string;
  owner: string;
  options: Array<{ label: string; value: string; enabled: boolean }>;
};

type MasterDataType = {
  id: string;
  name: string;
  code: string;
  owner: string;
  description: string;
  fields: Array<{ name: string; label: string; type: string; role: string }>;
  records: Array<Record<string, string>>;
};

const storageKey = 'mf_reference_data_admin';

const defaultDictionaries: DictionaryItem[] = [
  {
    id: 'alert-level',
    dictCode: 'alert_level',
    dictName: '告警等级',
    scope: '生产监控',
    owner: '系统管理',
    options: [
      { label: '严重', value: 'critical', enabled: true },
      { label: '一般', value: 'normal', enabled: true },
      { label: '提醒', value: 'notice', enabled: true },
    ],
  },
  {
    id: 'alert-status',
    dictCode: 'alert_status',
    dictName: '告警状态',
    scope: '流程状态',
    owner: '流程设计',
    options: [
      { label: '待处理', value: 'pending', enabled: true },
      { label: '处理中', value: 'processing', enabled: true },
      { label: '已关闭', value: 'closed', enabled: true },
    ],
  },
  {
    id: 'alert-source',
    dictCode: 'alert_source',
    dictName: '告警来源',
    scope: '告警中心',
    owner: '系统管理',
    options: [
      { label: '系统监测', value: 'system', enabled: true },
      { label: '人工上报', value: 'manual', enabled: true },
      { label: '外部接口', value: 'api', enabled: true },
    ],
  },
];

const defaultMasterData: MasterDataType[] = [
  {
    id: 'equipment',
    name: '设备档案',
    code: 'equipment_master',
    owner: '设备管理',
    description: '设备、产线、位置和默认负责人等可复用业务档案。',
    fields: [
      { name: 'equipment_no', label: '设备编号', type: '文本', role: '值字段' },
      { name: 'equipment_name', label: '设备名称', type: '文本', role: '显示字段' },
      { name: 'line', label: '所属产线', type: '关联档案', role: '带出字段' },
      { name: 'location', label: '安装位置', type: '文本', role: '带出字段' },
      { name: 'owner', label: '默认负责人', type: '人员', role: '带出字段' },
      { name: 'status', label: '状态', type: '数据字典', role: '过滤字段' },
    ],
    records: [
      { equipment_no: 'EQ-SMT-03', equipment_name: 'SMT-03 回流焊', line: 'SMT 产线', location: 'A区温区5', owner: '孙浩', status: '启用' },
      { equipment_no: 'EQ-AIR-02', equipment_name: '空压站 2#', line: '公用动力', location: '动力站', owner: '周强', status: '启用' },
      { equipment_no: 'EQ-ASM-A', equipment_name: 'Assembly-A 主线', line: '总装 A 线', location: '装配车间', owner: '李明', status: '启用' },
    ],
  },
  {
    id: 'line',
    name: '产线档案',
    code: 'production_line_master',
    owner: '生产管理',
    description: '产线、车间、节拍和负责人等基础数据。',
    fields: [
      { name: 'line_no', label: '产线编码', type: '文本', role: '值字段' },
      { name: 'line_name', label: '产线名称', type: '文本', role: '显示字段' },
      { name: 'workshop', label: '所属车间', type: '组织', role: '过滤字段' },
      { name: 'manager', label: '产线负责人', type: '人员', role: '带出字段' },
    ],
    records: [
      { line_no: 'LINE-SMT', line_name: 'SMT 产线', workshop: '电子车间', manager: '陈晨' },
      { line_no: 'LINE-ASM-A', line_name: '总装 A 线', workshop: '装配车间', manager: '李明' },
    ],
  },
  {
    id: 'alert-type',
    name: '告警类型档案',
    code: 'alert_type_master',
    owner: '设备管理',
    description: '维护告警类型、默认等级、处理角色和处理时限建议。',
    fields: [
      { name: 'type_code', label: '类型编码', type: '编码', role: '值字段' },
      { name: 'type_name', label: '类型名称', type: '文本', role: '显示字段' },
      { name: 'default_level', label: '默认等级', type: '数据字典', role: '带出字段' },
      { name: 'default_role', label: '默认处理角色', type: '角色', role: '带出字段' },
      { name: 'sla_hours', label: '处理时限', type: '数值', role: '带出字段' },
    ],
    records: [
      { type_code: 'TEMP_HIGH', type_name: '温度过高', default_level: '严重', default_role: '维修工程师', sla_hours: '2' },
      { type_code: 'PRESSURE_LOW', type_name: '压力偏低', default_level: '一般', default_role: '设备管理员', sla_hours: '6' },
    ],
  },
];

function loadInitialState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { dictionaries: defaultDictionaries, masterData: defaultMasterData };
    const parsed = JSON.parse(raw) as { dictionaries?: DictionaryItem[]; masterData?: MasterDataType[] };
    return {
      dictionaries: parsed.dictionaries?.length ? parsed.dictionaries : defaultDictionaries,
      masterData: parsed.masterData?.length ? parsed.masterData : defaultMasterData,
    };
  } catch {
    return { dictionaries: defaultDictionaries, masterData: defaultMasterData };
  }
}

export default function ReferenceDataManagement() {
  const initial = useMemo(loadInitialState, []);
  const [mode, setMode] = useState<'dictionary' | 'master'>('dictionary');
  const [dictionaries, setDictionaries] = useState<DictionaryItem[]>(initial.dictionaries);
  const [masterData, setMasterData] = useState<MasterDataType[]>(initial.masterData);
  const [selectedMasterId, setSelectedMasterId] = useState(initial.masterData[0]?.id || 'equipment');
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [dictionaryForm] = Form.useForm();
  const [masterForm] = Form.useForm();

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ dictionaries, masterData }));
  }, [dictionaries, masterData]);

  const selectedMaster = masterData.find((item) => item.id === selectedMasterId) || masterData[0];

  const addDictionary = async () => {
    const values = await dictionaryForm.validateFields();
    setDictionaries((items) => [
      ...items,
      {
        id: String(Date.now()),
        dictCode: values.dictCode,
        dictName: values.dictName,
        scope: values.scope || '通用',
        owner: values.owner || '系统管理',
        options: String(values.options || '')
          .split(/[、,\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => ({ label: item, value: item, enabled: true })),
      },
    ]);
    dictionaryForm.resetFields();
    setDictionaryOpen(false);
    message.success('数据字典已建立，可在表单字段中引用');
  };

  const addMaster = async () => {
    const values = await masterForm.validateFields();
    const next: MasterDataType = {
      id: String(Date.now()),
      name: values.name,
      code: values.code,
      owner: values.owner || '系统管理',
      description: values.description || '可被多个表单引用的基础档案。',
      fields: [
        { name: 'code', label: '编码', type: '文本', role: '值字段' },
        { name: 'name', label: '名称', type: '文本', role: '显示字段' },
        { name: 'status', label: '状态', type: '数据字典', role: '过滤字段' },
      ],
      records: [],
    };
    setMasterData((items) => [...items, next]);
    setSelectedMasterId(next.id);
    masterForm.resetFields();
    setMasterOpen(false);
    message.success('基础档案类型已建立，可继续维护字段和档案数据');
  };

  const dictionaryColumns = [
    { title: '字典名称', dataIndex: 'dictName', width: 140 },
    { title: '字典编码', dataIndex: 'dictCode', width: 160 },
    { title: '适用范围', dataIndex: 'scope', width: 120 },
    { title: '维护方', dataIndex: 'owner', width: 120 },
    {
      title: '选项',
      dataIndex: 'options',
      render: (options: DictionaryItem['options']) => (
        <Space wrap size={[4, 4]}>
          {options.map((item) => <Tag key={item.value} color={item.enabled ? 'blue' : 'default'}>{item.label}</Tag>)}
        </Space>
      ),
    },
  ];

  const fieldColumns = [
    { title: '字段名称', dataIndex: 'label', width: 140 },
    { title: '字段编码', dataIndex: 'name', width: 160 },
    { title: '字段类型', dataIndex: 'type', width: 120 },
    { title: '引用角色', dataIndex: 'role', render: (value: string) => <Tag color="cyan">{value}</Tag> },
  ];

  const recordColumns = selectedMaster?.fields.map((field) => ({
    title: field.label,
    dataIndex: field.name,
    key: field.name,
  })) || [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card>
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space direction="vertical" size={2}>
              <Typography.Title level={4} style={{ margin: 0 }}>数据字典与基础档案</Typography.Title>
              <Typography.Text type="secondary">
                后台统一维护可复用的数据值；表单字段只负责引用这些值，不在每个表单里重复维护。
              </Typography.Text>
            </Space>
          </Col>
          <Col>
            <Segmented
              value={mode}
              onChange={(value) => setMode(value as 'dictionary' | 'master')}
              options={[
                { label: '数据字典', value: 'dictionary', icon: <TagsOutlined /> },
                { label: '基础档案', value: 'master', icon: <ProfileOutlined /> },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {mode === 'dictionary' ? (
        <Card
          title={<Space><TagsOutlined />数据字典</Space>}
          extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setDictionaryOpen(true)}>新建字典</Button>}
        >
          <Table rowKey="id" columns={dictionaryColumns} dataSource={dictionaries} pagination={false} />
        </Card>
      ) : (
        <Row gutter={16}>
          <Col span={7}>
            <Card title={<Space><DatabaseOutlined />档案类型</Space>} extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setMasterOpen(true)}>新建</Button>}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {masterData.map((item) => (
                  <Button
                    key={item.id}
                    block
                    type={item.id === selectedMasterId ? 'primary' : 'default'}
                    icon={item.id === 'equipment' ? <ApartmentOutlined /> : <DatabaseOutlined />}
                    onClick={() => setSelectedMasterId(item.id)}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    {item.name}
                  </Button>
                ))}
              </Space>
            </Card>
          </Col>
          <Col span={17}>
            <Card
              title={selectedMaster?.name || '基础档案'}
              extra={<Tag color="blue">{selectedMaster?.code}</Tag>}
            >
              <Typography.Paragraph type="secondary">{selectedMaster?.description}</Typography.Paragraph>
              <Tabs
                items={[
                  {
                    key: 'fields',
                    label: '字段定义',
                    children: <Table rowKey="name" columns={fieldColumns} dataSource={selectedMaster?.fields || []} pagination={false} />,
                  },
                  {
                    key: 'records',
                    label: '档案数据',
                    children: <Table rowKey={(row) => Object.values(row).join('-')} columns={recordColumns} dataSource={selectedMaster?.records || []} pagination={false} />,
                  },
                  {
                    key: 'usage',
                    label: '表单引用',
                    children: (
                      <Space direction="vertical">
                        <Typography.Text>在表单设置中选择：来源类型 = 基础档案</Typography.Text>
                        <Typography.Text>引用对象：{selectedMaster?.name}</Typography.Text>
                        <Typography.Text>值字段：{selectedMaster?.fields.find((field) => field.role === '值字段')?.label || '编码'}</Typography.Text>
                        <Typography.Text>显示字段：{selectedMaster?.fields.find((field) => field.role === '显示字段')?.label || '名称'}</Typography.Text>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Modal title="新建数据字典" open={dictionaryOpen} onCancel={() => setDictionaryOpen(false)} onOk={addDictionary} okText="保存">
        <Form layout="vertical" form={dictionaryForm}>
          <Form.Item label="字典名称" name="dictName" rules={[{ required: true, message: '请输入字典名称' }]}>
            <Input placeholder="例如：告警等级" />
          </Form.Item>
          <Form.Item label="字典编码" name="dictCode" rules={[{ required: true, message: '请输入字典编码' }]}>
            <Input placeholder="例如：alert_level" />
          </Form.Item>
          <Form.Item label="适用范围" name="scope">
            <Input placeholder="例如：告警中心 / 通用" />
          </Form.Item>
          <Form.Item label="维护方" name="owner">
            <Input placeholder="例如：系统管理" />
          </Form.Item>
          <Form.Item label="选项值" name="options" rules={[{ required: true, message: '请输入选项' }]}>
            <Input.TextArea rows={3} placeholder="用顿号、逗号或换行分隔，例如：严重、一般、提醒" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新建基础档案类型" open={masterOpen} onCancel={() => setMasterOpen(false)} onOk={addMaster} okText="保存">
        <Form layout="vertical" form={masterForm}>
          <Form.Item label="档案名称" name="name" rules={[{ required: true, message: '请输入档案名称' }]}>
            <Input placeholder="例如：设备档案" />
          </Form.Item>
          <Form.Item label="档案编码" name="code" rules={[{ required: true, message: '请输入档案编码' }]}>
            <Input placeholder="例如：equipment_master" />
          </Form.Item>
          <Form.Item label="维护方" name="owner">
            <Input placeholder="例如：设备管理" />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={3} placeholder="说明这个档案给哪些表单复用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
