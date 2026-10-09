import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
const data = await mkdtemp(join(tmpdir(), 'ww-e2e-')); const fixture = resolve('tests/fixtures/wine.ts'); await chmod(fixture, 0o755)
const proc = Bun.spawn(['bun', 'scripts/dev.ts'], { env: { ...process.env, WW_DATA_DIR: data, WW_PORT: '4389', WW_WEB_PORT: '5199', WW_WINE_BIN: fixture, WW_WINESERVER_BIN: fixture, WW_WINETRICKS_BIN: fixture, WW_ADMIN_TOKEN: '', WW_ORIGIN: '', WW_HOST: '127.0.0.1', WW_DESKTOP_URL: '' }, stdout: 'inherit', stderr: 'inherit' })
let closing = false
async function close() { if (closing) return; closing = true; proc.kill('SIGTERM'); await proc.exited; await rm(data, { recursive: true, force: true }); process.exit(0) }
process.on('SIGINT', close); process.on('SIGTERM', close)
await proc.exited; await close()
