# ManuFoundry 前端开发指南

> **文档版本**: v1.0
> **日期**: 2026-04-28
> **适用范围**: `frontend/` 目录所有 TypeScript / React 代码

---

## 目录

1. [技术栈](#1-技术栈)
2. [启动与构建](#2-启动与构建)
3. [TypeScript 工程配置](#3-typescript-工程配置)
4. [API 层与拦截器](#4-api-层与拦截器)
5. [鉴权 Store 与权限模型](#5-鉴权-store-与权限模型)
6. [路由与菜单](#6-路由与菜单)
7. [新增一个业务页面](#7-新增一个业务页面)
8. [状态、表单、表格约定](#8-状态表单表格约定)
9. [图表与可视化](#9-图表与可视化)
10. [代码风格与提交检查](#10-代码风格与提交检查)

---

## 1. 技术栈

- **React 18** + **react-router-dom 7**
- **Vite 6** + TypeScript 5.7
- **Antd 5** + `@ant-design/pro-components`
- **Zustand 5** — 鉴权状态
- **axios 1** — HTTP 客户端（已挂拦截器）
- **ECharts 5** + `echarts-for-react` — 数据图表
- **Cytoscape 3** + `cytoscape-dagre` — 图谱可视化
- **ReactFlow 11** — 数据管线 / 工作流画布
- **lucide / @ant-design/icons** — 图标

---

## 2. 启动与构建

```bash
cd frontend
npm install
npm run dev          # vite 开发服务器，端口 3000
npm run type-check   # tsc -b --noEmit，CI 友好
npm run build        # tsc -b + vite build → dist/
npm run preview      # 本地预览构建产物
```

`npm run dev` 透过 `vite.config.ts: server.proxy['/api']` 把请求转发到 `http://localhost:8000`，无需 CORS。

---

## 3. TypeScript 工程配置

经 P1 重构后采用 `references` 模式，三个 tsconfig 各司其职：

| 文件 | 作用 | 关键差异 |
|---|---|---|
| `tsconfig.json` | 元配置 | 仅声明 `references`，无源代码 |
| `tsconfig.app.json` | 应用代码 | `lib: ES2020+DOM`，`jsx: react-jsx`，`include: ["src"]` |
| `tsconfig.node.json` | 构建脚本 | `types: ["node"]`，`include: ["vite.config.ts"]` |

`tsc -b` 会按 references 顺序构建，避免 vite 的 node 侧 import 污染应用编译。

`paths: { "@/*": ["src/*"] }` 已配，可写 `import X from '@/components/X'`。

---

## 4. API 层与拦截器

所有后端调用必须经 `src/services/api.ts` 暴露的函数；**禁止**在组件内直接 `fetch('/api/...')`（已在 P3 整改完毕）。

### 4.1 拦截器流水线

```
caller → axios request
            │
            ▼
   request interceptor
   ├ 读取 localStorage('mf_token')
   └ 写入 Authorization: Bearer <token>
            │
            ▼
   network → /api/v1/...
            │
            ▼
   response interceptor
   ├ 2xx → 直接 resolve
   └ 401 → localStorage clear + window.location='/login'
            │
            ▼
   caller .then/.catch
```

### 4.2 调用约定

```ts
// 命名：<verb><Resource>，如 listPipelines / createReport / wfApproveOrReject
import { listPipelines, runPipeline } from '@/services/api';

const { data } = await listPipelines();   // axios res
const items = data?.data ?? [];           // 后端统一 {data, total} 包裹
```

返回类型当前是宽松的 `any`，后续可逐步引入 `zod`/手写 `interface`。

---

## 5. 鉴权 Store 与权限模型

`src/stores/authStore.ts` 用 Zustand：

```ts
const { token, user, isAuthenticated, login, logout, restore } = useAuthStore();
```

- `login(token, user)` — 登录后写入 + 同步 localStorage；
- `logout()` — 清空 + 跳 `/login`（拦截器也会兜底）；
- `restore()` — `App.tsx` 启动时调用，从 localStorage 还原；
- `hasRole(user, name)` / `isAdmin(user)` / `getAdminMenus(user)` — 权限工具函数。

**菜单可见性**由 `src/config/menus.ts` 的 `ROLE_MENU_MAP` 决定：

```ts
ROLE_MENU_MAP = {
  production_manager: ['/', '/maintenance', '/quality', '/reports', '/ai-assistant'],
  quality_inspector:  ['/', '/quality', '/supply-chain', '/ai-assistant'],
  admin: null,    // null 表示不过滤
};
```

新增角色时仅改这个文件即可。

---

## 6. 路由与菜单

`App.tsx` 用 `react-router-dom v7` 的 `<Routes>`，所有页面均 `lazy` 加载：

```tsx
const DashboardPage = lazy(() => import('./pages/Dashboard'));
...
<Routes>
  <Route path="/" element={<DashboardPage />} />
  <Route path="/dynamic/:slug" element={<DynamicPage />} />
  ...
</Routes>
```

面包屑由 `BREADCRUMB_MAP`（来自 `config/menus.ts`）+ `useLocation()` 自动生成；`/dynamic/:slug` 的特例分支会从已加载的动态菜单查 label。

`<Suspense fallback={<PageLoader />}>` + 自定义 `ErrorBoundary` 包裹路由出口，单页崩溃不会蔓延到布局。

---

## 7. 新增一个业务页面

例：新增 `/process-params`。

1. **API**：在 `src/services/api.ts` 末尾追加：

   ```ts
   export const listProcessParams = (params?: Record<string, any>) =>
     api.get('/process-params', { params });
   ```

2. **页面**：新建 `src/pages/ProcessParams/index.tsx`：

   ```tsx
   import { useEffect, useState } from 'react';
   import { Card, Table } from 'antd';
   import { listProcessParams } from '@/services/api';

   export default function ProcessParamsPage() {
     const [rows, setRows] = useState<any[]>([]);
     useEffect(() => {
       listProcessParams().then(res => setRows(res.data?.data ?? []));
     }, []);
     return (
       <Card title="工艺参数">
         <Table dataSource={rows} rowKey="id" columns={[
           { title: '名称', dataIndex: 'name' },
           { title: '目标', dataIndex: 'target' },
         ]} />
       </Card>
     );
   }
   ```

3. **菜单 + 面包屑**：编辑 `src/config/menus.ts`：

   ```ts
   BUSINESS_MENUS.push({ key: '/process-params', icon: 'ToolOutlined', label: '工艺参数' });
   BREADCRUMB_MAP['/process-params'] = '工艺参数';
   ```

4. **路由**：在 `App.tsx`：

   ```tsx
   const ProcessParamsPage = lazy(() => import('./pages/ProcessParams'));
   ...
   <Route path="/process-params" element={<ProcessParamsPage />} />
   ```

5. **图标**：当前 `BUSINESS_MENUS.icon` 是字符串名，`App.tsx` 内有 `businessMenuItems` 数组真正映射 React 节点。如需新增图标渲染，需要同步该数组（或将来重构为统一的 icon registry）。

---

## 8. 状态、表单、表格约定

### 8.1 表单

- 简单表单优先 `Form` + `useForm()`；
- 复杂多步骤用 `@ant-design/pro-form` 的 `StepsForm`；
- 校验规则尽量在 schema 中声明（`rules: [{ required: true, message: '...' }]`）；
- 提交按钮的 loading 用 `Form.Item` 嵌套或自建 `useState`。

### 8.2 表格

- 列表页用 `ProTable` 时启用 `request: async (params) => api...`，自动处理分页 / 搜索；
- 朴素表格用 `Table` + 手动 `useState` 管理 `loading/data/total`；
- `rowKey="id"` 必须显式声明，避免 React key warning。

### 8.3 弹窗

- 优先 `Modal.confirm({...})`；
- **不要**用 `document.getElementById` 读 DOM。需要捕获弹窗内输入时使用 `React.createRef` + Antd `ref` 转发（参考 `App.tsx::handleApproval` 的实现）。

---

## 9. 图表与可视化

| 场景 | 库 | 备注 |
|---|---|---|
| 折线 / 柱状 / 饼图 / 仪表盘 / 雷达 | ECharts via `echarts-for-react` | `option` 函数化避免引用变量被闭包捕获 |
| 关系图谱 | Cytoscape + dagre | 适合中等量级（< 1000 节点） |
| 数据管线画布 / 工作流 | ReactFlow | 自定义节点用 `nodeTypes` 注入 |
| 报表 widget | `src/components/ReportWidgets/*` | 每个 widget 实现 `WidgetRegistry` 契约 |

性能注意：

- ECharts 使用 `notMerge: true` 避免增量合并 bug；
- 大列表用 `react-window` 或 `ProTable.virtual: true`；
- 长轮询（如通知）统一 60s 间隔，避免堆积请求。

---

## 10. 代码风格与提交检查

- 不引入 ESLint/Prettier 强制配置（保留团队选择空间），但请遵循：
  - 2 空格缩进；
  - 单引号；
  - 单文件 ≤ 400 行（`App.tsx` 是例外，后续仍可拆分 Header/Sider）；
  - 函数组件 + Hooks，不写 class（`ErrorBoundary` 是必要的例外）。
- 提交前必跑：

  ```bash
  npm run type-check
  npm run build      # 验证 production bundle 不报错
  ```

- 拒绝在生产代码里：
  - `localStorage` 写入除 `mf_token` / `mf_user` 之外的任何业务数据（用 Zustand）；
  - `any[]` 大量出现在公共组件 props（业务页内可暂留）；
  - 直接 `fetch`、`XMLHttpRequest`（统一 `services/api.ts`）。

---

> 后续若引入 Storybook、Playwright e2e、视觉回归（chromatic 等），请在本文末追加章节而不是另开文档。
