import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { State } from '../../shared/types'
import { api, ApiError, post } from './api'
interface Context { state: State | null; authenticated: boolean | null; authRequired: boolean; error: string; refresh: () => Promise<void>; checkAuth: () => Promise<void>; logout: () => Promise<void> }
const WorkspaceContext = createContext<Context | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null); const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [authRequired, setRequired] = useState(false); const [error, setError] = useState(''); const fetching = useRef(false)
  const checkAuth = useCallback(async () => {
    try { const auth = await api<{ authenticated: boolean; authRequired: boolean }>('/auth'); setAuthenticated(auth.authenticated); setRequired(auth.authRequired); setError('') }
    catch (error) { setError(error instanceof Error ? error.message : '连接失败') }
  }, [])
  const refresh = useCallback(async () => {
    if (fetching.current) return; fetching.current = true
    try { setState(await api<State>('/state')); setError('') }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) { setAuthenticated(false); setState(null) }
      setError(error instanceof Error ? error.message : '连接失败')
    } finally { fetching.current = false }
  }, [])
  useEffect(() => { void checkAuth() }, [checkAuth])
  useEffect(() => { if (!authenticated) return; void refresh(); const timer = setInterval(() => void refresh(), 2500); return () => clearInterval(timer) }, [authenticated, refresh])
  const logout = async () => { try { await post('/auth/logout'); setAuthenticated(false); setState(null) } catch (error) { toast.error((error as Error).message) } }
  return <WorkspaceContext.Provider value={{ state, authenticated, authRequired, error, refresh, checkAuth, logout }}>{children}</WorkspaceContext.Provider>
}
export function useWorkspace() { const context = useContext(WorkspaceContext); if (!context) throw new Error('WorkspaceProvider 缺失'); return context }
export function useOperation() {
  const [pending, setPending] = useState(false); const { refresh } = useWorkspace()
  async function perform<T>(operation: () => Promise<T>, message?: string): Promise<T | undefined> {
    setPending(true)
    try { const result = await operation(); if (message) toast.success(message); await refresh(); return result }
    catch (error) { toast.error(error instanceof Error ? error.message : '操作失败'); return undefined }
    finally { setPending(false) }
  }
  return { pending, perform }
}
