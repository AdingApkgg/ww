import { expect } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../server/config'
import { Store } from '../server/store'
import { Auth } from '../server/auth'
import { WineService } from '../server/wine'
import { JobManager } from '../server/jobs'
import { createApp } from '../server/app'
import { desktopHandler, type DesktopSocket } from '../server/desktop'

// Real sockets, isolated data, and an echo upstream exercise the authenticated noVNC transport.
const directory = await mkdtemp(join(tmpdir(), 'ww-desktop-'))
const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(req, server) {
  if (new URL(req.url).pathname === '/websockify' && server.upgrade(req, { headers: { 'Sec-WebSocket-Protocol': 'binary' } })) return
  return new Response('<html><body>Desktop fixture</body></html>', { headers: { 'Content-Type': 'text/html' } })
}, websocket: { message(ws, message) { ws.send(message) } } })
const config = loadConfig({ WW_DATA_DIR: directory, WW_ADMIN_TOKEN: 'desktop-test-secret', WW_DESKTOP_URL: `http://127.0.0.1:${upstream.port}` })
const store = new Store(join(directory, 'db.sqlite')); const jobs = new JobManager(store)
const auth = new Auth(config); const app = createApp(config, store, new WineService(config, store, jobs), auth)
const server = Bun.serve<DesktopSocket>({ hostname: '127.0.0.1', port: 0, fetch(req, server) {
  if (new URL(req.url).pathname === '/desktop/websockify' && req.headers.get('upgrade') === 'websocket') {
    const rejected = auth.authorize(req, true); if (rejected) return rejected
    if (server.upgrade(req, { data: { target: `ws://127.0.0.1:${upstream.port}/websockify`, pending: [], buffered: 0 }, headers: { 'Sec-WebSocket-Protocol': 'binary' } })) return
  }
  return app.fetch(req)
}, websocket: desktopHandler })
if (!server.port) throw new Error('测试服务未绑定 TCP 端口')
config.port = server.port
const origin = `http://127.0.0.1:${server.port}`
let socket: WebSocket | undefined
try {
  expect((await fetch(`${origin}/desktop/vnc.html`)).status).toBe(401)
  const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'desktop-test-secret' }) })
  expect(login.status).toBe(200); const cookie = login.headers.get('set-cookie')!.split(';')[0]
  const html = await fetch(`${origin}/desktop/vnc.html`, { headers: { Cookie: cookie } }); expect(await html.text()).toContain('Desktop fixture')
  const forged = await fetch(`${origin}/desktop/websockify`, { headers: { Origin: 'https://evil.example', Cookie: cookie, Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' } })
  expect(forged.status).toBe(403)
  // DOM types omit Bun's documented custom-header constructor extension.
  const BunSocket = WebSocket as unknown as { new(url: string, options: Bun.WebSocketOptions): WebSocket }
  socket = new BunSocket(`${origin.replace('http:', 'ws:')}/desktop/websockify`, { protocols: ['binary'], headers: { Origin: origin, Cookie: cookie } })
  socket.binaryType = 'arraybuffer'
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('桌面 WebSocket 超时')), 5000)
    socket!.onopen = () => socket!.send(new Uint8Array([82, 70, 66, 0, 255]))
    socket!.onmessage = event => { try { expect([...new Uint8Array(event.data)]).toEqual([82, 70, 66, 0, 255]); clearTimeout(timeout); resolve() } catch (error) { clearTimeout(timeout); reject(error) } }
    socket!.onerror = () => { clearTimeout(timeout); reject(new Error('桌面 WebSocket 连接失败')) }
  })
  console.log('Desktop transport: HTTP auth, foreign origin rejection, authenticated binary WebSocket forwarding passed.')
} finally { socket?.close(); server.stop(true); upstream.stop(true); await jobs.shutdown(); store.close(); await rm(directory, { recursive: true, force: true }) }
