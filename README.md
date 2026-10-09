# Wine Workspace

一个类似 Whisky 使用方式的 Web Wine 管理器。通过网页管理真正运行于主机上的 Wine prefix、程序、工具、依赖和日志。

前端参考本机其他项目：**Bun + Vite + React Router + React 19 + Tailwind CSS 4 + shadcn/ui**。后端为 **Hono + Bun SQLite**，单项目 TypeScript，无外部数据库。

## 支持的功能

- 创建独立的 64 位 Bottle，选择 Windows 10 / 11 / 7。
- 复制导入已有 Wine prefix，编辑名称/备注/用途/颜色，收藏、搜索和删除。
- 上传 `.exe` / `.msi`（最大 256 MiB），浏览 C: 盘并添加已有程序快捷方式。
- 启动程序，支持每行一个启动参数；MSI 使用 `wine msiexec /i`。
- 启动 Wine 配置、注册表编辑器和卸载工具。
- 安装精选 Winetricks 依赖：VC++ 2022、核心字体、DirectX 9、.NET 4.8。
- 查看持久化任务日志、退出码、失败状态，停止指定 Bottle 的全部 Wine 进程。
- Mac 本机窗口；Linux Docker 内置 noVNC 网页桌面与鉴权代理。
- 默认本机访问；公开监听需令牌和明确访问地址，Cookie 会话有效期 12 小时。

## Mac / 原生 Linux

需要 Bun 1.4.2+，以及可以正常执行的 `wine` 和匹配版本的 `wineserver`。安装依赖功能还需要 `winetricks`。先验证 `wine --version` 和 `wineserver --version`，不要跳过 Wine 本身的架构/安装检查。

```sh
bun install
bun run dev
```

打开 **http://localhost:5173**。开发 API 默认监听 `127.0.0.1:4387`。Mac 上启动的程序和 Wine 工具显示在 Mac 桌面。

生产模式：

```sh
bun run build
NODE_ENV=production bun run start
```

打开 **http://localhost:4387**。构建产物、API、登录和桌面由同一个服务托管，直接刷新子页面也可使用。

### 使用自定义 Wine

复制 `.env.example` 为 `.env`，按需设置：

```dotenv
WW_WINE_BIN=/absolute/path/to/wine
WW_WINESERVER_BIN=/absolute/path/to/matching/wineserver
WW_WINETRICKS_BIN=/absolute/path/to/winetricks
WW_DATA_DIR=/absolute/path/to/wine-workspace-data
```

指定 Wine 完整路径时，默认选择同目录的 `wineserver`，也可显式覆盖。必须使用匹配的 Wine/Wineserver；不同 runner 的兼容性（包括 Whisky Wine、GPTK 或 CrossOver）需由实际安装版本验证。项目不自动安装或下载 runner、DXVK、D3DMetal 或 Rosetta。

Apple Silicon 上若出现 `bad CPU type in executable`，先修复 Wine 二进制与架构/运行环境的兼容性。这个 Web 管理器不会绕过 Wine 自身的限制。

## Linux Docker + 网页桌面

镜像目标为 **Linux amd64**。内置 Wine、Xvfb、Fluxbox、x11vnc、noVNC；仅公开管理 API 端口，VNC 和 noVNC 监听容器内 loopback。Apple Silicon 上 Compose 会请求 amd64 模拟运行，性能和 Wine 可用性取决于虚拟化环境；推荐 amd64 Linux 主机。

```sh
cp .env.example .env
# 在 .env 设置至少 16 字符的随机 WW_ADMIN_TOKEN。
# WW_ORIGIN 填浏览器的完整 origin，例如 http://localhost:4387。
docker compose up -d --build
```

打开配置的 `WW_ORIGIN`，输入管理员令牌，创建 Bottle 后进入「远程桌面」。首次 Wine 初始化若出现 Mono/Gecko 安装提示，可在网页桌面完成。

远程部署时：

- 配置 `WW_BIND_ADDRESS=0.0.0.0`，或保留 loopback 由反向代理转发。
- `WW_ORIGIN` 填唯一的外部访问 origin，例如 `https://wine.example.com`。`localhost` 与 `127.0.0.1` 是不同 origin。
- 反向代理保留原始 `Host`，并为 `/desktop/websockify` 转发 WebSocket Upgrade。
- HTTPS origin 会启用 Secure Cookie；不要将 HTTPS origin 用于直接 HTTP 访问。
- 本机开发使用令牌时，`WW_ORIGIN` 应填 `http://localhost:5173`（开发页面地址）。

## 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `WW_HOST` | `127.0.0.1` | API 监听地址 |
| `WW_PORT` | `4387` | API / 生产网页端口 |
| `WW_WEB_PORT` | `5173` | Vite 开发网页端口 |
| `WW_DATA_DIR` | `.data` | 数据目录，默认相对当前启动目录 |
| `WW_WINE_BIN` | `wine` | Wine 可执行文件 |
| `WW_WINESERVER_BIN` | `wineserver` 或 runner 同目录 | 匹配的 Wineserver |
| `WW_WINETRICKS_BIN` | `winetricks` | Winetricks 可执行文件 |
| `WW_ADMIN_TOKEN` | 无 | 管理员令牌，设置时至少 16 字符 |
| `WW_ORIGIN` | 本机 origin | 浏览器访问地址；公开监听必须显式设置 |
| `WW_DESKTOP_URL` | 无 | 内部 noVNC HTTP origin，如 `http://127.0.0.1:6080` |

原生部署使用已存在的 noVNC 服务时，设置 `WW_DESKTOP_URL`，其 WebSocket 必须位于 `/websockify`。Bun 统一代理静态资源与 WebSocket，无需在浏览器暴露内部地址。

## 数据与操作语义

```
.data/
  workspace.sqlite       # Bottle、程序与任务记录
  workspace.sqlite-wal   # SQLite WAL（运行期间）
  bottles/<uuid>/        # 独立 WINEPREFIX
```

程序快捷方式的路径相对 Bottle 的 `drive_c`；上传文件位于 `drive_c/WW-Uploads/`。文件浏览、快捷方式注册和启动拒绝符号链接及越界路径。导入要求普通 `drive_c` 目录和 `system.reg` 文件，复制保留相对链接，指向源 prefix 内部的绝对链接会改指向副本。导入后首次启动可能触发 Wine 更新，因此建议选择兼容的 runner。

导入时选择的 Windows 版本会写入副本的 Wine 注册表；源 prefix 保持原样。复制和注册表设置完成后，Bottle 才会显示为就绪。

运行任务记录 Wine 启动进程的生命周期。某些 Windows 程序会派生进程后退出启动器，所以任务成功不等于所有窗口都关闭；「停止进程」始终使用指定 WINEPREFIX 的 `wineserver -k`。删除前也会停止该 prefix 的 Wineserver，停止失败时保留数据。初始化失败后可先停止进程再重试。

初始化命令超时 3 分钟、注册表命令超时 1 分钟、依赖安装超时 30 分钟。超时后若 Wine 派生进程仍存在，请在 Bottle 页停止该环境的全部进程。服务重启会将未完成任务标为「已中断」，不会将它们伪装为运行中。日志每任务保留最近 200,000 字符；任务页展示最新 200 条，数据库保留历史。

Bottle 是 Wine 配置与依赖的独立环境，运行的 Windows 程序仍具有服务账户的文件访问权限；Docker 使用非 root 的 `wine` 账户运行 Wine 和 Web API。备份应在服务停止后复制整个数据目录（Docker 为 `wine-data` 卷），包含 SQLite 与所有 prefix。

## 开发验证

```sh
bun run check
bun run test:e2e
bun run test:desktop
```

Bun 测试使用独立临时目录及实际执行的测试 fixture，覆盖 CRUD、参数隔离、非零退出、重启恢复、跨源请求、会话、符号链接和目录边界。Playwright 使用独立临时数据、4389 API 端口与 5199 网页端口，覆盖完整创建/上传/运行/日志流程与移动布局。

`bun run test:desktop` 使用独立的真实 socket 服务验证桌面 HTTP 鉴权、外部 Origin 拦截和登录后的二进制 WebSocket 转发。

如本机没有 Playwright 浏览器：`bunx playwright install chromium`。macOS 会优先使用已有 Playwright Chromium，也可设置 `WW_CHROMIUM_PATH`。

代码目录：`server/` 为服务端，`shared/` 为共享类型，`src/` 为 Web UI，`deploy/` 为 Linux 桌面进程配置。设计和实施记录位于 `docs/superpowers/`。

## 许可证

Copyright (C) 2026 AdingApkgg。

本项目采用 [GNU Affero General Public License v3.0](LICENSE)（`AGPL-3.0-only`）。
