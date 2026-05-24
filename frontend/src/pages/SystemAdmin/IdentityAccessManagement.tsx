import React from 'react';
import { SafetyCertificateOutlined, TeamOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { Alert, Tabs, Typography } from 'antd';
import OrganizationManagement from './OrganizationManagement';
import RoleManagement from './RoleManagement';
import UserManagement from './UserManagement';

interface IdentityAccessManagementProps {
  defaultActiveKey?: string;
}

export default function IdentityAccessManagement({ defaultActiveKey = 'users' }: IdentityAccessManagementProps) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>用户与权限</Typography.Title>
        <Typography.Text type="secondary">
          用户绑定组织和角色；角色被应用菜单、表单权限、流程审批等配置复用；组织负责后续数据范围。
        </Typography.Text>
      </div>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="权限关系"
        description="角色决定能做什么，组织决定能看哪里。应用与菜单、表单权限、流程设置中涉及权限的配置，都应选择这里维护的角色和组织。"
      />
      <Tabs
        defaultActiveKey={defaultActiveKey}
        items={[
          { key: 'users', label: <span><TeamOutlined /> 用户管理</span>, children: <UserManagement /> },
          { key: 'roles', label: <span><SafetyCertificateOutlined /> 角色管理</span>, children: <RoleManagement /> },
          { key: 'orgs', label: <span><UserSwitchOutlined /> 组织管理</span>, children: <OrganizationManagement /> },
        ]}
      />
    </div>
  );
}
