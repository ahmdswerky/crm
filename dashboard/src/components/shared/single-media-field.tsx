import { ImageIcon, Trash2 } from "lucide-react"
import type { ManagedMedia, MediaOwnerType } from "@/components/shared/media-collection"
import { useMediaCollection } from "@/components/shared/media-collection"
import { MediaDropzone } from "@/components/shared/media-dropzone"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type SingleMediaFieldProps = {
  ownerType: MediaOwnerType
  ownerId: number
  collection: string
  label: string
  description?: string
  disabled?: boolean
  onChange?: (media: ManagedMedia[]) => void
}

export function SingleMediaField({ ownerType, ownerId, collection, label, description, disabled = false, onChange }: SingleMediaFieldProps) {
  const { media, loading, busy, error, upload, remove } = useMediaCollection({ ownerType, ownerId, collection, onChange })
  const current = media[0]

  async function deleteCurrent() {
    if (!current) return
    try {
      await remove(current.id)
    } catch {
      // The inline error state explains the failed request.
    }
  }

  return <section className="space-y-4 border border-border bg-card p-4">
    <div><h3 className="font-medium">{label}</h3>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {loading ? <Skeleton className="h-20 w-full" /> : current && <article className="flex overflow-hidden border border-border bg-muted/20">
      <img src={current.thumbnail_url || current.url} alt={current.name} className="size-20 shrink-0 object-cover" />
      <div className="min-w-0 flex-1 px-3 py-2.5"><p className="truncate text-sm font-medium" title={current.name}>{current.name}</p><div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><ImageIcon className="size-3.5" /><span>Current profile image</span></div><p className="mt-2 text-[11px] text-muted-foreground">Replacing this image keeps only the newest file.</p></div>
      <div className="p-2"><Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" disabled={disabled || busy} aria-label="Remove current profile image" onClick={() => void deleteCurrent()}><Trash2 /></Button></div>
    </article>}
    <MediaDropzone multiple={false} maxFiles={1} disabled={disabled || busy} emptyTitle={current ? "Drop a replacement image here" : "Drop a profile image here"} emptyDescription="JPEG, PNG, WebP, or AVIF · maximum 10 MB" uploadLabel={current ? "Replace image" : "Upload image"} onUpload={upload} />
  </section>
}
