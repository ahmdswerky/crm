import { useState, type ComponentProps, type DragEvent } from "react"
import { ChevronLeft, ChevronRight, GripVertical, ImageIcon, Trash2 } from "lucide-react"
import type { ManagedMedia, MediaOwnerType } from "@/components/shared/media-collection"
import { useMediaCollection } from "@/components/shared/media-collection"
import { MediaDropzone } from "@/components/shared/media-dropzone"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type MultipleMediaFieldProps = {
  ownerType: MediaOwnerType
  ownerId: number
  collection: string
  label: string
  description?: string
  disabled?: boolean
  maxFilesPerUpload?: number
  onChange?: (media: ManagedMedia[]) => void
}

type StagedMultipleMediaFieldProps = {
  disabled?: boolean
  maxFiles?: number
  onFilesChange: (files: File[]) => void
}

export function StagedMultipleMediaField({ disabled = false, maxFiles = 10, onFilesChange }: StagedMultipleMediaFieldProps) {
  return <MediaDropzone className="sm:col-span-2" multiple maxFiles={maxFiles} disabled={disabled} emptyTitle="Drop property images here" emptyDescription={`JPEG, PNG, WebP, or AVIF · up to ${maxFiles} images, 10 MB each`} ariaLabel="Property images" uploadMode="deferred" deferredDescription="Images upload after the property is created." queueLayout="vertical" onFilesChange={onFilesChange} />
}

export function MultipleMediaField({ ownerType, ownerId, collection, label, description, disabled = false, maxFilesPerUpload = 10, onChange }: MultipleMediaFieldProps) {
  const { media, loading, busy, error, upload, remove, reorder } = useMediaCollection({ ownerType, ownerId, collection, onChange })
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null)

  async function move(id: number, direction: -1 | 1) {
    const index = media.findIndex((item) => item.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= media.length) return
    const next = [...media]
    ;[next[index], next[target]] = [next[target], next[index]]
    try {
      await reorder(next.map((item) => item.id))
    } catch {
      // The inline error state explains the failed request.
    }
  }

  async function moveTo(droppedOnId: number) {
    if (draggedId === null || draggedId === droppedOnId) return
    const next = [...media]
    const from = next.findIndex((item) => item.id === draggedId)
    const to = next.findIndex((item) => item.id === droppedOnId)
    if (from < 0 || to < 0) return
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    try {
      await reorder(next.map((candidate) => candidate.id))
    } catch {
      // The inline error state explains the failed request.
    } finally {
      setDraggedId(null)
    }
  }

  async function deleteMedia(id: number) {
    try {
      await remove(id)
      setPendingDeleteId(null)
    } catch {
      // The inline error state explains the failed request.
    }
  }

  function onCardDrop(event: DragEvent<HTMLElement>, id: number) {
    event.preventDefault()
    void moveTo(id)
  }

  return <section className="space-y-4 border border-border bg-card p-4">
    <div><h3 className="font-medium">{label}</h3>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <MediaDropzone multiple maxFiles={maxFilesPerUpload} disabled={disabled || busy} emptyTitle="Drop listing images here" emptyDescription={`JPEG, PNG, WebP, or AVIF · up to ${maxFilesPerUpload} images, 10 MB each`} queueLayout="vertical" autoUpload onUpload={upload} />
    {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="aspect-[4/3] w-full" />)}</div> : media.length ? <div className="space-y-2">
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Drag to set the gallery order. The first image is the listing cover.</p><span className="shrink-0 text-xs font-medium text-muted-foreground">{media.length} {media.length === 1 ? "image" : "images"}</span></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{media.map((item, index) => <figure key={item.id} draggable={!disabled && !busy} onDragStart={() => setDraggedId(item.id)} onDragEnd={() => setDraggedId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onCardDrop(event, item.id)} className={cn("group relative overflow-hidden border border-border bg-muted/20 transition-opacity", draggedId === item.id && "opacity-45", !disabled && !busy && "cursor-grab active:cursor-grabbing")}>
        <img src={item.thumbnail_url || item.url} alt={item.name} className="aspect-[4/3] w-full object-cover" />
        <div className="absolute left-2 top-2 flex items-center gap-1 border border-border bg-background/95 px-1.5 py-1 text-[11px] font-medium shadow-xs"><GripVertical className="size-3 text-muted-foreground" aria-hidden="true" />{index === 0 ? "Cover" : `#${index + 1}`}</div>
        <figcaption className="border-t border-border bg-card px-2 py-2"><p className="truncate text-xs font-medium" title={item.name}>{item.name}</p><div className="mt-2 flex items-center justify-between gap-1"><span className="text-[11px] text-muted-foreground">Ready</span>{pendingDeleteId === item.id ? <div className="flex gap-1"><Button variant="ghost" size="xs" disabled={busy} onClick={() => setPendingDeleteId(null)}>Cancel</Button><Button variant="destructive" size="xs" disabled={busy} onClick={() => void deleteMedia(item.id)}>Delete</Button></div> : <div className="flex gap-1"><IconButton label="Move image earlier" disabled={disabled || busy || index === 0} onClick={() => void move(item.id, -1)}><ChevronLeft /></IconButton><IconButton label="Move image later" disabled={disabled || busy || index === media.length - 1} onClick={() => void move(item.id, 1)}><ChevronRight /></IconButton><IconButton label="Delete image" disabled={disabled || busy} destructive onClick={() => setPendingDeleteId(item.id)}><Trash2 /></IconButton></div>}</div></figcaption>
      </figure>)}</div>
    </div> : !loading && <div className="flex items-center gap-3 border border-dashed border-border bg-muted/20 p-4"><ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" /><div><p className="text-sm font-medium">Your gallery is empty</p><p className="text-xs text-muted-foreground">Upload images above to build the gallery.</p></div></div>}
  </section>
}

function IconButton({ label, destructive = false, children, ...props }: ComponentProps<typeof Button> & { label: string; destructive?: boolean }) {
  return <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-xs" className={destructive ? "text-destructive hover:text-destructive" : undefined} aria-label={label} {...props}>{children}</Button></TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}
