import type { Subprocess } from 'bun'
import type { Store } from './store'
import { AppError } from './errors'

interface Command { argv: string[]; cwd?: string }
interface Options { env: Record<string, string | undefined>; timeout?: number; before?: () => Promise<void>; success?: () => void; failure?: () => void }
interface Active { bottleId: string; kind: string; proc?: Subprocess<'ignore', 'pipe', 'pipe'>; abort?: () => void; cancelled: boolean; done: Promise<void> }

export class JobManager {
  private active = new Map<string, Active>()
  constructor(private store: Store) {}
  busy(bottleId: string) { return [...this.active.values()].some(x => x.bottleId === bottleId) }
  exclusive(bottleId: string) { return [...this.active.values()].some(x => x.bottleId === bottleId && x.kind !== 'run') }
  start(bottleId: string, kind: string, commands: Command[], options: Options) {
    if (kind === 'stop' && [...this.active.values()].some(job => job.bottleId === bottleId && job.kind === 'stop')) throw new AppError('Bottle 正在停止，请稍后重试', 409)
    if (kind !== 'stop' && this.active.size >= 12) throw new AppError('同时运行的任务过多，请稍后重试', 409)
    const job = this.store.addJob(bottleId, kind, commands.flatMap(x => x.argv))
    const active: Active = { bottleId, kind, cancelled: false, done: Promise.resolve() }
    this.active.set(job.id, active)
    // Reserve synchronously before performing any asynchronous filesystem/process work.
    active.done = this.execute(job.id, active, commands, options)
    return job
  }
  private async pipe(id: string, stream: ReadableStream<Uint8Array>, signal: AbortSignal) {
    const reader = stream.getReader(); const decoder = new TextDecoder()
    const cancel = () => { void reader.cancel().catch(() => {}) }
    signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel()
    try {
      while (true) { const { value, done } = await reader.read(); if (done) break; this.store.appendLog(id, decoder.decode(value, { stream: true })) }
      const tail = decoder.decode(); if (tail) this.store.appendLog(id, tail)
    } finally { signal.removeEventListener('abort', cancel); reader.releaseLock() }
  }
  private terminate(active: Active) {
    if (active.proc) {
      try { process.kill(-active.proc.pid, 'SIGKILL') } catch { active.proc.kill('SIGKILL') }
    }
    active.abort?.()
  }
  private async execute(id: string, active: Active, commands: Command[], options: Options) {
    let code: number | null = null; let timer: ReturnType<typeof setTimeout> | undefined; let timedOut = false
    try {
      this.store.appendLog(id, `[${new Date().toLocaleString('zh-CN')}] ${active.kind}\nWINEPREFIX=${options.env.WINEPREFIX}\n`)
      if (options.before) await options.before()
      for (const command of commands) {
        if (active.cancelled) break
        this.store.appendLog(id, `$ ${command.argv.map(x => JSON.stringify(x)).join(' ')}\n`)
        active.proc = Bun.spawn(command.argv, { env: options.env, cwd: command.cwd, detached: true, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
        const streams = new AbortController(); active.abort = () => streams.abort()
        if (options.timeout) timer = setTimeout(() => { timedOut = true; this.terminate(active) }, options.timeout)
        // Attach the failure handler immediately: pipe/storage errors can precede process exit.
        const output = Promise.all([this.pipe(id, active.proc.stdout, streams.signal), this.pipe(id, active.proc.stderr, streams.signal)])
          .then(() => null, error => { this.terminate(active); return error })
        const exitCode = await active.proc.exited; clearTimeout(timer)
        // Detached Windows children may retain pipes after the launcher exits; never wait forever for EOF.
        const drain = setTimeout(() => streams.abort(), 250)
        let outputError: unknown
        try { outputError = await output } finally { clearTimeout(drain) }
        active.proc = undefined; active.abort = undefined; code = exitCode
        if (outputError) throw outputError
        if (timedOut) throw new Error('命令执行超时；请停止 bottle 进程后重试')
        if (active.cancelled) break
        if (exitCode !== 0) throw new Error(`命令退出码 ${exitCode}`)
      }
      if (active.cancelled) {
        options.failure?.(); this.store.finishJob(id, 'cancelled', code, '\n[任务已停止]\n')
      } else {
        options.success?.(); this.store.finishJob(id, 'succeeded', code ?? 0, '\n[任务完成]\n')
      }
    } catch (error) {
      try {
        options.failure?.()
        this.store.finishJob(id, active.cancelled ? 'cancelled' : 'failed', code, `\n[${error instanceof Error ? error.message : String(error)}]\n`)
      } catch (storageError) {
        // A full/unwritable database cannot record the failure, but must not crash the API.
        console.error('[Wine Workspace] 无法保存任务状态，请检查数据目录空间与权限', error, storageError)
      }
    } finally { clearTimeout(timer); this.active.delete(id) }
  }
  async wait(id: string) { await this.active.get(id)?.done; return this.store.getJob(id) }
  cancelBottle(bottleId: string, exceptId?: string) {
    for (const [id, active] of this.active) if (active.bottleId === bottleId && id !== exceptId) { active.cancelled = true; this.terminate(active) }
  }
  async shutdown() {
    const running = [...this.active.values()]
    for (const active of running) { active.cancelled = true; this.terminate(active) }
    await Promise.all(running.map(x => x.done))
  }
}
