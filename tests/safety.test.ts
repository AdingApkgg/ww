import { expect, test } from 'bun:test'
import { mkdir, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fixture } from './helpers'
import { safePath } from '../server/paths'
import { WineService } from '../server/wine'
import { JobManager } from '../server/jobs'

test('rejects a symlinked drive_c root before browsing or writing an upload', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const outside = join(ctx.dir, 'outside'); await mkdir(outside)
    const bottle = ctx.store.addBottle({ name: 'Unsafe', description: '', category: 'other', color: 'fern', windows: 'win10' })
    await mkdir(wine.prefix(bottle.id), { recursive: true }); await symlink(outside, join(wine.prefix(bottle.id), 'drive_c')); ctx.store.setBottleStatus(bottle.id, 'ready')
    await expect(safePath(join(wine.prefix(bottle.id), 'drive_c'), '')).rejects.toThrow()
    await expect(wine.upload(bottle.id, new File(['fixture'], 'app.exe'), 'app')).rejects.toThrow()
    expect(await Bun.file(join(outside, 'WW-Uploads')).exists()).toBe(false)
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('import rejects a prefix whose drive_c is a link to the original environment', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs); const source = `${ctx.dir}-linked-source`
  try {
    await mkdir(source); await mkdir(join(ctx.dir, 'outside')); await symlink(join(ctx.dir, 'outside'), join(source, 'drive_c')); await writeFile(join(source, 'system.reg'), 'WINE REGISTRY')
    await expect(wine.import({ name: 'Link', description: '', category: 'other', color: 'fern', windows: 'win10' }, source)).rejects.toThrow()
    expect(ctx.store.listBottles()).toHaveLength(0)
  } finally { await jobs.shutdown(); await ctx.cleanup(); await rm(source, { recursive: true, force: true }) }
})

test('new launches cannot race a bottle deletion while Wine shutdown is in progress', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const { bottle, job } = await wine.create({ name: 'Race', description: '', category: 'other', color: 'fern', windows: 'win10' }); await jobs.wait(job.id)
    const program = await wine.register(bottle.id, { name: 'Example', path: 'Program Files/Example.exe', args: [] })
    const removing = wine.remove(bottle.id)
    await expect(wine.run(program.id)).rejects.toThrow()
    await removing
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('import rewrites absolute links through aliases back into the copied prefix', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  const source = `${ctx.dir}-alias-source`; const alias = `${ctx.dir}-alias`
  try {
    await mkdir(join(source, 'drive_c'), { recursive: true }); await mkdir(join(source, 'dosdevices'))
    await writeFile(join(source, 'system.reg'), 'original registry'); await symlink(source, alias)
    await symlink(join(alias, 'drive_c'), join(source, 'dosdevices', 'c:'))
    const { bottle, job } = await wine.import({ name: 'Alias', description: '', category: 'other', color: 'fern', windows: 'win10' }, source); await jobs.wait(job.id)
    expect(await realpath(join(wine.prefix(bottle.id), 'dosdevices', 'c:'))).toBe(await realpath(join(wine.prefix(bottle.id), 'drive_c')))
    expect(await readlink(join(source, 'dosdevices', 'c:'))).toBe(join(alias, 'drive_c'))
  } finally { await jobs.shutdown(); await ctx.cleanup(); await rm(source, { recursive: true, force: true }); await rm(alias, { force: true }) }
})

test('a full job queue still accepts stopping Wine processes', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const { bottle, job } = await wine.create({ name: 'Capacity', description: '', category: 'other', color: 'fern', windows: 'win10' }); await jobs.wait(job.id)
    await writeFile(join(wine.prefix(bottle.id), 'drive_c', 'slow.exe'), 'fixture')
    const program = await wine.register(bottle.id, { name: 'Slow', path: 'slow.exe', args: [] })
    for (let index = 0; index < 12; index++) await wine.run(program.id)
    const stop = wine.stop(bottle.id); await jobs.wait(stop.id)
    expect(ctx.store.getJob(stop.id).status).toBe('succeeded')
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('a configuration task started during path lookup blocks the pending launch', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const { bottle, job } = await wine.create({ name: 'Async', description: '', category: 'other', color: 'fern', windows: 'win10' }); await jobs.wait(job.id)
    const program = await wine.register(bottle.id, { name: 'Example', path: 'Program Files/Example.exe', args: [] })
    const launching = wine.run(program.id); const configJob = wine.setWindows(bottle.id, 'win7')
    await expect(launching).rejects.toThrow('正在配置'); await jobs.wait(configJob.id)
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('a pending upload prevents deleting the prefix underneath its writes', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const { bottle, job } = await wine.create({ name: 'Upload', description: '', category: 'other', color: 'fern', windows: 'win10' }); await jobs.wait(job.id)
    const upload = wine.upload(bottle.id, new File(['fixture'], 'upload.exe'), 'Upload')
    await expect(wine.remove(bottle.id)).rejects.toThrow('任务')
    expect((await upload).name).toBe('Upload')
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('command timeout and shutdown finish even when child processes retain stdout', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store)
  try {
    const bottle = ctx.store.addBottle({ name: 'Timeout', description: '', category: 'other', color: 'fern', windows: 'win10' })
    const start = Date.now()
    const job = jobs.start(bottle.id, 'test', [{ argv: ['/bin/sh', '-c', 'sleep 2 & wait'] }], { env: process.env, timeout: 50 })
    await jobs.wait(job.id)
    expect(Date.now() - start).toBeLessThan(1200)
    expect(ctx.store.getJob(job.id).status).toBe('failed')
    expect(ctx.store.getJob(job.id).log).toContain('超时')
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})
