import type { ComponentProps } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
const buttonVariants = cva('inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer', {
  variants: { variant: { default: 'bg-primary text-primary-foreground hover:bg-primary/90', outline: 'border border-border bg-card hover:bg-accent', ghost: 'hover:bg-accent', secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80', destructive: 'bg-destructive text-white hover:bg-destructive/90' }, size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-11 px-5', icon: 'size-9' } }, defaultVariants: { variant: 'default', size: 'default' },
})
export function Button({ className, variant, size, asChild = false, ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'; return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
