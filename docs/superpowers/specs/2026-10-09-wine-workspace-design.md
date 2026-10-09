# Wine Workspace 设计

用户希望通过 Web 获得类似 Whisky 的 Wine 管理体验，前端参考 ~/Code 的 Bun、Vite、React Router、shadcn/ui 项目；Mac 和 Linux 均需支持。用户授权其余技术选择由开发者决定。

## 架构与范围

单项目 TypeScript：Vite SPA + React Router，Hono API 由 Bun 托管，SQLite 持久化 bottle、程序快捷方式与任务日志。选择本机 agent 架构，因为 Wine 命令和程序窗口需要运行在主机。纯静态前端无法控制 Wine；将所有平台强制装入容器也无法提供自然的 Mac 本机窗口体验。

Bottle 使用受管理数据目录内的独立 WINEPREFIX。支持创建、复制导入既有 prefix（不更改原目录）、编辑元数据、删除、程序上传/浏览注册/启动、winecfg/regedit/uninstaller、Windows 版本、精选 winetricks 依赖、停止 bottle 全部进程与任务日志。任务状态持久化，重启后标记未完成任务为 interrupted，不能虚报仍在运行。初始化失败保留 bottle 与日志并可重试。

Mac 使用已安装的 Wine，窗口显示于 Mac 桌面；不自行安装 Wine 或 Rosetta。Linux Docker 镜像使用 Wine + Xvfb + Fluxbox + x11vnc + noVNC，网页内嵌共享桌面。容器仅公开 API 端口，桌面 HTTP/WebSocket 通过同一会话鉴权代理。Linux amd64 是首个容器目标，Apple Silicon 不承诺通过 Docker 模拟获得可用游戏性能。

## 安全与错误

默认仅监听 127.0.0.1；公开监听必须设置至少 16 字符管理员令牌与明确的外部 origin。登录使用 HttpOnly SameSite cookie。主机/Origin 验证防止跨站命令调用和 DNS rebinding。没有通用 shell 接口，子进程通过参数数组启动。文件浏览拒绝越界与 symlink，上传只保存到受管理目录。删除仅作用于受管理副本，运行中的 bottle 禁止删除。命令输出限长，初始化和配置命令设超时。显示真实 Wine 检测失败及诊断，空库显示引导，不添加演示 bottle。

## 界面

中文，浅色石灰背景、深绿强调，桌面侧栏与响应式移动导航。页面包括 bottle 卡片列表、搜索与筛选、详情（程序/配置/文件/日志）、程序库、任务中心、远程桌面及主机信息。所有按钮对应已实现 API；加载、失败、空结果、提交中及删除确认均可见。

## 验证

Bun 测试覆盖命令参数、Wine prefix 隔离、真实子进程成功/失败、日志、重启恢复、文件边界、鉴权、Origin、并发及 API CRUD。测试使用独立的临时 prefix 与可执行 fixture，不操作现有 Wine 环境。Playwright 覆盖创建、文件上传、启动/任务日志和导航。TypeScript 与生产构建必须通过。当前主机 Wine 报 bad CPU type，所以实际 Windows 应用启动需在兼容 Wine 主机继续验证；Docker 如无 daemon 则明确说明未运行。
