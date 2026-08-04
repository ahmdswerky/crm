import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

type FrameProps = ComponentProps<"div"> & {
  stacked?: boolean
  dense?: boolean
  spacing?: "sm" | "default"
}

function Frame({ className, stacked, dense, spacing = "default", ...props }: FrameProps) {
  return <div data-slot="frame" data-spacing={spacing} className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-muted/50", stacked && "gap-0", dense ? "gap-0 p-0" : spacing === "sm" ? "gap-2 p-3" : "gap-3 p-4", className)} {...props} />
}

function FrameHeader({ className, ...props }: ComponentProps<"header">) {
  return <header data-slot="frame-panel-header" className={cn("flex px-3 py-1.5", className)} {...props} />
}

function FramePanel({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="frame-panel" className={cn("border-t border-border bg-card px-3 py-3", className)} {...props} />
}

export { Frame, FrameHeader, FramePanel }
