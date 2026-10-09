import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Box, Check, Cpu, ExternalLink, FolderOpen, LoaderCircle, Maximize2, Monitor, RefreshCw, Search, Server, ShieldCheck, TerminalSquare, Wine, X } from 'lucide-react'
import { useOperation, useWorkspace } from '@/lib/workspace'
import { post } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogDialog } from '@/components/dialogs'
import { ProgramCard, JobTable } from './bottle'
import type { Probe } from '../../shared/types'

export function LibraryPage() {
  const { state } = useWorkspace(); const [query, setQuery] = useState(''); if (!state) return null
  const programs = state.programs.filter(program => `${program.name} ${state.bottles.find(b => b.id === program.bottleId)?.name}`.toLowerCase().includes(query.toLowerCase()))
  return <><div className="page-heading"><div><div className="eyebrow">ALL YOUR APPS, TOGETHER</div><h1>程序库<span className="heading-count">{state.programs.length}</span></h1><p>所有 Bottle 的程序，在这里相遇。</p></div></div><div className="section-toolbar"><p className="muted">{programs.length} 个程序</p><div className="search-field"><Search size={15}/><Input aria-label="搜索程序" placeholder="搜索程序或 Bottle…" value={query} onChange={event => setQuery(event.target.value)}/></div></div>{programs.length ? <div className="program-grid">{programs.map(program => { const bottle = state.bottles.find(b => b.id === program.bottleId); return <ProgramCard key={program.id} program={program} bottleName={bottle?.name} ready={bottle?.status === 'ready'}/> })}</div> : <div className="empty-state"><Box size={34}/><h2>{query ? '没有找到匹配的程序' : '你的程序库还是空的'}</h2><p>{query ? '试试其他关键词。' : '打开一个 Bottle，上传安装包或添加程序快捷方式。'}</p><Button variant="outline" asChild><Link to="/">前往我的 Bottles<ArrowUpRight/></Link></Button></div>}</>
}

export function JobsPage() {
  const { state } = useWorkspace(); const [filter, setFilter] = useState('all'); const [logId, setLogId] = useState<string | null>(null); if (!state) return null
  const jobs = state.jobs.filter(job => filter === 'all' || job.status === filter || filter === 'failed' && job.status === 'interrupted')
  return <><div className="page-heading"><div><div className="eyebrow">A CLEAR VIEW OF WHAT'S HAPPENING</div><h1>任务中心</h1><p>每一次启动、配置和安装，都有迹可循。</p></div><span className="soft-badge"><RefreshCw size={13}/>自动更新</span></div><div className="section-toolbar"><div className="filter-tabs">{[['all', '全部任务'], ['running', '运行中'], ['succeeded', '已完成'], ['failed', '需要处理'], ['cancelled', '已停止']].map(([key, label]) => <button className={filter === key ? 'active' : ''} key={key} onClick={() => setFilter(key)}>{label}</button>)}</div><span className="muted text-xs">最近 {state.jobs.length} 条</span></div><JobTable jobs={jobs} onLog={setLogId} showBottle/><p className="field-note mt-4">这里显示最近 200 个任务。程序启动任务记录 Wine 启动进程的状态；停止 Bottle 会关闭该环境中的全部 Wine 进程。</p><LogDialog id={logId} onClose={() => setLogId(null)}/></>
}

export function DesktopPage() {
  const { state } = useWorkspace(); const [revision, setRevision] = useState(0); const container = useRef<HTMLDivElement>(null)
  if (!state) return null
  const desktopUrl = '/desktop/vnc.html?autoconnect=1&resize=remote&path=desktop/websockify'
  return <><div className="page-heading"><div><div className="eyebrow">YOUR WINDOWS, FROM ANYWHERE</div><h1>远程桌面</h1><p>在浏览器里，操作运行于 Linux 主机的 Windows 程序。</p></div>{state.health.desktop && <div className="flex gap-2"><Button variant="outline" onClick={() => setRevision(revision + 1)}><RefreshCw/>重新连接</Button><Button variant="outline" asChild><a href={desktopUrl} target="_blank" rel="noreferrer"><ExternalLink/>独立窗口</a></Button></div>}</div>{state.health.desktop ? <><div ref={container} className="desktop-frame"><div className="desktop-bar"><span><span className="connection-dot"/>网页桌面已配置</span><button aria-label="全屏桌面" onClick={() => void container.current?.requestFullscreen().catch(() => toast.error('浏览器不允许进入全屏'))}><Maximize2 size={17}/></button></div><iframe key={revision} src={desktopUrl} title="Wine 远程桌面" allow="fullscreen; clipboard-read; clipboard-write"/></div><p className="field-note mt-4">这台主机上的 Bottles 共用一个桌面。会话由管理后台统一鉴权；可在 Bottle 的配置页启动 Wine 配置和注册表工具。</p></> : <><div className="desktop-empty"><div className="desktop-illustration"><div className="illustration-screen"><Wine size={45}/><span>Wine Workspace</span></div><div className="illustration-stand"/></div><h2>{state.health.platform === 'darwin' ? 'Mac 上，窗口在你的桌面里' : '给这台主机连接一个桌面'}</h2><p>{state.health.platform === 'darwin' ? '从 Bottle 启动的程序和 Wine 工具，会显示在 Mac 的本机桌面。' : '当前主机尚未配置 noVNC，程序窗口会显示在主机的图形会话。'}<br/>Linux Docker 部署内置网页桌面，可直接在这里操作。</p><Button variant="outline" asChild><Link to="/environment">查看部署与运行环境<ArrowUpRight/></Link></Button></div><div className="desktop-notes"><div><Monitor size={22}/><h3>Mac 本机使用</h3><p>直接管理安装在 Mac 上的 Wine，享受本机窗口的体验。</p></div><div><Server size={22}/><h3>Linux 网页桌面</h3><p>Docker 内置 Wine、虚拟显示与 noVNC，只公开管理后台端口。</p></div><div><ShieldCheck size={22}/><h3>统一会话</h3><p>网页桌面的 HTTP 和 WebSocket 使用同一套管理后台登录。</p></div></div></>}</>
}

export function EnvironmentPage() {
  const { state } = useWorkspace(); const { pending, perform } = useOperation(); if (!state) return null
  const health = state.health
  return <><div className="page-heading"><div><div className="eyebrow">THE ENGINE BEHIND YOUR BOTTLES</div><h1>运行环境</h1><p>检查这台主机上的 Wine，以及工作空间的连接状态。</p></div><Button variant="outline" disabled={pending} onClick={() => void perform(() => post('/health/recheck'), '运行环境已重新检测')}>{pending ? <LoaderCircle className="animate-spin"/> : <RefreshCw/>}重新检测</Button></div>
    <div className="host-summary"><span className="host-summary-icon"><Cpu size={29}/></span><div><strong>{health.platform === 'darwin' ? 'macOS' : health.platform} 主机</strong><p>{health.arch} <span>·</span> {health.desktop ? '已配置网页桌面' : '本机窗口模式'}</p></div><span className="soft-badge"><ShieldCheck size={14}/>{health.authRequired ? '管理员令牌鉴权' : '本机访问'}</span></div>
    <div className="runtime-grid"><RuntimeCard name="Wine" description="Windows 应用兼容层" probe={health.wine}/><RuntimeCard name="Wineserver" description="Bottle 进程与会话管理" probe={health.wineserver}/><RuntimeCard name="Winetricks" description="常用依赖安装工具" probe={health.winetricks}/></div>
    {!health.wine.available && <div className="notice environment-notice"><span className="notice-icon">!</span><div><strong>先让 Wine 在主机上正常运行</strong><span>{/CPU|exec format|architecture|ENOEXEC/i.test(health.wine.error || '') ? '当前 Wine 二进制与主机运行环境不兼容。请检查 CPU 架构以及 Wine 的安装方式，再重新检测。' : '安装适用于此主机的 Wine，并检查可执行路径。运行环境就绪后，再初始化 Bottle。'}</span></div></div>}
    <div className="settings-stack"><section className="settings-card"><div className="section-heading"><div><h2>工作空间数据</h2><p>Bottle、程序记录和任务日志都保存在这个目录。</p></div><FolderOpen size={21}/></div><code className="data-directory">{health.dataDir}</code><div className="environment-info"><span>Prefix</span><code>bottles/&lt;id&gt;/</code><span>数据库</span><code>workspace.sqlite</code></div></section>
      <section className="settings-card"><div className="section-heading"><div><h2>部署方式</h2><p>同一个管理器，适配两种使用方式。</p></div></div><div className="deployment-grid"><div><Monitor size={21}/><h3>Mac / 本机</h3><p>安装 Wine 后使用 Bun 启动项目。应用与工具窗口在本机桌面打开。</p><span className="soft-badge">Bun + 原生 Wine</span></div><div><Server size={21}/><h3>Linux / Docker</h3><p>项目的 Docker Compose 内置 Wine 和网页桌面。首次部署需设置管理员令牌与访问地址。</p><span className="soft-badge">Linux amd64 + noVNC</span></div></div><p className="field-note mt-5">详细启动命令、环境变量及自定义 Wine 路径见项目 README。切换 Wine 版本前，建议先备份数据目录。</p></section>
    </div>
  </>
}
function RuntimeCard({ name, description, probe }: { name: string; description: string; probe: Probe }) {
  return <article className="runtime-card"><div className="runtime-card-header"><span className={probe.available ? 'runtime-good' : 'runtime-bad'}>{probe.available ? <Check size={15}/> : <X size={15}/>}</span><span>{probe.available ? '可用' : '不可用'}</span></div><h2>{name}</h2><p>{description}</p><code>{probe.path}</code><div className="runtime-version">{probe.available ? probe.version || '版本检测完成' : probe.error}</div></article>
}
