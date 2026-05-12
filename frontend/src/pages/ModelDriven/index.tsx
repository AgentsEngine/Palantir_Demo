import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, message } from 'antd';
import ModelDesigner from './ModelDesigner';
import PageGenerator from './PageGenerator';
import MenuManager from './MenuManager';

export default function ModelDriven() {
  return (
    <Tabs
      defaultActiveKey="models"
      items={[
        { key: 'models', label: '模型定义', children: <ModelDesigner /> },
        { key: 'pages', label: '页面生成', children: <PageGenerator /> },
        { key: 'menus', label: '菜单管理', children: <MenuManager /> },
      ]}
    />
  );
}
