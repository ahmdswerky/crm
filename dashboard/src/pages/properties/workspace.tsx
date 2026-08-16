// Shared implementation for the Properties route entry modules.
import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { motion } from "motion/react"
import { ArrowLeft, Building2, ChevronDown, ChevronLeft, ChevronRight, DollarSign, Eye, FileText, Funnel, ImageIcon, Inbox, MapPin, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react"
import { z } from "zod"
import type { components as ListingComponents, paths as ListingPaths } from "@/api/generated/Listing"
import type { components as SalesComponents } from "@/api/generated/Sales"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { MultipleMediaField, StagedMultipleMediaField } from "@/components/shared/multiple-media-field"
import { uploadMediaFiles } from "@/components/shared/media-collection"
import { NumericRangeFilter, type NumericRange } from "@/components/shared/numeric-range-filter"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Property = ListingComponents["schemas"]["Property"]
type PropertyEnvelope = { property: Property }
type PropertyType = Property["type"]
type PropertyStatus = Property["status"]
type PropertyUpdatePayload = ListingPaths["/{id}"]["post"]["requestBody"]["content"]["application/json"]
type PropertyFilterInfo = ListingPaths["/"]["get"]["responses"][200]["content"]["application/json"]["filter"]
type PropertyList = Paginated<Property> & { filter: PropertyFilterInfo }
type PropertyDeal = SalesComponents["schemas"]["Deal"]
type PropertyDealList = Paginated<PropertyDeal>

const propertyTypes = ["land", "villa", "appartment", "mansion", "commercial"] as const satisfies readonly PropertyType[]
const propertyStatuses = ["pending", "showing", "sold"] as const satisfies readonly PropertyStatus[]

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
})

type PropertyFormValues = z.infer<typeof propertySchema>

const emptyValues: PropertyFormValues = {
  title: "",
  description: "",
  city: "",
  address: "",
  price: "",
  type: "villa",
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

const dealStatusPillClass: Record<PropertyDeal["status"], string> = {
  inquiry: "border-slate-500/20 bg-slate-500/10 text-slate-800 hover:bg-slate-500/10 dark:text-slate-200",
  viewing: "border-blue-500/20 bg-blue-500/10 text-blue-800 hover:bg-blue-500/10 dark:text-blue-200",
  offer_made: "border-amber-500/20 bg-amber-500/10 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100",
  legal: "border-violet-500/20 bg-violet-500/10 text-violet-900 hover:bg-violet-500/10 dark:text-violet-100",
  won: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/10 dark:text-emerald-100",
  lost: "border-red-500/20 bg-red-500/10 text-red-900 hover:bg-red-500/10 dark:text-red-100",
}

const labelFor = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
const detailsPath = (id: number, returnSearch = "") => `/properties/${id}${returnSearch ? `?${returnSearch}` : ""}`
const editPath = (id: number, returnSearch = "") => `/properties/${id}/edit${returnSearch ? `?${returnSearch}` : ""}`
const rangeValue = (value: string, fallback: number | null | undefined) => {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : fallback ?? 0
}

const filterMotionTransition = { type: "spring", stiffness: 500, damping: 42, mass: 0.65 } as const
const filterSlideTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

function valuesFromProperty(property: Property): PropertyFormValues {
  return {
    title: property.title,
    description: property.description,
    city: property.city,
    address: property.address,
    price: String(property.price),
    type: property.type,
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
  }
}

function toPropertyUpdatePayload(values: PropertyFormValues, property: Property): PropertyUpdatePayload {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    city: values.city.trim(),
    address: values.address.trim(),
    price: Number(values.price),
    type: values.type,
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

function PropertyCard({ property, detailsHref, editHref, canEdit, canDelete, canCreateDeal, onRequestDelete }: {
  property: Property
  detailsHref: string
  editHref: string
  canEdit: boolean
  canDelete: boolean
  canCreateDeal: boolean
  onRequestDelete: () => void
}) {
  const propertyId = property.id
  const hasDeals = (property.deals_count ?? 0) > 0
  const cardActionClass = "border-0 bg-background/45 backdrop-blur-md hover:bg-background/60"
  const destructiveCardActionClass = "border-0 bg-background/45 text-destructive backdrop-blur-md hover:bg-background/60 hover:text-destructive"

  return <article className="group relative overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted/20">
    <PropertyCardImage property={property} />
    <div className="absolute start-2 top-2"><Badge className={statusCardPillClass[property.status]}>{labelFor(property.status)}</Badge></div>
    <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      <ActionTooltip label="Open property details"><Button asChild variant="ghost" size="icon-sm" className={cardActionClass}><Link to={propertyId ? detailsHref : "/properties"} aria-label={`Open details for ${property.title}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit property"><Button asChild variant="ghost" size="icon-sm" className={cardActionClass}><Link to={propertyId ? editHref : "/properties"} aria-label={`Edit ${property.title}`}><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label={hasDeals ? "Cannot delete a property with deals" : "Delete property"}><span className="inline-flex"><Button variant="ghost" size="icon-sm" aria-label={`Delete ${property.title}`} className={destructiveCardActionClass} disabled={hasDeals} onClick={onRequestDelete}><Trash2 /></Button></span></ActionTooltip>}</div>
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-base font-semibold tracking-tight" title={property.title}>{property.title}</h2><p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{property.city}</p></div><p className="shrink-0 font-mono text-lg font-semibold tracking-tight">{formatCurrency(property.price)}</p></div>
      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{property.description}</p>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3"><span className={`text-xs font-medium ${typeTextClass[property.type]}`}>{labelFor(property.type)}</span>{canCreateDeal && property.status !== "sold" && propertyId !== undefined && <Button asChild variant="outline" size="sm"><Link to={`/deals/create?property=${propertyId}`} onClick={(event) => event.stopPropagation()}>Make deal</Link></Button>}</div>
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
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [error, setError] = useState("")
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
    navigate(editPath(selectedId, returnSearch), { replace: true })
  }, [mode, navigate, returnSearch, selectedId])

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

  async function deleteProperty() {
    if (!pendingDelete?.id) return
    setDeleting(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/properties/${pendingDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      setPendingDelete(null)
      await loadProperties()
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this property.")
    } finally {
      setDeleting(false)
    }
  }

  if (!can("property.view")) return <ForbiddenProperties />
  const canCreate = can("property.create")
  const canCreateDeal = can("deal.create")
  const canEdit = can("property.edit")
  const canDelete = can("property.delete")
  const hasFilters = Boolean(query || typeFilter || statusFilter || cityFilter || minPriceFilter || maxPriceFilter)
  const filteredProperties = properties
  const propertyGridClass = "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
  const createPath = `/properties/create${returnSearch ? `?return=${encodeURIComponent(returnSearch)}` : ""}`

  return <div className="space-y-6 p-6 lg:p-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Properties</h1><p className="mt-1 text-sm text-muted-foreground">Manage the listings that shape your sales pipeline.</p></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="relative">
      <div className="flex items-end justify-between gap-4">
        <div className="filter-tab filter-tab-roundout ms-3">
          <button type="button" aria-expanded={filtersOpen} aria-controls="properties-filter-panel" onClick={() => setFiltersOpen((open) => !open)} className="filter-tab-roundout-button inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors"><Funnel className="size-3.5" aria-hidden="true" /><span>Filter</span><motion.span animate={{ rotate: filtersOpen ? 180 : 0 }} transition={filterMotionTransition} className="inline-flex"><ChevronDown className="size-4" aria-hidden="true" /></motion.span></button>
        </div>
        <div className="mb-1 flex shrink-0 gap-2">
          <Button type="button" variant="outline" className="shrink-0" onClick={() => void loadProperties()} disabled={loading}><RefreshCw className="size-4" />Refresh</Button>
          {canCreate && <Button asChild variant="outline" aria-label="Add new property"><Link to={createPath}><Plus className="size-4" />Add new property</Link></Button>}
        </div>
      </div>
      <motion.div initial={false} animate={{ height: filtersOpen ? "auto" : 0 }} transition={filterSlideTransition} className="overflow-hidden">
        <div className="search-filter-card rounded-md bg-muted/60 shadow-sm dark:bg-muted/70">
          <div className="p-4">
            <div id="properties-filter-panel" aria-hidden={!filtersOpen}>
              <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
                <div className="min-w-48 w-full md:w-64"><label className="text-xs font-medium text-muted-foreground" htmlFor="property-search">Search</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="property-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Title, description, city, address, owner…" /></div></div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground">Type</label><Select value={typeFilter || "all"} onValueChange={(value) => updateFilter("type", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{propertyTypes.map((type) => <SelectItem key={type} value={type}><span className={`capitalize ${typeTextClass[type]}`}>{labelFor(type)}</span></SelectItem>)}</SelectContent></Select></div>
                  <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={statusFilter || "all"} onValueChange={(value) => updateFilter("status", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{propertyStatuses.map((status) => <SelectItem key={status} value={status}><span className={statusTextClass[status]}>{labelFor(status)}</span></SelectItem>)}</SelectContent></Select></div>
                  <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground" htmlFor="property-city-filter">City</label><Input id="property-city-filter" className="mt-1" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="Any city" /></div>
                  <NumericRangeFilter id="property-price-range" label="Price range" min={filterInfo?.min_price} max={filterInfo?.max_price} value={priceRange} onChange={updatePriceRange} format={formatCurrency} />
                  {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
    <section className="min-w-0">
        {loading ? <div data-testid="properties-grid" className={propertyGridClass}>{Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden rounded-xl border border-border bg-card"><Skeleton className="aspect-[16/9] w-full" /><div className="space-y-3 p-4"><Skeleton className="h-5 w-4/5" /><Skeleton className="h-7 w-1/2" /><Skeleton className="h-4 w-3/5" /></div></div>)}</div> : filteredProperties.length ? <div data-testid="properties-grid" className={propertyGridClass}>{filteredProperties.map((property) => <PropertyCard key={property.id ?? property.title} property={property} detailsHref={property.id ? detailsPath(property.id, returnSearch) : "/properties"} editHref={property.id ? editPath(property.id, returnSearch) : "/properties"} canEdit={canEdit} canDelete={canDelete} canCreateDeal={canCreateDeal} onRequestDelete={() => setPendingDelete(property)} />)}</div> : <div data-testid="properties-grid" className="grid min-h-56 place-items-center border border-dashed border-border bg-muted/20 p-6 text-center"><div><p className="font-medium">{hasFilters ? "No properties match these filters" : "No properties yet"}</p><p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Try broadening the search or clearing the active filters." : "Create a property to start building the listing inventory."}</p>{hasFilters ? <Button variant="link" size="sm" className="mt-2" onClick={clearFilters}>Clear filters</Button> : canCreate && <Button asChild size="sm" className="mt-3"><Link to={createPath}><Plus />New property</Link></Button>}</div></div>}
        <div className="mt-4 border border-border bg-card"><ResourcePagination page={meta?.current_page ?? page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} /></div>
      </section>
    <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) { setPendingDelete(null); setDeleteError("") } }} title={`Delete ${pendingDelete?.title ?? "property"}?`} description={<>This permanently removes {pendingDelete?.title ?? "this property"} from the inventory. This action cannot be undone.</>} confirmLabel="Delete property" pending={deleting} error={deleteError} onConfirm={deleteProperty} />
  </div>
}

function PropertyInputField({ label, required, error, className, inputId, icon, inputGroupClassName, children }: { label: string; required?: boolean; error?: string; className?: string; inputId: string; icon?: ReactNode; inputGroupClassName?: string; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><label id={labelId} htmlFor={inputId} className="text-xs font-medium text-muted-foreground">{label}{required && <span className="font-normal"> (required)</span>}</label><InputGroup className={`mt-1 h-8 overflow-hidden ${inputGroupClassName ?? ""}`}>{icon && <InputGroupAddon align="inline-start" className="border-0 bg-transparent ps-2.5 pe-0">{icon}</InputGroupAddon>}{children}</InputGroup><FieldError>{error}</FieldError></Field>
}

function PropertySelectField({ label, required, error, className, inputId, value, onValueChange, placeholder, children }: { label: string; required?: boolean; error?: string; className?: string; inputId: string; value: string; onValueChange: (value: string) => void; placeholder?: string; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><label id={labelId} htmlFor={inputId} className="text-xs font-medium text-muted-foreground">{label}{required && <span className="font-normal"> (required)</span>}</label><InputGroup className="mt-1 h-8 overflow-hidden"><Select value={value} onValueChange={onValueChange}><SelectTrigger id={inputId} aria-labelledby={labelId} aria-invalid={Boolean(error)} data-slot="input-group-control" className="h-8 w-full rounded-none border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{children}</SelectContent></Select></InputGroup><FieldError>{error}</FieldError></Field>
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

function ForbiddenProperties() {
  return <ErrorState kind="forbidden" title="Properties are restricted" description="You do not have permission to view property listings." actionLabel="Return to overview" actionTo="/" />
}

function PropertyDetailsState({ title, description, backTo = "/properties" }: { title: string; description: string; backTo?: string }) {
  return <ErrorState kind="not-found" title={title} description={description} actionLabel="Return to properties" actionTo={backTo} />
}

export function PropertyDetailsPage({ create = false, edit = false }: { create?: boolean; edit?: boolean } = {}) {
  const { can } = useAuth()
  const { propertyId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
      navigate(detailsPath(property.id, returnSearch), { replace: true })
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
  if (edit && !can("property.edit")) return <ErrorState kind="forbidden" title="Property editing is restricted" description="You do not have permission to edit properties." actionLabel="Return to properties" actionTo="/properties" />
  if (!create && !can("property.view")) return <ForbiddenProperties />
  if (create) return <main className="mx-auto max-w-[100rem] space-y-6 p-6 pb-24 lg:p-8"><header className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6"><div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Back to properties</Link></Button><h1 className="mt-5 text-2xl font-semibold tracking-tight">{createdProperty ? "Finish image upload" : "New property"}</h1></div><div className="flex shrink-0 items-center gap-2">{createdProperty ? <><Button asChild type="button" variant="outline"><Link to={createdPropertyHref}>Open property</Link></Button><Button type="submit" form="property-create-form" disabled={uploadingMedia || !stagedImages.length}>{uploadingMedia ? "Uploading…" : "Retry images"}</Button></> : <><Button type="button" variant="outline" onClick={() => navigate(indexHref)}>Cancel</Button><Button type="submit" form="property-create-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create"}</Button></>}</div></header>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{mediaUploadError && createdProperty && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Property was created, but its images could not be uploaded. {mediaUploadError}</div>}<PropertyDetailsEditor create form={form} formId="property-create-form" hideToolbar saving={form.formState.isSubmitting || uploadingMedia} mediaField={mediaField} onCancel={() => navigate(createdPropertyHref)} onSubmit={createdProperty ? retryMediaUpload : createProperty} /></main>
  if (!Number.isInteger(id) || id < 1) return <PropertyDetailsState title="Property not found" description="The property identifier is invalid." backTo={indexHref} />
  if (loading) return <PropertyDetailsSkeleton />
  if (accessError === "unauthorized") return <ErrorState kind="unauthorized" title="Your session has ended" description="Sign in again to continue working with properties." actionLabel="Sign in" actionTo="/login" />
  if (accessError === "forbidden") return <ErrorState kind="forbidden" title="This property is restricted" description="You do not have access to this property record." actionLabel="Return to properties" actionTo={indexHref} />
  if (missing) return <PropertyDetailsState title="Property not found" description="This listing may have been removed or you may not have access to it." backTo={indexHref} />
  if (!property) return <PropertyDetailsLoadError message={error || "Unable to load this property."} backTo={indexHref} onRetry={() => void loadProperty()} />

  if (edit) return <main className="mx-auto max-w-[100rem] space-y-6 p-6 pb-24 lg:p-8"><header className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6"><div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Back to properties</Link></Button><h1 className="mt-5 text-2xl font-semibold tracking-tight">Edit property</h1></div><div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" onClick={() => navigate(indexHref)}>Cancel</Button><Button type="submit" form="property-edit-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Save changes"}</Button></div></header>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}<MultipleMediaField ownerType="property" ownerId={property.id ?? id} collection="gallery" label="Property images" description="Upload, remove, or reorder the images used for this listing." disabled={form.formState.isSubmitting} /><PropertyDetailsEditor form={form} formId="property-edit-form" hideToolbar saving={form.formState.isSubmitting} onCancel={() => navigate(indexHref)} onSubmit={saveProperty} /></main>

  const canEdit = can("property.edit")
  const canDelete = can("property.delete")
  return <main className="mx-auto max-w-[100rem] space-y-6 p-6 lg:p-8">
    <header className="border-b border-border pb-6">
      <div className="flex items-center justify-between gap-3"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Properties</Link></Button><div className="flex items-center justify-end gap-1"><ActionTooltip label="Refresh"><Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={() => void loadProperty()} disabled={loading}><RefreshCw className="size-3.5" /></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit property"><Button asChild variant="ghost" size="icon-sm"><Link to={editPath(property.id ?? id, returnSearch)} aria-label="Edit property"><Pencil className="size-3.5" /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete"><Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label="Delete property" onClick={() => { setDeleteError(""); setDeleteOpen(true) }}><Trash2 className="size-3.5" /></Button></ActionTooltip>}</div></div>
      <div className="mt-5"><div className="flex flex-wrap items-start justify-between gap-4"><h1 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground">{property.title}</h1><PropertyStatusSummary status={property.status} /></div><div className="mt-5"><PropertyHeroGallery property={property} /></div></div>
    </header>

    {error && <div role="alert" className="flex items-center justify-between gap-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setError("")}>Dismiss</Button></div>}

    <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start"><div className="min-w-0 space-y-8"><section className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4"><p className="font-mono text-3xl font-semibold tracking-tight">{formatCurrency(property.price)}</p><p className="flex items-center gap-1.5 text-sm"><MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{property.address}{property.city ? ` · ${property.city}` : ""}</span></p></section><section className="pb-8"><dl className="space-y-4"><div className="flex items-center gap-3"><Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><dd className="text-sm">{labelFor(property.type)}</dd></div><div className="flex items-start gap-3"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div><dt className="text-xs font-medium text-muted-foreground">Description</dt><dd className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{property.description || "No description has been recorded for this listing."}</dd></div></div></dl></section>{property.id !== undefined && <ActivityLogList model="property" id={property.id} title="Property activity" onReverted={() => void loadProperty()} />}</div>{property.id !== undefined && <PropertyDeals propertyId={property.id} canViewDeals={can("deal.view")} canCreateDeal={can("deal.create") && property.status !== "sold"} />}</div>
    <ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${property.title}?`} description={<>This permanently removes {property.title} from the inventory. This action cannot be undone.</>} confirmLabel="Delete property" pending={deleting} error={deleteError} onConfirm={deleteCurrentProperty} />
  </main>
}

function PropertyStatusSummary({ status }: { status: PropertyStatus }) {
  return <section aria-label="Property status" className="shrink-0"><Badge className={statusPillClass[status]}>{labelFor(status)}</Badge></section>
}

function PropertyHeroGallery({ property }: { property: Property }) {
  const images = property.images ?? []
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeImage = images[activeIndex]

  useEffect(() => setActiveIndex(0), [property.id])

  if (!images.length) return <div className="grid aspect-[2/1] w-full place-items-center border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground"><span><ImageIcon className="mx-auto mb-2 size-4" aria-hidden="true" />No listing image</span></div>

  const showImage = (index: number) => { setActiveIndex(index); setOpen(true) }
  const move = (direction: -1 | 1) => setActiveIndex((current) => (current + direction + images.length) % images.length)
  const imageTile = (image: typeof images[number], index: number, className = "") => <span key={image.id} className={`relative block min-h-0 overflow-hidden bg-muted/20 ${className}`}><ProgressivePropertyImage image={image} alt={index === 0 ? property.title : ""} />{index === 4 && images.length > 5 && <span className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-medium text-white">+{images.length - 5}</span>}</span>
  const layout = images.length >= 5
    ? <span data-gallery-layout="five-plus" className="grid size-full grid-cols-2 gap-px bg-background"><span className="min-h-0 overflow-hidden bg-muted/20">{imageTile(images[0], 0, "size-full")}</span><span className="grid min-h-0 grid-cols-2 grid-rows-2 gap-px">{images.slice(1, 5).map((image, index) => imageTile(image, index + 1))}</span></span>
    : images.length >= 2
      ? <span data-gallery-layout={images.length === 4 ? "four" : images.length === 3 ? "three" : "two"} className="grid size-full grid-cols-3 gap-px bg-background"><span className="col-span-2 min-h-0 overflow-hidden bg-muted/20">{imageTile(images[0], 0, "size-full")}</span><span className={`grid min-h-0 gap-px ${images.length === 4 ? "grid-rows-3" : images.length === 3 ? "grid-rows-2" : "grid-rows-1"}`}>{images.slice(1, 4).map((image, index) => imageTile(image, index + 1))}</span></span>
      : <span data-gallery-layout="one" className="block size-full bg-muted/20">{imageTile(images[0], 0, "size-full")}</span>

  return <Dialog open={open} onOpenChange={setOpen}>
    <button type="button" className="group block aspect-[2/1] max-h-96 w-full overflow-hidden border border-border text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Open property gallery for ${property.title}`} onClick={() => showImage(0)}>{layout}</button>
    <DialogContent className="max-w-[calc(100%-2rem)] gap-0 p-0 sm:max-w-5xl" showCloseButton onKeyDown={(event) => { if (images.length < 2) return; if (event.key === "ArrowLeft") { event.preventDefault(); move(-1) } else if (event.key === "ArrowRight") { event.preventDefault(); move(1) } }}>
      <DialogHeader className="border-b border-border p-4 pe-12"><DialogTitle>{property.title}</DialogTitle><DialogDescription>{activeIndex + 1} of {images.length} images</DialogDescription></DialogHeader>
      {activeImage && <div className="relative grid max-h-[70vh] place-items-center bg-black/90"><img src={activeImage.url} alt={`${property.title}, image ${activeIndex + 1} of ${images.length}`} className="max-h-[70vh] w-full object-contain" />{images.length > 1 && <><button type="button" className="absolute start-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-secondary text-secondary-foreground outline-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Previous image" onClick={() => move(-1)}><ChevronLeft className="size-4" /></button><button type="button" className="absolute end-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg bg-secondary text-secondary-foreground outline-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Next image" onClick={() => move(1)}><ChevronRight className="size-4" /></button></>}</div>}
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto border-t border-border p-3">{images.map((image, index) => <button key={image.id} type="button" className={`aspect-[4/3] w-20 shrink-0 overflow-hidden border ${index === activeIndex ? "border-primary" : "border-border"}`} aria-label={`Show image ${index + 1}`} aria-current={index === activeIndex} onClick={() => setActiveIndex(index)}><img src={image.thumbnail_url || image.url} alt="" className="size-full object-cover" /></button>)}</div>}
    </DialogContent>
  </Dialog>
}

function ProgressivePropertyImage({ image, alt }: { image: NonNullable<Property["images"]>[number]; alt: string }) {
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

function PropertyDeals({ propertyId, canViewDeals, canCreateDeal }: { propertyId: number; canViewDeals: boolean; canCreateDeal: boolean }) {
  const [deals, setDeals] = useState<PropertyDeal[]>([])
  const [meta, setMeta] = useState<PropertyDealList["meta"] | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadDeals = useCallback(async (requestedPage: number, append: boolean, signal?: AbortSignal) => {
    if (!canViewDeals) return
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<PropertyDealList>(listUrl(`${API_BASE_URL}/v1/deals`, { property: propertyId, page: requestedPage, per_page: 6 }), { signal })
      setDeals((current) => append ? [...current, ...body.data] : body.data)
      setMeta(body.meta)
      setPage(body.meta.current_page)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load deals.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [canViewDeals, propertyId])

  useEffect(() => {
    if (!canViewDeals) return
    const controller = new AbortController()
    setDeals([])
    setMeta(null)
    setPage(1)
    void loadDeals(1, false, controller.signal)
    return () => controller.abort()
  }, [canViewDeals, loadDeals])

  if (!canViewDeals) return null
  const canLoadMore = Boolean(meta && page < meta.last_page)

  return <aside className="h-fit min-w-0 xl:sticky xl:top-6"><article aria-labelledby="property-deals-title" className="w-full overflow-hidden rounded-xl bg-muted/40 p-3"><header className="-mx-3 -mt-3 mb-3 flex items-center justify-between gap-3 bg-muted/70 px-3 py-2"><h2 id="property-deals-title" className="text-sm font-semibold">Deals</h2>{meta && meta.total > 0 && <span className="text-xs text-muted-foreground">{meta.total}</span>}</header><div className="space-y-3">{canCreateDeal && <Button asChild variant="outline" className="w-full"><Link to={`/deals/create?property=${propertyId}`}><Plus className="size-4" />Make deal</Link></Button>}{loading && !deals.length && <div className="space-y-2"><Skeleton className="h-20 w-full rounded-lg" /><Skeleton className="h-20 w-full rounded-lg" /></div>}{error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><p>{error}</p><Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0 text-destructive" disabled={loading} onClick={() => void loadDeals(page, false)}>{loading ? "Loading…" : "Try again"}</Button></div>}{!loading && !error && !deals.length && <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground"><Inbox className="size-3.5" aria-hidden="true" /><span>No deals yet</span></div>}{deals.length > 0 && <ul className="space-y-2">{deals.map((deal) => <li key={deal.id ?? `${deal.contact.name}-${deal.created_at ?? deal.deal_value}`}><Link className="block rounded-lg bg-background/60 px-3 py-3 transition-colors hover:bg-background/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" to={deal.id === undefined ? "/deals" : `/deals/${deal.id}`}><div className="flex items-start justify-between gap-3"><span className="min-w-0 truncate text-sm font-medium">{deal.contact.name}</span><Badge className={`shrink-0 ${dealStatusPillClass[deal.status]}`}>{labelFor(deal.status)}</Badge></div><p className="mt-1 font-mono text-sm font-semibold">{formatCurrency(deal.deal_value)}</p></Link></li>)}</ul>}{canLoadMore && <div><Button type="button" variant="outline" size="sm" className="w-full" disabled={loading} onClick={() => void loadDeals(page + 1, true)}>{loading ? "Loading…" : "Load more"}</Button></div>}</div></article></aside>
}

function PropertyDetailsEditor({ create = false, form, saving, onCancel, onSubmit, hideToolbar = false, formId, mediaField }: { create?: boolean; form: ReturnType<typeof useForm<PropertyFormValues>>; saving: boolean; onCancel: () => void; onSubmit: () => void; hideToolbar?: boolean; formId?: string; mediaField?: ReactNode }) {
  const { register, formState: { errors }, setValue, watch } = form
  return <form id={formId} onSubmit={onSubmit} className={hideToolbar ? "w-full" : "w-full border-t border-border pt-5"}>
    {!hideToolbar && <div className="sticky top-0 z-10 -mt-5 border-b border-border bg-background py-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">{create ? "Create property" : "Edit property"}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Listing information</h2></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? (create ? "Creating…" : "Saving…") : create ? "Create" : <><Save className="me-2 size-3.5" />Save changes</>}</Button></div></div></div>}
    {create && mediaField}
    <div className={`w-full ${create ? "mt-4" : "mt-6"} xl:max-w-[50vw]`}>
    <FieldGroup className="mt-0 grid w-full gap-4 sm:grid-cols-2">
      <PropertyInputField inputId="property-details-title" label="Title" required error={errors.title?.message} className="sm:col-span-2"><InputGroupInput id="property-details-title" aria-labelledby="property-details-title-label" aria-invalid={Boolean(errors.title)} {...register("title")} className="h-8 px-2.5" /></PropertyInputField>
      <PropertyInputField inputId="property-details-city" label="City" required error={errors.city?.message} icon={<MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />}><InputGroupInput id="property-details-city" aria-labelledby="property-details-city-label" aria-invalid={Boolean(errors.city)} {...register("city")} /></PropertyInputField>
      <PropertyInputField inputId="property-details-address" label="Address" required error={errors.address?.message} icon={<MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />}><InputGroupInput id="property-details-address" aria-labelledby="property-details-address-label" aria-invalid={Boolean(errors.address)} {...register("address")} /></PropertyInputField>
      <PropertyInputField inputId="property-details-price" label="Price" required error={errors.price?.message} icon={<DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" />}><InputGroupInput id="property-details-price" aria-labelledby="property-details-price-label" aria-invalid={Boolean(errors.price)} type="number" min="5000" max="1000000" step="any" {...register("price")} /></PropertyInputField>
      <PropertySelectField inputId="property-details-type" label="Type" required error={errors.type?.message} value={watch("type")} onValueChange={(value) => setValue("type", value as PropertyFormValues["type"], { shouldValidate: true })}>{propertyTypes.map((type) => <SelectItem key={type} value={type}>{labelFor(type)}</SelectItem>)}</PropertySelectField>
      <PropertyInputField inputId="property-details-description" label="Description" required error={errors.description?.message} inputGroupClassName="h-auto" className="sm:col-span-2"><InputGroupTextarea id="property-details-description" aria-labelledby="property-details-description-label" aria-invalid={Boolean(errors.description)} className="min-h-32 px-2.5" {...register("description")} /></PropertyInputField>
    </FieldGroup>
    </div>
  </form>
}

function PropertyDetailsSkeleton() {
  return <div className="mx-auto max-w-[100rem] space-y-6 p-6 lg:p-8"><div className="border-b border-border pb-6"><div className="flex items-center justify-between"><Skeleton className="h-7 w-28" /><Skeleton className="h-8 w-24" /></div><Skeleton className="mt-6 h-8 w-3/5" /><Skeleton className="mt-5 aspect-[2/1] max-h-96 w-full" /></div><div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="space-y-8"><Skeleton className="h-6 w-28" /><Skeleton className="h-20 w-full" /><Skeleton className="h-6 w-24" /><Skeleton className="h-16 w-full" /></div><div className="space-y-4 border-t border-border pt-5"><Skeleton className="h-6 w-16" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div></div></div>
}

function PropertyDetailsLoadError({ message, backTo, onRetry }: { message: string; backTo: string; onRetry: () => void }) {
  return <div className="mx-auto max-w-xl p-6 lg:p-8"><div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p className="font-semibold">Unable to open property</p><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-4 flex gap-2"><Button onClick={onRetry}>Try again</Button><Button asChild variant="outline"><Link to={backTo}>Back to properties</Link></Button></div></div></div>
}
