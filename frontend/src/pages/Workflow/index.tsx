import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'antd';
import WorkflowList from './WorkflowList';
import MyApprovals from './MyApprovals';
import MyApplications from './MyApplications';

export default function WorkflowPage() {
  return (
    <Tabs
      defaultActiveKey="definitions"
      items={[
        { key: 'definitions', label: '工作流管理', children: <WorkflowList /> },
        { key: 'my-approvals', label: '待我审批', children: <MyApprovals /> },
        { key: 'my-applications', label: '我的申请', children: <MyApplications /> },
      ]}
    />
  );
}
