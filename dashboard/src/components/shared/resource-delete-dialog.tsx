import type { ReactNode } from "react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type ResourceDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  pendingLabel?: string
  pending: boolean
  error?: string
  onConfirm: () => void | Promise<void>
}

/** Domain-neutral destructive confirmation chrome. The caller owns the request and target. */
export function ResourceDeleteDialog({ open, onOpenChange, title, description, confirmLabel, pendingLabel = "Deleting…", pending, error, onConfirm }: ResourceDeleteDialogProps) {
  return <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!pending) onOpenChange(nextOpen) }}>
    <AlertDialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={pending} onClick={(event) => { event.preventDefault(); void onConfirm() }}>{pending ? pendingLabel : confirmLabel}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}
