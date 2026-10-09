import { cn } from '@/lib/utils'
import { LoaderCircle } from 'lucide-react'
const labels: Record<string, string> = { ready: '已就绪', creating: '初始化中', error: '需要处理', running: '运行中', succeeded: '已完成', failed: '失败', interrupted: '已中断', cancelled: '已停止' }
export function Status({ status }: { status: string }) {
  const live = ['running', 'creating'].includes(status)
  return <span className={cn('status', ['ready', 'succeeded'].includes(status) && 'status-green', ['error', 'failed', 'interrupted'].includes(status) && 'status-amber', live && 'status-blue')}>{live ? <LoaderCircle size={12} className="animate-spin"/> : <span className="status-dot"/>}{labels[status] || status}</span>
}
