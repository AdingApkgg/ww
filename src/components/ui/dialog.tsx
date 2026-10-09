import type { ComponentProps } from 'react'
import * as Primitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
export const Dialog = Primitive.Root
export const DialogTitle = Primitive.Title
export const DialogDescription = Primitive.Description
export function DialogContent({ className, children, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal><Primitive.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[3px]"/><Primitive.Content className={cn('fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl outline-none max-h-[90dvh] overflow-y-auto', className)} {...props}>{children}<Primitive.Close aria-label="关闭" className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"><X size={18}/></Primitive.Close></Primitive.Content></Primitive.Portal>
}
