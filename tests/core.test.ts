import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Store } from '../server/store'
import { safePath } from '../server/paths'
import { loadConfig } from '../server/config'

const dirs: string[] = []
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })
async function temp() { const dir = await mkdtemp(join(tmpdir(), 'ww-test-')); dirs.push(dir); return dir }

test('file browser rejects traversal and symlinks outside drive_c', async () => {
  const dir = await temp(); await mkdir(join(dir, 'drive_c')); await writeFile(join(dir, 'outside.exe'), 'secret')
  await symlink(join(dir, 'outside.exe'), join(dir, 'drive_c', 'escape.exe'))
  expect(await safePath(join(dir, 'drive_c'), '')).toBe(await realpath(join(dir, 'drive_c')))
  await expect(safePath(join(dir, 'drive_c'), '../outside.exe')).rejects.toThrow()
  await expect(safePath(join(dir, 'drive_c'), 'escape.exe')).rejects.toThrow()
  await expect(safePath(join(dir, 'drive_c'), '/tmp/file')).rejects.toThrow()
})

test('SQLite preserves bottles and recovers unfinished jobs after restart', async () => {
  const path = join(await temp(), 'db.sqlite'); const store = new Store(path)
  const bottle = store.addBottle({ name: '测试 Bottle', description: '', category: 'gaming', color: 'fern', windows: 'win10' })
  const job = store.addJob(bottle.id, 'initialize', ['wine', 'wineboot', '--init'])
  store.appendLog(job.id, 'initializing'); store.close()
  const restored = new Store(path)
  expect(restored.getBottle(bottle.id).name).toBe('测试 Bottle')
  expect(restored.getBottle(bottle.id).status).toBe('interrupted')
  expect(restored.getJob(job.id).status).toBe('interrupted')
  expect(restored.getJob(job.id).log).toContain('initializing')
  restored.close()
})

test('public binding requires an admin secret and explicit origin', () => {
  expect(() => loadConfig({ WW_HOST: '0.0.0.0' })).toThrow()
  expect(() => loadConfig({ WW_HOST: '0.0.0.0', WW_ADMIN_TOKEN: '0123456789abcdef' })).toThrow()
  expect(loadConfig({ WW_HOST: '0.0.0.0', WW_ADMIN_TOKEN: '0123456789abcdef', WW_ORIGIN: 'https://wine.example.com' }).host).toBe('0.0.0.0')
  expect(loadConfig({}).host).toBe('127.0.0.1')
})
