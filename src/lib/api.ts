export class ApiError extends Error { constructor(message: string, public status: number) { super(message) } }
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: 'same-origin', headers: { ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers } })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || `请求失败 (${response.status})`, response.status)
  return data as T
}
export function post<T>(path: string, data?: unknown) { return api<T>(path, { method: 'POST', body: data instanceof FormData ? data : data === undefined ? undefined : JSON.stringify(data) }) }
