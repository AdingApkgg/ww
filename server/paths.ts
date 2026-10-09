import { lstat, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { AppError } from './errors'

export function inside(root: string, path: string) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}
export async function safePath(root: string, path: string) {
  if (isAbsolute(path) || path.includes('\0') || path.includes('\\')) throw new AppError('不允许的文件路径')
  const target = resolve(root, path)
  if (!inside(root, target)) throw new AppError('文件路径超出 bottle')
  if ((await lstat(root)).isSymbolicLink()) throw new AppError('不允许访问符号链接目录')
  const canonicalRoot = await realpath(root)
  let current = root
  for (const part of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, part)
    if ((await lstat(current)).isSymbolicLink()) throw new AppError('不允许访问符号链接')
  }
  const canonical = await realpath(target)
  if (!inside(canonicalRoot, canonical)) throw new AppError('文件路径超出 bottle')
  return canonical
}
