import { expect, spyOn, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fixture } from './helpers'
import { JobManager } from '../server/jobs'
import { WineService } from '../server/wine'

const input = { name: '游戏', description: '', category: 'gaming' as const, color: 'fern' as const, windows: 'win10' as const }
test('log storage failures are handled without an unhandled task rejection', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store)
  const bottle = ctx.store.addBottle(input)
  const append = ctx.store.appendLog.bind(ctx.store)
  let outputSeen = false
  ctx.store.appendLog = (id, text) => { if (text.includes('"args"')) { outputSeen = true; throw new Error('database or disk is full') }; append(id, text) }
  const finish = spyOn(ctx.store, 'finishJob').mockImplementation(() => { throw new Error('database or disk is full') })
  const error = spyOn(console, 'error').mockImplementation(() => {})
  try {
    const job = jobs.start(bottle.id, 'run', [{ argv: [ctx.config.wineBin, 'slow.exe'] }], { env: process.env, timeout: 1000 })
    await jobs.wait(job.id)
    expect(outputSeen).toBe(true)
    expect(jobs.busy(bottle.id)).toBe(false)
    expect(error).toHaveBeenCalled()
  } finally { finish.mockRestore(); error.mockRestore(); await jobs.shutdown(); await ctx.cleanup() }
})
test('initialization and program launch use separate WINEPREFIX and preserve argv', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const { bottle, job } = await wine.create(input); await jobs.wait(job.id)
    expect(ctx.store.getBottle(bottle.id).status).toBe('ready')
    expect(ctx.store.getJob(job.id).status).toBe('succeeded')
    const program = await wine.register(bottle.id, { name: 'Example', path: 'Program Files/Example.exe', args: ['a b', ';echo unsafe'] })
    const launch = await wine.run(program.id); await jobs.wait(launch.id)
    const log = ctx.store.getJob(launch.id).log
    expect(log).toContain('a b'); expect(log).toContain(';echo unsafe')
    expect(log).toContain(wine.prefix(bottle.id)); expect(ctx.store.getJob(launch.id).exitCode).toBe(0)
    expect((await wine.health()).wine.available).toBe(true)
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('nonzero exit preserves stderr and reports failed rather than success', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const { bottle, job } = await wine.create(input); await jobs.wait(job.id)
    await writeFile(join(wine.prefix(bottle.id), 'drive_c', 'failure.exe'), 'fixture')
    const program = await wine.register(bottle.id, { name: 'Failure', path: 'failure.exe', args: [] })
    const launch = await wine.run(program.id); await jobs.wait(launch.id)
    expect(ctx.store.getJob(launch.id).status).toBe('failed')
    expect(ctx.store.getJob(launch.id).exitCode).toBe(17)
    expect(ctx.store.getJob(launch.id).log).toContain('fixture failure')
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('active jobs prevent deletion and stopping is limited to one bottle', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  try {
    const { bottle, job } = await wine.create(input); await jobs.wait(job.id)
    await writeFile(join(wine.prefix(bottle.id), 'drive_c', 'slow.exe'), 'fixture')
    const program = await wine.register(bottle.id, { name: 'Slow', path: 'slow.exe', args: [] })
    const launch = await wine.run(program.id)
    await expect(wine.remove(bottle.id)).rejects.toThrow('任务')
    const stop = await wine.stop(bottle.id); await jobs.wait(stop.id); await jobs.wait(launch.id)
    expect(ctx.store.getJob(launch.id).status).toBe('cancelled')
    expect(ctx.store.getJob(stop.id).log).toContain(wine.prefix(bottle.id))
  } finally { await jobs.shutdown(); await ctx.cleanup() }
})

test('import copies an existing prefix without changing its source', async () => {
  const ctx = await fixture(); const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs)
  const source = `${ctx.dir}-source`
  try {
    await mkdir(join(source, 'drive_c'), { recursive: true }); await writeFile(join(source, 'system.reg'), 'old registry')
    const { bottle, job } = await wine.import(input, source); await jobs.wait(job.id)
    expect(ctx.store.getBottle(bottle.id).status).toBe('ready')
    expect(await Bun.file(join(source, 'system.reg')).text()).toBe('old registry')
    expect(wine.prefix(bottle.id)).not.toBe(source)
    expect(ctx.store.getJob(job.id).log).toContain('HKCU')
    expect(ctx.store.getJob(job.id).log).toContain('win10')
  } finally { await jobs.shutdown(); await ctx.cleanup(); await rm(source, { recursive: true, force: true }) }
})
