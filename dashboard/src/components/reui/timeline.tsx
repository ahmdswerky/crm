import { createContext, useContext, useState, type ComponentProps, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

const TimelineContext = createContext(1)

function Timeline({ defaultValue = 1, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { defaultValue?: number }) {
  const [activeStep] = useState(defaultValue)
  return <TimelineContext.Provider value={activeStep}><div data-slot="timeline" data-orientation="vertical" className={cn("group/timeline flex flex-col", className)} {...props}>{children}</div></TimelineContext.Provider>
}

function TimelineItem({ step, className, ...props }: HTMLAttributes<HTMLDivElement> & { step: number }) {
  const activeStep = useContext(TimelineContext)
  return <div data-slot="timeline-item" data-completed={step <= activeStep || undefined} className={cn("group/timeline-item relative ms-8 flex flex-1 flex-col gap-0.5 pb-6 last:pb-0", className)} {...props} />
}

function TimelineHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="timeline-header" className={cn(className)} {...props} /> }
function TimelineContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div data-slot="timeline-content" className={cn("text-sm text-muted-foreground", className)} {...props} /> }
function TimelineTitle({ className, ...props }: ComponentProps<"h3">) { return <h3 data-slot="timeline-title" className={cn("text-sm font-medium", className)} {...props} /> }
function TimelineIndicator({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) { return <div aria-hidden="true" data-slot="timeline-indicator" className={cn("absolute top-0 -left-7 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-primary/20", className)} {...props}>{children}</div> }
function TimelineSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div aria-hidden="true" data-slot="timeline-separator" className={cn("absolute -left-7 h-[calc(100%-1.75rem)] w-0.5 translate-y-7 -translate-x-1/2 bg-primary/10 group-last/timeline-item:hidden", className)} {...props} /> }

export { Timeline, TimelineContent, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle }
