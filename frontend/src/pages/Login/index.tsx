import { Button, Card, Divider, Form, Input, Select, Space, Typography, message } from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authLogin } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

const demoAccounts = [
  { name: 'admin', label: '平台管理员', pass: 'admin123' },
  { name: 'zhangsan', label: '生产经理', pass: '123456' },
  { name: 'lisi', label: '质量工程师', pass: '123456' },
];

const capabilityItems = [
  { icon: <ClusterOutlined />, label: '业务页面配置', value: '表单 / 图表 / 权限' },
  { icon: <SafetyCertificateOutlined />, label: '流程权限协同', value: '审批 / 角色 / 发布' },
  { icon: <ApiOutlined />, label: '分析组件运行', value: '指标 / 模型 / 数据源' },
];

const flowItems = ['业务页面', '表单设置', '流程设置', '权限设置', '发布'];

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authLogin(values.username, values.password);
      const data = res.data;
      login(data.token, data.user);
      message.success(`欢迎回来，${data.user.display_name}`);
      navigate('/');
    } catch {
      message.error('账号或密码不正确');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="identity-shell">
      <div className="identity-grid" />

      <section className="identity-intro">
        <Typography.Title level={1}>ManuFoundry</Typography.Title>
        <Typography.Paragraph>
          面向制造业数据资产、业务页面、流程权限和分析组件的低代码工作台。
        </Typography.Paragraph>

        <div className="identity-flow">
          {flowItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <div className="identity-status">
          {capabilityItems.map((item) => (
            <div className="identity-status-item" key={item.label}>
              <span className="identity-status-icon">{item.icon}</span>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card className="identity-card" variant="borderless">
        <Space direction="vertical" size={4} className="identity-card-head">
          <div className="brand-mark">MF</div>
          <Typography.Title level={3}>进入工作台</Typography.Title>
          <Typography.Text type="secondary">选择空间并验证身份</Typography.Text>
        </Space>

        <Form
          layout="vertical"
          onFinish={handleLogin}
          initialValues={{ environment: 'demo', username: 'admin', password: 'admin123' }}
        >
          <Form.Item name="environment" label="组织环境">
            <Select
              options={[
                { value: 'demo', label: 'Demo Workspace / 制造业演示空间' },
                { value: 'sandbox', label: 'Sandbox / 配置沙箱' },
                { value: 'prod', label: 'Production / 生产环境' },
              ]}
            />
          </Form.Item>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入账号" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block className="identity-submit">
            登录工作台
          </Button>
        </Form>

        <Divider />
        <div className="demo-account-row">
          <Typography.Text type="secondary">演示账号</Typography.Text>
          <Space wrap>
            {demoAccounts.map((account) => (
              <Button
                key={account.name}
                size="small"
                type="text"
                icon={<CheckCircleOutlined />}
                onClick={() => handleLogin({ username: account.name, password: account.pass })}
              >
                {account.label}
              </Button>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
}
