import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Divider } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authLogin } from '@/services/api';

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
      message.success(`欢迎，${data.user.display_name}`);
      navigate('/');
    } catch {
      message.error('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    }}>
      <Card
        style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #1677ff, #4096ff)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 700,
          }}>MF</div>
          <Typography.Title level={3} style={{ margin: 0, color: '#1a1a2e' }}>制造数智平台</Typography.Title>
          <Typography.Text type="secondary">制造业数据操作系统</Typography.Text>
        </div>

        <Form onFinish={handleLogin} size="large" initialValues={{ username: 'admin', password: 'admin123' }}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block
              style={{ height: 44, borderRadius: 8, fontSize: 16 }}>
              登 录
            </Button>
          </Form.Item>
        </Form>

        <Divider style={{ margin: '16px 0' }} />
        <div style={{ textAlign: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            演示账号
          </Typography.Text>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { name: 'admin', label: '管理员', pass: 'admin123' },
              { name: 'zhangsan', label: '生产主管', pass: '123456' },
              { name: 'lisi', label: '质检员', pass: '123456' },
            ].map((a) => (
              <Button key={a.name} size="small" type="link" onClick={() => {
                handleLogin({ username: a.name, password: a.pass });
              }}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
