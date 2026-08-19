import type { ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

type ResourcePreviewDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: ReactNode
}

/** Domain-neutral Sheet chrome for read-only resource previews. */
export function ResourcePreviewDrawer({ open, onOpenChange, title, description, children }: ResourcePreviewDrawerProps) {
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" showCloseButton={false} className="w-[calc(100%-1rem)] gap-0 p-0 sm:max-w-xl">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0"><SheetTitle>{title}</SheetTitle><SheetDescription className="mt-1">{description}</SheetDescription></div>
        <SheetClose asChild><Button variant="ghost" size="icon" aria-label="Close preview" className="-me-2 -mt-1 shrink-0"><X /></Button></SheetClose>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </SheetContent>
  </Sheet>
}
