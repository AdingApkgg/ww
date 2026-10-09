import { useEffect, useId, useState, type FormEvent } from 'react'
import { Copy, FileUp, FolderOpen, LoaderCircle, Plus, Wine } from 'lucide-react'
import { toast } from 'sonner'
import type { Bottle, BottleColor, BottleInput, Job, Program } from '../../shared/types'
import { api, post } from '@/lib/api'
import { useOperation } from '@/lib/workspace'
import { cn, jobLabels } from '@/lib/utils'
import { Button } from './ui/button'
import { Input, Select, Textarea } from './ui/input'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Status } from './status'

export function BottleDialog({ open, onOpenChange, bottle }: { open: boolean; onOpenChange: (value: boolean) => void; bottle?: Bottle }) {
  const [mode, setMode] = useState<'create' | 'import'>('create'); const [color, setColor] = useState<BottleColor>('fern')
  const { pending, perform } = useOperation(); const id = useId()
  useEffect(() => { if (open) { setMode('create'); setColor(bottle?.color || 'fern') } }, [open, bottle])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    const input: BottleInput = { name: String(form.get('name')).trim(), description: String(form.get('description') || ''), color, category: form.get('category') as BottleInput['category'], windows: form.get('windows') as BottleInput['windows'] || 'win10' }
    const result = await perform(() => bottle ? api(`/bottles/${bottle.id}`, { method: 'PATCH', body: JSON.stringify({ name: input.name, description: input.description, color, category: input.category }) }) : post(mode === 'import' ? '/bottles/import' : '/bottles', mode === 'import' ? { ...input, source: form.get('source') } : input), bottle ? 'Bottle 已更新' : mode === 'import' ? '已开始复制导入，可在任务中心查看进度' : '已开始初始化，可在任务中心查看进度')
    if (result) onOpenChange(false)
  }
  return <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}><DialogContent>
    <div className="dialog-icon"><Wine size={23}/></div><DialogTitle className="dialog-title">{bottle ? '编辑 Bottle' : '给应用一个新空间'}</DialogTitle>
    <DialogDescription className="dialog-description">{bottle ? '为这个空间取一个容易找到的名字。' : '每个 Bottle 都是独立的 Windows 环境，互不打扰。'}</DialogDescription>
    {!bottle && <div className="segmented mt-5"><button className={mode === 'create' ? 'selected' : ''} onClick={() => setMode('create')}><Plus size={14}/>新建</button><button className={mode === 'import' ? 'selected' : ''} onClick={() => setMode('import')}><FolderOpen size={14}/>导入已有 Prefix</button></div>}
    <form key={`${bottle?.id}-${mode}`} onSubmit={submit} className="form-stack mt-5">
      <label htmlFor={`${id}-name`}>Bottle 名称<Input id={`${id}-name`} name="name" placeholder="例如：我的游戏空间" defaultValue={bottle?.name} maxLength={80} required autoFocus/></label>
      {mode === 'import' && <label htmlFor={`${id}-source`}>主机上的 Prefix 路径<Input id={`${id}-source`} name="source" placeholder="/home/user/.wine" required/><span className="field-note">输入服务端的目录。导入会复制一份，原目录保持不变。</span></label>}
      <div className="form-row"><label htmlFor={`${id}-category`}>用途<Select id={`${id}-category`} name="category" defaultValue={bottle?.category || 'gaming'}><option value="gaming">游戏</option><option value="work">工作</option><option value="other">其他</option></Select></label>{!bottle && <label htmlFor={`${id}-windows`}>Windows 版本<Select id={`${id}-windows`} name="windows" defaultValue="win10"><option value="win10">Windows 10</option><option value="win11">Windows 11</option><option value="win7">Windows 7</option></Select></label>}</div>
      <label htmlFor={`${id}-description`}>备注 <span className="optional">可选</span><Textarea id={`${id}-description`} name="description" placeholder="记下这个空间的用途…" defaultValue={bottle?.description} maxLength={500}/></label>
      <div><span className="field-label">标记颜色</span><div className="swatches">{(['fern', 'amber', 'blue', 'rose'] as const).map((item, i) => <button type="button" aria-label={['苔绿', '琥珀', '雾蓝', '玫瑰'][i]} aria-pressed={color === item} onClick={() => setColor(item)} key={item} className={cn('swatch', item, color === item && 'chosen')}/>)}</div></div>
      {!bottle && <p className="field-note">64 位环境 · 使用主机已安装的 Wine{mode === 'create' ? ' · 首次初始化可能需要几分钟' : ''}</p>}
      <div className="dialog-footer"><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>取消</Button><Button disabled={pending}>{pending ? <LoaderCircle className="animate-spin"/> : <Plus/>}{bottle ? '保存修改' : mode === 'import' ? '复制并导入' : '创建 Bottle'}</Button></div>
    </form>
  </DialogContent></Dialog>
}

export function ProgramDialog({ open, onOpenChange, bottleId, initialPath = '' }: { open: boolean; onOpenChange: (value: boolean) => void; bottleId: string; initialPath?: string }) {
  const [mode, setMode] = useState<'upload' | 'path'>('upload'); const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState(''); const { pending, perform } = useOperation(); const id = useId()
  useEffect(() => { if (open) { setMode(initialPath ? 'path' : 'upload'); setFile(null); setName(initialPath.split('/').at(-1)?.replace(/\.(exe|msi)$/i, '') || '') } }, [open, initialPath])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    if (mode === 'upload' && !file) { toast.error('请选择程序文件'); return }
    const data = new FormData(); if (file) data.set('file', file); data.set('name', name.trim())
    const result = await perform(() => post<Program>(`/bottles/${bottleId}/${mode === 'upload' ? 'upload' : 'programs'}`, mode === 'upload' ? data : { name: name.trim(), path: form.get('path'), args: String(form.get('args') || '').split('\n').filter(Boolean) }), '程序已添加')
    if (result) onOpenChange(false)
  }
  return <Dialog open={open} onOpenChange={pending ? undefined : onOpenChange}><DialogContent>
    <div className="dialog-icon"><FileUp size={23}/></div><DialogTitle className="dialog-title">添加程序</DialogTitle><DialogDescription className="dialog-description">上传安装包，或为 C: 盘里的现有程序添加快捷方式。</DialogDescription>
    <div className="segmented mt-5"><button onClick={() => setMode('upload')} className={mode === 'upload' ? 'selected' : ''}>上传文件</button><button onClick={() => setMode('path')} className={mode === 'path' ? 'selected' : ''}>现有程序</button></div>
    <form onSubmit={submit} className="form-stack mt-5">
      {mode === 'upload' ? <label className="upload-zone" htmlFor={`${id}-file`}><FileUp size={30}/><strong>{file ? file.name : '选择 Windows 程序'}</strong><span>.exe 或 .msi，最大 256 MiB</span><Input id={`${id}-file`} aria-label="程序文件" type="file" accept=".exe,.msi" className="mt-3 file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2 file:text-primary" onChange={event => { const selected = event.target.files?.[0]; setFile(selected || null); if (selected) setName(selected.name.replace(/\.(exe|msi)$/i, '')) }}/></label> : <label htmlFor={`${id}-path`}>C: 盘内的相对路径<Input id={`${id}-path`} name="path" placeholder="Program Files/MyApp/app.exe" defaultValue={initialPath} required/><span className="field-note">也可以在「文件」页面选中程序自动填写。</span></label>}
      <label htmlFor={`${id}-name`}>程序名称<Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} required maxLength={80}/></label>
      {mode === 'path' && <label htmlFor={`${id}-args`}>启动参数 <span className="optional">可选，每行一个参数</span><Textarea id={`${id}-args`} name="args" placeholder={'--fullscreen\n--language=zh'}/></label>}
      <div className="dialog-footer"><Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>取消</Button><Button disabled={pending}>{pending && <LoaderCircle className="animate-spin"/>}{mode === 'upload' ? '上传并添加' : '添加快捷方式'}</Button></div>
    </form>
  </DialogContent></Dialog>
}

export function LogDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [job, setJob] = useState<Job | null>(null); const [error, setError] = useState('')
  useEffect(() => {
    setJob(null); setError(''); if (!id) return
    let closed = false
    const load = async () => { try { const data = await api<Job>(`/jobs/${id}`); if (!closed) setJob(data) } catch (error) { if (!closed) setError((error as Error).message) } }
    void load(); const timer = setInterval(() => void load(), 1500)
    return () => { closed = true; clearInterval(timer) }
  }, [id])
  return <Dialog open={!!id} onOpenChange={open => { if (!open) onClose() }}><DialogContent className="max-w-3xl">
    <DialogTitle className="dialog-title">{job ? jobLabels[job.kind] || job.kind : '任务日志'}</DialogTitle><DialogDescription className="dialog-description">命令输出来自主机。日志自动更新，最多保留最近 200,000 个字符。</DialogDescription>
    <div className="flex items-center justify-between gap-3 my-4">{job ? <Status status={job.status}/> : <span className="muted">正在加载…</span>}<Button size="sm" variant="outline" disabled={!job} onClick={async () => { try { await navigator.clipboard.writeText(job?.log || ''); toast.success('日志已复制') } catch { toast.error('浏览器不允许复制，请手动选择日志') } }}><Copy/>复制日志</Button></div>
    <pre className="terminal" tabIndex={0}>{error || job?.log || '等待命令输出…'}</pre>
    {job && <div className="field-note mt-3">退出码：{job.exitCode ?? '—'} <span className="mx-2">·</span>任务 ID：{job.id}</div>}
  </DialogContent></Dialog>
}

export function ConfirmDialog({ open, title, description, pending, onClose, onConfirm }: { open: boolean; title: string; description: string; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Dialog open={open} onOpenChange={value => { if (!value && !pending) onClose() }}><DialogContent><DialogTitle className="dialog-title">{title}</DialogTitle><DialogDescription className="dialog-description mt-3">{description}</DialogDescription><div className="dialog-footer mt-6"><Button variant="outline" disabled={pending} onClick={onClose}>取消</Button><Button variant="destructive" disabled={pending} onClick={onConfirm}>{pending && <LoaderCircle className="animate-spin"/>}确认删除</Button></div></DialogContent></Dialog>
}
