# ManuFoundry 文档

> 制造业低代码数据操作系统 | 最后更新 2026-05-13

---

## 文档结构

```
docs/
├── README.md                    ← 你在这里
├── architecture/                ← 架构设计
│   ├── overview.md              技术架构总览（设计原则 + 五层架构 + 目录结构）
│   ├── low-code-platform.md     低代码平台架构设计（数据存储 + 表单/字段/规则 + 路线图）
│   └── data-model.md            数据模型与本体定义（PostgreSQL + Neo4j）
│
├── development/                 ← 开发指南
│   ├── backend.md               后端开发指南（含安全鉴权）
│   ├── frontend.md              前端开发指南
│   └── api-reference.md         API 接口参考
│
├── operations/                  ← 运维部署
│   ├── deployment.md            部署与运行（Docker 生产环境）
│   └── testing.md               测试指南
│
├── business/                    ← 业务文档
│   ├── user-guide.md            用户手册与演示指南
│   └── integration.md           外部系统集成指南
│
└── archive/                     ← 已归档
    ├── 05-部署指南.md            被 operations/deployment.md 替代
    ├── 06-开发者指南.md           被 development/backend.md 替代
    └── 17-审计变更记录.md         历史 changelog
```

---

## 快速导航

| 你想做什么 | 看哪个文件 |
|-----------|-----------|
| 了解项目整体架构 | `architecture/overview.md` |
| 了解低代码平台设计 | `architecture/low-code-platform.md` |
| 了解数据库设计 | `architecture/data-model.md` |
| 写后端代码 | `development/backend.md` |
| 写前端代码 | `development/frontend.md` |
| 查 API 接口 | `development/api-reference.md` |
| 部署到服务器 | `operations/deployment.md` |
| 写测试 | `operations/testing.md` |
| 了解业务功能 | `business/user-guide.md` |
| 对接外部系统 | `business/integration.md` |

---

## 阅读顺序

- **新人 onboarding**：overview → low-code-platform → data-model → backend/frontend
- **低代码开发**：low-code-platform → backend → api-reference
- **运维部署**：deployment → overview → backend（安全章节）
- **产品演示**：user-guide → low-code-platform
