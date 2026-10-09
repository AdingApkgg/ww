# 验证记录

日期：2026-10-09 至 2026-10-10（Asia/Shanghai）。实现与测试使用 Bun 1.4.2。

## 已通过

- `bun run check`：TypeScript、19 个 Bun 测试（70 个断言）、Vite 生产构建。
- `bun run test:e2e`：2 个 Playwright 测试，覆盖完整创建/上传/运行/日志流程，以及 390px 移动端布局和导航。
- `bun run test:desktop`：真实 HTTP/socket 验证未登录拒绝、登录会话、跨源拒绝、双向二进制 WebSocket 代理。
- Docker Compose 配置解析。
- 人工浏览器检查：首页、环境诊断、空状态和响应式导航。

测试数据均使用独立临时目录；Web 端到端测试使用执行于子进程的 Wine fixture，不冒充真实 Wine 验证。

## 代码审查

独立审查发现并修复了导入链接可能回指源 prefix、异步路径检查期间启动/删除竞态、任务上限阻止停止操作、派生进程保留输出管道导致超时不结束的问题。对应回归测试均已通过。

## 平台验证

最初 Mac 的 `/opt/homebrew/bin/wine` 与 `wineserver` 报 `EBADARCH` / `bad CPU type in executable`，页面正确显示不可用。最终检查时现有 Wine 已恢复可执行，显示 Wine 11.16；本任务未安装或修改系统 Wine、Rosetta，也未操作既有 prefix。

随后在隔离的临时数据目录补做 Mac 原生验证：通过相同 WineService 成功初始化 win64 prefix、写入 Windows 10 配置（退出码 0）、启动记事本任务并确认运行状态、成功执行 Wineserver 停止。测试 prefix 与数据库已自动清理，正式工作空间仍为空。

Linux amd64 镜像已在 Apple Silicon / OrbStack 的 amd64 模拟环境构建成功并实际运行。Wine 9.0、Wineserver、Winetricks 检测成功；未登录 API 被拒绝，生产 SPA 子路由可刷新，noVNC 页面通过鉴权 HTTP 代理返回，WebSocket 收到真实 `RFB 003.008` 握手。

通过真实 API 创建 win64 prefix、写入 Windows 10 注册表配置并获得初始化成功状态/退出码 0。注册并启动 `windows/system32/notepad.exe` 后确认真实记事本进程存在。随后 API 调用 `wineserver -k` 成功，退出码 0。此 prefix 占用约 1.3 GB；最初验证使用的 1 GB tmpfs 不足，已改为随测试容器退出自动删除的磁盘卷。验证容器及匿名数据卷已清理，保留最终 `wine-workspace:local` 镜像。

容量不足测试还暴露了日志管道写入失败产生未处理异步异常的问题。已先用回归测试复现，再修复为终止该任务，并在数据库无法保存失败状态时写服务日志，避免 API 因这一任务异常退出。19 个测试与最终镜像构建均在修复后重新通过。

容器 GUI 未作人工截图确认：当前内置浏览器拒绝加载该测试端口。验证确认的是真实 Wine 初始化、记事本进程和 noVNC 网络协议连接，不代表所有 Windows 应用/游戏均兼容。
