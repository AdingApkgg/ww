import { resolve } from 'node:path'

export interface Config {
  host: string; port: number; dataDir: string; wineBin: string; wineserverBin: string; winetricksBin: string
  adminToken: string; origin: string | null; desktopUrl: string | null; distDir: string; dev: boolean
}
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const host = env.WW_HOST || '127.0.0.1'
  const adminToken = env.WW_ADMIN_TOKEN || ''
  const origin = env.WW_ORIGIN ? new URL(env.WW_ORIGIN).origin : null
  const local = ['127.0.0.1', 'localhost', '::1'].includes(host)
  if (adminToken && adminToken.length < 16) throw new Error('WW_ADMIN_TOKEN 至少需要 16 个字符')
  if (!local && (!adminToken || !origin)) throw new Error('公开监听需要 WW_ADMIN_TOKEN（至少 16 字符）和 WW_ORIGIN')
  const port = Number(env.WW_PORT || 4387)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WW_PORT 无效')
  const wineBin = env.WW_WINE_BIN || 'wine'
  // Custom Wine runners must use their own matching wineserver.
  const companion = wineBin.includes('/') ? resolve(wineBin, '..', 'wineserver') : 'wineserver'
  const desktopUrl = env.WW_DESKTOP_URL ? new URL(env.WW_DESKTOP_URL).origin : null
  if (desktopUrl && !['http:', 'https:'].includes(new URL(desktopUrl).protocol)) throw new Error('桌面地址必须使用 HTTP(S)')
  return { host, port, adminToken, origin, desktopUrl, wineBin, wineserverBin: env.WW_WINESERVER_BIN || companion,
    winetricksBin: env.WW_WINETRICKS_BIN || 'winetricks', dataDir: resolve(env.WW_DATA_DIR || '.data'),
    distDir: resolve('dist'), dev: env.NODE_ENV !== 'production' }
}
