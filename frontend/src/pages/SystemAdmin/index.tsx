import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'antd';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';

export default function SystemAdmin() {
  return (
    <Tabs
      defaultActiveKey="users"
      items={[
        { key: 'users', label: '用户管理', children: <UserManagement /> },
        { key: 'roles', label: '角色权限', children: <RoleManagement /> },
      ]}
    />
  );
}
