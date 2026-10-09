# Wine Workspace Implementation Plan

> **For agentic workers:** Use native execution in this session. Steps use checkbox syntax for tracking.

**Goal:** 构建可以实际管理 Wine 的 Mac/Linux Web 应用。
**Architecture:** Bun/Hono 管理受控 WINEPREFIX 和 SQLite，Vite/React SPA 调用同源 API；Linux noVNC 通过鉴权代理接入。
**Tech Stack:** Bun, Hono, SQLite, React Router, Vite, Tailwind 4, shadcn/ui, Playwright.
**Spec:** docs/superpowers/specs/2026-10-09-wine-workspace-design.md

## Global Constraints

- 默认 loopback；公开部署要求令牌 >=16 字符和明确 origin。
- 不修改既有 Wine prefix，导入复制到 .data。
- Mac 本机窗口；Linux amd64 Docker 网页桌面。
- 子进程参数数组，日志上限 200000 字符，上传上限 256 MiB。

## Review Focus

- 目录穿越及 symlink：浏览/启动必须拒绝越界。
- Wine 不存在或架构不兼容：健康检测展示真实失败，创建不虚报成功。
- 初始化未完成、并发配置及删除：返回冲突，不破坏 prefix。
- API 重启后遗留任务：标记 interrupted，提示停止残留进程再重试。
- 跨源登录和 WebSocket：HTTP 与桌面均使用同一鉴权及 Origin 策略。

### Task 1: 持久化与 Wine 作业
**Files:** shared/types.ts, server/{config,store,paths,wine,jobs}.ts, tests/{core,jobs}.test.ts
**Interfaces:** Store.listBottles/getBottle, JobManager.start/wait, WineService.create/run/tool/stop, Config.
- [x] 写测试验证 argv/env、文件隔离、真实 fixture 进程与重启恢复，执行并确认失败。
- [x] 实现数据库、路径校验、Wine 检测及任务生命周期。
- [x] `bun test tests` 通过对应测试。

### Task 2: API 与部署
**Files:** server/{auth,app,index,desktop}.ts, scripts/dev.ts, Dockerfile, compose.yaml, deploy/, tests/api.test.ts
**Interfaces:** createApp(config, store, wine, auth): Hono; cookie 会话及统一鉴权。
- [x] 写 API 行为测试，验证 CRUD、upload、配置冲突、Origin 与登录，执行并确认失败。
- [x] 实现 API、SPA fallback、Linux 桌面代理、部署和文档。
- [x] `bun test tests` 全部通过。

### Task 3: Web 交互与端到端
**Files:** src/{main,app,styles}, src/components/, src/pages/, src/lib/, e2e/, playwright.config.ts, README.md
**Interfaces:** /api/state, /api/bottles, /api/jobs, /api/auth, /desktop/*。
- [x] 写浏览器流程测试并确认无页面时失败。
- [x] 实现响应式 Web、空状态、错误提示及真实操作。
- [x] `bun run check` 和 `bun run test:e2e` 通过；浏览器检查截图与网络错误。
- [x] 自审危险路径和功能完整性，记录主机 Wine/Docker 验证限制。

验证详情：`docs/verification.md`。Linux 真实 Wine 初始化/记事本进程和 noVNC 握手通过；最终 Mac Wine 恢复可执行后，原生 Wine 11.16 的初始化、记事本启动和停止也通过。
