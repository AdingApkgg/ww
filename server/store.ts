import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Bottle, BottleInput, BottleStatus, Job, JobStatus, Program } from '../shared/types'
import { AppError } from './errors'

export class Store {
  private db: Database
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path, { create: true })
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS bottles (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS programs (id TEXT PRIMARY KEY, bottle_id TEXT NOT NULL REFERENCES bottles(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, bottle_id TEXT NOT NULL REFERENCES bottles(id) ON DELETE CASCADE, data TEXT NOT NULL);`)
    for (const job of this.listJobs()) {
      if (job.status === 'running') this.finishJob(job.id, 'interrupted', null, '\n[服务已重启，任务被中断；请停止 bottle 残留进程后重试]\n')
    }
    for (const bottle of this.listBottles()) if (bottle.status === 'creating') this.setBottleStatus(bottle.id, 'interrupted')
  }
  private all<T>(table: string): T[] {
    return (this.db.query(`SELECT data FROM ${table} ORDER BY rowid DESC`).all() as { data: string }[]).map(row => JSON.parse(row.data))
  }
  private get<T>(table: string, id: string): T {
    const row = this.db.query(`SELECT data FROM ${table} WHERE id = ?`).get(id) as { data: string } | null
    if (!row) throw new AppError('找不到记录', 404)
    return JSON.parse(row.data)
  }
  private save(table: string, id: string, data: unknown) { this.db.query(`UPDATE ${table} SET data = ? WHERE id = ?`).run(JSON.stringify(data), id) }
  listBottles() { return this.all<Bottle>('bottles') }
  getBottle(id: string) { return this.get<Bottle>('bottles', id) }
  addBottle(input: BottleInput): Bottle {
    const bottle: Bottle = { ...input, id: randomUUID(), favorite: false, status: 'creating', createdAt: new Date().toISOString() }
    this.db.query('INSERT INTO bottles VALUES (?, ?)').run(bottle.id, JSON.stringify(bottle)); return bottle
  }
  updateBottle(id: string, patch: Partial<BottleInput> & { favorite?: boolean }) {
    const bottle = { ...this.getBottle(id), ...patch }; this.save('bottles', id, bottle); return bottle
  }
  setBottleStatus(id: string, status: BottleStatus) { const bottle = this.getBottle(id); this.save('bottles', id, { ...bottle, status }) }
  deleteBottle(id: string) { this.getBottle(id); this.db.query('DELETE FROM bottles WHERE id = ?').run(id) }
  listPrograms() { return this.all<Program>('programs') }
  getProgram(id: string) { return this.get<Program>('programs', id) }
  addProgram(bottleId: string, input: Pick<Program, 'name' | 'path' | 'args'>) {
    this.getBottle(bottleId)
    const program: Program = { ...input, id: randomUUID(), bottleId, createdAt: new Date().toISOString() }
    this.db.query('INSERT INTO programs VALUES (?, ?, ?)').run(program.id, bottleId, JSON.stringify(program)); return program
  }
  deleteProgram(id: string) { this.getProgram(id); this.db.query('DELETE FROM programs WHERE id = ?').run(id) }
  listJobs(): Job[] { return this.all<Job>('jobs') }
  getJob(id: string) { return this.get<Job>('jobs', id) }
  addJob(bottleId: string, kind: string, command: string[]) {
    this.getBottle(bottleId)
    const job: Job = { id: randomUUID(), bottleId, kind, command, status: 'running', log: '', exitCode: null, createdAt: new Date().toISOString(), finishedAt: null }
    this.db.query('INSERT INTO jobs VALUES (?, ?, ?)').run(job.id, bottleId, JSON.stringify(job)); return job
  }
  appendLog(id: string, text: string) {
    const job = this.getJob(id); job.log = (job.log + text).slice(-200000); this.save('jobs', id, job)
  }
  finishJob(id: string, status: JobStatus, exitCode: number | null, log = '') {
    const job = this.getJob(id)
    this.save('jobs', id, { ...job, status, exitCode, log: (job.log + log).slice(-200000), finishedAt: new Date().toISOString() })
  }
  close() { this.db.close() }
}
