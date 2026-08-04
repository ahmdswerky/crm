import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, DollarSign, Eye, ImageIcon, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react"
import { z } from "zod"
import type { components as ListingComponents, paths as ListingPaths } from "@/api/generated/Listing"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePreviewDrawer } from "@/components/shared/resource-preview-drawer"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { StagedMultipleMediaField } from "@/components/shared/multiple-media-field"
import { uploadMediaFiles } from "@/components/shared/media-collection"
import { NumericRangeFilter, type NumericRange } from "@/components/shared/numeric-range-filter"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Property = ListingComponents["schemas"]["Property"]
type PropertyEnvelope = { property: Property }
type PropertyType = Property["type"]
type PropertyStatus = Property["status"]
type PropertyUpdatePayload = ListingPaths["/{id}"]["post"]["requestBody"]["content"]["application/json"]
type EditablePropertyStatus = Exclude<PropertyUpdatePayload["status"], null | undefined>
type PropertyFilterInfo = ListingPaths["/"]["get"]["responses"][200]["content"]["application/json"]["filter"]
type PropertyList = Paginated<Property> & { filter: PropertyFilterInfo }
type PropertyPreviewError = { message: string; status?: number }

const propertyTypes = ["land", "villa", "appartment", "mansion", "commercial"] as const satisfies readonly PropertyType[]
const propertyStatuses = ["pending", "showing", "sold"] as const satisfies readonly PropertyStatus[]
const editablePropertyStatuses = ["pending", "showing"] as const satisfies readonly EditablePropertyStatus[]

const propertySchema = z.object({
  title: z.string().trim().min(1, "Enter a property title."),
  description: z.string().trim().min(1, "Enter a property description."),
  city: z.string().trim().min(1, "Enter a city."),
  address: z.string().trim().min(1, "Enter an address."),
  price: z.string().trim().refine((value) => {
    const amount = Number(value)
    return Number.isFinite(amount) && amount >= 5000 && amount <= 1_000_000
  }, "Enter a price between $5,000 and $1,000,000."),
  type: z.enum(propertyTypes),
  status: z.enum(propertyStatuses).or(z.literal("")),
})

type PropertyFormValues = z.infer<typeof propertySchema>

const emptyValues: PropertyFormValues = {
  title: "",
  description: "",
  city: "",
  address: "",
  price: "",
  type: "villa",
  status: "pending",
}

const statusPillClass: Record<PropertyStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/20 text-amber-950 hover:bg-amber-500/20 dark:text-amber-100",
  showing: "border-blue-500/30 bg-blue-500/20 text-blue-950 hover:bg-blue-500/20 dark:text-blue-100",
  sold: "border-emerald-500/30 bg-emerald-500/20 text-emerald-950 hover:bg-emerald-500/20 dark:text-emerald-100",
}

const statusCardPillClass: Record<PropertyStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/25 px-2.5 py-1.5 text-amber-950 backdrop-blur-md hover:bg-amber-500/30 dark:text-amber-100",
  showing: "border-blue-500/40 bg-blue-500/25 px-2.5 py-1.5 text-blue-950 backdrop-blur-md hover:bg-blue-500/30 dark:text-blue-100",
  sold: "border-emerald-500/40 bg-emerald-500/25 px-2.5 py-1.5 text-emerald-950 backdrop-blur-md hover:bg-emerald-500/30 dark:text-emerald-100",
}

const statusTextClass: Record<PropertyStatus, string> = {
  pending: "text-amber-700/80 dark:text-amber-300/80",
  showing: "text-blue-700/80 dark:text-blue-300/80",
  sold: "text-emerald-700/80 dark:text-emerald-300/80",
}

const typeTextClass: Record<PropertyType, string> = {
  land: "text-sky-700/80 dark:text-sky-300/80",
  villa: "text-indigo-700/80 dark:text-indigo-300/80",
  appartment: "text-violet-700/80 dark:text-violet-300/80",
  mansion: "text-rose-700/80 dark:text-rose-300/80",
  commercial: "text-teal-700/80 dark:text-teal-300/80",
}

const labelFor = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "—"
const detailsPath = (id: number, returnSearch = "", edit = false) => {
  const params = new URLSearchParams()
  if (edit) params.set("mode", "edit")
  if (returnSearch) params.set("return", returnSearch)
  return `/properties/${id}${params.size ? `?${params.toString()}` : ""}`
}
const rangeValue = (value: string, fallback: number | null | undefined) => {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : fallback ?? 0
}

function valuesFromProperty(property: Property): PropertyFormValues {
  return {
    title: property.title,
    description: property.description,
    city: property.city,
    address: property.address,
    price: String(property.price),
    type: property.type,
    status: property.status ?? "",
  }
}

function toPayload(values: PropertyFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    city: values.city.trim(),
    address: values.address.trim(),
    price: Number(values.price),
    type: values.type,
    status: values.status || null,
  }
}

function toPropertyUpdatePayload(values: PropertyFormValues, property: Property): PropertyUpdatePayload {
  const status = values.status === "pending" || values.status === "showing" ? values.status : undefined
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    city: values.city.trim(),
    address: values.address.trim(),
    price: Number(values.price),
    type: values.type,
    ...(status ? { status } : {}),
    created_at: property.created_at,
    _method: "PUT",
  }
}

function PropertyCardImage({ property }: { property: Property }) {
  const cover = property.images?.[0]
  const imageCount = property.images?.length ?? 0

  return <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-muted/30">
    {cover ? <img src={cover.thumbnail_url || cover.url} alt="" className="size-full object-cover" loading="lazy" /> : <div className="grid size-full place-items-center text-muted-foreground"><ImageIcon className="size-5" aria-hidden="true" /></div>}
    <span className="absolute bottom-2 start-2 inline-flex items-center gap-1 border border-border bg-background/95 px-1.5 py-1 text-[11px] font-medium text-muted-foreground"><ImageIcon className="size-3" aria-hidden="true" />{imageCount} {imageCount === 1 ? "image" : "images"}</span>
  </div>
}

function PropertyCard({ property, detailsHref, editHref, selected, canEdit, canDelete, onOpen, onRequestDelete }: {
  property: Property
  detailsHref: string
  editHref: string
  selected: boolean
  canEdit: boolean
  canDelete: boolean
  onOpen: () => void
  onRequestDelete: () => void
}) {
  const propertyId = property.id
  const cardActionClass = "border-0 bg-background/45 backdrop-blur-md hover:bg-background/60"
  const destructiveCardActionClass = "border-0 bg-destructive/15 text-destructive backdrop-blur-md hover:bg-destructive/25"

  return <article role="button" tabIndex={0} aria-label={`Inspect ${property.title}`} aria-pressed={selected} onClick={onOpen} onKeyDown={(event) => {
    if (event.target !== event.currentTarget) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen()
    }
  }} className={`group relative overflow-hidden border bg-card outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${selected ? "border-primary bg-primary/[0.03]" : "border-border hover:bg-muted/20"}`}>
    <PropertyCardImage property={property} />
    <div className="absolute start-2 top-2"><Badge className={statusCardPillClass[property.status]}>{labelFor(property.status)}</Badge></div>
    <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      <ActionTooltip label="Open property details"><Button asChild variant="ghost" size="icon-sm" className={cardActionClass} aria-pressed={selected}><Link to={propertyId ? detailsHref : "/properties"} aria-label={`Open details for ${property.title}`} onClick={(event) => event.stopPropagation()}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit property"><Button asChild variant="ghost" size="icon-sm" className={cardActionClass}><Link to={propertyId ? editHref : "/properties"} aria-label={`Edit ${property.title}`} onClick={(event) => event.stopPropagation()}><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete property"><Button variant="ghost" size="icon-sm" aria-label={`Delete ${property.title}`} className={destructiveCardActionClass} onClick={(event) => { event.stopPropagation(); onRequestDelete() }}><Trash2 /></Button></ActionTooltip>}</div>
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-semibold tracking-tight" title={property.title}>{property.title}</h2><p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{property.city}</p></div><p className="shrink-0 font-mono text-lg font-semibold tracking-tight">{formatCurrency(property.price)}</p></div>
      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{property.description}</p>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><span className={`text-xs font-medium ${typeTextClass[property.type]}`}>{labelFor(property.type)}</span><span className="text-xs text-muted-foreground">Added {formatDate(property.created_at)}</span></div>
    </div>
  </article>
}

export function PropertiesPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const selectedId = Number(searchParams.get("record") ?? "") || undefined
  const mode = searchParams.get("mode")
  const returnParams = new URLSearchParams(searchParams)
  returnParams.delete("record")
  returnParams.delete("mode")
  const returnSearch = returnParams.toString()
  const query = searchParams.get("q") ?? ""
  const typeFilter = searchParams.get("type") ?? ""
  const statusFilter = searchParams.get("status") ?? ""
  const cityFilter = searchParams.get("city") ?? ""
  const minPriceFilter = searchParams.get("min_price") ?? ""
  const maxPriceFilter = searchParams.get("max_price") ?? ""
  const [queryInput, setQueryInput] = useState(query)
  const [cityInput, setCityInput] = useState(cityFilter)
  const [properties, setProperties] = useState<Property[]>([])
  const [meta, setMeta] = useState<Paginated<Property>["meta"] | null>(null)
  const [filterInfo, setFilterInfo] = useState<PropertyFilterInfo | null>(null)
  const [selected, setSelected] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [error, setError] = useState("")
  const [previewError, setPreviewError] = useState<PropertyPreviewError | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Property | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const loadProperties = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<PropertyList>(listUrl(`${API_BASE_URL}/v1/properties`, {
        page,
        q: query,
        type: typeFilter,
        status: statusFilter,
        city: cityFilter,
        min_price: minPriceFilter,
        max_price: maxPriceFilter,
      }), { signal })
      setProperties(body.data)
      setMeta(body.meta)
      setFilterInfo(body.filter)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load properties.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [cityFilter, maxPriceFilter, minPriceFilter, page, query, statusFilter, typeFilter])

  useEffect(() => {
    if (!can("property.view")) return
    const controller = new AbortController()
    void loadProperties(controller.signal)
    return () => controller.abort()
  }, [can, loadProperties])

  useEffect(() => {
    if (mode !== "create") return
    const createReturnParams = new URLSearchParams(searchParams)
    createReturnParams.delete("record")
    createReturnParams.delete("mode")
    const createReturn = createReturnParams.toString()
    navigate(`/properties/create${createReturn ? `?return=${encodeURIComponent(createReturn)}` : ""}`, { replace: true })
  }, [mode, navigate, searchParams])

  useEffect(() => {
    if (mode !== "edit" || !selectedId) return
    navigate(detailsPath(selectedId, returnSearch, true), { replace: true })
  }, [mode, navigate, returnSearch, selectedId])

  useEffect(() => {
    if (!selectedId || mode === "create" || mode === "edit") {
      setSelected(null)
      setPreviewError(null)
      setSelectionLoading(false)
      return
    }

    const listed = properties.find((property) => property.id === selectedId)
    if (listed) setSelected(listed)

    const controller = new AbortController()
    setSelectionLoading(true)
    setPreviewError(null)
    void apiJson<PropertyEnvelope>(`${API_BASE_URL}/v1/properties/${selectedId}`, { signal: controller.signal })
      .then((body) => {
        setSelected(body.property)
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setSelected(null)
          setPreviewError({ message: caught instanceof Error ? caught.message : "Unable to load this property.", status: caught instanceof ApiError ? caught.status : undefined })
        }
      })
      .finally(() => { if (!controller.signal.aborted) setSelectionLoading(false) })
    return () => controller.abort()
  }, [mode, properties, selectedId])

  const setParams = (next: Record<string, string | undefined>) => setSearchParams((current) => {
    const params = new URLSearchParams(current)
    Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value))
    return params
  })

  const updateFilter = (key: "type" | "status", value: string) => setParams({ [key]: value || undefined, page: "1", record: undefined, mode: undefined })
  const clearFilters = () => setParams({ q: undefined, type: undefined, status: undefined, city: undefined, min_price: undefined, max_price: undefined, page: "1", record: undefined, mode: undefined })

  useEffect(() => {
    setQueryInput(query)
    setCityInput(cityFilter)
  }, [cityFilter, query])

  useEffect(() => {
    if (queryInput === query && cityInput === cityFilter) return
    const timeout = window.setTimeout(() => setSearchParams((current) => {
      const params = new URLSearchParams(current)
      const values: Record<string, string> = { q: queryInput.trim(), city: cityInput.trim() }
      Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key))
      params.set("page", "1")
      params.delete("record")
      params.delete("mode")
      return params
    }), 500)
    return () => window.clearTimeout(timeout)
  }, [cityFilter, cityInput, query, queryInput, setSearchParams])

  const priceRange: NumericRange = [
    rangeValue(minPriceFilter, filterInfo?.min_price),
    rangeValue(maxPriceFilter, filterInfo?.max_price),
  ]
  const updatePriceRange = (next: NumericRange) => {
    if (filterInfo?.min_price === null || filterInfo?.max_price === null || !filterInfo) return
    setParams({
      min_price: next[0] <= filterInfo.min_price ? undefined : String(next[0]),
      max_price: next[1] >= filterInfo.max_price ? undefined : String(next[1]),
      page: "1",
      record: undefined,
      mode: undefined,
    })
  }

  const openProperty = (id: number) => selectedId === id && !mode
    ? setParams({ record: undefined })
    : setParams({ page: String(page), record: String(id), mode: undefined })

  async function deleteProperty() {
    if (!pendingDelete?.id) return
    setDeleting(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/properties/${pendingDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      const deletedId = pendingDelete.id
      setPendingDelete(null)
      if (selectedId === deletedId) setParams({ page: String(page), record: undefined, mode: undefined })
      await loadProperties()
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this property.")
    } finally {
      setDeleting(false)
    }
  }

  if (!can("property.view")) return <ForbiddenProperties />
  const canCreate = can("property.create")
  const canEdit = can("property.edit")
  const canDelete = can("property.delete")
  const hasFilters = Boolean(query || typeFilter || statusFilter || cityFilter || minPriceFilter || maxPriceFilter)
  const filteredProperties = properties
  const propertyGridClass = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
  const createPath = `/properties/create${returnSearch ? `?return=${encodeURIComponent(returnSearch)}` : ""}`
  const previewOpen = Boolean(selectedId && mode !== "create" && mode !== "edit")

  return <div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="text-xs font-medium text-muted-foreground">CRM / Listings</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Properties</h1><p className="mt-1 text-sm text-muted-foreground">Keep the inventory view aligned with the team.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void loadProperties()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canCreate && <Button asChild size="sm"><Link to={createPath}><Plus className="me-2 size-3.5" />New property</Link></Button>}</div></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
      <div className="min-w-56 flex-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="property-search">Search</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="property-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Title, description, city, address, owner…" /></div></div>
      <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground">Type</label><Select value={typeFilter || "all"} onValueChange={(value) => updateFilter("type", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{propertyTypes.map((type) => <SelectItem key={type} value={type}><span className={`capitalize ${typeTextClass[type]}`}>{labelFor(type)}</span></SelectItem>)}</SelectContent></Select></div>
      <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={statusFilter || "all"} onValueChange={(value) => updateFilter("status", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{propertyStatuses.map((status) => <SelectItem key={status} value={status}><span className={statusTextClass[status]}>{labelFor(status)}</span></SelectItem>)}</SelectContent></Select></div>
      <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground" htmlFor="property-city-filter">City</label><Input id="property-city-filter" className="mt-1" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="Any city" /></div>
      <NumericRangeFilter id="property-price-range" label="Price range" min={filterInfo?.min_price} max={filterInfo?.max_price} value={priceRange} onChange={updatePriceRange} format={formatCurrency} />
      {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}
    </div>
    <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground"><p>{loading ? "Loading inventory…" : `${meta?.total ?? filteredProperties.length} ${meta?.total === 1 ? "property" : "properties"} in inventory`}</p><p className="hidden sm:block">Select a listing to inspect it</p></div>
        {loading ? <div data-testid="properties-grid" className={propertyGridClass}>{Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden border border-border bg-card"><Skeleton className="aspect-[16/9] w-full" /><div className="space-y-3 p-4"><Skeleton className="h-5 w-4/5" /><Skeleton className="h-7 w-1/2" /><Skeleton className="h-4 w-3/5" /></div></div>)}</div> : filteredProperties.length ? <div data-testid="properties-grid" className={propertyGridClass}>{filteredProperties.map((property) => <PropertyCard key={property.id ?? property.title} property={property} detailsHref={property.id ? detailsPath(property.id, returnSearch) : "/properties"} editHref={property.id ? detailsPath(property.id, returnSearch, true) : "/properties"} selected={selectedId === property.id} canEdit={canEdit} canDelete={canDelete} onOpen={() => property.id && openProperty(property.id)} onRequestDelete={() => setPendingDelete(property)} />)}</div> : <div data-testid="properties-grid" className="grid min-h-56 place-items-center border border-dashed border-border bg-muted/20 p-6 text-center"><div><p className="font-medium">{hasFilters ? "No properties match these filters" : "No properties yet"}</p><p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Try broadening the search or clearing the active filters." : "Create a property to start building the listing inventory."}</p>{hasFilters ? <Button variant="link" size="sm" className="mt-2" onClick={clearFilters}>Clear filters</Button> : canCreate && <Button asChild size="sm" className="mt-3"><Link to={createPath}><Plus />New property</Link></Button>}</div></div>}
        <div className="mt-4 border border-border bg-card"><ResourcePagination page={meta?.current_page ?? page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} /></div>
      </section>
    <ResourcePreviewDrawer open={previewOpen} onOpenChange={(open) => { if (!open) setParams({ record: undefined }) }} title="Property preview" description="Read-only property details and available actions.">
      {selectionLoading && !selected ? <div className="space-y-4 p-5"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-24 w-full" /></div> : previewError ? <div className="space-y-3 p-5"><h2 className="font-semibold">{previewError.status === 403 ? "Property is restricted" : previewError.status === 404 ? "Property not found" : "Unable to load property"}</h2><p role="alert" className="text-sm text-destructive">{previewError.message}</p><Button variant="outline" size="sm" onClick={() => setParams({ record: undefined })}>Close preview</Button></div> : selected ? <PropertyInspector property={selected} detailsHref={selected.id ? detailsPath(selected.id, returnSearch) : "/properties"} editHref={selected.id ? detailsPath(selected.id, returnSearch, true) : "/properties"} canEdit={canEdit} canDelete={canDelete} onDelete={() => setPendingDelete(selected)} /> : <div className="p-5 text-sm text-muted-foreground">This property could not be loaded.</div>}
    </ResourcePreviewDrawer>
    <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) { setPendingDelete(null); setDeleteError("") } }} title={`Delete ${pendingDelete?.title ?? "property"}?`} description={<>This permanently removes {pendingDelete?.title ?? "this property"} from the inventory. This action cannot be undone.</>} confirmLabel="Delete property" pending={deleting} error={deleteError} onConfirm={deleteProperty} />
  </div>
}

function PropertyBlockStartField({ label, required, error, className, inputId, icon, children }: { label: string; required?: boolean; error?: string; className?: string; inputId: string; icon?: ReactNode; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{icon}{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon>{children}</InputGroup><FieldError>{error}</FieldError></Field>
}

function PropertySelectField({ label, required, error, className, inputId, value, onValueChange, placeholder, children }: { label: string; required?: boolean; error?: string; className?: string; inputId: string; value: string; onValueChange: (value: string) => void; placeholder?: string; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon><Select value={value} onValueChange={onValueChange}><SelectTrigger id={inputId} aria-labelledby={labelId} aria-invalid={Boolean(error)} data-slot="input-group-control" className="h-8 w-full rounded-none border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{children}</SelectContent></Select></InputGroup><FieldError>{error}</FieldError></Field>
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

function PropertyInspector({ property, detailsHref, editHref, canEdit, canDelete, onDelete }: { property: Property | null; detailsHref: string; editHref: string; canEdit: boolean; canDelete: boolean; onDelete: () => void }) {
  if (!property) return null
  return <div className="space-y-6 p-5"><header className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Property record</p><h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{property.title}</h2><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{property.city}<span aria-hidden="true">·</span>{labelFor(property.type)}</p></div><div className="flex shrink-0 gap-1"><ActionTooltip label="Open dedicated details"><Button asChild variant="outline" size="icon"><Link to={detailsHref} aria-label="Open dedicated details"><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit property"><Button asChild variant="outline" size="icon"><Link to={editHref} aria-label="Edit property"><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete property"><Button variant="outline" size="icon" aria-label="Delete property" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /></Button></ActionTooltip>}</div></header><div className="flex flex-wrap gap-2"><Badge className={statusPillClass[property.status]}>{labelFor(property.status)}</Badge><span className={`inline-flex items-center rounded-sm border border-border px-2 py-1 text-xs capitalize ${typeTextClass[property.type]}`}>{labelFor(property.type)}</span></div><section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Listing value</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{formatCurrency(property.price)}</p><p className="mt-1 text-sm text-muted-foreground">Current asking price</p></section><section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Location</p><dl className="mt-4 grid gap-4 text-sm"><Info label="City" value={property.city} /><Info label="Address" value={property.address} /></dl></section><section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Description</p><p className="mt-3 text-sm leading-6 text-muted-foreground">{property.description}</p></section>{property.owner && <section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Owner</p><div className="mt-3 flex items-center gap-2">{property.owner.id !== undefined && <PersonAvatar name={property.owner.name} size="sm" />}<div>{property.owner.id !== undefined ? <Link className="text-primary hover:text-foreground" to={`/agents/${property.owner.id}`} onClick={(event) => event.stopPropagation()}>{property.owner.name}</Link> : <span className="font-medium">{property.owner.name}</span>}<p className="text-xs text-muted-foreground">{property.owner.email}</p></div></div></section>}<Separator /><p className="text-xs text-muted-foreground">Created {formatDate(property.created_at)}</p></div>
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>
}

function ForbiddenProperties() {
  return <ErrorState kind="forbidden" title="Properties are restricted" description="You do not have permission to view property listings." actionLabel="Return to overview" actionTo="/" />
}

function PropertyDetailsState({ title, description, backTo = "/properties" }: { title: string; description: string; backTo?: string }) {
  return <ErrorState kind="not-found" title={title} description={description} actionLabel="Return to properties" actionTo={backTo} />
}

export function PropertyDetailsPage({ create = false }: { create?: boolean } = {}) {
  const { can } = useAuth()
  const { propertyId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = Number(propertyId)
  const [property, setProperty] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [missing, setMissing] = useState(false)
  const [accessError, setAccessError] = useState<"unauthorized" | "forbidden" | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [stagedImages, setStagedImages] = useState<File[]>([])
  const [createdProperty, setCreatedProperty] = useState<Property | null>(null)
  const [mediaUploadError, setMediaUploadError] = useState("")
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const form = useForm<PropertyFormValues>({ resolver: zodResolver(propertySchema), defaultValues: emptyValues })
  const editing = !create && searchParams.get("mode") === "edit" && can("property.edit")
  const returnSearch = searchParams.get("return") ?? ""
  const indexHref = returnSearch ? `/properties?${returnSearch}` : "/properties"
  const handleStagedImagesChange = useCallback((files: File[]) => {
    setStagedImages(files)
    if (files.length) setMediaUploadError("")
  }, [])

  const loadProperty = useCallback(async (signal?: AbortSignal) => {
    if (!can("property.view") || !Number.isInteger(id) || id < 1) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    setMissing(false)
    setAccessError(null)
    try {
      const body = await apiJson<PropertyEnvelope>(`${API_BASE_URL}/v1/properties/${id}`, { signal })
      setProperty(body.property)
      form.reset(valuesFromProperty(body.property))
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      if (caught instanceof ApiError && caught.status === 401) setAccessError("unauthorized")
      else if (caught instanceof ApiError && caught.status === 403) setAccessError("forbidden")
      else if (caught instanceof ApiError && caught.status === 404) setMissing(true)
      else setError(caught instanceof Error ? caught.message : "Unable to load this property.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [can, form, id])

  useEffect(() => {
    const controller = new AbortController()
    if (create) {
      form.reset(emptyValues)
      setProperty(null)
      setError("")
      setStagedImages([])
      setCreatedProperty(null)
      setMediaUploadError("")
      setUploadingMedia(false)
      setLoading(false)
      return () => controller.abort()
    }
    void loadProperty(controller.signal)
    return () => controller.abort()
  }, [create, form, loadProperty])

  const setEditMode = (enabled: boolean) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (enabled) next.set("mode", "edit")
    else next.delete("mode")
    return next
  })

  async function deleteCurrentProperty() {
    if (!property?.id) return
    setDeleting(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/properties/${property.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      navigate(indexHref, { replace: true })
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this property.")
      setDeleting(false)
    }
  }

  const saveProperty = form.handleSubmit(async (values) => {
    if (!property?.id) return
    setError("")
    try {
      const result = await apiJson<PropertyEnvelope>(`${API_BASE_URL}/v1/properties/${property.id}`, {
        method: "POST",
        body: JSON.stringify(toPropertyUpdatePayload(values, property)),
      })
      setProperty(result.property)
      form.reset(valuesFromProperty(result.property))
      setEditMode(false)
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof PropertyFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to save this property.")
    }
  })

  const createProperty = form.handleSubmit(async (values) => {
    setError("")
    try {
      const result = await apiJson<PropertyEnvelope>(`${API_BASE_URL}/v1/properties`, {
        method: "POST",
        body: JSON.stringify(toPayload(values)),
      })
      if (!stagedImages.length) {
        if (!result.property.id) {
          navigate(indexHref, { replace: true })
          return
        }
        const detailsParams = returnSearch ? new URLSearchParams({ return: returnSearch }) : undefined
        navigate(`/properties/${result.property.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
        return
      }
      if (!result.property.id) {
        setError("Property was created, but its identifier was not returned, so the staged images could not be uploaded.")
        return
      }
      setCreatedProperty(result.property)
      setUploadingMedia(true)
      try {
        await uploadMediaFiles({ ownerType: "property", ownerId: result.property.id, collection: "gallery", files: stagedImages })
        const detailsParams = returnSearch ? new URLSearchParams({ return: returnSearch }) : undefined
        navigate(`/properties/${result.property.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
      } catch (caught) {
        setMediaUploadError(caught instanceof Error ? caught.message : "Unable to upload the staged images.")
      } finally {
        setUploadingMedia(false)
      }
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof PropertyFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to create this property.")
    }
  })

  const retryMediaUpload = form.handleSubmit(async () => {
    if (!createdProperty?.id || !stagedImages.length) return
    setMediaUploadError("")
    setUploadingMedia(true)
    try {
      await uploadMediaFiles({ ownerType: "property", ownerId: createdProperty.id, collection: "gallery", files: stagedImages })
      const detailsParams = returnSearch ? new URLSearchParams({ return: returnSearch }) : undefined
      navigate(`/properties/${createdProperty.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
    } catch (caught) {
      setMediaUploadError(caught instanceof Error ? caught.message : "Unable to upload the staged images.")
    } finally {
      setUploadingMedia(false)
    }
  })

  const mediaField = <StagedMultipleMediaField disabled={uploadingMedia} onFilesChange={handleStagedImagesChange} />

  const createdPropertyHref = createdProperty?.id ? detailsPath(createdProperty.id, returnSearch) : indexHref

  if (create && !can("property.create")) return <ErrorState kind="forbidden" title="Property creation is restricted" description="You do not have permission to create properties." actionLabel="Return to properties" actionTo="/properties" />
  if (!create && !can("property.view")) return <ForbiddenProperties />
  if (create) return <main className="mx-auto max-w-[100rem] space-y-6 p-6 pb-24 lg:p-8"><header className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6"><div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Back to properties</Link></Button><h1 className="mt-5 text-2xl font-semibold tracking-tight">{createdProperty ? "Finish image upload" : "New property"}</h1></div><div className="flex shrink-0 items-center gap-2">{createdProperty ? <><Button asChild type="button" variant="outline"><Link to={createdPropertyHref}>Open property</Link></Button><Button type="submit" form="property-create-form" disabled={uploadingMedia || !stagedImages.length}>{uploadingMedia ? "Uploading…" : "Retry images"}</Button></> : <><Button type="button" variant="outline" onClick={() => navigate(indexHref)}>Cancel</Button><Button type="submit" form="property-create-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create"}</Button></>}</div></header>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{mediaUploadError && createdProperty && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Property was created, but its images could not be uploaded. {mediaUploadError}</div>}<PropertyDetailsEditor property={null} create form={form} formId="property-create-form" hideToolbar saving={form.formState.isSubmitting || uploadingMedia} mediaField={mediaField} onCancel={() => navigate(createdPropertyHref)} onSubmit={createdProperty ? retryMediaUpload : createProperty} /></main>
  if (!Number.isInteger(id) || id < 1) return <PropertyDetailsState title="Property not found" description="The property identifier is invalid." backTo={indexHref} />
  if (loading) return <PropertyDetailsSkeleton />
  if (accessError === "unauthorized") return <ErrorState kind="unauthorized" title="Your session has ended" description="Sign in again to continue working with properties." actionLabel="Sign in" actionTo="/login" />
  if (accessError === "forbidden") return <ErrorState kind="forbidden" title="This property is restricted" description="You do not have access to this property record." actionLabel="Return to properties" actionTo={indexHref} />
  if (missing) return <PropertyDetailsState title="Property not found" description="This listing may have been removed or you may not have access to it." backTo={indexHref} />
  if (!property) return <PropertyDetailsLoadError message={error || "Unable to load this property."} backTo={indexHref} onRetry={() => void loadProperty()} />

  const canEdit = can("property.edit")
  const canDelete = can("property.delete")
  return <main className="mx-auto max-w-[100rem] space-y-6 p-6 lg:p-8">
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Properties</Link></Button><div className="mt-5 flex flex-wrap items-center gap-2"><PropertyStatusSummary status={property.status} /><span className={`text-xs font-medium ${typeTextClass[property.type]}`}>{labelFor(property.type)}</span></div><h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{property.title}</h1><p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{property.address}, {property.city}</span></p></div>
        <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => void loadProperty()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canEdit && <Button size="sm" onClick={() => setEditMode(true)}><Pencil className="me-2 size-3.5" />Edit property</Button>}{canDelete && <ActionTooltip label="Delete property"><Button variant="outline" size="icon" className="text-destructive hover:text-destructive" aria-label="Delete property" onClick={() => { setDeleteError(""); setDeleteOpen(true) }}><Trash2 /></Button></ActionTooltip>}</div>
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">Asking price</p><p className="mt-1 font-mono text-3xl font-semibold tracking-tight">{formatCurrency(property.price)}</p></div><div className="flex flex-wrap gap-x-8 gap-y-3 text-sm"><div><p className="text-xs text-muted-foreground">Property type</p><p className="mt-1 font-medium">{labelFor(property.type)}</p></div><div><p className="text-xs text-muted-foreground">Listed</p><p className="mt-1 font-medium">{formatDate(property.created_at)}</p></div><div><p className="text-xs text-muted-foreground">Property ID</p><p className="mt-1 font-mono text-xs font-medium">#{property.id}</p></div></div></div>
    </header>

    {error && <div role="alert" className="flex items-center justify-between gap-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setError("")}>Dismiss</Button></div>}

    {editing ? <PropertyDetailsEditor property={property} form={form} saving={form.formState.isSubmitting} onCancel={() => { form.reset(valuesFromProperty(property)); setEditMode(false) }} onSubmit={saveProperty} /> : <><PropertyMobileContactBar property={property} canViewOwner={can("user.view")} /><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start"><div className="min-w-0 space-y-8"><PropertyHeroGallery property={property} /><section className="border-t border-border pt-5"><h2 className="text-lg font-semibold tracking-tight">Description</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{property.description}</p></section><section className="border-t border-border pt-5"><h2 className="text-lg font-semibold tracking-tight">Location</h2><dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2"><Info label="Address" value={property.address} /><Info label="City" value={property.city} /></dl></section>{property.id !== undefined && <ActivityLogList model="property" id={property.id} title="Property activity" onReverted={() => void loadProperty()} />}</div><div className="hidden xl:block"><PropertyOwnerRail property={property} canViewOwner={can("user.view")} /></div></div></>}
    <ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${property.title}?`} description={<>This permanently removes {property.title} from the inventory. This action cannot be undone.</>} confirmLabel="Delete property" pending={deleting} error={deleteError} onConfirm={deleteCurrentProperty} />
  </main>
}

function PropertyStatusSummary({ status }: { status: PropertyStatus }) {
  return <Badge className={statusPillClass[status]}>Status: {labelFor(status)}</Badge>
}

function PropertyHeroGallery({ property }: { property: Property }) {
  const images = property.images ?? []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeImage = images[Math.min(activeIndex, Math.max(images.length - 1, 0))]

  useEffect(() => setActiveIndex(0), [property.id])

  if (!activeImage) return <section className="grid aspect-[16/9] place-items-center border border-dashed border-border bg-muted/20"><div className="text-center text-muted-foreground"><ImageIcon className="mx-auto size-7" aria-hidden="true" /><p className="mt-3 text-sm font-medium text-foreground">No listing images</p></div></section>

  return <section aria-label="Property gallery"><a href={activeImage.url} target="_blank" rel="noreferrer" className="group relative block overflow-hidden border border-border bg-muted/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><img src={activeImage.url} alt={`${property.title} — ${activeImage.name}`} className="aspect-[16/9] w-full object-cover" /><span className="absolute bottom-3 start-3 border border-border bg-background/95 px-2 py-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Open full image</span></a>{images.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Choose gallery image">{images.map((image, index) => <button key={image.id} type="button" aria-label={`View image ${index + 1}: ${image.name}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)} className={`shrink-0 overflow-hidden border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${index === activeIndex ? "border-primary" : "border-border opacity-70 hover:opacity-100"}`}><img src={image.thumbnail_url || image.url} alt="" className="aspect-[4/3] w-20 object-cover" /></button>)}</div>}<p className="mt-3 text-xs text-muted-foreground">{images.length} {images.length === 1 ? "image" : "images"}</p></section>
}

function PropertyMobileContactBar({ property, canViewOwner }: { property: Property; canViewOwner: boolean }) {
  const owner = property.owner
  if (!owner) return null
  const ownerName = owner.id !== undefined && canViewOwner ? <Link className="font-medium text-primary hover:text-foreground" to={`/agents/${owner.id}`}>{owner.name}</Link> : <span className="font-medium">{owner.name}</span>
  return <aside className="border-y border-border py-3 xl:hidden"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2">{owner.id !== undefined && <PersonAvatar name={owner.name} size="sm" />}<div className="min-w-0"><p className="text-xs text-muted-foreground">Owner</p>{ownerName}</div></div><div className="flex gap-2">{owner.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${owner.email}`}><Mail className="me-1.5 size-3.5" />Email</a></Button>}{owner.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${owner.phone}`}><Phone className="me-1.5 size-3.5" />Call</a></Button>}</div></div></aside>
}

function PropertyOwnerRail({ property, canViewOwner }: { property: Property; canViewOwner: boolean }) {
  const owner = property.owner
  if (!owner) return <aside className="border-t border-border pt-5 xl:sticky xl:top-6"><p className="text-xs font-medium text-muted-foreground">Owner</p><p className="mt-3 text-sm text-muted-foreground">No owner is assigned.</p></aside>
  const ownerName = owner.id !== undefined && canViewOwner ? <Link className="font-semibold text-primary hover:text-foreground" to={`/agents/${owner.id}`}>{owner.name}</Link> : <p className="font-semibold">{owner.name}</p>
  return <aside className="border-t border-border pt-5 xl:sticky xl:top-6"><p className="text-xs font-medium text-muted-foreground">Owner</p><div className="mt-4 flex items-center gap-3">{owner.id !== undefined && <PersonAvatar name={owner.name} />}<div className="min-w-0">{ownerName}<p className="mt-0.5 truncate text-xs text-muted-foreground">{owner.username}</p></div></div>{(owner.email || owner.phone) && <><div className="mt-5 space-y-3 border-t border-border pt-4">{owner.email && <a className="flex items-center gap-2 text-sm text-primary hover:text-foreground" href={`mailto:${owner.email}`}><Mail className="size-3.5" aria-hidden="true" /><span className="truncate">{owner.email}</span></a>}{owner.phone && <a className="flex items-center gap-2 text-sm text-primary hover:text-foreground" href={`tel:${owner.phone}`}><Phone className="size-3.5" aria-hidden="true" /><span>{owner.phone}</span></a>}</div><div className="mt-5 flex flex-wrap gap-2">{owner.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${owner.email}`}><Mail className="me-1.5 size-3.5" />Email</a></Button>}{owner.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${owner.phone}`}><Phone className="me-1.5 size-3.5" />Call</a></Button>}</div></>}</aside>
}

function PropertyDetailsEditor({ property, create = false, form, saving, onCancel, onSubmit, hideToolbar = false, formId, mediaField }: { property: Property | null; create?: boolean; form: ReturnType<typeof useForm<PropertyFormValues>>; saving: boolean; onCancel: () => void; onSubmit: () => void; hideToolbar?: boolean; formId?: string; mediaField?: ReactNode }) {
  const { register, formState: { errors }, setValue, watch } = form
  const statusIsReturnedOnly = !create && property?.status === "sold"
  return <form id={formId} onSubmit={onSubmit} className={hideToolbar ? "w-full" : "w-full border-t border-border pt-5"}>
    {!hideToolbar && <div className="sticky top-0 z-10 -mt-5 border-b border-border bg-background py-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">{create ? "Create property" : "Edit property"}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Listing information</h2></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? (create ? "Creating…" : "Saving…") : create ? "Create" : <><Save className="me-2 size-3.5" />Save changes</>}</Button></div></div></div>}
    <FieldGroup className={`${hideToolbar ? "mt-0" : "mt-6"} grid w-full gap-4 sm:grid-cols-2`}>
      <PropertyBlockStartField inputId="property-details-title" label="Title" required error={errors.title?.message} className="sm:col-span-2"><InputGroupInput id="property-details-title" aria-labelledby="property-details-title-label" aria-invalid={Boolean(errors.title)} {...register("title")} className="h-9 px-2.5" /></PropertyBlockStartField>
      <PropertyBlockStartField inputId="property-details-city" label="City" required error={errors.city?.message} icon={<MapPin className="size-3.5" aria-hidden="true" />}><InputGroupInput id="property-details-city" aria-labelledby="property-details-city-label" aria-invalid={Boolean(errors.city)} {...register("city")} className="h-9 px-2.5" /></PropertyBlockStartField>
      <PropertyBlockStartField inputId="property-details-address" label="Address" required error={errors.address?.message} icon={<MapPin className="size-3.5" aria-hidden="true" />}><InputGroupInput id="property-details-address" aria-labelledby="property-details-address-label" aria-invalid={Boolean(errors.address)} {...register("address")} className="h-9 px-2.5" /></PropertyBlockStartField>
      <PropertyBlockStartField inputId="property-details-price" label="Price" required error={errors.price?.message} icon={<DollarSign className="size-3.5" aria-hidden="true" />}><InputGroupInput id="property-details-price" aria-labelledby="property-details-price-label" aria-invalid={Boolean(errors.price)} type="number" min="5000" max="1000000" step="any" {...register("price")} className="h-9 px-2.5" /></PropertyBlockStartField>
      <PropertySelectField inputId="property-details-type" label="Type" required error={errors.type?.message} value={watch("type")} onValueChange={(value) => setValue("type", value as PropertyFormValues["type"], { shouldValidate: true })}>{propertyTypes.map((type) => <SelectItem key={type} value={type}>{labelFor(type)}</SelectItem>)}</PropertySelectField>
      {statusIsReturnedOnly ? <PropertyBlockStartField inputId="property-details-status" label="Status" className="sm:col-span-2"><div className="flex items-center gap-3 px-2.5 py-2 text-sm"><Badge className={statusPillClass.sold}>Sold</Badge><span className="text-muted-foreground">Sold is retained.</span></div></PropertyBlockStartField> : <PropertySelectField inputId="property-details-status" label="Status" error={errors.status?.message} className="sm:col-span-2" value={watch("status") || "none"} onValueChange={(value) => setValue("status", value === "none" ? "" : value as PropertyFormValues["status"], { shouldValidate: true })} placeholder="No status"><SelectItem value="none">No status</SelectItem>{editablePropertyStatuses.map((status) => <SelectItem key={status} value={status}>{labelFor(status)}</SelectItem>)}</PropertySelectField>}
      <PropertyBlockStartField inputId="property-details-description" label="Description" required error={errors.description?.message} className="sm:col-span-2"><InputGroupTextarea id="property-details-description" aria-labelledby="property-details-description-label" aria-invalid={Boolean(errors.description)} className="min-h-32 px-2.5" {...register("description")} /></PropertyBlockStartField>
      {create && mediaField}
    </FieldGroup>
  </form>
}

function PropertyDetailsSkeleton() {
  return <div className="mx-auto max-w-[100rem] space-y-6 p-6 lg:p-8"><div className="border-b border-border pb-6"><Skeleton className="h-7 w-28" /><Skeleton className="mt-6 h-9 w-3/5" /><Skeleton className="mt-3 h-5 w-2/5" /><Skeleton className="mt-8 h-10 w-44" /></div><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]"><Skeleton className="aspect-[16/9] w-full" /><div className="space-y-4 border-t border-border pt-5"><Skeleton className="h-4 w-16" /><Skeleton className="h-10 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div></div></div>
}

function PropertyDetailsLoadError({ message, backTo, onRetry }: { message: string; backTo: string; onRetry: () => void }) {
  return <div className="mx-auto max-w-xl p-6 lg:p-8"><div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p className="font-semibold">Unable to open property</p><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-4 flex gap-2"><Button onClick={onRetry}>Try again</Button><Button asChild variant="outline"><Link to={backTo}>Back to properties</Link></Button></div></div></div>
}
