import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Config } from './config'
import { AppError } from './errors'

export class Auth {
  private sessions = new Map<string, number>()
  private failures: number[] = []
  constructor(private config: Config) {}
  private origins() {
    if (this.config.origin) return [this.config.origin]
    const ports = this.config.dev ? [this.config.port, Number(process.env.WW_WEB_PORT || 5173)] : [this.config.port]
    return ports.flatMap(port => [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`])
  }
  surface(req: Request, websocket = false) {
    const url = new URL(req.url)
    if (!this.origins().some(origin => new URL(origin).host === url.host)) return Response.json({ error: '不允许的主机，请检查 WW_ORIGIN' }, { status: 403 })
    const origin = req.headers.get('origin')
    if ((origin && !this.origins().includes(origin)) || ((!['GET', 'HEAD'].includes(req.method) || websocket) && !origin)) return Response.json({ error: '请求来源不受信任' }, { status: 403 })
    return null
  }
  private sessionId(req: Request) { return /(?:^|;\s*)ww_session=([a-f0-9]+)/.exec(req.headers.get('cookie') || '')?.[1] }
  authenticated(req: Request) {
    if (!this.config.adminToken) return true
    const id = this.sessionId(req); if (!id) return false
    const expiry = this.sessions.get(id); if (!expiry || expiry < Date.now()) { this.sessions.delete(id); return false }
    return true
  }
  authorize(req: Request, websocket = false) {
    const rejected = this.surface(req, websocket); if (rejected) return rejected
    if (!this.authenticated(req)) return Response.json({ error: '请先登录管理后台' }, { status: 401 })
    return null
  }
  login(token: string) {
    this.failures = this.failures.filter(time => Date.now() - time < 60000)
    if (this.failures.length >= 10) throw new AppError('尝试次数过多，请一分钟后重试', 429)
    const digest = (value: string) => createHash('sha256').update(value).digest()
    if (!this.config.adminToken || !timingSafeEqual(digest(token), digest(this.config.adminToken))) { this.failures.push(Date.now()); throw new AppError('管理员令牌不正确', 401) }
    for (const [id, expiry] of this.sessions) if (expiry < Date.now()) this.sessions.delete(id)
    if (this.sessions.size >= 100) this.sessions.delete(this.sessions.keys().next().value!)
    const id = randomBytes(32).toString('hex'); this.sessions.set(id, Date.now() + 12 * 3600000)
    return this.cookie(id, 12 * 3600)
  }
  logout(req: Request) { const id = this.sessionId(req); if (id) this.sessions.delete(id); return this.cookie('', 0) }
  private cookie(value: string, maxAge: number) { return `ww_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${this.config.origin?.startsWith('https:') ? '; Secure' : ''}` }
}
