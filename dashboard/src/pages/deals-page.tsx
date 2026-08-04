import { createContext, useCallback, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDown, ArrowLeft, ArrowUp, Building2, Check, ChevronLeft, ChevronRight, DollarSign, Eye, HandCoins, ImageIcon, Mail, MapPin as MapPinIcon, Pencil, Percent, Phone, Plus, RefreshCw, Save, Search, Trash2, UserRound, X } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { z } from "zod"
import type { components as AuthComponents } from "@/api/generated/Auth"
import type { components as SalesComponents, paths as SalesPaths } from "@/api/generated/Sales"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { SearchableResourcePicker, type SearchableResourceOption, type SearchableResourcePage } from "@/components/shared/searchable-resource-picker"
import { NumericRangeFilter, type NumericRange } from "@/components/shared/numeric-range-filter"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { DateRangePicker, DateTimePicker } from "@/components/ui/date-picker"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePreviewDrawer } from "@/components/shared/resource-preview-drawer"

const MapPin = (props: ComponentProps<typeof MapPinIcon>) => <MapPinIcon {...props} />

type Deal = SalesComponents["schemas"]["Deal"]
type User = AuthComponents["schemas"]["User"]
type AuthenticatedAgent = User & { commission_rate: number }
type AgentOption = { id: number; name: string; username?: string | null }
type DealEnvelope = { deal: Deal }
type DealFilterInfo = SalesPaths["/"]["get"]["responses"][200]["content"]["application/json"]["filter"]
type DealList = Paginated<Deal> & { filter: DealFilterInfo }
type DealUpdatePayload = SalesPaths["/{id}"]["post"]["requestBody"]["content"]["application/json"]
type DealPropertyImage = { url: string; thumbnail_url?: string }
type DealPropertyOption = Pick<Deal["property"], "id" | "title" | "description" | "city" | "address" | "price" | "type" | "status"> & { images?: DealPropertyImage[] } & Partial<Pick<Deal["property"], "owner" | "created_at">>

type DealRelationOptions = { contacts: Deal["contact"][]; properties: DealPropertyOption[]; agents: AgentOption[]; agentsLoading: boolean }
const DealRelationOptionsContext = createContext<DealRelationOptions>({ contacts: [], properties: [], agents: [], agentsLoading: false })

const statuses = ["inquiry", "viewing", "offer_made", "legal", "won", "lost"] as const
const statusPillClass: Record<Deal["status"], string> = {
  inquiry: "border-slate-500/20 bg-slate-500/10 text-slate-800 hover:bg-slate-500/10 dark:text-slate-200",
  viewing: "border-blue-500/20 bg-blue-500/10 text-blue-800 hover:bg-blue-500/10 dark:text-blue-200",
  offer_made: "border-amber-500/20 bg-amber-500/10 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100",
  legal: "border-violet-500/20 bg-violet-500/10 text-violet-900 hover:bg-violet-500/10 dark:text-violet-100",
  won: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/10 dark:text-emerald-100",
  lost: "border-red-500/20 bg-red-500/10 text-red-900 hover:bg-red-500/10 dark:text-red-100",
}
const statusTextClass: Record<Deal["status"], string> = {
  inquiry: "text-slate-700/80 dark:text-slate-300/80",
  viewing: "text-blue-700/80 dark:text-blue-300/80",
  offer_made: "text-amber-700/80 dark:text-amber-300/80",
  legal: "text-violet-700/80 dark:text-violet-300/80",
  won: "text-emerald-700/80 dark:text-emerald-300/80",
  lost: "text-red-700/80 dark:text-red-300/80",
}
const propertyStatusPillClass: Record<Deal["property"]["status"], string> = {
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  showing: "border-blue-500/20 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  sold: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
}

const numericField = (label: string) => z.string().trim().min(1, `Enter ${label}.`).refine((value) => Number.isFinite(Number(value)), `Enter a valid ${label}.`)
const optionalNumericField = (label: string) => z.string().trim().refine((value) => !value || Number.isFinite(Number(value)), `Enter a valid ${label}.`)
const integerField = (label: string) => numericField(label).refine((value) => Number.isInteger(Number(value)), `Enter a whole-number ${label}.`)
const dealSchema = z.object({
  value: optionalNumericField("a value"),
  deal_value: numericField("a deal value"),
  contact_id: integerField("contact ID"),
  property_id: integerField("property ID"),
  agent_id: integerField("agent ID"),
  status: z.enum(statuses),
  closed_at: z.string().refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Enter a valid closing date."),
})
type DealFormValues = z.infer<typeof dealSchema>
type DealFormProps = { form: ReturnType<typeof useForm<DealFormValues>>; title: string; saving: boolean; onCancel: () => void; onSubmit: () => void; commissionRate: number | null; lockRelations?: boolean; formId?: string }
const emptyValues: DealFormValues = { value: "", deal_value: "", contact_id: "", property_id: "", agent_id: "", status: "inquiry", closed_at: "" }

function labelFor(value: string) { return value.replaceAll("_", " ") }
function titleFor(value: string) { return labelFor(value).replace(/\b\w/g, (character) => character.toUpperCase()) }
function formatCurrency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value) }
function formatNumber(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) }
function authenticatedCommissionRate(user: User | null): number | null {
  const agent = user as AuthenticatedAgent | null
  return typeof agent?.commission_rate === "number" ? agent.commission_rate : null
}
function rangeValue(value: string, fallback: number | null | undefined) {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : fallback ?? 0
}
function calculateCommissionAmount(dealValue: string, commissionRate: number | null): number | null {
  const value = Number(dealValue)
  if (!dealValue.trim() || commissionRate === null || !Number.isFinite(value) || !Number.isFinite(commissionRate)) return null
  return value * commissionRate / 100
}
function formatDate(value?: string | null) {
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
function normalizeDealProperty(value: unknown): DealPropertyOption | undefined {
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
async function loadDealContactOptions(query: string, _page: number, signal: AbortSignal): Promise<SearchableResourcePage> {
  const body = await apiJson<unknown>(`${API_BASE_URL}/v1/contacts`, { signal })
  const options = collectionValues(body).map(normalizeDealContact).filter((contact): contact is Deal["contact"] => contact !== undefined).map((contact) => ({ id: contact.id, label: contact.name, description: [contact.title, contact.email ?? contact.phone].filter(Boolean).join(" · "), data: contact }))
  return { options: filterRelationOptions(options, query), currentPage: 1, lastPage: 1 }
}
async function loadDealPropertyOptions(query: string, _page: number, signal: AbortSignal): Promise<SearchableResourcePage> {
  const body = await apiJson<unknown>(`${API_BASE_URL}/v1/properties`, { signal })
  const options = collectionValues(body).map(normalizeDealProperty).filter((property): property is DealPropertyOption => property !== undefined).map((property) => ({ id: property.id as number, label: property.title, description: `${property.city} · ${formatCurrency(property.price)}`, data: property }))
  return { options: filterRelationOptions(options, query), currentPage: 1, lastPage: 1 }
}
function toDateTimeInput(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
function valuesFromDeal(deal: Deal): DealFormValues {
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
function toPayload(values: DealFormValues, editing: boolean, commissionRate: number | null) {
  return {
    value: Number(values.value),
    deal_value: Number(values.deal_value),
    contact_id: Number(values.contact_id),
    property_id: Number(values.property_id),
    agent_id: Number(values.agent_id),
    status: values.status,
    commission_rate: commissionRate ?? 0,
    closed_at: values.closed_at ? (editing ? values.closed_at.slice(0, 10) : new Date(values.closed_at).toISOString()) : null,
  }
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

function PropertyCover({ property, size = "row" }: { property: DealPropertyOption; size?: "row" | "option" }) {
  const cover = property.images?.[0]
  const className = size === "row" ? "h-10 w-[3.333rem]" : "size-9"

  return cover ? <img src={cover.thumbnail_url || cover.url} alt="" className={`${className} shrink-0 border border-border object-cover`} loading="lazy" /> : <span className={`${className} grid shrink-0 place-items-center border border-dashed border-border bg-muted/20 text-muted-foreground`} aria-hidden="true"><ImageIcon className="size-3.5" /></span>
}

function PropertyOption({ property }: { property: DealPropertyOption }) {
  return <span className="flex min-w-0 items-center gap-2"><PropertyCover property={property} size="option" /><span className="min-w-0"><span className="block truncate">{property.title}</span><span className="block truncate text-xs text-muted-foreground">{property.city}</span></span></span>
}

function DealPropertyPickerOption({ option }: { option: SearchableResourceOption }) {
  const property = normalizeDealProperty(option.data)
  return <span className="flex min-w-0 items-center gap-2">{property ? <PropertyCover property={property} size="option" /> : <span className="grid size-9 shrink-0 place-items-center border border-dashed border-border bg-muted/20 text-muted-foreground" aria-hidden="true"><ImageIcon className="size-3.5" /></span>}<span className="min-w-0"><span className="block truncate font-medium">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span></span>
}

export function DealsPage() {
  const { can, isSuper, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const selectedId = Number(searchParams.get("record") ?? "") || undefined
  const mode = searchParams.get("mode")
  const query = searchParams.get("q") ?? ""
  const statusFilter = searchParams.get("status") ?? ""
  const contactFilter = searchParams.get("contact") ?? ""
  const propertyFilter = searchParams.get("property") ?? ""
  const agentFilter = searchParams.get("agent") ?? ""
  const closedFrom = searchParams.get("closed_from") ?? ""
  const closedTo = searchParams.get("closed_to") ?? ""
  const minValueFilter = searchParams.get("min_value") ?? ""
  const maxValueFilter = searchParams.get("max_value") ?? ""
  const minDealValueFilter = searchParams.get("min_deal_value") ?? ""
  const maxDealValueFilter = searchParams.get("max_deal_value") ?? ""
  const [queryInput, setQueryInput] = useState(query)
  const [closedFromInput, setClosedFromInput] = useState(closedFrom)
  const [closedToInput, setClosedToInput] = useState(closedTo)
  const [deals, setDeals] = useState<Deal[]>([])
  const [userOptions, setUserOptions] = useState<AgentOption[]>([])
  const [userOptionsLoading, setUserOptionsLoading] = useState(false)
  const [meta, setMeta] = useState<DealList["meta"] | null>(null)
  const [filterInfo, setFilterInfo] = useState<DealFilterInfo | null>(null)
  const [selected, setSelected] = useState<Deal | null>(null)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [selectionError, setSelectionError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [pendingDeleteTarget, setPendingDelete] = useState<Deal | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const endpoint = `${API_BASE_URL}/v1/deals`

  useEffect(() => {
    if (!can("user.view")) return
    const controller = new AbortController()
    setUserOptionsLoading(true)
    void apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users`, { signal: controller.signal })
      .then(async (firstPage) => {
        const remainingPages = await Promise.all(Array.from({ length: Math.max(0, firstPage.meta.last_page - 1) }, (_, index) => apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users?page=${index + 2}`, { signal: controller.signal })))
        const users = [firstPage, ...remainingPages].flatMap((pageBody) => pageBody.data)
        setUserOptions(users.filter((user): user is User & { id: number } => user.id !== undefined).map((user) => ({ id: user.id, name: user.name, username: user.username })))
      })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setUserOptions([]) })
      .finally(() => { if (!controller.signal.aborted) setUserOptionsLoading(false) })
    return () => controller.abort()
  }, [can])

  async function loadDeals(signal?: AbortSignal, requestedPage = page) {
    setLoading(true)
    setError("")
    setErrorStatus(null)
    try {
      const requestUrl = listUrl(endpoint, {
        page: requestedPage,
        q: query,
        status: statusFilter,
        contact: contactFilter,
        property: propertyFilter,
        agent: agentFilter,
        closed_from: closedFrom,
        closed_to: closedTo,
        min_value: minValueFilter,
        max_value: maxValueFilter,
        min_deal_value: minDealValueFilter,
        max_deal_value: maxDealValueFilter,
      })
      const body = await apiJson<DealList>(requestUrl, { signal })
      setDeals(body.data)
      setMeta(body.meta)
      setFilterInfo(body.filter)
      if (body.meta.current_page !== requestedPage && requestedPage > 1) setSearchParams((current) => { const next = new URLSearchParams(current); next.set("page", String(body.meta.current_page)); return next })
      return body
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return undefined
      setErrorStatus(caught instanceof ApiError ? caught.status : null)
      setError(caught instanceof Error ? caught.message : "Unable to load deals.")
      return undefined
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    if (!can("deal.view")) return
    const controller = new AbortController()
    void loadDeals(controller.signal)
    return () => controller.abort()
  }, [agentFilter, closedFrom, closedTo, contactFilter, maxDealValueFilter, maxValueFilter, minDealValueFilter, minValueFilter, page, propertyFilter, query, statusFilter])

  useEffect(() => {
    if (mode === "create" || mode === "edit") {
      setSelected(null)
      return
    }
    if (!selectedId) {
      setSelected(null)
      setSelectionError(null)
      setSelectionLoading(false)
      return
    }
    const listed = deals.find((deal) => deal.id === selectedId)
    if (listed) setSelected(listed)
    const controller = new AbortController()
    setSelectionLoading(true)
    setSelectionError(null)
    void apiJson<DealEnvelope>(`${endpoint}/${selectedId}`, { signal: controller.signal })
      .then((body) => setSelected(body.deal))
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setSelectionError(caught instanceof ApiError ? caught : new ApiError(caught instanceof Error ? caught.message : "Unable to load this deal.", 0)) })
      .finally(() => { if (!controller.signal.aborted) setSelectionLoading(false) })
    return () => controller.abort()
  }, [deals, endpoint, mode, selectedId])

  const setParams = (next: Record<string, string | undefined>) => setSearchParams((current) => {
    const params = new URLSearchParams(current)
    Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value))
    return params
  })
  const updateFilter = (key: "status" | "contact" | "property" | "agent", value: string) => setParams({ [key]: value || undefined, page: "1", record: undefined, mode: undefined })
  const clearFilters = () => setParams({ q: undefined, status: undefined, contact: undefined, property: undefined, agent: undefined, closed_from: undefined, closed_to: undefined, min_value: undefined, max_value: undefined, min_deal_value: undefined, max_deal_value: undefined, page: "1", record: undefined, mode: undefined })
  const canEditDeal = (deal: Deal | null | undefined) => Boolean(
    deal && (isSuper || can("deal.update") || user?.id === deal.agent_id),
  )
  useEffect(() => { setQueryInput(query) }, [query])
  useEffect(() => { setClosedFromInput(closedFrom); setClosedToInput(closedTo) }, [closedFrom, closedTo])
  useEffect(() => {
    if (queryInput === query) return
    const timeout = window.setTimeout(() => setParams({ q: queryInput || undefined, page: "1", record: undefined, mode: undefined }), 500)
    return () => window.clearTimeout(timeout)
  }, [query, queryInput])
  useEffect(() => {
    if (closedFromInput === closedFrom && closedToInput === closedTo) return
    const timeout = window.setTimeout(() => setParams({ closed_from: closedFromInput || undefined, closed_to: closedToInput || undefined, page: "1", record: undefined, mode: undefined }), 500)
    return () => window.clearTimeout(timeout)
  }, [closedFrom, closedFromInput, closedTo, closedToInput])

  const valueRange: NumericRange = [
    rangeValue(minValueFilter, filterInfo?.min_value),
    rangeValue(maxValueFilter, filterInfo?.max_value),
  ]
  const dealValueRange: NumericRange = [
    rangeValue(minDealValueFilter, filterInfo?.min_deal_value),
    rangeValue(maxDealValueFilter, filterInfo?.max_deal_value),
  ]
  const updateValueRange = (next: NumericRange) => {
    if (!filterInfo || filterInfo.min_value === null || filterInfo.max_value === null) return
    setParams({
      min_value: next[0] <= filterInfo.min_value ? undefined : String(next[0]),
      max_value: next[1] >= filterInfo.max_value ? undefined : String(next[1]),
      page: "1",
      record: undefined,
      mode: undefined,
    })
  }
  const updateDealValueRange = (next: NumericRange) => {
    if (!filterInfo || filterInfo.min_deal_value === null || filterInfo.max_deal_value === null) return
    setParams({
      min_deal_value: next[0] <= filterInfo.min_deal_value ? undefined : String(next[0]),
      max_deal_value: next[1] >= filterInfo.max_deal_value ? undefined : String(next[1]),
      page: "1",
      record: undefined,
      mode: undefined,
    })
  }

  const openDeal = (id: number) => selectedId === id ? setParams({ record: undefined }) : setParams({ page: String(page), record: String(id) })
  const startEditFor = (id: number) => {
    const deal = selected?.id === id ? selected : deals.find((item) => item.id === id)
    if (!canEditDeal(deal)) return
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    navigate(`/deals/${id}?mode=edit${queryString ? `&return=${encodeURIComponent(queryString)}` : ""}`)
  }
  async function deleteDeal() {
    if (!pendingDeleteTarget?.id) return
    setSaving(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${endpoint}/${pendingDeleteTarget.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      const deletedId = pendingDeleteTarget.id
      setPendingDelete(null)
      if (selectedId === deletedId) setParams({ record: undefined, mode: undefined })
      await loadDeals()
    } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this deal.") } finally { setSaving(false) }
  }

  useEffect(() => {
    if (!selectedId || mode !== "edit") return
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    navigate(`/deals/${selectedId}?mode=edit${queryString ? `&return=${encodeURIComponent(queryString)}` : ""}`, { replace: true })
  }, [mode, navigate, searchParams, selectedId])

  useEffect(() => {
    if (mode !== "create") return
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    navigate(`/deals/create${queryString ? `?return=${encodeURIComponent(queryString)}` : ""}`, { replace: true })
  }, [mode, navigate, searchParams])

  if (!can("deal.view")) return <ForbiddenDeals />
  if (errorStatus === 403) return <ForbiddenDeals />
  const canCreate = can("deal.create")
  const canDelete = isSuper
  // The table's legacy inline controls remain inert while the shared dialog owns deletion.
  const pendingDelete = pendingDeleteTarget ? { ...pendingDeleteTarget, id: -(pendingDeleteTarget.id ?? 0) } : null
  const hasFilters = Boolean(query || statusFilter || contactFilter || propertyFilter || agentFilter || closedFrom || closedTo || minValueFilter || maxValueFilter || minDealValueFilter || maxDealValueFilter)
  const filteredDeals = deals
  const optionDeals = selected ? [...deals, selected] : deals
  const contactOptions = Array.from(new Map(optionDeals.filter((deal) => deal.contact.id !== undefined).map((deal) => [String(deal.contact.id), deal.contact])).values())
  const propertyOptions = Array.from(new Map(optionDeals.filter((deal) => deal.property.id !== undefined).map((deal) => [String(deal.property.id), deal.property])).values())
  const dealAgentOptions = Array.from(new Map(optionDeals.filter((deal) => deal.agent?.id !== undefined).map((deal) => [String(deal.agent?.id), deal.agent])).values()).filter((agent): agent is NonNullable<Deal["agent"]> => Boolean(agent)).map((agent) => ({ id: agent.id as number, name: agent.name, username: agent.username }))
  const agentOptions = Array.from(new Map([...userOptions, ...dealAgentOptions].map((agent) => [String(agent.id), agent])).values())
  const detailsPath = (id: number) => {
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    return `/deals/${id}${queryString ? `?return=${encodeURIComponent(queryString)}` : ""}`
  }
  const createPath = () => {
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    return `/deals/create${queryString ? `?return=${encodeURIComponent(queryString)}` : ""}`
  }
  const closeDrawer = () => setParams({ record: undefined })
  return <DealRelationOptionsContext.Provider value={{ contacts: contactOptions, properties: propertyOptions, agents: agentOptions, agentsLoading: userOptionsLoading }}><div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="text-xs font-medium text-muted-foreground">CRM / Sales</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Deals</h1><p className="mt-1 text-sm text-muted-foreground">Track opportunities from qualification through close.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void loadDeals()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canCreate && <Button asChild size="sm"><Link to={createPath()}><Plus className="me-2 size-3.5" />New deal</Link></Button>}</div></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4"><div className="min-w-56 flex-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="deal-search">Search loaded deals</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="deal-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Contact, agent, property, status, amount…" /></div></div><div className="min-w-36"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={statusFilter || "all"} onValueChange={(value) => updateFilter("status", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((status) => <SelectItem key={status} value={status}><span className={`capitalize ${statusTextClass[status]}`}>{labelFor(status)}</span></SelectItem>)}</SelectContent></Select></div><div className="min-w-44"><label className="text-xs font-medium text-muted-foreground">Contact</label><Select value={contactFilter || "all"} onValueChange={(value) => updateFilter("contact", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="All contacts" /></SelectTrigger><SelectContent><SelectItem value="all">All contacts</SelectItem>{contactOptions.map((contact) => <SelectItem key={contact.id} value={String(contact.id)}><span className="flex items-center gap-2"><PersonAvatar name={contact.name} size="sm" />{contact.name}</span></SelectItem>)}</SelectContent></Select></div><div className="min-w-44"><label className="text-xs font-medium text-muted-foreground">Property</label><Select value={propertyFilter || "all"} onValueChange={(value) => updateFilter("property", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="All properties" /></SelectTrigger><SelectContent><SelectItem value="all">All properties</SelectItem>{propertyOptions.map((property) => <SelectItem key={property.id} value={String(property.id)}><PropertyOption property={property} /></SelectItem>)}</SelectContent></Select></div><div className="min-w-44"><label className="text-xs font-medium text-muted-foreground">Agent</label><Select value={agentFilter || "all"} onValueChange={(value) => updateFilter("agent", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue placeholder="All agents" /></SelectTrigger><SelectContent><SelectItem value="all">All agents</SelectItem>{agentOptions.map((agent) => agent && <SelectItem key={agent.id} value={String(agent.id)}><span className="flex items-center gap-2"><PersonAvatar name={agent.name} size="sm" /><span className="min-w-0"><span className="block truncate">{agent.name}</span></span></span></SelectItem>)}</SelectContent></Select></div><div className="min-w-72"><label className="text-xs font-medium text-muted-foreground">Closed date range</label><DateRangePicker from={closedFromInput} to={closedToInput} onChange={({ from, to }) => { setClosedFromInput(from); setClosedToInput(to) }} /></div>{hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}</div>
    <div className="flex flex-wrap items-end gap-3">
      <NumericRangeFilter id="deal-listed-value-range" label="Listed value" min={filterInfo?.min_value} max={filterInfo?.max_value} value={valueRange} onChange={updateValueRange} format={formatCurrency} />
      <NumericRangeFilter id="deal-final-value-range" label="Final deal value" min={filterInfo?.min_deal_value} max={filterInfo?.max_deal_value} value={dealValueRange} onChange={updateDealValueRange} format={formatCurrency} />
    </div>
    <div><section className="min-w-0 border border-border bg-card"><Table><TableHeader><TableRow><TableHead>Contact</TableHead><TableHead>Property</TableHead><TableHead>Agent</TableHead><TableHead>Status</TableHead><TableHead>Deal value</TableHead><TableHead>Commission</TableHead><TableHead>Closed</TableHead><TableHead className="w-48 min-w-48 max-w-48 text-end">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: 8 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-5 w-3/4" /></TableCell>)}</TableRow>) : filteredDeals.length ? filteredDeals.map((deal) => { const isPreviewing = selectedId === deal.id && !mode; const isEditing = selectedId === deal.id && mode === "edit"; const dealDetailsPath = deal.id ? detailsPath(deal.id) : "/deals"; const canEdit = canEditDeal(deal); return <TableRow key={deal.id} data-state={selectedId === deal.id ? "selected" : undefined} className="cursor-pointer" onClick={() => deal.id && openDeal(deal.id)}><TableCell><div className="flex items-center gap-2"><PersonAvatar name={deal.contact.name} /><div><div className="font-medium">{deal.contact.id !== undefined ? <Link className="text-primary hover:text-foreground" to={`/contacts/${deal.contact.id}`} onClick={(event) => event.stopPropagation()}>{deal.contact.name}</Link> : deal.contact.name}</div><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{deal.contact.email ? <Mail className="size-3 shrink-0" aria-hidden="true" /> : <Phone className="size-3 shrink-0" aria-hidden="true" />}<span className="truncate">{deal.contact.email ?? deal.contact.phone ?? "—"}</span></div></div></div></TableCell><TableCell><div className="flex min-w-44 items-center gap-2"><PropertyCover property={deal.property} /><div className="min-w-0"><div className="truncate font-medium">{deal.property.id !== undefined ? <Link className="text-primary hover:text-foreground" to={`/properties/${deal.property.id}`} onClick={(event) => event.stopPropagation()}>{deal.property.title}</Link> : deal.property.title}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" aria-hidden="true" />{deal.property.city}</div></div></div></TableCell><TableCell><DealAgent agent={deal.agent} agentId={deal.agent_id} compact /></TableCell><TableCell><Badge className={statusPillClass[deal.status]}>{labelFor(deal.status)}</Badge></TableCell><TableCell><div className="flex items-center gap-1 whitespace-nowrap font-mono text-xs">{deal.deal_value !== deal.value && (deal.deal_value > deal.value ? <ArrowUp className="size-3 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> : <ArrowDown className="size-3 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />)}<div className="space-y-0.5">{deal.deal_value === deal.value ? <div className="text-foreground">{formatCurrency(deal.value)}</div> : <><div className="text-muted-foreground/60 line-through">{formatCurrency(deal.value)}</div><div className={deal.deal_value > deal.value ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{formatCurrency(deal.deal_value)}</div></>}</div></div></TableCell><TableCell><div className="font-mono text-xs" aria-label={`Commission ${formatNumber(deal.commission_rate)} percent, ${formatCurrency(deal.deal_value * deal.commission_rate / 100)}`}><div>{formatNumber(deal.commission_rate)}%</div><div className="text-muted-foreground">{formatCurrency(deal.deal_value * deal.commission_rate / 100)}</div></div></TableCell><TableCell className="text-sm">{formatDate(deal.closed_at)}</TableCell><TableCell className="w-48 min-w-48 max-w-48 text-end"><div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>{pendingDelete?.id === deal.id ? <><ActionTooltip label="Cancel deletion"><Button variant="ghost" size="sm" disabled={saving} onClick={() => setPendingDelete(null)}>Cancel</Button></ActionTooltip><ActionTooltip label="Permanently delete deal"><Button variant="destructive" size="sm" disabled={saving} onClick={() => void deleteDeal()}>{saving ? "Deleting…" : "Delete"}</Button></ActionTooltip></> : <><ActionTooltip label="Open deal details"><Button asChild variant={isPreviewing ? "secondary" : "ghost"} size="icon" aria-pressed={isPreviewing}><Link to={dealDetailsPath} aria-label={`Open details for ${deal.contact.name}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit deal"><Button variant={isEditing ? "secondary" : "ghost"} size="icon" aria-pressed={isEditing} aria-label={`Edit deal ${deal.id}`} onClick={() => deal.id && startEditFor(deal.id)}><Pencil /></Button></ActionTooltip>}{canDelete && <Button variant="ghost" size="icon" aria-label={`Delete deal ${deal.id}`} className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(deal)}><Trash2 /></Button>}</>}</div></TableCell></TableRow> }) : <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No deals match the current filters. {hasFilters ? <Button variant="link" size="sm" className="ms-1" onClick={clearFilters}>Clear filters</Button> : canCreate && <Button asChild variant="link" size="sm" className="ms-1"><Link to={createPath()}>Create a deal</Link></Button>}</TableCell></TableRow>}</TableBody></Table><ResourcePagination page={meta?.current_page ?? page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} /></section></div>
    <ResourcePreviewDrawer open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) closeDrawer() }} title="Deal preview" description="Read-only deal context and related records.">
      {selectionLoading && !selected ? <div className="space-y-4 p-5"><Skeleton className="h-7 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></div> : selectionError ? <div className="space-y-3 p-5"><h2 className="font-semibold">{selectionError.status === 403 ? "Deal is restricted" : selectionError.status === 404 ? "Deal not found" : "Unable to load deal"}</h2><p className="text-sm text-muted-foreground">{selectionError.message}</p><Button variant="outline" size="sm" onClick={closeDrawer}>Close preview</Button></div> : selected ? <DealInspector deal={selected} detailsPath={selected.id ? detailsPath(selected.id) : "/deals"} canEdit={canEditDeal(selected)} canDelete={canDelete} onEdit={() => selected.id && startEditFor(selected.id)} onDelete={() => setPendingDelete(selected)} /> : <div className="p-5 text-sm text-muted-foreground">This deal could not be loaded.</div>}
    </ResourcePreviewDrawer>
    <ResourceDeleteDialog open={Boolean(pendingDeleteTarget)} onOpenChange={(open) => { if (!open && !saving) { setPendingDelete(null); setDeleteError("") } }} title="Delete this deal?" description={<>This permanently removes deal {pendingDeleteTarget?.id}. This action cannot be undone.</>} confirmLabel="Delete deal" pending={saving} error={deleteError} onConfirm={deleteDeal} />
  </div></DealRelationOptionsContext.Provider>
}

function DealForm({ form, title, saving, onCancel, onSubmit, commissionRate, lockRelations = false, formId }: DealFormProps) {
  const { register, formState: { errors }, setValue, watch } = form
  const watchedDealValue = watch("deal_value")
  const commissionAmount = calculateCommissionAmount(watchedDealValue, commissionRate)
  const { contacts, properties, agents, agentsLoading } = useContext(DealRelationOptionsContext)
  const propertyField = lockRelations ? <DealSelectField inputId="deal-property" label="Property" required error={errors.property_id?.message} value={watch("property_id")} onValueChange={(value) => setValue("property_id", value, { shouldDirty: true, shouldValidate: true })} placeholder={properties.length ? "Choose a property" : "Property unavailable"} disabled><>{properties.map((property) => <SelectItem key={property.id} value={String(property.id)}><PropertyOption property={property} /></SelectItem>)}</></DealSelectField> : <SearchableResourcePicker id="deal-property" label="Property" required icon={<Building2 className="size-3.5" aria-hidden="true" />} value={Number(watch("property_id")) || 0} onChange={(value, option) => { setValue("property_id", String(value), { shouldDirty: true, shouldValidate: true }); const property = normalizeDealProperty(option?.data); if (property) { setValue("value", String(property.price), { shouldDirty: true, shouldValidate: true }); if (!watch("deal_value").trim()) setValue("deal_value", String(property.price), { shouldDirty: true, shouldValidate: true }) } }} error={errors.property_id?.message} loadOptions={loadDealPropertyOptions} placeholder="Choose a property" searchPlaceholder="Search properties…" loadingLabel="Searching properties…" emptyLabel="No properties found." noResultsLabel="No properties match your search." description="Search the loaded property inventory by title, city, or address." renderOption={(option) => <DealPropertyPickerOption option={option} />} renderSelectedOption={(option) => <DealPropertyPickerOption option={option} />} />
  const contactField = lockRelations ? <DealSelectField inputId="deal-contact" label="Contact" required error={errors.contact_id?.message} value={watch("contact_id")} onValueChange={(value) => setValue("contact_id", value, { shouldDirty: true, shouldValidate: true })} placeholder={contacts.length ? "Choose a contact" : "Contact unavailable"} disabled><>{contacts.map((contact) => <SelectItem key={contact.id} value={String(contact.id)}><span className="flex items-center gap-2"><PersonAvatar name={contact.name} size="sm" /><span className="min-w-0"><span className="block truncate">{contact.name}</span><span className="block truncate text-xs text-muted-foreground">{contact.phone}</span></span></span></SelectItem>)}</></DealSelectField> : <SearchableResourcePicker id="deal-contact" label="Contact" required icon={<UserRound className="size-3.5" aria-hidden="true" />} value={Number(watch("contact_id")) || 0} onChange={(value) => setValue("contact_id", String(value), { shouldDirty: true, shouldValidate: true })} error={errors.contact_id?.message} loadOptions={loadDealContactOptions} placeholder="Choose a contact" searchPlaceholder="Search contacts…" loadingLabel="Searching contacts…" emptyLabel="No contacts found." noResultsLabel="No contacts match your search." description="Search the loaded contacts by name, title, email, or phone." renderOption={(option) => <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={option.label} size="sm" /><span className="min-w-0"><span className="block truncate font-medium">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span></span>} renderSelectedOption={(option) => <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={option.label} size="sm" /><span className="truncate">{option.label}</span></span>} />
  return (
    <form id={formId} onSubmit={onSubmit} className="w-full space-y-5 p-5">
      {lockRelations && <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Deal editor</p><h2 className="mt-1 text-lg font-semibold">{title}</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Close editor" onClick={onCancel}><X /></Button></div>}
      <FieldGroup className="grid w-full gap-3 sm:grid-cols-2">
        {propertyField}
        {contactField}
        <DealInputField inputId="deal-value" label="Value" error={errors.value?.message} inputGroupClassName="focus-within:!border-input focus-within:!ring-0 cursor-default [&_*]:!cursor-default"><div className="flex min-w-0 w-full items-center"><InputGroupAddon align="inline-start" className="border-0 bg-transparent ps-2.5 pe-0"><DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" /></InputGroupAddon><InputGroupInput id="deal-value" aria-labelledby="deal-value-label" aria-readonly="true" aria-invalid={Boolean(errors.value)} readOnly tabIndex={-1} type="number" step="1000" className="!border-0 focus-visible:!border-0 focus-visible:!ring-0" {...register("value")} /></div></DealInputField>
        <DealInputField inputId="deal-final-value" label="Deal value" required error={errors.deal_value?.message} description={commissionAmount === null ? undefined : <span className="flex w-full items-center gap-2" aria-live="polite"><HandCoins className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span>Commission</span><span className="ms-auto font-mono font-medium text-foreground">{formatCurrency(commissionAmount)}</span></span>}><div className="flex min-w-0 w-full items-center"><InputGroupAddon align="inline-start" className="border-0 bg-transparent ps-2.5 pe-0"><DollarSign className="size-3.5 text-muted-foreground" aria-hidden="true" /></InputGroupAddon><InputGroupInput id="deal-final-value" aria-labelledby="deal-final-value-label" aria-invalid={Boolean(errors.deal_value)} type="number" step="1000" className="!border-0 focus-visible:!border-0 focus-visible:!ring-0" {...register("deal_value")} /></div></DealInputField>
        <DealSelectField inputId="deal-agent" label="Agent" required error={errors.agent_id?.message} value={watch("agent_id")} onValueChange={(value) => setValue("agent_id", value, { shouldDirty: true, shouldValidate: true })} placeholder={agentsLoading ? "Loading users…" : agents.length ? "Choose an agent" : "No agents available"} disabled={lockRelations || agentsLoading || agents.length === 0}><>{agents.map((agent) => <SelectItem key={agent.id} value={String(agent.id)}><span className="flex items-center gap-2"><PersonAvatar name={agent.name} size="sm" /><span className="truncate">{agent.name}</span></span></SelectItem>)}</></DealSelectField>
        {lockRelations && <p className="sm:col-span-2 text-xs text-muted-foreground">Contact, property, and agent stay read-only here because the documented collections do not provide a bounded relation-options search.</p>}
        <DealSelectField inputId="deal-status" label="Status" required error={errors.status?.message} value={watch("status") || "inquiry"} onValueChange={(value) => setValue("status", value as DealFormValues["status"], { shouldValidate: true })}><>{statuses.map((status) => <SelectItem key={status} value={status}><span className={`capitalize ${statusTextClass[status]}`}>{labelFor(status)}</span></SelectItem>)}</></DealSelectField>
        <DealInputField inputId="deal-closed-at" label="Closed at" error={errors.closed_at?.message} description="Optional. Leave empty if the deal has not closed." className="sm:col-span-2"><DateTimePicker value={watch("closed_at")} onChange={(value) => setValue("closed_at", value, { shouldValidate: true })} className="rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0" /></DealInputField>
      </FieldGroup>
      {lockRelations && <div className="flex justify-between gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Save className="me-2 size-3.5" />Save deal</>}</Button></div>}
    </form>
  )
}

function DealInputField({ inputId, label, required, error, className, description, inputGroupClassName, children }: { inputId: string; label: string; required?: boolean; error?: string; className?: string; description?: ReactNode; inputGroupClassName?: string; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><InputGroup className={`h-auto! overflow-hidden ${inputGroupClassName ?? ""}`}><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}>{label}{required && <span className="font-normal text-muted-foreground"> (required)</span>}</InputGroupText></InputGroupAddon>{children}{description && <InputGroupAddon align="block-end" className="border-t border-border/70 bg-muted/30 dark:bg-transparent"><InputGroupText className="w-full justify-between px-0 text-xs font-normal">{description}</InputGroupText></InputGroupAddon>}</InputGroup><FieldError>{error}</FieldError></Field>
}

function DealSelectField({ inputId, label, required, error, className, value, onValueChange, placeholder, disabled = false, children }: { inputId: string; label: string; required?: boolean; error?: string; className?: string; value: string; onValueChange: (value: string) => void; placeholder?: string; disabled?: boolean; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}>{label}{required && <span className="font-normal text-muted-foreground"> (required)</span>}</InputGroupText></InputGroupAddon><Select value={value} onValueChange={onValueChange} disabled={disabled}><SelectTrigger id={inputId} aria-labelledby={labelId} aria-invalid={Boolean(error)} data-slot="input-group-control" className="h-8 w-full rounded-none border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{children}</SelectContent></Select></InputGroup><FieldError>{error}</FieldError></Field>
}

function DealValueComparison({ value, dealValue }: { value: number; dealValue: number }) {
  const equal = dealValue === value
  const higher = dealValue > value
  const tone = higher ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
  return <div aria-label={`Deal value ${formatCurrency(dealValue)}; intended value ${formatCurrency(value)}`}>
    {equal ? <div className="font-mono text-xl font-semibold text-foreground">{formatCurrency(value)}</div> : <><div className={`flex items-center gap-1.5 font-mono text-xl font-semibold ${tone}`}><span className="sr-only">{higher ? "Higher than intended: " : "Lower than intended: "}</span>{higher ? <ArrowUp className="size-4 shrink-0" aria-hidden="true" /> : <ArrowDown className="size-4 shrink-0" aria-hidden="true" />}{formatCurrency(dealValue)}</div><div className="font-mono text-xs text-muted-foreground/60 line-through">{formatCurrency(value)}</div></>}
  </div>
}

function DealAgent({ agent, agentId, compact = false, linkEnabled = true, useIcon = false }: { agent: Deal["agent"] | null | undefined; agentId?: number; compact?: boolean; linkEnabled?: boolean; useIcon?: boolean }) {
  if (!agent) return <span className="text-sm text-muted-foreground">—</span>
  const id = agent.id ?? agentId
  const name = id !== undefined && linkEnabled ? <Link className="text-primary hover:text-foreground" to={`/agents/${id}`} onClick={(event) => event.stopPropagation()}>{agent.name}</Link> : agent.name
  return <div className="flex min-w-0 items-center gap-2">{useIcon ? <span className="grid size-7 shrink-0 place-items-center text-muted-foreground" aria-hidden="true"><UserRound className="size-4" /></span> : <PersonAvatar name={agent.name} size={compact ? "sm" : "default"} />}<div className="min-w-0 truncate font-medium">{name}</div></div>
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

function DealInspector({ deal, detailsPath, canEdit, canDelete, onEdit, onDelete }: { deal: Deal | null; detailsPath: string; canEdit: boolean; canDelete: boolean; onEdit: () => void; onDelete: () => void }) {
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
        <span className="flex items-center gap-1.5 font-mono font-medium" aria-label={`Commission amount ${formatCurrency(deal.deal_value * deal.commission_rate / 100)}`}><HandCoins className="size-3.5 text-muted-foreground" aria-hidden="true" />{formatCurrency(deal.deal_value * deal.commission_rate / 100)}</span>
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

function DealInfo({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{label === "Property" && <MapPin className="me-1 inline size-3 align-[-1px]" aria-hidden="true" />}{value}</dd></div> }
function RelatedLink({ to, label, enabled = true }: { to: string; label: string; enabled?: boolean }) { return enabled ? <Link className="text-primary hover:text-foreground" to={to} onClick={(event) => event.stopPropagation()}>{label}</Link> : <span>{label}</span> }
function ForbiddenDeals() { return <ErrorState kind="forbidden" title="Deals are restricted" description="You do not have permission to view deals." actionLabel="Return to overview" actionTo="/" /> }

export function DealDetailsPage({ create = false }: { create?: boolean } = {}) {
  const { can, isSuper, user } = useAuth()
  const { dealId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = Number(dealId)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [mutationError, setMutationError] = useState("")
  const [mutationMessage, setMutationMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<Deal["status"] | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [createRelationOptions, setCreateRelationOptions] = useState<DealRelationOptions>({ contacts: [], properties: [], agents: [], agentsLoading: false })
  const [createRelationError, setCreateRelationError] = useState("")
  const form = useForm<DealFormValues>({ resolver: zodResolver(dealSchema), defaultValues: emptyValues })
  const returnQuery = searchParams.get("return")
  const backToIndex = returnQuery ? `/deals?${returnQuery}` : "/deals"
  const commissionRate = authenticatedCommissionRate(user)
  const canEdit = Boolean(!create && deal && (isSuper || can("deal.update") || user?.id === deal.agent_id))
  const canDelete = isSuper
  const editing = !create && searchParams.get("mode") === "edit" && canEdit

  const loadDeal = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isInteger(id) || id < 1) return
    setLoading(true); setError(null)
    try {
      const body = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals/${id}`, { signal })
      setDeal(body.deal); form.reset(valuesFromDeal(body.deal))
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof ApiError ? caught : new ApiError(caught instanceof Error ? caught.message : "Unable to load this deal.", 0))
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [form, id])

  useEffect(() => {
    if (create || !can("deal.view") || !Number.isInteger(id) || id < 1) { setLoading(false); return }
    const controller = new AbortController(); void loadDeal(controller.signal)
    return () => controller.abort()
  }, [can, create, id, loadDeal])

  useEffect(() => {
    if (!create || !can("deal.view")) return
    const controller = new AbortController()
    setCreateRelationError("")
    setCreateRelationOptions((current) => ({ ...current, agentsLoading: can("user.view") }))
    const usersRequest = can("user.view") ? apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users`, { signal: controller.signal }) : Promise.resolve(null)
    void usersRequest
      .then((users) => {
        const userAgents = users?.data.filter((item): item is User & { id: number } => item.id !== undefined).map((item) => ({ id: item.id, name: item.name, username: item.username })) ?? []
        setCreateRelationOptions({ contacts: [], properties: [], agents: userAgents, agentsLoading: false })
      })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setCreateRelationError(caught instanceof Error ? caught.message : "Unable to load deal options.") })
      .finally(() => { if (!controller.signal.aborted) setCreateRelationOptions((current) => ({ ...current, agentsLoading: false })) })
    return () => controller.abort()
  }, [can, create])

  function setEditMode(next: boolean) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      if (next) params.set("mode", "edit")
      else params.delete("mode")
      return params
    })
  }

  async function updateDeal(changes: Omit<DealUpdatePayload, "_method">, successMessage: string) {
    if (!deal?.id || !canEdit) return false
    setSaving(true); setMutationError(""); setMutationMessage("")
    try {
      const result = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals/${deal.id}`, { method: "POST", body: JSON.stringify({ ...changes, _method: "PUT" }) })
      setDeal(result.deal); form.reset(valuesFromDeal(result.deal)); setMutationMessage(successMessage)
      return true
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof DealFormValues, { message: messages[0] }))
      setMutationError(caught instanceof Error ? caught.message : "Unable to save this deal.")
      return false
    } finally { setSaving(false); setPendingStatus(null) }
  }

  const submitEdit = form.handleSubmit(async (values) => {
    const saved = await updateDeal(toPayload(values, true, commissionRate), "Deal saved.")
    if (saved) setEditMode(false)
  })

  const submitCreate = form.handleSubmit(async (values) => {
    setSaving(true); setMutationError(""); setMutationMessage("")
    try {
      const result = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals`, { method: "POST", body: JSON.stringify(toPayload(values, false, commissionRate)) })
      if (!result.deal.id) { navigate(backToIndex, { replace: true }); return }
      const detailsParams = returnQuery ? new URLSearchParams({ return: returnQuery }) : undefined
      navigate(`/deals/${result.deal.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof DealFormValues, { message: messages[0] }))
      setMutationError(caught instanceof Error ? caught.message : "Unable to create this deal.")
    } finally { setSaving(false) }
  })

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

  if (create && !can("deal.create")) return <ErrorState kind="forbidden" title="Deal creation is restricted" description="You do not have permission to create deals." actionLabel="Return to deals" actionTo="/deals" />
  if (!can("deal.view")) return <ForbiddenDeals />
  if (create) return <DealRelationOptionsContext.Provider value={createRelationOptions}><div className="space-y-6 p-6 pb-24 lg:p-8"><header className="border-b border-border pb-6"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={backToIndex}><ArrowLeft className="me-2 size-3.5" />Back to deals</Link></Button><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">CRM / Sales</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">New deal</h1></div><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => navigate(backToIndex)}>Cancel</Button><Button type="submit" form="deal-create-form" size="sm" disabled={saving}>{saving ? "Creating…" : "Create"}</Button></div></div></header>{createRelationError && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{createRelationError}</div>}<section className="w-full"><DealForm formId="deal-create-form" form={form} title="Create deal" saving={saving} commissionRate={commissionRate} onCancel={() => navigate(backToIndex)} onSubmit={submitCreate} /></section></div></DealRelationOptionsContext.Provider>
  if (!Number.isInteger(id) || id < 1) return <DealDetailsState title="Deal not found" description="The deal identifier is invalid." />
  if (loading) return <DealDetailsSkeleton />
  if (error?.status === 403) return <ForbiddenDeals />
  if (error || !deal) return <DealDetailsState title={error?.status === 404 ? "Deal not found" : "Unable to open deal"} description={error?.message || "This deal is no longer available."} retry={error?.status !== 404 ? () => void loadDeal() : undefined} />

  const relationOptions: DealRelationOptions = {
    contacts: [deal.contact],
    properties: [deal.property],
    agents: deal.agent?.id === undefined ? [] : [{ id: deal.agent.id, name: deal.agent.name, username: deal.agent.username }],
    agentsLoading: false,
  }
  const contactLink = deal.contact.id === undefined ? deal.contact.name : <RelatedLink to={`/contacts/${deal.contact.id}`} label={deal.contact.name} enabled={can("contact.view")} />
  const propertyLink = deal.property.id === undefined ? deal.property.title : <RelatedLink to={`/properties/${deal.property.id}`} label={deal.property.title} enabled={can("property.view")} />

  return <DealRelationOptionsContext.Provider value={relationOptions}><div className="space-y-6 p-6 pb-24 lg:p-8">
    <header className="border-b border-border pb-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={backToIndex}><ArrowLeft className="me-2 size-3.5" />Back to deals</Link></Button>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">Sales / Deal {deal.id ?? ""}</p><div className="flex flex-wrap items-center justify-end gap-2"><Button variant="outline" size="sm" onClick={() => void loadDeal()} disabled={saving}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canEdit && <Button variant={editing ? "secondary" : "outline"} size="sm" onClick={() => { form.reset(valuesFromDeal(deal)); setEditMode(!editing) }}><Pencil className="me-2 size-3.5" />{editing ? "Editing" : "Edit"}</Button>}{canDelete && <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="me-2 size-3.5" />Delete</Button>}</div></div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4"><div className="min-w-0"><h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-semibold tracking-tight"><PersonAvatar name={deal.contact.name} /><span>{contactLink}</span><span className="text-muted-foreground">·</span><span>{propertyLink}</span></h1><p className="mt-2 text-sm text-muted-foreground">{deal.property.city}{deal.property.address ? ` · ${deal.property.address}` : ""}</p>{!editing && <div className="mt-6 flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-muted-foreground">Status</span>{statuses.map((status) => <Button key={status} size="sm" variant={deal.status === status ? "secondary" : "ghost"} className={deal.status === status ? statusPillClass[status] : ""} aria-pressed={deal.status === status} disabled={!canEdit || saving} onClick={() => void changeStatus(status)}>{pendingStatus === status ? "Saving…" : <>{deal.status === status && <Check className="me-1.5 size-3.5" />}{labelFor(status)}</>}</Button>)}</div>}</div>{!editing && <div className="w-[21rem] shrink-0 border border-border bg-muted/20 p-3"><p className="text-xs font-medium text-muted-foreground">Assigned agent</p><div className="mt-2"><DealAgent agent={deal.agent} agentId={deal.agent_id} compact linkEnabled={can("user.view")} useIcon /></div></div>}</div>
    </header>
    <p className="sr-only" aria-live="polite">{mutationMessage || mutationError}</p>
    {mutationError && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{mutationError}</div>}
    {editing ? <DealForm form={form} title={`Edit deal ${deal.id ?? ""}`} saving={saving} commissionRate={commissionRate} onCancel={() => { form.reset(valuesFromDeal(deal)); setEditMode(false) }} onSubmit={submitEdit} lockRelations /> : <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <main className="min-w-0 space-y-8">
        <section className="grid border-y border-border sm:grid-cols-3"><Metric label="Final deal value" value={<DealValueComparison value={deal.value} dealValue={deal.deal_value} />} /><Metric label="Commission" value={<><span>{formatNumber(deal.commission_rate)}%</span><span className="mt-1 block text-sm font-medium text-muted-foreground">{formatCurrency(deal.deal_value * deal.commission_rate / 100)}</span></>} /><Metric label="Closed" value={formatDate(deal.closed_at)} /></section>
        <section className="pb-8"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">Property</h2><Badge className={propertyStatusPillClass[deal.property.status]}>Listing {titleFor(deal.property.status)}</Badge></div><h3 className="mt-3 text-xl font-semibold tracking-tight">{propertyLink}</h3><p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{deal.property.address}{deal.property.city ? ` · ${deal.property.city}` : ""}</span></p></div>{deal.property.id !== undefined && can("property.view") && <Button asChild variant="outline" size="sm"><Link to={`/properties/${deal.property.id}`}><Eye className="me-2 size-3.5" />Open property</Link></Button>}</div><div className="mt-5 grid gap-6 md:grid-cols-[minmax(17rem,0.85fr)_minmax(0,1.15fr)] md:items-start"><DealPropertyMedia property={deal.property} /><div className="min-w-0"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">Asking price</p><p className="mt-1 font-mono text-2xl font-semibold tracking-tight">{formatCurrency(deal.property.price)}</p></div><dl className="grid min-w-52 grid-cols-2 gap-x-6 gap-y-3 text-sm"><DealInfo label="Property type" value={titleFor(deal.property.type)} /><DealInfo label="Listing status" value={titleFor(deal.property.status)} /></dl></div><div className="mt-5 border-t border-border pt-5"><p className="text-xs font-medium text-muted-foreground">Listing description</p><p className="mt-2 line-clamp-3 max-w-2xl text-sm leading-6 text-muted-foreground">{deal.property.description || "No description has been recorded for this listing."}</p></div><div className="mt-5 border-t border-border pt-4"><p className="text-xs font-medium text-muted-foreground">Listing owner</p><div className="mt-2"><DealAgent agent={deal.property.owner} agentId={deal.property.owner?.id} compact linkEnabled={can("user.view")} useIcon /></div></div></div></div></section>
        {deal.id !== undefined && <ActivityLogList model="deal" id={deal.id} title="Deal activity" onReverted={() => void loadDeal()} />}
      </main>
      <aside className="h-fit border border-border bg-muted/20 xl:sticky xl:top-20"><div className="border-b border-border p-5"><p className="text-xs font-medium text-muted-foreground">Customer</p><div className="mt-3 flex items-center gap-3"><PersonAvatar name={deal.contact.name} size="lg" /><div className="min-w-0"><h2 className="truncate text-lg font-semibold">{contactLink}</h2>{deal.contact.title && <p className="truncate text-sm text-muted-foreground">{deal.contact.title}</p>}</div></div></div><div className="space-y-4 p-5"><div className="space-y-2 text-sm"><p className="text-xs font-medium text-muted-foreground">Reachability</p>{deal.contact.phone && <a className="flex items-center gap-2 text-primary hover:text-foreground" href={`tel:${deal.contact.phone}`}><Phone className="size-3.5" />{deal.contact.phone}</a>}{deal.contact.email && <a className="flex items-center gap-2 text-primary hover:text-foreground" href={`mailto:${deal.contact.email}`}><Mail className="size-3.5" />{deal.contact.email}</a>}{!deal.contact.phone && !deal.contact.email && <p className="text-muted-foreground">No contact method recorded.</p>}</div><div className="border-t border-border pt-4"><DealInfo label="Account" value={deal.contact.account?.id === undefined ? deal.contact.account?.name ?? "—" : <RelatedLink to={`/accounts/${deal.contact.account.id}`} label={deal.contact.account.name} enabled={can("account.view")} />} /></div></div></aside>
    </div>}
    <ResourceDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete this deal?" description={<>This permanently removes deal {deal.id}. This action cannot be undone.</>} confirmLabel="Delete deal" pending={saving} error={mutationError} onConfirm={deleteCurrentDeal} />
  </div></DealRelationOptionsContext.Provider>
}

function Metric({ label, value }: { label: string; value: ReactNode }) { return <div className="border-b border-border p-5 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><div className="mt-2 font-mono text-xl font-semibold text-foreground">{value}</div></div> }
function DealPropertyMedia({ property }: { property: Deal["property"] }) {
  const images = property.images ?? []
  const previewImages = images.slice(1, 4)
  const hiddenImageCount = Math.max(0, images.length - 4)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeImage = images[activeIndex]
  const showImage = (index: number) => { setActiveIndex(index); setOpen(true) }
  const move = (direction: -1 | 1) => setActiveIndex((current) => (current + direction + images.length) % images.length)

  if (!images.length) return <div className="grid aspect-[4/3] w-full place-items-center border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground"><span><ImageIcon className="mx-auto mb-2 size-4" />No listing image</span></div>

  return <Dialog open={open} onOpenChange={setOpen}>
    <button type="button" className="group relative block aspect-[4/3] w-full overflow-hidden border border-border bg-muted/20 text-start focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Open property gallery for ${property.title}`} onClick={() => showImage(0)}>
      <img src={images[0].thumbnail_url || images[0].url} alt={property.title} className="size-full object-cover transition-opacity duration-150 group-hover:opacity-85 motion-reduce:transition-none" />
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-background/90 p-2 text-xs font-medium text-foreground"><span className="flex min-w-0 items-center justify-end gap-1"><span className="shrink-0 text-muted-foreground">{images.length}</span>{previewImages.map((image) => <span key={image.id} className="h-7 w-10 shrink-0 overflow-hidden border border-background/80 bg-muted"><img src={image.thumbnail_url || image.url} alt="" className="size-full object-cover" /></span>)}{hiddenImageCount > 0 && <span className="grid h-7 min-w-7 shrink-0 place-items-center border border-border bg-background px-1 text-[11px]">+{hiddenImageCount}</span>}</span></span>
    </button>
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
function DealDetailsSkeleton() { return <div className="space-y-8 p-6 lg:p-8"><Skeleton className="h-7 w-28" /><Skeleton className="h-12 w-2/3" /><Skeleton className="h-16 w-full" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"><Skeleton className="h-96 w-full" /><Skeleton className="h-72 w-full" /></div></div> }
function DealDetailsState({ title, description, retry }: { title: string; description: string; retry?: () => void }) { return <ErrorState kind="not-found" title={title} description={description} actionLabel={retry ? "Retry" : "Return to deals"} actionTo="/deals" onAction={retry} /> }
