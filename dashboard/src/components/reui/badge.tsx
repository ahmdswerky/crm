import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex h-4.5 shrink-0 items-center justify-center gap-1 rounded-sm border px-1 py-0.25 text-[0.625rem] font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        "success-light": "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
        "info-light": "border-blue-500/20 bg-blue-500/10 text-blue-900 dark:text-blue-100",
        "warning-light": "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-100",
        "destructive-light": "border-red-500/20 bg-red-500/10 text-red-900 dark:text-red-100",
        "primary-light": "border-primary/20 bg-primary/10 text-primary",
      },
      size: { sm: "h-4.5 px-1 py-0.25 text-[0.625rem]", default: "h-5 px-1.25 py-0.5 text-xs" },
    },
    defaultVariants: { variant: "primary-light", size: "default" },
  },
)

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }

function Badge({ className, variant, size, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, type BadgeProps }
