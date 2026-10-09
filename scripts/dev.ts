const processes = [
  Bun.spawn(['bun', '--watch', 'server/index.ts'], { env: { ...process.env, WW_PORT: process.env.WW_PORT || '4387' }, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
  Bun.spawn(['bun', 'run', 'dev:web'], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }),
]
let closing = false
function close() { if (closing) return; closing = true; for (const proc of processes) proc.kill('SIGTERM') }
process.on('SIGINT', close); process.on('SIGTERM', close)
const code = await Promise.race(processes.map(x => x.exited)); close(); await Promise.all(processes.map(x => x.exited)); process.exit(code)
export {}
