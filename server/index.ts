import { join } from 'node:path'
import { loadConfig } from './config'
import { Store } from './store'
import { JobManager } from './jobs'
import { WineService } from './wine'
import { Auth } from './auth'
import { createApp } from './app'
import { desktopHandler, type DesktopSocket } from './desktop'

const config = loadConfig(); const store = new Store(join(config.dataDir, 'workspace.sqlite'))
const jobs = new JobManager(store); const wine = new WineService(config, store, jobs); const auth = new Auth(config)
const app = createApp(config, store, wine, auth)
const server = Bun.serve<DesktopSocket>({
  hostname: config.host, port: config.port, maxRequestBodySize: 258 * 1024 * 1024, idleTimeout: 60,
  async fetch(req, server) {
    if (new URL(req.url).pathname === '/desktop/websockify' && req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const rejected = auth.authorize(req, true); if (rejected) return rejected
      if (!config.desktopUrl) return Response.json({ error: '未配置网页桌面' }, { status: 503 })
      const target = new URL('/websockify', config.desktopUrl); target.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:'
      if (server.upgrade(req, { data: { target: target.href, pending: [], buffered: 0 }, headers: { 'Sec-WebSocket-Protocol': 'binary' } })) return
      return new Response('无法升级 WebSocket', { status: 400 })
    }
    return app.fetch(req)
  },
  websocket: desktopHandler,
})
console.log(`Wine Workspace API: http://${config.host}:${server.port}`)
let closing = false
async function shutdown() {
  if (closing) return; closing = true; server.stop(true)
  await jobs.shutdown(); store.close(); process.exit(0)
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown)
