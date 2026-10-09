import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig } from '../server/config'
import { Store } from '../server/store'

export async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'ww-fixture-'))
  const runner = resolve('tests/fixtures/wine.ts'); await chmod(runner, 0o755)
  const config = loadConfig({ WW_DATA_DIR: dir, WW_WINE_BIN: runner, WW_WINESERVER_BIN: runner, WW_WINETRICKS_BIN: runner })
  const store = new Store(join(dir, 'db.sqlite'))
  return { dir, config, store, cleanup: async () => { store.close(); await rm(dir, { recursive: true, force: true }) } }
}
