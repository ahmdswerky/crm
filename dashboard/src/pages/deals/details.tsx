import { useEffect, useState, useCallback, type ComponentProps, type ReactNode } from "react"
import { ArrowLeft, Building2, Check, ChevronLeft, ChevronRight, ClockCheck, DollarSign, ExternalLink, FileText, ImageIcon, Mail, MapPin as MapPinIcon, Pencil, Phone, RefreshCw, Trash2 } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DealEnvelope,
  DealRelationOptions,
  DealRelationOptionsContext,
  DealUpdatePayload,
  Deal,
  formatCurrency,
  formatDate,
  ForbiddenDeals,
  labelFor,
  statusPillClass,
  statuses,
  titleFor,
} from "./shared"
const MapPin = (props: ComponentProps<typeof MapPinIcon>) => <MapPinIcon {...props} />
export function DealDetailsPage() {
  const { can, isSuper, user } = useAuth()
  const { dealId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const id = Number(dealId)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [mutationMessage, setMutationMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<Deal["status"] | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const returnQuery = searchParams.get("return")
  const backToIndex = returnQuery ? `/deals?${returnQuery}` : "/deals"
  const canEdit = Boolean(deal && (isSuper || can("deal.update") || user?.id === deal.agent_id))
  const canDelete = isSuper

  const loadDeal = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isInteger(id) || id < 1) return
    setLoading(true); setError(null)
    try {
      const body = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals/${id}`, { signal })
      setDeal(body.deal)
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof ApiError ? caught : new ApiError(caught instanceof Error ? caught.message : "Unable to load this deal.", 0))
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [id])

  useEffect(() => {
    if (!can("deal.view") || !Number.isInteger(id) || id < 1) { setLoading(false); return }
    const controller = new AbortController(); void loadDeal(controller.signal)
    return () => controller.abort()
  }, [can, id, loadDeal])

  async function updateDeal(changes: Omit<DealUpdatePayload, "_method">, successMessage: string) {
    if (!deal?.id || !canEdit) return false
    setSaving(true); setMutationError(""); setMutationMessage("")
    try {
      const result = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals/${deal.id}`, { method: "POST", body: JSON.stringify({ ...changes, _method: "PUT" }) })
      setDeal(result.deal); setMutationMessage(successMessage)
      return true
    } catch (caught) {
      setMutationError(caught instanceof Error ? caught.message : "Unable to save this deal.")
      return false
    } finally { setSaving(false); setPendingStatus(null) }
  }

  async function changeStatus(status: Deal["status"]) {
    if (!deal || saving || status === deal.status) return
    setPendingStatus(status)
    await updateDeal({ status }, `Status updated to ${labelFor(status)}.`)
  }

  async function deleteCurrentDeal() {
    if (!deal?.id || !canDelete) return
    setSaving(true); setMutationError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/deals/${deal.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      setDeleteOpen(false)
      navigate(backToIndex)
    } catch (caught) { setMutationError(caught instanceof Error ? caught.message : "Unable to delete this deal.") } finally { setSaving(false) }
  }

  if (!Number.isInteger(id) || id < 1) return <DealDetailsState title="Deal not found" description="The deal identifier is invalid." />
  if (loading) return <DealDetailsSkeleton />
  if (error?.status === 403) return <ForbiddenDeals />
  if (error || !deal) return <DealDetailsState title={error?.status === 404 ? "Deal not found" : "Unable to open deal"} description={error?.message || "This deal is no longer available."} retry={error?.status !== 404 ? () => void loadDeal() : undefined} />

  const relationOptions: DealRelationOptions = {
    contacts: [deal.contact],
    properties: [deal.property],
    propertiesLoading: false,
    propertiesLoadingMore: false,
    propertiesHasMore: false,
    agents: deal.agent?.id === undefined ? [] : [{ id: deal.agent.id, name: deal.agent.name, username: deal.agent.username }],
    agentsLoading: false,
  }
  const contactLink = deal.contact.lead_id !== undefined && can("lead.view")
    ? <Link className="truncate hover:text-primary" to={`/leads?record=${deal.contact.lead_id}`} target="_blank" rel="noreferrer">{deal.contact.name}</Link>
    : deal.contact.id === undefined || !can("contact.view") ? deal.contact.name : <Link className="truncate hover:text-primary" to={`/contacts/${deal.contact.id}`}>{deal.contact.name}</Link>
  const agentLink = deal.agent?.id === undefined || !can("user.view") ? deal.agent?.name ?? "Unassigned" : <Link className="truncate hover:text-primary" to={`/agents/${deal.agent.id}`} target="_blank" rel="noreferrer">{deal.agent.name}</Link>
  const managerName = deal.commission.allocations?.find((allocation) => allocation.recipient_type === "manager")?.recipient?.name

  return <DealRelationOptionsContext.Provider value={relationOptions}><div className="space-y-6 p-6 pb-24 lg:p-8">
    <header className="border-b border-border pb-6">
      <div className="flex items-center justify-between gap-3"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={backToIndex}><ArrowLeft className="me-2 size-3.5" />Back to deals</Link></Button><div className="flex items-center justify-end gap-1"><DealHeaderAction label="Refresh"><Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={() => void loadDeal()} disabled={saving}><RefreshCw className="size-3.5" /></Button></DealHeaderAction>{canEdit && <DealHeaderAction label="Edit"><Button asChild variant="ghost" size="icon-sm" aria-label="Edit"><Link to={`/deals/${deal.id}/edit${returnQuery ? `?return=${encodeURIComponent(returnQuery)}` : ""}`}><Pencil className="size-3.5" /></Link></Button></DealHeaderAction>}{canDelete && <DealHeaderAction label="Delete"><Button variant="ghost" size="icon-sm" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="size-3.5" /></Button></DealHeaderAction>}</div></div>
      <div className="mt-5"><div className="flex flex-wrap items-start justify-between gap-4"><h1 className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-semibold tracking-tight"><span>{deal.contact.name}</span><span className="text-muted-foreground">·</span><span>{deal.property.title}</span></h1><section aria-label="Deal status" className="max-w-full shrink-0 overflow-x-auto rounded-md bg-muted/40 p-1"><div className="flex w-max items-center gap-1">{statuses.map((status) => <Button key={status} size="sm" variant={deal.status === status ? "secondary" : "ghost"} className={deal.status === status ? statusPillClass[status] : ""} aria-pressed={deal.status === status} disabled={!canEdit || saving} onClick={() => void changeStatus(status)}>{pendingStatus === status ? "Saving…" : <>{deal.status === status && <Check className="me-1.5 size-3.5" />}{labelFor(status)}</>}</Button>)}</div></section></div><div className="mt-5"><DealPropertyMedia property={deal.property} /></div></div>
    </header>
    <p className="sr-only" aria-live="polite">{mutationMessage || mutationError}</p>
    {mutationError && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{mutationError}</div>}
    <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <main className="min-w-0 space-y-8">
        <section className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4"><div className="flex flex-wrap items-center gap-x-8 gap-y-3"><p className="font-mono text-3xl font-semibold tracking-tight">{formatWholeCurrency(deal.deal_value)}</p>{deal.closed_at && <Tooltip><TooltipTrigger asChild><p className="flex items-center gap-2 text-sm text-muted-foreground"><ClockCheck className="size-4 shrink-0" aria-hidden="true" />{formatDate(deal.closed_at)}</p></TooltipTrigger><TooltipContent side="top">Close date</TooltipContent></Tooltip>}</div><p className="flex items-center gap-1.5 text-sm"><MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{deal.property.address}{deal.property.city ? ` · ${deal.property.city}` : ""}</span></p></section>
        <section className="pb-8"><dl className="space-y-4"><div className="flex items-start gap-3"><DollarSign className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs font-medium text-muted-foreground">Asking price</dt><dd className="mt-1 font-mono text-lg font-semibold">{formatCurrency(deal.property.price)}</dd></div></div><div className="flex items-center gap-3"><Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><dd className="text-sm">{titleFor(deal.property.type)}</dd></div><div className="flex items-start gap-3"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs font-medium text-muted-foreground">Description</dt><dd className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{deal.property.description || "No description has been recorded for this listing."}</dd></div></div></dl></section>
        {deal.id !== undefined && <ActivityLogList model="deal" id={deal.id} title="Deal activity" onReverted={() => void loadDeal()} />}
      </main>
      <aside className="h-fit space-y-4 xl:sticky xl:top-20"><article aria-label="Commission breakdown" className="w-full overflow-hidden rounded-xl bg-muted/40 p-3"><header className="-mx-3 -mt-3 mb-3 bg-muted/70 px-3 py-2"><p className="text-sm font-semibold">Commission</p></header><p className="font-mono text-xl font-semibold">{formatCurrency(deal.commission.total_amount ?? 0)}</p><dl className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><dt className="text-muted-foreground">Agent</dt><dd className="mt-1 font-mono font-medium text-foreground">{formatCurrency(deal.commission.agent_amount ?? 0)}</dd></div><div><dt className="text-muted-foreground">Manager</dt><dd className="mt-1 font-mono font-medium text-foreground">{formatCurrency(deal.commission.manager_amount ?? 0)}</dd></div><div><dt className="text-muted-foreground">Company</dt><dd className="mt-1 font-mono font-medium text-foreground">{formatCurrency(deal.commission.company_amount ?? 0)}</dd></div></dl></article><article aria-label="Customer details" className="w-full overflow-hidden rounded-xl bg-muted/40 p-3"><header className="-mx-3 -mt-3 mb-3 bg-muted/70 px-3 py-2"><p className="text-sm font-semibold">Contact</p></header><div className="flex items-start gap-2.5"><PersonAvatar name={deal.contact.name} size="sm" /><h2 className="min-w-0 flex-1 truncate pt-0.5 text-sm font-semibold">{contactLink}</h2>{deal.contact.lead_id !== undefined && can("lead.view") && <DealHeaderAction label="Open lead in new tab"><Button asChild variant="ghost" size="icon-sm" aria-label="Open lead in new tab" className="-me-1 -mt-1 shrink-0"><Link to={`/leads?record=${deal.contact.lead_id}`} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /></Link></Button></DealHeaderAction>}</div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground">{deal.contact.phone && <a className="flex items-center gap-2 truncate hover:text-foreground" href={`tel:${deal.contact.phone}`}><Phone className="size-3 shrink-0" aria-hidden="true" />{deal.contact.phone}</a>}{deal.contact.email && <a className="flex items-center gap-2 truncate hover:text-foreground" href={`mailto:${deal.contact.email}`}><Mail className="size-3 shrink-0" aria-hidden="true" />{deal.contact.email}</a>}</div></article><div><article aria-label="Assigned agent" className="w-full overflow-hidden rounded-t-xl rounded-bl-xl bg-muted/40 p-3"><header className="-mx-3 -mt-3 mb-3 bg-muted/70 px-3 py-2"><p className="text-sm font-semibold">Agent</p></header><div className="flex items-start gap-2.5"><PersonAvatar name={deal.agent?.name ?? "Unassigned"} size="sm" /><h2 className="min-w-0 flex-1 truncate pt-0.5 text-sm font-semibold">{agentLink}</h2>{deal.agent?.id !== undefined && can("user.view") && <DealHeaderAction label="Open agent in new tab"><Button asChild variant="ghost" size="icon-sm" aria-label="Open agent in new tab" className="-me-1 -mt-1 shrink-0"><Link to={`/agents/${deal.agent.id}`} target="_blank" rel="noreferrer"><ExternalLink className="size-3.5" /></Link></Button></DealHeaderAction>}</div></article>{managerName && <footer className="ms-6 mt-0 w-[calc(100%-1.5rem)] bg-foreground/8 px-3 rounded-b-xl py-1.5 text-xs text-muted-foreground"><strong>{managerName}'s</strong> team</footer>}</div></aside>
    </div>
    <ResourceDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this deal?" description={<>This permanently removes deal {deal.id}. This action cannot be undone.</>} confirmLabel="Delete deal" pending={saving} error={mutationError} onConfirm={deleteCurrentDeal} />
  </div></DealRelationOptionsContext.Provider>
}

function formatWholeCurrency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) }
function DealHeaderAction({ label, children }: { label: string; children: ReactNode }) { return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="bottom">{label}</TooltipContent></Tooltip> }
function DealPropertyMedia({ property }: { property: Deal["property"] }) {
  const images = property.images ?? []
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeImage = images[activeIndex]
  const showImage = (index: number) => { setActiveIndex(index); setOpen(true) }
  const move = (direction: -1 | 1) => setActiveIndex((current) => (current + direction + images.length) % images.length)

  if (!images.length) return <div className="grid aspect-[2/1] w-full place-items-center border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground"><span><ImageIcon className="mx-auto mb-2 size-4" />No listing image</span></div>

  const imageTile = (image: typeof images[number], index: number, className = "") => <span key={image.id} className={`relative block min-h-0 overflow-hidden bg-muted/20 ${className}`}><ProgressivePropertyImage image={image} alt={index === 0 ? property.title : ""} />{index === 4 && images.length > 5 && <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-medium text-white">+{images.length - 5}</span>}</span>
  const layout = images.length >= 5
    ? <span data-gallery-layout="five-plus" className="grid size-full grid-cols-2 gap-px bg-background"><span className="min-h-0 overflow-hidden bg-muted/20">{imageTile(images[0], 0, "size-full")}</span><span className="grid min-h-0 grid-cols-2 grid-rows-2 gap-px">{images.slice(1, 5).map((image, index) => imageTile(image, index + 1))}</span></span>
    : images.length >= 2
      ? <span data-gallery-layout={images.length === 4 ? "four" : images.length === 3 ? "three" : "two"} className="grid size-full grid-cols-3 gap-px bg-background"><span className="col-span-2 min-h-0 overflow-hidden bg-muted/20">{imageTile(images[0], 0, "size-full")}</span><span className={`grid min-h-0 gap-px ${images.length === 4 ? "grid-rows-3" : images.length === 3 ? "grid-rows-2" : "grid-rows-1"}`}>{images.slice(1, 4).map((image, index) => imageTile(image, index + 1))}</span></span>
      : <span data-gallery-layout="one" className="block size-full bg-muted/20">{imageTile(images[0], 0, "size-full")}</span>

  return <Dialog open={open} onOpenChange={setOpen}>
    <button type="button" className="group block aspect-[2/1] max-h-96 w-full overflow-hidden border border-border text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Open property gallery for ${property.title}`} onClick={() => showImage(0)}>{layout}</button>
        <DialogContent
          className="max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-5xl"
          showCloseButton
          onKeyDown={(event) => {
            if (images.length < 2) return

            if (event.key === "ArrowLeft") {
              event.preventDefault()
              move(-1)
            } else if (event.key === "ArrowRight") {
              event.preventDefault()
              move(1)
            }
          }}
        >
      <DialogHeader className="border-b border-border p-4 pe-12"><DialogTitle>{property.title}</DialogTitle><DialogDescription>{activeIndex + 1} of {images.length} images</DialogDescription></DialogHeader>
      {activeImage && <div className="relative grid max-h-[70vh] place-items-center bg-black/90"><img src={activeImage.url} alt={`${property.title}, image ${activeIndex + 1} of ${images.length}`} className="max-h-[70vh] w-full object-contain" />{images.length > 1 && <><button type="button" className="absolute start-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-secondary text-secondary-foreground outline-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Previous image" onClick={() => move(-1)}><ChevronLeft className="size-4" /></button><button type="button" className="absolute end-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-secondary text-secondary-foreground outline-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Next image" onClick={() => move(1)}><ChevronRight className="size-4" /></button></>}</div>}
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto border-t border-border p-3">{images.map((image, index) => <button key={image.id} type="button" className={`aspect-[4/3] w-20 shrink-0 overflow-hidden border ${index === activeIndex ? "border-primary" : "border-border"}`} aria-label={`Show image ${index + 1}`} aria-current={index === activeIndex} onClick={() => setActiveIndex(index)}><img src={image.thumbnail_url || image.url} alt="" className="size-full object-cover" /></button>)}</div>}
    </DialogContent>
  </Dialog>
}
function ProgressivePropertyImage({ image, alt }: { image: NonNullable<Deal["property"]["images"]>[number]; alt: string }) {
  const previewUrl = image.thumbnail_url || image.url
  const [fullImageLoaded, setFullImageLoaded] = useState(previewUrl === image.url)
  const [fullImageFailed, setFullImageFailed] = useState(false)

  useEffect(() => {
    setFullImageLoaded(previewUrl === image.url)
    setFullImageFailed(false)
  }, [image.url, previewUrl])

  return <>
    <img src={previewUrl} alt={previewUrl === image.url ? alt : ""} aria-hidden={previewUrl !== image.url || undefined} className={`size-full object-cover transition-[filter,opacity,transform] duration-200 ease-out motion-reduce:transition-none ${fullImageLoaded || fullImageFailed ? "scale-100 blur-0 opacity-100" : "scale-105 blur-sm opacity-100"}`} />
    {previewUrl !== image.url && !fullImageFailed && <img data-gallery-full-image src={image.url} alt={alt} onLoad={() => setFullImageLoaded(true)} onError={() => setFullImageFailed(true)} className={`absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out motion-reduce:transition-none ${fullImageLoaded ? "opacity-100" : "opacity-0"}`} />}
  </>
}
function DealDetailsSkeleton() { return <div className="space-y-8 p-6 lg:p-8"><Skeleton className="h-7 w-28" /><Skeleton className="h-12 w-2/3" /><Skeleton className="h-16 w-full" /><div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"><Skeleton className="h-96 w-full" /><Skeleton className="h-72 w-full" /></div></div> }
function DealDetailsState({ title, description, retry }: { title: string; description: string; retry?: () => void }) { return <ErrorState kind="not-found" title={title} description={description} actionLabel={retry ? "Retry" : "Return to deals"} actionTo="/deals" onAction={retry} /> }
