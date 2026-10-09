import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
export function Input({ className, ...props }: ComponentProps<'input'>) { return <input data-slot="input" className={cn('flex h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-50', className)} {...props} /> }
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) { return <textarea className={cn('min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/20', className)} {...props} /> }
export function Select({ className, ...props }: ComponentProps<'select'>) { return <select className={cn('h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/20', className)} {...props} /> }
