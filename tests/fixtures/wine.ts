#!/usr/bin/env bun
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
const args = process.argv.slice(2)
if (args.includes('--version')) { console.log('wine-test 10.0'); process.exit(0) }
if (args[0] === 'wineboot') {
  await mkdir(join(process.env.WINEPREFIX!, 'drive_c', 'Program Files'), { recursive: true })
  await writeFile(join(process.env.WINEPREFIX!, 'system.reg'), 'WINE REGISTRY Version 2')
  await writeFile(join(process.env.WINEPREFIX!, 'drive_c', 'Program Files', 'Example.exe'), 'fixture')
}
console.log(JSON.stringify({ args, prefix: process.env.WINEPREFIX, cwd: process.cwd() }))
if (args.some(x => x.endsWith('failure.exe'))) { console.error('fixture failure'); process.exit(17) }
if (args.some(x => x.endsWith('slow.exe'))) await Bun.sleep(30000)
console.log('operation complete')
