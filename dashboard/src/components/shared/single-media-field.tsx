import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { ImageIcon } from "lucide-react"
import type { ManagedMedia, MediaOwnerType } from "@/components/shared/media-collection"
import { useMediaCollection } from "@/components/shared/media-collection"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"

type BaseSingleMediaFieldProps = {
  label: string
  description?: string
  disabled?: boolean
}

type ManagedSingleMediaFieldProps = BaseSingleMediaFieldProps & {
  ownerType: MediaOwnerType
  ownerId: number
  collection: string
  onChange?: (media: ManagedMedia[]) => void
}

type StagedSingleMediaFieldProps = BaseSingleMediaFieldProps & {
  onFilesChange: (files: File[]) => void
}

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
const accept = "image/jpeg,image/png,image/webp,image/avif"
const maxFileSize = 10 * 1024 * 1024

export function SingleMediaField(props: ManagedSingleMediaFieldProps | StagedSingleMediaFieldProps) {
  return "ownerId" in props ? <ManagedSingleMediaField {...props} /> : <StagedSingleMediaField {...props} />
}

function ManagedSingleMediaField({ ownerType, ownerId, collection, label, disabled = false, onChange }: ManagedSingleMediaFieldProps) {
  const { media, loading, busy, error, upload } = useMediaCollection({ ownerType, ownerId, collection, onChange })
  const current = media[0]

  return <CompactImagePicker label={label} disabled={disabled || busy} loading={loading} image={current ? { src: current.thumbnail_url || current.url, alt: current.name } : undefined} error={error} onFile={(file) => void upload([file]).catch(() => undefined)} />
}

function StagedSingleMediaField({ label, disabled = false, onFilesChange }: StagedSingleMediaFieldProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")

  useEffect(() => {
    if (!file) { setPreviewUrl(""); return }
    const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : ""
    setPreviewUrl(url)
    return () => { if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url) }
  }, [file])

  function setStagedFile(nextFile: File) {
    setFile(nextFile)
    onFilesChange([nextFile])
  }
  return <CompactImagePicker label={label} disabled={disabled} image={file ? { src: previewUrl, alt: `${label} preview` } : undefined} onFile={setStagedFile} />
}

function CompactImagePicker({ label, disabled, loading = false, image, error, onFile }: { label: string; disabled: boolean; loading?: boolean; image?: { src: string; alt: string }; error?: string; onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [validationError, setValidationError] = useState("")

  function choose(file?: File) {
    if (!file || disabled) return
    if (!acceptedTypes.has(file.type) || file.size > maxFileSize) {
      setValidationError(`${file.name} must be a JPEG, PNG, WebP, or AVIF image under 10 MB.`)
      return
    }
    setValidationError("")
    onFile(file)
  }
  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    choose(event.target.files?.[0])
    event.target.value = ""
  }
  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    choose(event.dataTransfer.files[0])
  }

  return <section className="space-y-2">
    <input ref={inputRef} className="sr-only" type="file" accept={accept} disabled={disabled} onChange={onInputChange} />
    <div className="flex justify-center">{loading ? <Skeleton className="size-16 rounded-md" /> : <button type="button" aria-label={`${image ? "Replace" : "Upload"} ${label}`} disabled={disabled} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="grid size-16 place-items-center overflow-hidden rounded-md border border-border bg-white p-1 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white">{image?.src ? <img src={image.src} alt={image.alt} className="size-full object-contain" /> : <ImageIcon className="size-5" aria-hidden="true" />}</button>}</div>
    {(error || validationError) && <Alert variant="destructive"><AlertDescription>{error || validationError}</AlertDescription></Alert>}
  </section>
}
