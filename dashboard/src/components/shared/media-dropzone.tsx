import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { Check, FileImage, LoaderCircle, UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type QueueStatus = "queued" | "uploading" | "processing" | "error"

type QueuedFile = {
  id: string
  file: File
  previewUrl: string
  status: QueueStatus
  error?: string
}

type MediaDropzoneProps = {
  multiple?: boolean
  maxFiles?: number
  disabled?: boolean
  emptyTitle: string
  emptyDescription: string
  ariaLabel?: string
  ariaLabelledBy?: string
  className?: string
  uploadLabel?: string
  uploadMode?: "immediate" | "deferred"
  autoUpload?: boolean
  deferredDescription?: string
  queueLayout?: "horizontal" | "vertical"
  onUpload?: (files: File[]) => Promise<unknown>
  onFilesChange?: (files: File[]) => void
}

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
const maxFileSize = 10 * 1024 * 1024
const accept = "image/jpeg,image/png,image/webp,image/avif"

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileType(file: File) {
  return file.type.replace("image/", "").toUpperCase() || "IMAGE"
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function createPreviewUrl(file: File) {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : ""
}

function revokePreviewUrl(url: string) {
  if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url)
}

export function MediaDropzone({ multiple = false, maxFiles = 1, disabled = false, emptyTitle, emptyDescription, ariaLabel, ariaLabelledBy, className, uploadLabel, uploadMode = "immediate", autoUpload = false, deferredDescription = "Images upload after this record is created.", queueLayout = "horizontal", onUpload, onFilesChange }: MediaDropzoneProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<QueuedFile[]>([])
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => () => { queueRef.current.forEach((item) => revokePreviewUrl(item.previewUrl)) }, [])
  useEffect(() => {
    if (uploadMode === "deferred") onFilesChange?.(queue.map((item) => item.file))
  }, [onFilesChange, queue, uploadMode])

  function addFiles(inputFiles: File[]) {
    if (disabled || !inputFiles.length) return
    const remaining = Math.max(0, maxFiles - queue.length)
    if (!remaining) {
      setMessage(`This field accepts up to ${maxFiles} ${maxFiles === 1 ? "image" : "images"} at a time.`)
      return
    }

    if (inputFiles.length > remaining) {
      setMessage(`Choose up to ${remaining} more ${remaining === 1 ? "image" : "images"}.`)
      return
    }

    const invalid = inputFiles.find((file) => !acceptedTypes.has(file.type) || file.size > maxFileSize)
    if (invalid) {
      setMessage(`${invalid.name} must be a JPEG, PNG, WebP, or AVIF image under 10 MB.`)
      return
    }

    setMessage("")
    const nextItems = inputFiles.map((file) => ({
      id: newId(),
      file,
      previewUrl: createPreviewUrl(file),
      status: "queued" as const,
    }))
    setQueue((current) => [...current, ...nextItems])
    if (autoUpload && uploadMode !== "deferred" && onUpload) void uploadItems(nextItems)
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ""
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  function removeQueuedFile(id: string) {
    setQueue((current) => {
      const item = current.find((candidate) => candidate.id === id)
      if (item) revokePreviewUrl(item.previewUrl)
      return current.filter((candidate) => candidate.id !== id)
    })
  }

  function clearQueue() {
    queue.forEach((item) => revokePreviewUrl(item.previewUrl))
    setQueue([])
  }

  async function uploadItems(items: QueuedFile[]) {
    if (uploadMode === "deferred" || !onUpload) return
    const files = items.filter((item) => item.status === "queued" || item.status === "error")
    if (!files.length) return
    const ids = new Set(files.map((item) => item.id))
    setMessage("")
    setQueue((current) => current.map((item) => ids.has(item.id) ? { ...item, status: "uploading", error: undefined } : item))

    try {
      await onUpload(files.map((item) => item.file))
      setQueue((current) => current.map((item) => ids.has(item.id) ? { ...item, status: "processing" } : item))
      setMessage("Originals are stored. Optimized previews are processing in the background.")
    } catch {
      setQueue((current) => current.map((item) => ids.has(item.id) ? { ...item, status: "error", error: "Upload failed. Try again." } : item))
    }
  }

  async function uploadQueue() {
    await uploadItems(queue)
  }

  const queuedCount = queue.filter((item) => item.status === "queued" || item.status === "error").length
  const hasUploading = queue.some((item) => item.status === "uploading")

  return <div className={cn("space-y-3", className)}>
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={message ? `${inputId}-message` : undefined}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragEnter={(event) => { event.preventDefault(); if (!disabled) setIsDragging(true) }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDragging(false) }}
      onDrop={onDrop}
      className={cn(
        "group relative grid min-h-36 cursor-pointer place-items-center border border-dashed bg-muted/20 px-5 py-6 text-center outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        isDragging && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-55"
      )}
    >
      <input ref={inputRef} id={inputId} className="sr-only" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={onInputChange} />
      <div className="pointer-events-none space-y-2">
        <span className={cn("mx-auto grid size-10 place-items-center border border-border bg-background text-muted-foreground", isDragging && "border-primary text-primary")}><UploadCloud className="size-5" aria-hidden="true" /></span>
        <div><p className="text-sm font-medium">{isDragging ? "Drop images to add them" : emptyTitle}</p><p className="mt-1 text-xs text-muted-foreground">{emptyDescription}</p></div>
        <p className="text-xs font-medium text-primary">Browse files</p>
      </div>
    </div>

    {(message || queue.length > 0) && <div aria-live="polite" className="space-y-2">
      {message && <p id={`${inputId}-message`} className="text-xs text-muted-foreground">{message}</p>}
      {queue.length > 0 && <div className={queueLayout === "horizontal" ? "overflow-x-auto pb-1" : undefined}><div className={queueLayout === "horizontal" ? "flex min-w-max gap-2" : "space-y-2"}>
        {queue.map((item) => <QueueItem key={item.id} item={item} onRemove={() => removeQueuedFile(item.id)} disabled={hasUploading} fullWidth={queueLayout === "vertical"} />)}
      </div></div>}
    </div>}

    {queue.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">{queue.length} {queue.length === 1 ? "image" : "images"} {autoUpload ? "added" : "staged"}</p>
      <div className="flex gap-2">
        {uploadMode === "deferred" ? <><p className="text-xs text-muted-foreground">{deferredDescription}</p><Button type="button" variant="ghost" size="sm" onClick={clearQueue}>Clear queue</Button></> : <><Button type="button" variant="ghost" size="sm" disabled={hasUploading} onClick={clearQueue}>Clear queue</Button>{(!autoUpload || queue.some((item) => item.status === "error")) && <Button type="button" size="sm" disabled={!queuedCount || hasUploading || disabled} onClick={() => void uploadQueue()}>
          {hasUploading ? <LoaderCircle className="motion-safe:animate-spin" /> : <UploadCloud />}
          {hasUploading ? "Uploading" : uploadLabel ?? `Upload ${queuedCount} ${queuedCount === 1 ? "image" : "images"}`}
        </Button>}</>}
      </div>
    </div>}
  </div>
}

function QueueItem({ item, onRemove, disabled, fullWidth = false }: { item: QueuedFile; onRemove: () => void; disabled: boolean; fullWidth?: boolean }) {
  const isWorking = item.status === "uploading"
  const status = item.status === "queued" ? "Ready to upload" : item.status === "uploading" ? "Uploading" : item.status === "processing" ? "Stored · processing queued" : item.error ?? "Upload failed"

  return <article className={cn("relative flex overflow-hidden border border-border bg-card shadow-xs", fullWidth ? "w-full" : "w-80")}>
    <img src={item.previewUrl} alt="" className="size-16 shrink-0 object-cover" />
    <div className="min-w-0 flex-1 px-3 py-2"><p className="truncate text-xs font-medium" title={item.file.name}>{item.file.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{fileType(item.file)} · {fileSize(item.file.size)}</p><div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">{item.status === "processing" ? <Check className="size-3 text-primary" /> : item.status === "error" ? <X className="size-3 text-destructive" /> : isWorking ? <LoaderCircle className="size-3 motion-safe:animate-spin" /> : <FileImage className="size-3" />}<span>{status}</span></div>{isWorking && <div className="mt-2 h-0.5 overflow-hidden bg-muted"><div className="h-full w-2/3 bg-primary motion-safe:animate-pulse" /></div>}</div>
    <Button type="button" variant="ghost" size="icon-xs" className="absolute right-1 top-1" aria-label={`Remove ${item.file.name} from queue`} disabled={disabled} onClick={onRemove}><X /></Button>
  </article>
}
