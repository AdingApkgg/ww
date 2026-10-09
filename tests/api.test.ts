import { expect, test } from 'bun:test'
import { fixture } from './helpers'
import { JobManager } from '../server/jobs'
import { WineService } from '../server/wine'
import { Auth } from '../server/auth'
import { createApp } from '../server/app'

const input = { name: 'Web Bottle', description: 'test', category: 'work', color: 'blue', windows: 'win10' }
async function setup(secret = '') {
  const ctx = await fixture(); ctx.config.adminToken = secret
  const jobs = new JobManager(ctx.store); const wine = new WineService(ctx.config, ctx.store, jobs); const auth = new Auth(ctx.config)
  const app = createApp(ctx.config, ctx.store, wine, auth)
  const call = (path: string, init: RequestInit = {}) => app.request(`http://127.0.0.1:4387${path}`, { ...init, headers: { Origin: 'http://127.0.0.1:4387', ...init.headers } })
  return { ...ctx, jobs, wine, app, call, cleanup: async () => { await jobs.shutdown(); await ctx.cleanup() } }
}
test('API creates a bottle, uploads a program, launches it, and persists logs', async () => {
  const ctx = await setup()
  try {
    const response = await ctx.call('/api/bottles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    expect(response.status).toBe(201)
    const { bottle, job } = await response.json(); await ctx.jobs.wait(job.id)
    const data = new FormData(); data.set('file', new File(['fixture'], 'test.exe')); data.set('name', 'Test Program')
    const upload = await ctx.call(`/api/bottles/${bottle.id}/upload`, { method: 'POST', body: data })
    expect(upload.status).toBe(201); const program = await upload.json()
    const run = await ctx.call(`/api/programs/${program.id}/run`, { method: 'POST' }); expect(run.status).toBe(202)
    const launched = await run.json(); await ctx.jobs.wait(launched.id)
    const log = await (await ctx.call(`/api/jobs/${launched.id}`)).json(); expect(log.log).toContain('operation complete')
    const state = await (await ctx.call('/api/state')).json(); expect(state.bottles).toHaveLength(1); expect(state.programs).toHaveLength(1)
    const deleted = await ctx.call(`/api/bottles/${bottle.id}`, { method: 'DELETE' }); expect(deleted.status).toBe(200)
    expect(ctx.store.listPrograms()).toHaveLength(0)
  } finally { await ctx.cleanup() }
})

test('validates inputs and blocks arbitrary tools and dependency commands', async () => {
  const ctx = await setup()
  try {
    const invalid = await ctx.call('/api/bottles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, name: ' ' }) })
    expect(invalid.status).toBe(400)
    const { bottle, job } = await (await ctx.call('/api/bottles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).json()
    await ctx.jobs.wait(job.id)
    const unknown = await ctx.call(`/api/bottles/${bottle.id}/tools`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: 'sh' }) })
    expect(unknown.status).toBe(400)
    const traverse = await ctx.call(`/api/bottles/${bottle.id}/files?path=${encodeURIComponent('../system.reg')}`)
    expect(traverse.status).toBe(400)
    const file = new FormData(); file.set('file', new File(['test'], 'evil.sh'))
    expect((await ctx.call(`/api/bottles/${bottle.id}/upload`, { method: 'POST', body: file })).status).toBe(400)
  } finally { await ctx.cleanup() }
})

test('login protects state and desktop, rejects foreign origin and forged host', async () => {
  const ctx = await setup('correct-password-123')
  try {
    expect((await ctx.call('/api/state')).status).toBe(401)
    expect((await ctx.call('/desktop/vnc.html')).status).toBe(401)
    const login = await ctx.call('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'correct-password-123' }) })
    expect(login.status).toBe(200)
    const cookie = login.headers.get('set-cookie')!; expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('SameSite=Strict')
    expect((await ctx.call('/api/state', { headers: { Cookie: cookie } })).status).toBe(200)
    const foreign = await ctx.app.request('http://127.0.0.1:4387/api/bottles', { method: 'POST', headers: { Origin: 'https://evil.example', Cookie: cookie } })
    expect(foreign.status).toBe(403)
    expect((await ctx.app.request('http://evil.example:4387/api/auth')).status).toBe(403)
    expect((await ctx.call('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status).toBe(200)
    expect((await ctx.call('/api/state', { headers: { Cookie: cookie } })).status).toBe(401)
  } finally { await ctx.cleanup() }
})
