import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ArrowUpRight, Box, File, Folder, FolderOpen, LoaderCircle, Pencil, Play, Plus, RotateCw, Settings2, Square, TerminalSquare, Trash2, ChevronRight } from 'lucide-react'
import type { Bottle, FileEntry, Job, Program, WindowsVersion } from '../../shared/types'
import { dependencyOptions } from '../../shared/types'
import { api, post } from '@/lib/api'
import { useOperation, useWorkspace } from '@/lib/workspace'
import { bytes, categoryLabels, jobLabels, timeLabel } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Status } from '@/components/status'
import { BottleArt } from '@/components/bottle-art'
import { BottleDialog, ConfirmDialog, LogDialog, ProgramDialog } from '@/components/dialogs'

export function BottlePage() {
  const { id } = useParams(); const { state } = useWorkspace(); const navigate = useNavigate(); const { pending, perform } = useOperation()
  const [editOpen, setEditOpen] = useState(false); const [programOpen, setProgramOpen] = useState(false); const [initialPath, setInitialPath] = useState(''); const [removeOpen, setRemoveOpen] = useState(false); const [logId, setLogId] = useState<string | null>(null)
  const bottle = state?.bottles.find(bottle => bottle.id === id)
  if (!bottle || !state) return <div className="empty-state"><h1>找不到这个 Bottle</h1><Button asChild><Link to="/">返回工作空间</Link></Button></div>
  const programs = state.programs.filter(program => program.bottleId === bottle.id)
  const jobs = state.jobs.filter(job => job.bottleId === bottle.id)
  const add = (path = '') => { setInitialPath(path); setProgramOpen(true) }
  const ready = bottle.status === 'ready'
  return <>
    <Link to="/" className="back-link"><ArrowLeft size={15}/>所有 Bottles</Link>
    <div className="detail-heading"><div className={`detail-bottle-icon ${bottle.color}`}><BottleArt color={bottle.color}/></div><div className="detail-title"><div className="eyebrow">{categoryLabels[bottle.category]} / 64-BIT BOTTLE</div><h1>{bottle.name}</h1><p>{bottle.description || '每个应用，都有自己的空间。'}</p><div className="detail-meta"><Status status={bottle.status}/><span>{bottle.windows.replace('win', 'Windows ')}<i/>64-bit</span></div></div><div className="detail-actions"><Button variant="outline" onClick={() => setEditOpen(true)}><Pencil/>编辑</Button><Button variant="outline" disabled={pending} onClick={() => void perform(() => post<Job>(`/bottles/${id}/stop`), '已请求停止此 Bottle 中的全部 Wine 进程')}><Square/>停止进程</Button><Button disabled={!ready} onClick={() => add()}><Plus/>添加程序</Button></div></div>
    {!ready && <div className="notice"><span className="notice-icon">!</span><div><strong>{bottle.status === 'creating' ? '正在准备 Windows 环境' : '这个 Bottle 尚未就绪'}</strong><span>{bottle.status === 'creating' ? '首次初始化可能需要几分钟，可以在日志中查看进度。' : '先检查任务日志和运行环境，停止残留进程后重新初始化。'}</span></div>{bottle.status !== 'creating' && <Button variant="outline" size="sm" disabled={pending} onClick={async () => { const job = await perform(() => post<Job>(`/bottles/${id}/initialize`)); if (job) setLogId(job.id) }}><RotateCw/>重新初始化</Button>}</div>}
    <nav className="detail-tabs">{[{ to: '', title: '程序', icon: Box, count: programs.length }, { to: '/settings', title: '配置', icon: Settings2 }, { to: '/files', title: '文件', icon: FolderOpen }, { to: '/logs', title: '日志', icon: TerminalSquare }].map(({ to, title, icon: Icon, count }) => <NavLink key={to} to={`/bottles/${id}${to}`} end={to === ''}><Icon size={16}/>{title}{count !== undefined && <small>{count}</small>}</NavLink>)}</nav>
    <Routes><Route index element={<div><div className="section-heading"><div><h2>这个 Bottle 里的程序</h2><p>安装包和应用快捷方式，都放在这里。</p></div></div>{programs.length ? <div className="program-grid">{programs.map(program => <ProgramCard key={program.id} program={program} ready={ready}/>)}</div> : <div className="empty-state"><Box size={32}/><h2>把第一个程序放进来</h2><p>上传安装包，或从 C: 盘选取已有的 Windows 程序。</p><Button variant="outline" disabled={!ready} onClick={() => add()}><Plus/>添加程序</Button></div>}</div>}/><Route path="settings" element={<BottleSettings bottle={bottle} onJob={setLogId} onRemove={() => setRemoveOpen(true)}/>}/><Route path="files" element={<FileBrowser bottleId={bottle.id} onChoose={add}/>}/><Route path="logs" element={<JobTable jobs={jobs} onLog={setLogId}/>}/><Route path="*" element={<p className="muted">此页面不存在。</p>}/></Routes>
    <BottleDialog bottle={bottle} open={editOpen} onOpenChange={setEditOpen}/><ProgramDialog bottleId={bottle.id} open={programOpen} onOpenChange={setProgramOpen} initialPath={initialPath}/><LogDialog id={logId} onClose={() => setLogId(null)}/>
    <ConfirmDialog open={removeOpen} pending={pending} title={`删除「${bottle.name}」？`} description="这会删除受管理的 Bottle 文件、程序记录和日志。导入的原始目录不受影响。此操作无法撤销。" onClose={() => setRemoveOpen(false)} onConfirm={async () => { const result = await perform(() => api(`/bottles/${id}`, { method: 'DELETE' }), 'Bottle 已删除'); if (result) navigate('/') }}/>
  </>
}

export function ProgramCard({ program, ready = true, bottleName }: { program: Program; ready?: boolean; bottleName?: string }) {
  const { pending, perform } = useOperation(); const [removeOpen, setRemoveOpen] = useState(false)
  return <article className="program-card"><div className="program-card-top"><div className="program-icon"><Box size={23}/></div><Button variant="ghost" size="icon" aria-label={`移除 ${program.name}`} onClick={() => setRemoveOpen(true)}><Trash2 size={15}/></Button></div><h3>{program.name}</h3>{bottleName && <Link className="program-bottle-link" to={`/bottles/${program.bottleId}`}>{bottleName}<ArrowUpRight size={12}/></Link>}<p className="program-path" title={program.path}>{program.path}</p><Button variant="outline" className="w-full mt-5" disabled={pending || !ready} aria-label={`运行 ${program.name}`} onClick={() => void perform(() => post(`/programs/${program.id}/run`), '启动任务已提交，可在任务中心查看状态')}><Play size={14}/>运行程序</Button><ConfirmDialog open={removeOpen} title="移除这个快捷方式？" description="只移除程序记录，Bottle 内的程序文件会保留。" pending={pending} onClose={() => setRemoveOpen(false)} onConfirm={async () => { const result = await perform(() => api(`/programs/${program.id}`, { method: 'DELETE' }), '快捷方式已移除'); if (result) setRemoveOpen(false) }}/></article>
}

function BottleSettings({ bottle, onJob, onRemove }: { bottle: Bottle; onJob: (id: string) => void; onRemove: () => void }) {
  const { state } = useWorkspace(); const { pending, perform } = useOperation(); const [windows, setWindows] = useState<WindowsVersion>(bottle.windows)
  useEffect(() => { setWindows(bottle.windows) }, [bottle.windows])
  const ready = bottle.status === 'ready'
  async function task(path: string, data?: unknown) { const job = await perform(() => post<Job>(`/bottles/${bottle.id}/${path}`, data)); if (job) onJob(job.id) }
  return <div className="settings-stack"><section className="settings-card"><div className="section-heading"><div><h2>Windows 环境</h2><p>设置应用识别到的 Windows 版本。</p></div><Settings2 size={20}/></div><div className="setting-row"><div><strong>Windows 版本</strong><p>更改会写入这个 Bottle 的 Wine 注册表。</p></div><div className="setting-control"><Select aria-label="Windows 版本" value={windows} onChange={event => setWindows(event.target.value as WindowsVersion)}><option value="win10">Windows 10</option><option value="win11">Windows 11</option><option value="win7">Windows 7</option></Select><Button variant="outline" disabled={!ready || pending || windows === bottle.windows} onClick={() => void task('windows', { windows })}>应用</Button></div></div><div className="setting-row"><div><strong>Prefix 位置</strong><p className="path-text">{state?.health.dataDir}/bottles/{bottle.id}</p></div><span className="soft-badge">受管理目录</span></div></section>
    <section className="settings-card"><div className="section-heading"><div><h2>Wine 工具</h2><p>工具窗口{state?.health.desktop ? '会在网页远程桌面中打开' : '会在主机桌面上打开'}。</p></div></div><div className="tool-grid">{[{ id: 'winecfg', name: 'Wine 配置', description: '图形、音频、驱动器与 DLL 设置', icon: Settings2 }, { id: 'regedit', name: '注册表编辑器', description: '查看和编辑这个环境的注册表', icon: TerminalSquare }, { id: 'uninstaller', name: '卸载程序', description: '管理已安装的 Windows 软件', icon: Box }].map(({ id, name, description, icon: Icon }) => <button key={id} disabled={!ready || pending} onClick={() => void task('tools', { tool: id })}><Icon size={22}/><strong>{name}</strong><span>{description}</span><ArrowUpRight size={14}/></button>)}</div></section>
    <section className="settings-card"><div className="section-heading"><div><h2>常用依赖</h2><p>通过 Winetricks 安装，下载和安装可能需要几分钟。</p></div><span className="soft-badge">WINETRICKS</span></div>{!state?.health.winetricks.available && <p className="inline-warning">主机的 Winetricks 暂不可用，请先在运行环境页检查。</p>}{dependencyOptions.map(dependency => <div className="setting-row" key={dependency.id}><div><strong>{dependency.name}</strong><p>{dependency.description}</p></div><Button size="sm" variant="outline" disabled={!ready || pending || !state?.health.winetricks.available} onClick={() => void task('dependencies', { dependency: dependency.id })}><Plus/>安装</Button></div>)}</section>
    <section className="settings-card danger-card"><div><h2>删除 Bottle</h2><p>删除这个受管理的环境及其数据。请先停止运行中的任务。</p></div><Button variant="outline" className="text-destructive" onClick={onRemove}><Trash2/>删除 Bottle</Button></section>
  </div>
}

function FileBrowser({ bottleId, onChoose }: { bottleId: string; onChoose: (path: string) => void }) {
  const [path, setPath] = useState(''); const [files, setFiles] = useState<FileEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('')
    api<FileEntry[]>(`/bottles/${bottleId}/files?path=${encodeURIComponent(path)}`).then(files => { if (!cancelled) setFiles(files) }).catch(error => { if (!cancelled) setError(error.message) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bottleId, path, revision])
  const segments = path.split('/').filter(Boolean)
  return <section className="files-panel"><div className="section-heading"><div><h2>C: 盘文件</h2><p>浏览 Bottle 内的文件，为 .exe 或 .msi 添加快捷方式。</p></div><Button size="sm" variant="outline" onClick={() => setRevision(revision + 1)}><RotateCw/>刷新</Button></div><div className="file-breadcrumb"><button onClick={() => setPath('')}><FolderOpen size={15}/>C:</button>{segments.map((segment, index) => <span key={index}><ChevronRight size={13}/><button onClick={() => setPath(segments.slice(0, index + 1).join('/'))}>{segment}</button></span>)}</div>{loading ? <div className="empty-state compact"><LoaderCircle className="animate-spin"/><p>正在读取文件…</p></div> : error ? <div className="empty-state compact"><p>{error}</p><Button variant="outline" onClick={() => setPath('')}>返回 C: 盘</Button></div> : <div className="file-table">{path && <button className="file-row" onClick={() => setPath(segments.slice(0, -1).join('/'))}><Folder size={18}/><strong>..</strong><span>上一级目录</span></button>}{files.map(file => <div className="file-row" key={file.path}>{file.directory ? <Folder size={18} className="text-[#b59a61]"/> : <File size={18}/>}<button disabled={!file.directory} onClick={() => setPath(file.path)} className="file-name">{file.name}</button><span>{file.directory ? '文件夹' : bytes(file.size)}</span>{file.executable && <Button variant="outline" size="sm" onClick={() => onChoose(file.path)}><Plus/>添加程序</Button>}</div>)}{files.length === 0 && <p className="muted p-8 text-center">这个文件夹是空的。</p>}</div>}<p className="field-note mt-3">仅展示普通文件与目录，符号链接不开放访问。每个目录最多显示 1,000 项。</p></section>
}

export function JobTable({ jobs, onLog, showBottle = false }: { jobs: Omit<Job, 'log'>[]; onLog: (id: string) => void; showBottle?: boolean }) {
  const { state } = useWorkspace()
  if (!jobs.length) return <div className="empty-state"><TerminalSquare size={32}/><h2>这里还没有任务</h2><p>创建、配置和运行程序后的日志都会保存在这里。</p></div>
  return <div className="job-table"><div className="job-table-head"><span>任务</span><span>状态</span><span>开始时间</span><span/></div>{jobs.map(job => <div className="job-row" key={job.id}><div className="job-name"><span className={`job-icon ${job.status}`}><TerminalSquare size={17}/></span><div><strong>{jobLabels[job.kind] || job.kind}</strong>{showBottle && <Link to={`/bottles/${job.bottleId}`}>{state?.bottles.find(bottle => bottle.id === job.bottleId)?.name || 'Bottle'}</Link>}</div></div><Status status={job.status}/><time>{timeLabel(job.createdAt)}</time><Button variant="ghost" size="sm" onClick={() => onLog(job.id)}>查看日志<ChevronRight size={13}/></Button></div>)}</div>
}
