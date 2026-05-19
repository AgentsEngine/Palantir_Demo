# ManuFoundry 文档

> 制造业低代码分析平台文档索引  
> 最后更新：2026-05-19

## 当前重点

当前项目已经从“制造业分析 Demo”演进为“浅色 Foundry 风格的低代码分析平台原型”。最新设计重点是：

- 普通用户通过顶部应用下拉切换业务应用。
- 左侧菜单只显示当前应用下的菜单结构。
- 系统管理中维护应用、表单、菜单装配、数据资产、本体、用户和角色。
- 应用和表单是 N:N 关系，菜单结构是应用内的导航组织方式。
- 当前“应用装配”交互仍是前端 Demo 状态，下一阶段需要落库。

## 推荐阅读顺序

1. [当前代码框架说明](architecture/current-framework.md)
2. [低代码平台架构](architecture/low-code-platform.md)
3. [架构总览](architecture/overview.md)
4. [数据模型与本体](architecture/data-model.md)
5. [前端开发指南](development/frontend.md)
6. [后端开发指南](development/backend.md)
7. [API 参考](development/api-reference.md)

## 文档结构

```text
docs/
  README.md
  architecture/
    current-framework.md       # 当前代码框架、已实现能力、前端 Demo 状态、落库计划
    overview.md                # 整体架构总览
    low-code-platform.md       # 低代码平台设计
    data-model.md              # 数据模型与本体设计
  development/
    frontend.md                # 前端开发指南
    backend.md                 # 后端开发指南
    api-reference.md           # API 参考
  operations/
    deployment.md              # 部署说明
    testing.md                 # 测试说明
  business/
    user-guide.md              # 用户手册
    integration.md             # 外部系统集成
  archive/
    ...                        # 历史文档归档
```

## 当前实现状态

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 登录页 | 已实现 UI 原型 | 后续还会继续优化视觉。 |
| 工作台 | 已实现 | 登录后 `/` 展示个人分析工作台。 |
| 顶部应用切换 | 已实现 | 可切换生产态势、预测性维护、质量分析、供应链风险等应用。 |
| 左侧菜单 | 已实现 | 显示“我的工作台 + 当前应用菜单结构”，支持分组展示。 |
| 系统管理 | 已实现入口 | 包含应用与菜单、数据资产与本体、用户管理、角色权限。 |
| 应用装配 | 前端 Demo 闭环 | 支持应用选择、表单拖拽、菜单分组、删除、解绑。 |
| 应用基础 API | 已有后端雏形 | `applications`、`application_menus`、`application_roles` 已有基础模型和接口。 |
| 表单装配落库 | 待实现 | `forms`、`application_forms`、`application_menu_nodes` 下一阶段实现。 |
| 本体/图谱 | 已有入口和 API 原型 | 后续需要与表单字段配置强绑定。 |

## 当前数据边界

现在需要特别注意：系统管理里的“应用装配”虽然交互已经能跑通，但表单、应用-表单绑定、菜单树仍主要在前端状态中维护。刷新页面会回到初始 Demo 数据。

下一阶段数据库开发应优先解决：

- 表单主数据持久化
- 应用与表单 N:N 绑定持久化
- 应用菜单树持久化
- 分组层级持久化
- 删除表单入口时的解绑规则后端化
- 当前应用菜单接口返回完整分组结构

## 开发验证命令

前端：

```bash
cd frontend
npm.cmd run type-check
npm.cmd run build
```

后端：

```bash
cd backend
python -m pytest
```
