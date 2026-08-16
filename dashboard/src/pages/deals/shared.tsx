import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, DollarSign, Eye, HandCoins, ImageIcon, MapPin as MapPinIcon, Pencil, Percent, Search, Trash2, UserRound } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { z } from "zod"
import type { components as AuthComponents } from "@/api/generated/Auth"
import type { components as SalesComponents, paths as SalesPaths } from "@/api/generated/Sales"
import { API_BASE_URL, apiJson } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { ErrorState } from "@/components/shared/error-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { SearchableResourcePicker, type SearchableResourceOption, type SearchableResourcePage } from "@/components/shared/searchable-resource-picker"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { DateTimePicker } from "@/components/ui/date-picker"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { statusPillClass, type DealStatus } from "@/components/shared/deal-status"

const MapPin = (props: ComponentProps<typeof MapPinIcon>) => <MapPinIcon {...props} />

export type Deal = SalesComponents["schemas"]["Deal"]
export type User = AuthComponents["schemas"]["User"]
type AuthenticatedAgent = User & { commission_rate: number }
export type AgentOption = { id: number; name: string; username?: string | null; avatar?: User["avatar"] }
export type DealEnvelope = { deal: Deal }
export type DealFilterInfo = SalesPaths["/"]["get"]["responses"][200]["content"]["application/json"]["filter"]
export type DealList = Paginated<Deal> & { filter: DealFilterInfo }
export type DealUpdatePayload = SalesPaths["/{id}"]["post"]["requestBody"]["content"]["application/json"]
export type DealPropertyImage = { url: string; thumbnail_url?: string }
export type DealPropertyOption = Pick<Deal["property"], "id" | "title" | "description" | "city" | "address" | "price" | "type" | "status"> & { images?: DealPropertyImage[] } & Partial<Pick<Deal["property"], "owner" | "created_at">>

export type DealRelationOptions = {
  contacts: Deal["contact"][]
  properties: DealPropertyOption[]
  propertiesLoading: boolean
  propertiesLoadingMore: boolean
  propertiesHasMore: boolean
  onPropertySearch?: (query: string) => void
  onLoadMoreProperties?: () => void
  agents: AgentOption[]
  agentsLoading: boolean
}
export const DealRelationOptionsContext = createContext<DealRelationOptions>({ contacts: [], properties: [], propertiesLoading: false, propertiesLoadingMore: false, propertiesHasMore: false, agents: [], agentsLoading: false })

export const statuses = ["inquiry", "viewing", "offer_made", "legal", "won", "lost"] as const
export { statusPillClass }
export const statusTextClass: Record<DealStatus, string> = {
  inquiry: "text-slate-700/80 dark:text-slate-300/80",
  viewing: "text-blue-700/80 dark:text-blue-300/80",
  offer_made: "text-amber-700/80 dark:text-amber-300/80",
  legal: "text-violet-700/80 dark:text-violet-300/80",
  won: "text-emerald-700/80 dark:text-emerald-300/80",
  lost: "text-red-700/80 dark:text-red-300/80",
}
export const propertyStatusPillClass: Record<Deal["property"]["status"], string> = {
  pending: "border-amber-500/40 bg-amber-500/25 px-2.5 py-1.5 text-amber-950 backdrop-blur-md hover:bg-amber-500/30 dark:text-amber-100",
  showing: "border-blue-500/40 bg-blue-500/25 px-2.5 py-1.5 text-blue-950 backdrop-blur-md hover:bg-blue-500/30 dark:text-blue-100",
  sold: "border-emerald-500/40 bg-emerald-500/25 px-2.5 py-1.5 text-emerald-950 backdrop-blur-md hover:bg-emerald-500/30 dark:text-emerald-100",
}

const numericField = (label: string) => z.string().trim().min(1, `Enter ${label}.`).refine((value) => Number.isFinite(Number(value)), `Enter a valid ${label}.`)
const optionalNumericField = (label: string) => z.string().trim().refine((value) => !value || Number.isFinite(Number(value)), `Enter a valid ${label}.`)
const integerField = (label: string) => numericField(label).refine((value) => Number.isInteger(Number(value)), `Enter a whole-number ${label}.`)
export const dealSchema = z.object({
  value: optionalNumericField("a value"),
  deal_value: numericField("a deal value"),
  contact_id: integerField("contact ID"),
  property_id: integerField("property ID"),
  agent_id: integerField("agent ID"),
  status: z.enum(statuses),
  closed_at: z.string().refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Enter a valid closing date."),
})
export type DealFormValues = z.infer<typeof dealSchema>
export type DealFormProps = { form: ReturnType<typeof useForm<DealFormValues>>; onSubmit: () => void; commissionRate: number | null; formId?: string; onPropertyChange?: (property: DealPropertyOption) => void; agentUserId?: number; urlPropertyId?: number; editing?: boolean }
export const emptyValues: DealFormValues = { value: "", deal_value: "", contact_id: "", property_id: "", agent_id: "", status: "inquiry", closed_at: "" }

export function labelFor(value: string) { return value.replaceAll("_", " ") }
export function titleFor(value: string) { return labelFor(value).replace(/\b\w/g, (character) => character.toUpperCase()) }
export function formatCurrency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value) }
export function formatNumber(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) }
export function authenticatedCommissionRate(user: User | null): number | null {
  const agent = user as AuthenticatedAgent | null
  return typeof agent?.commission_rate === "number" ? agent.commission_rate : null
}
export function rangeValue(value: string, fallback: number | null | undefined) {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : fallback ?? 0
}
export function calculateCommissionAmount(dealValue: string, commissionRate: number | null): number | null {
  const value = Number(dealValue)
  if (!dealValue.trim() || commissionRate === null || !Number.isFinite(value) || !Number.isFinite(commissionRate)) return null
  return value * commissionRate / 100
}
export function formatDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date)
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null }
function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}
function normalizeDealImage(value: unknown): DealPropertyImage | undefined {
  if (!isRecord(value)) return undefined
  const url = stringValue(value.url)
  const thumbnailUrl = stringValue(value.thumbnail_url)
  if (!url && !thumbnailUrl) return undefined
  return { url: url ?? thumbnailUrl!, ...(thumbnailUrl ? { thumbnail_url: thumbnailUrl } : {}) }
}
function collectionValues(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (!isRecord(body)) return []
  if (Array.isArray(body.data)) return body.data
  if (Array.isArray(body.contacts)) return body.contacts
  if (Array.isArray(body.properties)) return body.properties
  return []
}
function normalizeDealContact(value: unknown): Deal["contact"] | undefined {
  if (!isRecord(value)) return undefined
  const id = numberValue(value.id)
  const name = stringValue(value.name)
  const phone = stringValue(value.phone)
  if (id === undefined || !name || !phone) return undefined
  return {
    id,
    name,
    phone,
    ...(value.title === null ? { title: null } : stringValue(value.title) ? { title: stringValue(value.title) } : {}),
    ...(value.email === null ? { email: null } : stringValue(value.email) ? { email: stringValue(value.email) } : {}),
  }
}
export function normalizeDealProperty(value: unknown): DealPropertyOption | undefined {
  if (!isRecord(value)) return undefined
  const id = numberValue(value.id)
  const title = stringValue(value.title)
  const description = stringValue(value.description)
  const city = stringValue(value.city)
  const address = stringValue(value.address)
  const price = numberValue(value.price)
  const type = stringValue(value.type)
  const status = stringValue(value.status)
  if (id === undefined || !title || !description || !city || !address || price === undefined || !type || !status) return undefined
  if (!["land", "villa", "appartment", "mansion", "commercial"].includes(type)) return undefined
  if (!["pending", "showing", "sold"].includes(status)) return undefined
  const images = Array.isArray(value.images) ? value.images.map(normalizeDealImage).filter((image): image is DealPropertyImage => image !== undefined) : []
  return { id, title, description, city, address, price, type: type as Deal["property"]["type"], status: status as Deal["property"]["status"], ...(images.length ? { images } : {}) }
}
function filterRelationOptions(options: SearchableResourceOption[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return normalizedQuery ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLocaleLowerCase().includes(normalizedQuery)) : options
}
export function prioritizeDealProperty(properties: DealPropertyOption[], selectedId?: number) {
  if (selectedId === undefined) return properties
  const selected = properties.find((property) => property.id === selectedId)
  return selected ? [selected, ...properties.filter((property) => property.id !== selectedId)] : properties
}
async function loadDealContactOptions(query: string, _page: number, signal: AbortSignal): Promise<SearchableResourcePage> {
  const body = await apiJson<unknown>(`${API_BASE_URL}/v1/contacts`, { signal })
  const options = collectionValues(body).map(normalizeDealContact).filter((contact): contact is Deal["contact"] => contact !== undefined).map((contact) => ({ id: contact.id, label: contact.name, description: [contact.title, contact.email ?? contact.phone].filter(Boolean).join(" · "), data: contact }))
  return { options: filterRelationOptions(options, query), currentPage: 1, lastPage: 1 }
}
export async function loadDealPropertyOptions(query: string, _page: number, signal: AbortSignal): Promise<SearchableResourcePage> {
  const body = await apiJson<unknown>(listUrl(`${API_BASE_URL}/v1/properties`, { page: _page, q: query || undefined }), { signal })
  const options = collectionValues(body).map(normalizeDealProperty).filter((property): property is DealPropertyOption => property !== undefined).map((property) => ({ id: property.id as number, label: property.title, description: `${property.city} · ${formatCurrency(property.price)}`, data: property }))
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : undefined
  const currentPage = numberValue(meta?.current_page) ?? _page
  const lastPage = numberValue(meta?.last_page) ?? currentPage
  return { options: filterRelationOptions(options, query), currentPage, lastPage }
}
export function toDateTimeInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function valuesFromDeal(deal: Deal): DealFormValues {
  return {
    value: String(deal.value),
    deal_value: String(deal.deal_value),
    contact_id: deal.contact.id === undefined ? "" : String(deal.contact.id),
    property_id: deal.property.id === undefined ? "" : String(deal.property.id),
    agent_id: deal.agent_id === undefined ? "" : String(deal.agent_id),
    status: deal.status,
    closed_at: toDateTimeInput(deal.closed_at),
  }
}
export function toPayload(values: DealFormValues, editing: boolean) {
  return {
    value: Number(values.value),
    deal_value: Number(values.deal_value),
    contact_id: Number(values.contact_id),
    property_id: Number(values.property_id),
    agent_id: Number(values.agent_id),
    status: values.status,
    closed_at: values.closed_at ? (editing ? values.closed_at.slice(0, 10) : new Date(values.closed_at).toISOString()) : null,
  }
}

export function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

export function applyPropertyToDealForm(form: ReturnType<typeof useForm<DealFormValues>>, property: DealPropertyOption) {
  form.setValue("property_id", String(property.id), { shouldDirty: true, shouldValidate: true })
  form.setValue("value", String(property.price), { shouldDirty: true, shouldValidate: true })
  form.setValue("deal_value", String(property.price), { shouldDirty: true, shouldValidate: true })
}

export function PropertyCover({ property, size = "row" }: { property: DealPropertyOption; size?: "row" | "option" }) {
  const cover = property.images?.[0]
  const className = size === "row" ? "h-10 w-[3.333rem]" : "size-9"

  return cover ? <img src={cover.thumbnail_url || cover.url} alt="" className={`${className} shrink-0 border border-border object-cover`} loading="lazy" /> : <span className={`${className} grid shrink-0 place-items-center border border-dashed border-border bg-muted/20 text-muted-foreground`} aria-hidden="true"><ImageIcon className="size-3.5" /></span>
}

export function PropertyOption({ property }: { property: DealPropertyOption }) {
  return <span className="flex min-w-0 items-center gap-2"><PropertyCover property={property} size="option" /><span className="min-w-0"><span className="block truncate">{property.title}</span><span className="block truncate text-xs text-muted-foreground">{property.city}</span></span></span>
}

function DealPropertyCard({ property, selected, dimmed, onSelect, readOnly = false }: { property: DealPropertyOption; selected: boolean; dimmed: boolean; onSelect?: () => void; readOnly?: boolean }) {
  const cover = property.images?.[0]
  const interactive = !readOnly

  return <article data-property-card aria-label={interactive ? `Select ${property.title}` : `${property.title} property`} {...(interactive ? { role: "button", tabIndex: 0, "aria-pressed": selected } : {})} onClick={interactive ? onSelect : undefined} onKeyDown={interactive ? (event) => { if (event.target !== event.currentTarget) return; if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.() } } : undefined} className={`group relative w-full shrink-0 overflow-hidden rounded-lg border bg-card text-start outline-none transition-opacity duration-150 ${interactive ? "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-72" : "max-w-xs sm:w-72"} ${selected ? "border-primary bg-primary/[0.03]" : "border-border"} ${dimmed ? "opacity-40" : "opacity-100"}`}>
    <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-muted/30">
      {cover ? <img src={cover.thumbnail_url || cover.url} alt={`${property.title} listing`} className="size-full object-cover transition-opacity duration-150 group-hover:opacity-85 motion-reduce:transition-none" loading="lazy" /> : <div className="grid size-full place-items-center text-muted-foreground"><ImageIcon className="size-5" aria-hidden="true" /></div>}
      <div className="absolute start-2 top-2"><Badge className={propertyStatusPillClass[property.status]}>{titleFor(property.status)}</Badge></div>
      <div className="absolute end-2 top-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"><Button asChild variant="ghost" size="icon-sm" className="border-0 bg-background/90 backdrop-blur-md hover:bg-background"><Link to={`/properties/${property.id}`} target="_blank" rel="noreferrer" aria-label={`Open details for ${property.title}`} title="Open property details" onClick={(event) => event.stopPropagation()}><Eye /></Link></Button></div>
    </div>
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold tracking-tight" title={property.title}>{property.title}</p><p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{property.city}</p></div><p className="shrink-0 font-mono text-sm font-semibold tracking-tight">{formatCurrency(property.price)}</p></div>
    </div>
  </article>
}

function DealPropertyCardSkeleton() {
  return <div data-property-card-skeleton className="w-full shrink-0 overflow-hidden rounded-lg border border-border bg-card sm:w-72">
    <Skeleton className="aspect-[16/9] w-full rounded-none" />
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-1/4" /></div>
      <Skeleton className="h-4 w-2/5" />
    </div>
  </div>
}

export function DealPropertyCarousel({ properties, propertiesLoading, propertiesLoadingMore, propertiesHasMore, onPropertySearch, onLoadMoreProperties, value, error, onChange, priorityPropertyId }: { properties: DealPropertyOption[]; propertiesLoading: boolean; propertiesLoadingMore: boolean; propertiesHasMore: boolean; onPropertySearch?: (query: string) => void; onLoadMoreProperties?: () => void; value: string; error?: string; onChange: (property: DealPropertyOption) => void; priorityPropertyId?: number }) {
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [revealAll, setRevealAll] = useState(false)
  const carouselViewportRef = useRef<HTMLDivElement>(null)
  const selectedId = Number(value) || undefined

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = queryInput.trim().toLocaleLowerCase()
      setQuery(nextQuery)
      onPropertySearch?.(nextQuery)
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [onPropertySearch, queryInput])

  const orderedProperties = prioritizeDealProperty(properties, priorityPropertyId)
  const filteredProperties = query
    ? orderedProperties.filter((property) => property.id === priorityPropertyId || `${property.title} ${property.city} ${property.address} ${property.type} ${property.status}`.toLocaleLowerCase().includes(query))
    : orderedProperties
  const showInitialSkeleton = propertiesLoading && properties.length === 0
  const requestMoreIfNeeded = useCallback(() => {
    const viewport = carouselViewportRef.current
    if (!viewport || !propertiesHasMore || propertiesLoading || propertiesLoadingMore || !onLoadMoreProperties) return
    if (viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - viewport.clientWidth) onLoadMoreProperties()
  }, [onLoadMoreProperties, propertiesHasMore, propertiesLoading, propertiesLoadingMore])

  useEffect(() => {
    const viewport = carouselViewportRef.current
    if (!viewport) return
    const onScroll = () => requestMoreIfNeeded()
    viewport.addEventListener("scroll", onScroll, { passive: true })
    requestMoreIfNeeded()
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [filteredProperties.length, requestMoreIfNeeded])

  const moveCarousel = (direction: -1 | 1) => {
    const firstCard = carouselViewportRef.current?.querySelector<HTMLElement>("[data-property-card]")
    const cardWidth = firstCard?.getBoundingClientRect().width ?? 288
    carouselViewportRef.current?.scrollBy({ left: direction * (cardWidth + 12), behavior: "smooth" })
  }

  return <Field className="w-full min-w-0 sm:col-span-2">
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-border bg-muted/20 p-4">
      <InputGroup className="max-w-md">
        <InputGroupAddon align="inline-start"><InputGroupText><Search className="size-3.5" aria-hidden="true" /></InputGroupText></InputGroupAddon>
        <InputGroupInput id="deal-property-search" aria-label="Search properties" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search by title, city, or address…" />
      </InputGroup>
      <div className="mt-3 flex min-w-0 items-center gap-2" onMouseEnter={() => setRevealAll(true)} onMouseLeave={() => setRevealAll(false)}>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Previous property" aria-controls="deal-property-carousel" disabled={filteredProperties.length < 2 || propertiesLoading} onClick={() => moveCarousel(-1)}><ChevronLeft /></Button>
        <div className="min-w-0 flex-1">
          {showInitialSkeleton ? <div className="flex gap-3 overflow-hidden pb-3">{Array.from({ length: 3 }, (_, index) => <DealPropertyCardSkeleton key={index} />)}</div> : filteredProperties.length ? <ScrollArea id="deal-property-carousel" viewportRef={carouselViewportRef} orientation="horizontal" className="w-full min-w-0" onWheel={(event) => { const viewport = carouselViewportRef.current; if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return; const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX; if (!delta) return; event.preventDefault(); viewport.scrollLeft += delta }}><div className="flex min-w-full gap-3 pb-3 pe-1">{filteredProperties.map((property) => <DealPropertyCard key={property.id} property={property} selected={selectedId === property.id} dimmed={Boolean(selectedId && !revealAll && selectedId !== property.id)} onSelect={() => onChange(property)} />)}{(propertiesLoadingMore || (propertiesLoading && properties.length > 0)) && Array.from({ length: 2 }, (_, index) => <DealPropertyCardSkeleton key={`loading-${index}`} />)}</div></ScrollArea> : propertiesLoading ? <div className="flex gap-3 overflow-hidden pb-3">{Array.from({ length: 3 }, (_, index) => <DealPropertyCardSkeleton key={index} />)}</div> : <div className="border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{query ? "No properties match this search." : "No properties available."}</div>}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Next property" aria-controls="deal-property-carousel" disabled={filteredProperties.length < 2 || propertiesLoading} onClick={() => moveCarousel(1)}><ChevronRight /></Button>
      </div>
    </div>
    <FieldError>{error}</FieldError>
  </Field>
}

export function DealForm({ form, onSubmit, commissionRate, formId, onPropertyChange, agentUserId, urlPropertyId, editing = false }: DealFormProps) {
  const { register, formState: { errors }, setValue, watch } = form
  const watchedDealValue = watch("deal_value")
  const watchedStatus = watch("status")
  const commissionAmount = editing ? null : calculateCommissionAmount(watchedDealValue, commissionRate)
  const [, setFormSearchParams] = useSearchParams()
  const { contacts, properties, propertiesLoading, propertiesLoadingMore, propertiesHasMore, onPropertySearch, onLoadMoreProperties, agents, agentsLoading } = useContext(DealRelationOptionsContext)
  const hideAgentSelect = agentUserId !== undefined

  useEffect(() => {
    if (!hideAgentSelect || form.getValues("agent_id") === String(agentUserId)) return
    form.setValue("agent_id", String(agentUserId), { shouldDirty: false, shouldValidate: true })
  }, [agentUserId, form, hideAgentSelect])
  useEffect(() => {
    if (watchedStatus === "won" || !form.getValues("closed_at")) return
    form.setValue("closed_at", "", { shouldDirty: true, shouldValidate: true })
  }, [form, watchedStatus])
  const propertyField = editing ? <Field className="w-full min-w-0 sm:col-span-2">{properties[0] ? <DealPropertyCard property={properties[0]} selected dimmed={false} readOnly /> : <div className="max-w-xs border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">Property unavailable.</div>}<FieldError>{errors.property_id?.message}</FieldError></Field> : <DealPropertyCarousel properties={properties} propertiesLoading={propertiesLoading} propertiesLoadingMore={propertiesLoadingMore} propertiesHasMore={propertiesHasMore} onPropertySearch={onPropertySearch} onLoadMoreProperties={onLoadMoreProperties} value={watch("property_id")} error={errors.property_id?.message} priorityPropertyId={urlPropertyId} onChange={(property) => { applyPropertyToDealForm(form, property); setFormSearchParams((current) => { const next = new URLSearchParams(current); next.set("property", String(property.id)); return next }); onPropertyChange?.(property) }} />
  const selectedContact = contacts.find((contact) => contact.id === Number(watch("contact_id")))
  const selectedContactOption = selectedContact && selectedContact.id !== undefined ? { id: selectedContact.id, label: selectedContact.name, description: [selectedContact.title, selectedContact.email ?? selectedContact.phone].filter(Boolean).join(" · "), data: selectedContact } : undefined
  const contactField = editing ? <div className="min-w-0"><label htmlFor="deal-contact" className="text-xs font-medium text-muted-foreground">Contact <span className="font-normal">(required)</span></label><div id="deal-contact" className="mt-1 flex min-h-8 items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 text-sm" aria-readonly="true">{selectedContact ? <><PersonAvatar name={selectedContact.name} size="sm" /><span className="min-w-0 truncate">{selectedContact.name}</span></> : <span className="text-muted-foreground">Contact unavailable.</span>}</div><FieldError>{errors.contact_id?.message}</FieldError></div> : <div className="min-w-0"><label htmlFor="deal-contact" className="text-xs font-medium text-muted-foreground">Contact <span className="font-normal">(required)</span></label><SearchableResourcePicker id="deal-contact" label="Contact" labelStyle="icon-only" required icon={<UserRound className="size-3.5" aria-hidden="true" />} value={Number(watch("contact_id")) || 0} selectedOption={selectedContactOption} onChange={(value) => setValue("contact_id", String(value), { shouldDirty: true, shouldValidate: true })} error={errors.contact_id?.message} loadOptions={loadDealContactOptions} placeholder="Choose a contact" searchPlaceholder="Search contacts…" loadingLabel="Searching contacts…" emptyLabel="No contacts found." noResultsLabel="No contacts match your search." className="mt-1" renderOption={(option) => <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={option.label} size="sm" /><span className="min-w-0"><span className="block truncate font-medium">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span></span>} renderSelectedOption={(option) => <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={option.label} size="sm" /><span className="truncate">{option.label}</span></span>} /></div>
  return (
    <form id={formId} onSubmit={onSubmit} className="min-w-0 w-full space-y-5 p-5">
      <div className="w-full">{propertyField}</div>
      <FieldGroup className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-[50%]">
        <div className="sm:col-span-2">{contactField}</div>
        <DealInputField inputId="deal-final-value" label="Deal value" required error={errors.deal_value?.message} description={commissionAmount === null ? undefined : <span className="flex w-full items-center gap-2" aria-live="polite"><HandCoins className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span>Commission</span><span className="ms-auto font-mono font-medium text-foreground">{formatCurrency(commissionAmount)}</span></span>}><div className="flex min-w-0 w-full items-center"><InputGroupAddon align="inline-start" className="border-0 bg-transparent ps-2.5 pe-0"><DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" /></InputGroupAddon><InputGroupInput id="deal-final-value" aria-labelledby="deal-final-value-label" aria-invalid={Boolean(errors.deal_value)} type="number" step="1000" className="!border-0 focus-visible:!border-0 focus-visible:!ring-0" {...register("deal_value")} /></div></DealInputField>
        <DealInputField inputId="deal-value" label="Value" error={errors.value?.message} inputGroupClassName="focus-within:!border-input focus-within:!ring-0 cursor-default [&_*]:!cursor-default"><div className="flex min-w-0 w-full items-center"><InputGroupAddon align="inline-start" className="border-0 bg-transparent ps-2.5 pe-0"><DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" /></InputGroupAddon><InputGroupInput id="deal-value" aria-labelledby="deal-value-label" aria-readonly="true" aria-invalid={Boolean(errors.value)} readOnly tabIndex={-1} type="number" step="1000" className="!border-0 focus-visible:!border-0 focus-visible:!ring-0" {...register("value")} /></div></DealInputField>
        {hideAgentSelect ? <input type="hidden" {...register("agent_id")} /> : <DealSelectField inputId="deal-agent" label="Agent" required error={errors.agent_id?.message} value={watch("agent_id")} onValueChange={(value) => setValue("agent_id", value, { shouldDirty: true, shouldValidate: true })} placeholder={agentsLoading ? "Loading users…" : agents.length ? "Choose an agent" : "No agents available"} disabled={agentsLoading || agents.length === 0}><>{agents.map((agent) => <SelectItem key={agent.id} value={String(agent.id)}><span className="flex items-center gap-2"><PersonAvatar name={agent.name} avatar={agent.avatar} size="sm" /><span className="truncate">{agent.name}</span></span></SelectItem>)}</></DealSelectField>}
        <DealSelectField inputId="deal-status" label="Status" required error={errors.status?.message} value={watchedStatus || "inquiry"} onValueChange={(value) => setValue("status", value as DealFormValues["status"], { shouldValidate: true })} className="sm:max-w-44"><>{statuses.map((status) => <SelectItem key={status} value={status}><span className={`capitalize ${statusTextClass[status]}`}>{labelFor(status)}</span></SelectItem>)}</></DealSelectField>
        {watchedStatus === "won" && <DealInputField inputId="deal-closed-at" label="Closed at" error={errors.closed_at?.message}><DateTimePicker value={watch("closed_at")} onChange={(value) => setValue("closed_at", value, { shouldValidate: true })} className="rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0" /></DealInputField>}
      </FieldGroup>
    </form>
  )
}

function DealInputField({ inputId, label, required, error, className, description, inputGroupClassName, children }: { inputId: string; label: string; required?: boolean; error?: string; className?: string; description?: ReactNode; inputGroupClassName?: string; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><label id={labelId} htmlFor={inputId} className="text-xs font-medium text-muted-foreground">{label}{required && <span className="font-normal"> (required)</span>}</label><InputGroup className={`mt-1 h-8 overflow-hidden ${inputGroupClassName ?? ""}`}>{children}{description && <InputGroupAddon align="inline-end" className="border-0 bg-transparent pe-2"><InputGroupText className="text-xs font-normal">{description}</InputGroupText></InputGroupAddon>}</InputGroup><FieldError>{error}</FieldError></Field>
}

function DealSelectField({ inputId, label, required, error, className, value, onValueChange, placeholder, disabled = false, children }: { inputId: string; label: string; required?: boolean; error?: string; className?: string; value: string; onValueChange: (value: string) => void; placeholder?: string; disabled?: boolean; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><label id={labelId} htmlFor={inputId} className="text-xs font-medium text-muted-foreground">{label}{required && <span className="font-normal"> (required)</span>}</label><InputGroup className="mt-1 h-8 overflow-hidden"><Select value={value} onValueChange={onValueChange} disabled={disabled}><SelectTrigger id={inputId} aria-labelledby={labelId} aria-invalid={Boolean(error)} data-slot="input-group-control" className="h-8 w-full rounded-none border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{children}</SelectContent></Select></InputGroup><FieldError>{error}</FieldError></Field>
}

export function DealValueComparison({ value, dealValue }: { value: number; dealValue: number }) {
  const equal = dealValue === value
  const higher = dealValue > value
  const tone = higher ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
  return <div aria-label={`Deal value ${formatCurrency(dealValue)}; intended value ${formatCurrency(value)}`}>
    {equal ? <div className="font-mono text-xl font-semibold text-foreground">{formatCurrency(value)}</div> : <><div className={`flex items-center gap-1.5 font-mono text-xl font-semibold ${tone}`}><span className="sr-only">{higher ? "Higher than intended: " : "Lower than intended: "}</span>{higher ? <ArrowUp className="size-4 shrink-0" aria-hidden="true" /> : <ArrowDown className="size-4 shrink-0" aria-hidden="true" />}{formatCurrency(dealValue)}</div><div className="font-mono text-xs text-muted-foreground/60 line-through">{formatCurrency(value)}</div></>}
  </div>
}

export function DealAgent({ agent, agentId, compact = false, linkEnabled = true, useIcon = false, linkClassName = "text-primary", linkVisuals = false }: { agent: Deal["agent"] | null | undefined; agentId?: number; compact?: boolean; linkEnabled?: boolean; useIcon?: boolean; linkClassName?: string; linkVisuals?: boolean }) {
  if (!agent) return <span className="text-sm text-muted-foreground">—</span>
  const id = agent.id ?? agentId
  const agentPath = id !== undefined && linkEnabled ? `/agents/${id}` : undefined
  const name = agentPath ? <Link className={linkClassName} to={agentPath} onClick={(event) => event.stopPropagation()}>{agent.name}</Link> : agent.name
  const visual = useIcon ? <span className="grid size-7 shrink-0 place-items-center text-muted-foreground" aria-hidden="true"><UserRound className="size-4" /></span> : <PersonAvatar name={agent.name} size={compact ? "sm" : "default"} />
  return <div className="flex min-w-0 items-center gap-2">{agentPath && linkVisuals ? <Link className="shrink-0" to={agentPath} aria-label={`${agent.name} avatar`} onClick={(event) => event.stopPropagation()}>{visual}</Link> : visual}<div className="min-w-0 truncate font-medium">{name}</div></div>
}

function DealPreviewMedia({ property }: { property: Deal["property"] }) {
  const images = property.images ?? []
  if (!images.length) return <div className="grid aspect-[2/1] place-items-center border border-dashed border-border bg-muted/20 text-xs text-muted-foreground"><span><ImageIcon className="mx-auto mb-1.5 size-4" />No listing image</span></div>
  const thumbnails = images.slice(1, 4)
  return <section aria-label="Deal property images" className="space-y-2">
    <div className="aspect-[2/1] overflow-hidden border border-border bg-muted/20"><img src={images[0].thumbnail_url || images[0].url} alt={`${property.title} listing`} className="size-full object-cover" /></div>
    <div className="flex items-center gap-1.5 overflow-hidden">
      {thumbnails.map((image) => <img key={image.id} src={image.thumbnail_url || image.url} alt="" className="h-10 w-14 shrink-0 border border-border object-cover" />)}
      {images.length > 4 && <span className="grid h-10 min-w-10 shrink-0 place-items-center border border-border bg-muted/20 px-1 text-xs text-muted-foreground">+{images.length - 4}</span>}
      <span className="ms-auto text-xs text-muted-foreground">{images.length} images</span>
    </div>
  </section>
}

export function DealInspector({ deal, detailsPath, canEdit, canDelete, onEdit, onDelete }: { deal: Deal | null; detailsPath: string; canEdit: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void }) {
  if (!deal) return null
  return <div className="space-y-6 p-5">
    <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <PersonAvatar name={deal.contact.name} size="lg" />
          <div className="min-w-0">
            <h2 className="mt-1 truncate text-lg font-semibold">{deal.contact.id !== undefined ? <RelatedLink to={`/contacts/${deal.contact.id}`} label={deal.contact.name} /> : deal.contact.name}</h2>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{deal.property.id !== undefined ? <RelatedLink to={`/properties/${deal.property.id}`} label={deal.property.title} /> : deal.property.title}<span className="truncate">· {deal.property.city}</span></p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{deal.contact.email ?? deal.contact.phone ?? "No contact details"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Badge className={statusPillClass[deal.status]}>{labelFor(deal.status)}</Badge><Badge variant="secondary">{formatNumber(deal.commission_rate)}% commission</Badge></div>
      </div>
      <div className="flex shrink-0 gap-1">
        <ActionTooltip label="Open dedicated details"><Button asChild variant="outline" size="icon"><Link to={detailsPath} aria-label="Open dedicated details"><Eye /></Link></Button></ActionTooltip>
        {canEdit && <ActionTooltip label="Edit deal"><Button variant="outline" size="icon" aria-label="Edit deal" onClick={onEdit}><Pencil /></Button></ActionTooltip>}
        {canDelete && <ActionTooltip label="Delete deal"><Button variant="outline" size="icon" aria-label="Delete deal" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /></Button></ActionTooltip>}
      </div>
    </header>
    <DealPreviewMedia property={deal.property} />
    <section className="overflow-hidden border border-border bg-muted/20">
      <div className="grid grid-cols-2 gap-3 p-4">
        <div><p className="text-xs font-medium text-muted-foreground">Deal value</p><p className="mt-2 font-mono text-lg font-semibold">{formatCurrency(deal.deal_value)}</p></div>
        <div><p className="text-xs font-medium text-muted-foreground">Value</p><p className="mt-2 font-mono text-lg font-semibold text-muted-foreground">{formatCurrency(deal.value)}</p></div>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Percent className="size-3.5" aria-hidden="true" /><span className="sr-only">Commission </span>{formatNumber(deal.commission_rate)}%</span>
        <span className="flex items-center gap-1.5 font-mono font-medium" aria-label={`Commission amount ${formatCurrency(deal.commission.total_amount)}`}><HandCoins className="size-3.5 text-muted-foreground" aria-hidden="true" />{formatCurrency(deal.commission.total_amount)}</span>
      </footer>
    </section>
    <section className="border border-border bg-muted/20 p-4">
      <p className="text-xs font-medium text-muted-foreground">Assigned agent</p>
      <div className="mt-3"><DealAgent agent={deal.agent} agentId={deal.agent_id} compact /></div>
    </section>
    <section className="border-t border-border pt-5">
      <p className="text-xs font-medium text-muted-foreground">Timeline</p>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2"><DealInfo label="Closed" value={formatDate(deal.closed_at)} /><DealInfo label="Created" value={formatDate(deal.created_at)} /></dl>
    </section>
  </div>
}

export function DealInfo({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{label === "Property" && <MapPin className="me-1 inline size-3 align-[-1px]" aria-hidden="true" />}{value}</dd></div> }
export function RelatedLink({ to, label, enabled = true }: { to: string; label: string; enabled?: boolean }) { return enabled ? <Link className="text-primary" to={to} onClick={(event) => event.stopPropagation()}>{label}</Link> : <span>{label}</span> }
export function ForbiddenDeals() { return <ErrorState kind="forbidden" title="Deals are restricted" description="You do not have permission to view deals." actionLabel="Return to overview" actionTo="/" /> }
