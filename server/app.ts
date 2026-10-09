import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z, ZodError } from 'zod'
import { join } from 'node:path'
import { stat } from 'node:fs/promises'
import type { Config } from './config'
import type { Store } from './store'
import type { WineService } from './wine'
import type { Auth } from './auth'
import { AppError } from './errors'
import { safePath } from './paths'

const name = z.string().trim().min(1, '请输入名称').max(80, '名称不能超过 80 字符')
const bottleSchema = z.object({ name, description: z.string().max(500).default(''), category: z.enum(['gaming', 'work', 'other']).default('other'), color: z.enum(['fern', 'amber', 'blue', 'rose']).default('fern'), windows: z.enum(['win10', 'win11', 'win7']).default('win10') })
const programSchema = z.object({ name, path: z.string().min(1).max(2000), args: z.array(z.string().max(4000).refine(x => !x.includes('\0'))).max(50).default([]) })

export function createApp(config: Config, store: Store, wine: WineService, auth: Auth) {
  const app = new Hono()
  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff'); c.header('Referrer-Policy', 'same-origin'); c.header('Content-Security-Policy', "frame-ancestors 'self'")
    const rejected = auth.surface(c.req.raw); if (rejected) return rejected
    await next()
  })
  app.use('/api/*', bodyLimit({ maxSize: 258 * 1024 * 1024, onError: c => c.json({ error: '上传内容超过 256 MiB' }, 413) }))
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    if (['/api/auth', '/api/auth/login'].includes(c.req.path)) return next()
    const rejected = auth.authorize(c.req.raw); if (rejected) return rejected
    await next()
  })
  app.get('/api/auth', c => c.json({ authenticated: auth.authenticated(c.req.raw), authRequired: !!config.adminToken }))
  app.post('/api/auth/login', async c => {
    const { token } = z.object({ token: z.string().max(1024) }).parse(await c.req.json())
    c.header('Set-Cookie', auth.login(token)); return c.json({ ok: true })
  })
  app.post('/api/auth/logout', c => { c.header('Set-Cookie', auth.logout(c.req.raw)); return c.json({ ok: true }) })
  app.get('/api/state', async c => c.json({ bottles: store.listBottles(), programs: store.listPrograms(), jobs: store.listJobs().slice(0, 200).map(({ log, ...job }) => job), health: await wine.health() }))
  app.post('/api/health/recheck', async c => c.json(await wine.health(true)))
  app.post('/api/bottles', async c => c.json(await wine.create(bottleSchema.parse(await c.req.json())), 201))
  app.post('/api/bottles/import', async c => {
    const data = bottleSchema.extend({ source: z.string().min(1).max(2000) }).parse(await c.req.json())
    const { source, ...input } = data; return c.json(await wine.import(input, source), 201)
  })
  app.patch('/api/bottles/:id', async c => {
    const patch = bottleSchema.omit({ windows: true }).partial().extend({ favorite: z.boolean().optional() }).strict().parse(await c.req.json())
    return c.json(store.updateBottle(c.req.param('id'), patch))
  })
  app.delete('/api/bottles/:id', async c => { await wine.remove(c.req.param('id')); return c.json({ ok: true }) })
  app.post('/api/bottles/:id/initialize', c => c.json(wine.initialize(c.req.param('id')), 202))
  app.post('/api/bottles/:id/stop', c => c.json(wine.stop(c.req.param('id')), 202))
  app.post('/api/bottles/:id/tools', async c => {
    const { tool } = z.object({ tool: z.enum(['winecfg', 'regedit', 'uninstaller']) }).parse(await c.req.json())
    return c.json(wine.tool(c.req.param('id'), tool), 202)
  })
  app.post('/api/bottles/:id/windows', async c => {
    const { windows } = z.object({ windows: z.enum(['win10', 'win11', 'win7']) }).parse(await c.req.json())
    return c.json(wine.setWindows(c.req.param('id'), windows), 202)
  })
  app.post('/api/bottles/:id/dependencies', async c => {
    const { dependency } = z.object({ dependency: z.string().max(40) }).parse(await c.req.json())
    return c.json(wine.install(c.req.param('id'), dependency), 202)
  })
  app.get('/api/bottles/:id/files', async c => c.json(await wine.files(c.req.param('id'), c.req.query('path') || '')))
  app.post('/api/bottles/:id/programs', async c => c.json(await wine.register(c.req.param('id'), programSchema.parse(await c.req.json())), 201))
  app.post('/api/bottles/:id/upload', async c => {
    const data = await c.req.formData(); const file = data.get('file')
    if (!(file instanceof File)) throw new AppError('请选择要上传的文件')
    const title = name.parse(data.get('name') || file.name.replace(/\.(exe|msi)$/i, ''))
    return c.json(await wine.upload(c.req.param('id'), file, title), 201)
  })
  app.post('/api/programs/:id/run', async c => c.json(await wine.run(c.req.param('id')), 202))
  app.delete('/api/programs/:id', c => { store.deleteProgram(c.req.param('id')); return c.json({ ok: true }) })
  app.get('/api/jobs/:id', c => c.json(store.getJob(c.req.param('id'))))
  app.get('/desktop/*', async c => {
    const rejected = auth.authorize(c.req.raw); if (rejected) return rejected
    if (!config.desktopUrl) throw new AppError('此主机没有配置网页桌面', 503)
    if (c.req.path === '/desktop/websockify') return c.json({ error: '需要 WebSocket 连接' }, 426)
    const url = new URL(c.req.url); const target = new URL(config.desktopUrl)
    target.pathname = url.pathname.slice('/desktop'.length); target.search = url.search
    try {
      const result = await fetch(target, { redirect: 'error', signal: AbortSignal.timeout(10000) })
      return new Response(result.body, { status: result.status, headers: { 'Content-Type': result.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store' } })
    } catch { throw new AppError('网页桌面服务不可用，请检查 noVNC', 502) }
  })
  app.get('*', async c => {
    if (c.req.path.startsWith('/api/')) return c.json({ error: 'API 不存在' }, 404)
    try {
      const path = await safePath(config.distDir, decodeURIComponent(c.req.path.slice(1)))
      if ((await stat(path)).isFile()) return new Response(Bun.file(path))
    } catch { /* SPA routes fall back to the index; only managed dist files can be served. */ }
    const index = Bun.file(join(config.distDir, 'index.html'))
    if (!(await index.exists())) return c.text('前端尚未构建。开发请访问 http://localhost:5173；生产请先运行 bun run build。', 503)
    return new Response(index, { headers: { 'Cache-Control': 'no-cache' } })
  })
  app.onError((error, c) => {
    if (error instanceof ZodError) return c.json({ error: error.issues[0]?.message || '输入格式不正确' }, 400)
    if (error instanceof AppError) return c.json({ error: error.message }, error.status as 400)
    if (error instanceof SyntaxError) return c.json({ error: '请求格式不正确' }, 400)
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return c.json({ error: '找不到文件或目录' }, 404)
    if (code === 'EACCES' || code === 'EPERM') return c.json({ error: '主机没有访问该路径的权限' }, 403)
    console.error('[Wine Workspace]', error)
    return c.json({ error: '操作失败，请检查服务端日志' }, 500)
  })
  return app
}
