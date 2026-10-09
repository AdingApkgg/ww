import { useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router'
import { ArrowUpRight, Box, ChevronRight, CircleHelp, Layers3, LoaderCircle, LogOut, Monitor, Settings2, ShieldCheck, TerminalSquare, Wine } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace'
import { post } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BottleDialog } from '@/components/dialogs'
import { BottlesPage } from '@/pages/bottles'
import { BottlePage } from '@/pages/bottle'
import { LibraryPage, JobsPage, DesktopPage, EnvironmentPage } from '@/pages/tools'
import { BottleArt } from '@/components/bottle-art'

const navigation = [ { path: '/', name: '我的 Bottles', icon: Layers3 }, { path: '/library', name: '程序库', icon: Box }, { path: '/jobs', name: '任务中心', icon: TerminalSquare }, { path: '/desktop', name: '远程桌面', icon: Monitor }, { path: '/environment', name: '运行环境', icon: Settings2 } ]
export function App() {
  const { authenticated, state, error, checkAuth, refresh, authRequired, logout } = useWorkspace()
  const [createOpen, setCreateOpen] = useState(false); const location = useLocation()
  if (authenticated === false) return <Login/>
  if (authenticated === null || !state) return <div className="boot"><Wine size={36}/><h1>Wine Workspace</h1>{error ? <><p>{error}</p><Button onClick={() => void (authenticated === null ? checkAuth() : refresh())}>重新连接</Button></> : <p className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin"/>正在连接你的工作空间…</p>}</div>
  const active = state.jobs.filter(job => job.status === 'running').length
  const current = navigation.find(item => item.path === location.pathname)?.name || 'Bottle 详情'
  return <div className="app-shell">
    <aside className="sidebar"><Link to="/" className="brand"><span className="brand-mark"><Wine size={23}/></span><span>Wine<span className="brand-sub">WORKSPACE</span></span></Link>
      <div className="workspace-selector"><div className="workspace-avatar">W</div><div><strong>我的工作空间</strong><span>{state.health.platform === 'darwin' ? 'Mac' : 'Linux'} · 本机管理</span></div><ShieldCheck size={16}/></div>
      <span className="nav-caption">工作空间</span><nav className="nav-links">{navigation.map(({ path, name, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18}/><span>{name}</span>{path === '/' && <small>{state.bottles.length}</small>}{path === '/jobs' && active > 0 && <small className="live-count">{active}</small>}</NavLink>)}</nav>
      <div className="sidebar-guide"><span className="guide-icon"><CircleHelp size={18}/></span><strong>一个应用，一个空间</strong><p>把游戏、工具和它们的依赖放进各自的 Bottle。</p><Link to="/environment">查看运行环境 <ArrowUpRight size={14}/></Link></div>
      <div className="sidebar-footer"><span className={`connection-dot ${state.health.wine.available ? '' : 'warning'}`}/><div><strong>{state.health.wine.available ? 'Wine 已连接' : 'Wine 需要配置'}</strong><span>Wine Workspace v0.1.0</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><span>工作空间</span><ChevronRight size={13}/><span>{current}</span></div><div className="topbar-right"><Link to="/environment" className="host-pill"><span className={`connection-dot ${state.health.wine.available ? '' : 'warning'}`}/>{state.health.platform === 'darwin' ? 'macOS' : 'Linux'} <span className="muted">{state.health.arch}</span></Link>{authRequired && <Button variant="ghost" size="icon" aria-label="退出登录" onClick={() => void logout()}><LogOut/></Button>}</div></header>
      {error && <div className="connection-banner">连接异常：{error}<button onClick={() => void refresh()}>重试</button></div>}
      <main className="page"><Routes><Route path="/" element={<BottlesPage onCreate={() => setCreateOpen(true)}/>}/><Route path="/bottles/:id/*" element={<BottlePage/>}/><Route path="/library" element={<LibraryPage/>}/><Route path="/jobs" element={<JobsPage/>}/><Route path="/desktop" element={<DesktopPage/>}/><Route path="/environment" element={<EnvironmentPage/>}/><Route path="*" element={<div className="empty-state"><h1>页面不存在</h1><Button asChild><Link to="/">返回工作空间</Link></Button></div>}/></Routes></main>
      <footer className="page-footer"><span>给 Windows 应用，留一点空间。</span><span>运行于你的主机 <span className="mx-2">·</span> Wine Workspace</span></footer>
    </div>
    <nav className="mobile-nav">{navigation.map(({ path, name, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'}><Icon size={20}/><span>{name}</span></NavLink>)}</nav>
    <BottleDialog open={createOpen} onOpenChange={setCreateOpen}/>
  </div>
}
function Login() {
  const { checkAuth } = useWorkspace(); const [pending, setPending] = useState(false); const [token, setToken] = useState('')
  return <div className="login-page"><div className="login-art"><BottleArt/><p>A little room<br/><em>for Windows.</em></p></div><form className="login-card" onSubmit={async event => { event.preventDefault(); setPending(true); try { await post('/auth/login', { token }); await checkAuth() } catch (error) { toast.error((error as Error).message) } finally { setPending(false) } }}><span className="brand-mark"><Wine size={25}/></span><h1>欢迎回到工作空间</h1><p>输入管理员令牌，连接这台主机上的 Wine。</p><label htmlFor="admin-token">管理员令牌<Input id="admin-token" type="password" value={token} onChange={event => setToken(event.target.value)} required autoComplete="current-password"/></label><Button className="w-full" disabled={pending}>{pending && <LoaderCircle className="animate-spin"/>}连接工作空间</Button><small><ShieldCheck size={14}/>令牌仅用于此主机的管理后台</small></form></div>
}
