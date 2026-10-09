import { cp, lstat, mkdir, readdir, readlink, realpath, rm, stat, symlink, unlink } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { BottleInput, FileEntry, Health, Probe, Program, WindowsVersion } from '../shared/types'
import { dependencyOptions } from '../shared/types'
import type { Config } from './config'
import type { Store } from './store'
import type { JobManager } from './jobs'
import { AppError } from './errors'
import { inside, safePath } from './paths'

export class WineService {
  private probeCache: { time: number; value: Promise<Health> } | null = null
  private removing = new Set<string>()
  private fileOperations = new Map<string, number>()
  constructor(public config: Config, private store: Store, public jobs: JobManager) {}
  prefix(id: string) { this.store.getBottle(id); return join(this.config.dataDir, 'bottles', id) }
  private env(id: string) { return { ...process.env, WINEPREFIX: this.prefix(id), WINEARCH: 'win64', WINEDEBUG: process.env.WINEDEBUG || 'fixme-all' } }
  private ready(id: string) {
    if (this.removing.has(id)) throw new AppError('Bottle 正在删除', 409)
    const bottle = this.store.getBottle(id)
    if (bottle.status !== 'ready') throw new AppError('Bottle 尚未就绪，请先初始化或重试', 409)
    if (this.jobs.exclusive(id)) throw new AppError('Bottle 正在配置，请等待任务完成', 409)
  }
  private idle(id: string) { this.store.getBottle(id); if (this.removing.has(id) || this.jobs.busy(id) || this.fileOperations.has(id)) throw new AppError('Bottle 有运行中的任务或文件操作，请稍后重试或先停止', 409) }
  private registry(version: WindowsVersion) { return [this.config.wineBin, 'reg', 'add', 'HKCU\\Software\\Wine', '/v', 'Version', '/t', 'REG_SZ', '/d', version, '/f'] }
  async create(input: BottleInput) {
    const bottle = this.store.addBottle(input)
    return { bottle, job: this.initialize(bottle.id) }
  }
  initialize(id: string) {
    this.idle(id); this.store.setBottleStatus(id, 'creating')
    const bottle = this.store.getBottle(id)
    try {
      return this.jobs.start(id, 'initialize', [
        { argv: [this.config.wineBin, 'wineboot', '--init'] }, { argv: this.registry(bottle.windows) },
      ], { env: this.env(id), timeout: 180000, before: () => mkdir(this.prefix(id), { recursive: true }).then(() => {}),
        success: () => this.store.setBottleStatus(id, 'ready'), failure: () => this.store.setBottleStatus(id, 'error') })
    } catch (error) { this.store.setBottleStatus(id, 'error'); throw error }
  }
  async import(input: BottleInput, sourceInput: string) {
    const source = await realpath(resolve(sourceInput))
    const managed = await realpath(this.config.dataDir)
    if (inside(source, managed) || inside(managed, source)) throw new AppError('不能导入数据目录或其父目录')
    if (!(await lstat(join(source, 'drive_c'))).isDirectory() || !(await lstat(join(source, 'system.reg'))).isFile()) throw new AppError('该目录不是独立的 Wine prefix（drive_c 和 system.reg 必须是普通目录与文件）')
    const bottle = this.store.addBottle(input)
    try {
      const job = this.jobs.start(bottle.id, 'import', [{ argv: this.registry(input.windows) }], { env: this.env(bottle.id), timeout: 180000, before: async () => {
        const destination = this.prefix(bottle.id)
        await cp(source, destination, { recursive: true, dereference: false, verbatimSymlinks: true, errorOnExist: true, force: false })
        // Absolute links into the source must point into the copy, never back at the original prefix.
        const fixLinks = async (directory: string): Promise<void> => {
          for (const entry of await readdir(directory, { withFileTypes: true })) {
            const target = join(directory, entry.name)
            if (entry.isDirectory()) await fixLinks(target)
            else if (entry.isSymbolicLink()) {
              const link = await readlink(target)
              const lexical = resolve(dirname(join(source, relative(destination, target))), link)
              const original = await realpath(lexical).catch(() => lexical)
              if (inside(source, original)) {
                const copied = join(destination, relative(source, original))
                await unlink(target); await symlink(relative(dirname(target), copied), target)
              }
            }
          }
        }
        await fixLinks(destination)
      }, success: () => this.store.setBottleStatus(bottle.id, 'ready'), failure: () => this.store.setBottleStatus(bottle.id, 'error') })
      return { bottle, job }
    } catch (error) { this.store.setBottleStatus(bottle.id, 'error'); throw error }
  }
  async remove(id: string) {
    this.idle(id); this.removing.add(id)
    // Always stop the prefix's Wine server before deleting, including detached Windows children.
    try {
      const job = this.stop(id); const result = await this.jobs.wait(job.id)
      if (result.status !== 'succeeded') throw new AppError('无法停止 Wine 进程，已保留 bottle；请检查日志', 409)
      await rm(this.prefix(id), { recursive: true, force: true }); this.store.deleteBottle(id)
    } finally { this.removing.delete(id) }
  }
  tool(id: string, tool: 'winecfg' | 'regedit' | 'uninstaller') {
    this.ready(id); this.idle(id)
    return this.jobs.start(id, tool, [{ argv: [this.config.wineBin, tool] }], { env: this.env(id) })
  }
  setWindows(id: string, version: WindowsVersion) {
    this.ready(id); this.idle(id)
    return this.jobs.start(id, 'windows', [{ argv: this.registry(version) }], { env: this.env(id), timeout: 60000,
      success: () => { this.store.updateBottle(id, { windows: version }) } })
  }
  install(id: string, dependency: string) {
    this.ready(id); this.idle(id)
    if (!dependencyOptions.some(x => x.id === dependency)) throw new AppError('不支持的依赖')
    if (!Bun.which(this.config.winetricksBin)) throw new AppError('主机没有安装 winetricks', 503)
    return this.jobs.start(id, 'winetricks', [{ argv: [this.config.winetricksBin, '-q', dependency] }], { env: this.env(id), timeout: 1800000 })
  }
  stop(id: string) {
    this.store.getBottle(id)
    let jobId = ''
    const job = this.jobs.start(id, 'stop', [{ argv: [this.config.wineserverBin, '-k'] }], { env: this.env(id), timeout: 15000,
      success: () => this.jobs.cancelBottle(id, jobId) })
    jobId = job.id; return job
  }
  async files(id: string, path: string) {
    const root = join(this.prefix(id), 'drive_c'); const dir = await safePath(root, path)
    if (!(await stat(dir)).isDirectory()) throw new AppError('不是目录')
    const entries = await readdir(dir, { withFileTypes: true })
    const files: FileEntry[] = []
    for (const entry of entries.slice(0, 1000)) {
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) continue
      const item = await lstat(join(dir, entry.name))
      files.push({ name: entry.name, path: path ? `${path}/${entry.name}` : entry.name, directory: entry.isDirectory(), size: item.size, executable: /\.(exe|msi)$/i.test(entry.name) })
    }
    return files.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))
  }
  async register(id: string, input: Pick<Program, 'name' | 'path' | 'args'>) {
    this.ready(id)
    const path = await safePath(join(this.prefix(id), 'drive_c'), input.path)
    if (!(await stat(path)).isFile() || !/\.(exe|msi)$/i.test(path)) throw new AppError('请选择 .exe 或 .msi 文件')
    this.ready(id)
    return this.store.addProgram(id, input)
  }
  async upload(id: string, file: File, name: string) {
    this.ready(id)
    if (!/\.(exe|msi)$/i.test(file.name)) throw new AppError('仅支持 .exe 或 .msi 文件')
    if (file.size === 0 || file.size > 256 * 1024 * 1024) throw new AppError('文件大小必须在 1 字节到 256 MiB 之间')
    this.fileOperations.set(id, (this.fileOperations.get(id) || 0) + 1)
    try {
      const root = await safePath(join(this.prefix(id), 'drive_c'), '')
      // Create one owned directory, and validate it before writing to imported prefixes.
      await mkdir(join(root, 'WW-Uploads'), { recursive: true })
      const uploads = await safePath(root, 'WW-Uploads')
      const path = `WW-Uploads/${randomUUID()}${extname(basename(file.name)).toLowerCase()}`
      const target = join(uploads, basename(path))
      try { await Bun.write(target, file); return await this.register(id, { name: name || file.name.replace(/\.(exe|msi)$/i, ''), path, args: [] }) }
      catch (error) { await rm(target, { force: true }); throw error }
    } finally {
      const remaining = (this.fileOperations.get(id) || 1) - 1
      if (remaining) this.fileOperations.set(id, remaining); else this.fileOperations.delete(id)
    }
  }
  async run(programId: string) {
    const program = this.store.getProgram(programId); this.ready(program.bottleId)
    const path = await safePath(join(this.prefix(program.bottleId), 'drive_c'), program.path)
    if (!(await stat(path)).isFile()) throw new AppError('程序文件不存在')
    this.ready(program.bottleId)
    const args = extname(path).toLowerCase() === '.msi' ? ['msiexec', '/i', path, ...program.args] : [path, ...program.args]
    return this.jobs.start(program.bottleId, 'run', [{ argv: [this.config.wineBin, ...args], cwd: dirname(path) }], { env: this.env(program.bottleId) })
  }
  private async probe(binary: string): Promise<Probe> {
    const path = Bun.which(binary)
    if (!path) return { path: binary, available: false, version: '', error: '未找到可执行文件，请安装或设置运行环境路径' }
    try {
      const proc = Bun.spawn([path, '--version'], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
      const timer = setTimeout(() => proc.kill('SIGKILL'), 5000)
      try {
        const [code, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()])
        return { path, available: code === 0, version: stdout.trim().slice(0, 200), error: code === 0 ? null : (stderr.trim() || `退出码 ${code}`).slice(0, 1000) }
      } finally { clearTimeout(timer) }
    } catch (error) { return { path, available: false, version: '', error: error instanceof Error ? error.message : String(error) } }
  }
  health(refresh = false): Promise<Health> {
    if (refresh) this.probeCache = null
    if (this.probeCache && Date.now() - this.probeCache.time < 10000) return this.probeCache.value
    const value = Promise.all([this.probe(this.config.wineBin), this.probe(this.config.wineserverBin), this.probe(this.config.winetricksBin)]).then(([wine, wineserver, winetricks]) => ({
      wine, wineserver, winetricks, platform: process.platform, arch: process.arch, dataDir: this.config.dataDir,
      desktop: !!this.config.desktopUrl, authenticated: true, authRequired: !!this.config.adminToken,
    }))
    this.probeCache = { time: Date.now(), value }; return value
  }
}
