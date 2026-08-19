import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "motion/react"
import { ArrowDown, ArrowUp, ChevronDown, Eye, Funnel, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Search, Trash2, X } from "lucide-react"
import type { components as ContactComponents } from "@/api/generated/Contact"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { NumericRangeFilter, type NumericRange } from "@/components/shared/numeric-range-filter"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { SearchableResourcePicker, type SearchableResourceOption, type SearchableResourcePage } from "@/components/shared/searchable-resource-picker"
import { DateRangePicker } from "@/components/ui/date-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ActionTooltip,
  Deal,
  DealAgent,
  DealFilterInfo,
  DealList,
  DealRelationOptionsContext,
  ForbiddenDeals,
  PropertyCover,
  PropertyOption,
  formatCurrency,
  formatDate,
  labelFor,
  loadDealPropertyOptions,
  normalizeDealProperty,
  rangeValue,
  statusPillClass,
  statusTextClass,
  statuses,
  type AgentOption,
  type User,
} from "./shared"

type Contact = ContactComponents["schemas"]["Contact"]
const formatSliderCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
const filterMotionTransition = { type: "spring", stiffness: 500, damping: 42, mass: 0.65 } as const
const filterSlideTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

export function DealsPage() {
  const { can, isSuper, user } = useAuth()
  const isAgentUser = user?.roles?.some((role) => role.name.toLowerCase() === "agent") === true
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
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [pendingDeleteTarget, setPendingDelete] = useState<Deal | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const endpoint = `${API_BASE_URL}/v1/deals`

  const loadContactFilterOptions = useCallback(async (contactQuery: string, contactPage: number, signal: AbortSignal): Promise<SearchableResourcePage> => {
    const body = await apiJson<Paginated<Contact>>(listUrl(`${API_BASE_URL}/v1/contacts`, { page: contactPage, per_page: 30, q: contactQuery.trim() }), { signal })
    return {
      options: body.data.flatMap((contact) => contact.id === undefined ? [] : [{ id: contact.id, label: contact.name, description: [contact.title, contact.email ?? contact.phone].filter(Boolean).join(" · "), data: contact }]),
      currentPage: body.meta.current_page,
      lastPage: body.meta.last_page,
    }
  }, [])

  const loadAgentFilterOptions = useCallback(async (agentQuery: string, agentPage: number, signal: AbortSignal): Promise<SearchableResourcePage> => {
    const body = await apiJson<Paginated<User>>(listUrl(`${API_BASE_URL}/v1/users`, { page: agentPage, per_page: 30, q: agentQuery.trim() }), { signal })
    return {
      options: body.data.flatMap((agent) => agent.id === undefined ? [] : [{ id: agent.id, label: agent.name, description: agent.username ? `@${agent.username}` : undefined, data: agent }]),
      currentPage: body.meta.current_page,
      lastPage: body.meta.last_page,
    }
  }, [])

  useEffect(() => {
    if (!can("user.view")) return
    const controller = new AbortController()
    setUserOptionsLoading(true)
    void apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users`, { signal: controller.signal })
      .then(async (firstPage) => {
        const remainingPages = await Promise.all(Array.from({ length: Math.max(0, firstPage.meta.last_page - 1) }, (_, index) => apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users?page=${index + 2}`, { signal: controller.signal })))
        const users = [firstPage, ...remainingPages].flatMap((pageBody) => pageBody.data)
        setUserOptions(users.filter((user): user is User & { id: number } => user.id !== undefined).map((user) => ({ id: user.id, name: user.name, username: user.username, avatar: user.avatar })))
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

  async function deleteDeal() {
    if (!pendingDeleteTarget?.id) return
    setSaving(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${endpoint}/${pendingDeleteTarget.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      setPendingDelete(null)
      await loadDeals()
    } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this deal.") } finally { setSaving(false) }
  }

  useEffect(() => {
    if (!selectedId || mode !== "edit") return
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    navigate(`/deals/${selectedId}/edit${queryString ? `?return=${encodeURIComponent(queryString)}` : ""}`, { replace: true })
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
  const optionDeals = deals
  const contactOptions = Array.from(new Map(optionDeals.filter((deal) => deal.contact.id !== undefined).map((deal) => [String(deal.contact.id), deal.contact])).values())
  const propertyOptions = Array.from(new Map(optionDeals.filter((deal) => deal.property.id !== undefined).map((deal) => [String(deal.property.id), deal.property])).values())
  const dealAgentOptions = Array.from(new Map(optionDeals.filter((deal) => deal.agent?.id !== undefined).map((deal) => [String(deal.agent?.id), deal.agent])).values()).filter((agent): agent is NonNullable<Deal["agent"]> => Boolean(agent)).map((agent) => ({ id: agent.id as number, name: agent.name, username: agent.username }))
  const agentOptions = Array.from(new Map([...dealAgentOptions, ...userOptions].map((agent) => [String(agent.id), agent])).values())
  const selectedContactOption = contactOptions.find((contact) => contact.id === Number(contactFilter))
  const selectedPropertyOption = propertyOptions.find((property) => property.id === Number(propertyFilter))
  const selectedAgentOption = agentOptions.find((agent) => agent.id === Number(agentFilter))
  const detailsPath = (id: number) => {
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    return `/deals/${id}${queryString ? `?return=${encodeURIComponent(queryString)}` : ""}`
  }
  const editPath = (id: number) => {
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    return `/deals/${id}/edit${queryString ? `?return=${encodeURIComponent(queryString)}` : ""}`
  }
  const createPath = () => {
    const returnParams = new URLSearchParams(searchParams)
    returnParams.delete("record"); returnParams.delete("mode")
    const queryString = returnParams.toString()
    return `/deals/create${queryString ? `?return=${encodeURIComponent(queryString)}` : ""}`
  }
  return <DealRelationOptionsContext.Provider value={{ contacts: contactOptions, properties: propertyOptions, propertiesLoading: false, propertiesLoadingMore: false, propertiesHasMore: false, agents: agentOptions, agentsLoading: userOptionsLoading }}><div className="space-y-6 p-6 lg:p-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Deals</h1><p className="mt-1 text-sm text-muted-foreground">Track active negotiations from offer to close.</p></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="relative">
      <div className="flex items-end justify-between gap-4">
        <div className="filter-tab filter-tab-roundout ms-3">
          <button type="button" aria-expanded={filtersOpen} aria-controls="deals-filter-panel" onClick={() => setFiltersOpen((open) => !open)} className="filter-tab-roundout-button inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors"><Funnel className="size-3.5" aria-hidden="true" /><span>Filter</span><motion.span animate={{ rotate: filtersOpen ? 180 : 0 }} transition={filterMotionTransition} className="inline-flex"><ChevronDown className="size-4" aria-hidden="true" /></motion.span></button>
        </div>
        <div className="mb-1 flex shrink-0 gap-2">
          <Button type="button" variant="outline" className="shrink-0" onClick={() => void loadDeals()} disabled={loading}><RefreshCw className="size-4" />Refresh</Button>
          {canCreate && <Button asChild variant="outline"><Link to={createPath()}><Plus className="size-4" />Create new deal</Link></Button>}
        </div>
      </div>
      <motion.div initial={false} animate={{ height: filtersOpen ? "auto" : 0 }} transition={filterSlideTransition} className="overflow-hidden">
        <div className="search-filter-card rounded-t-md rounded-b-none bg-muted/60 shadow-sm dark:bg-muted/70">
          <div className="p-4">
    <div id="deals-filter-panel" aria-hidden={!filtersOpen}>
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
      <div className="min-w-48 w-full md:w-64"><label className="text-xs font-medium text-muted-foreground" htmlFor="deal-search">Search loaded deals</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="deal-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Contact, agent, property, status, amount…" /></div></div>
      <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground">Status</label><Select value={statusFilter || "all"} onValueChange={(value) => updateFilter("status", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((status) => <SelectItem key={status} value={status}><span className={`capitalize ${statusTextClass[status]}`}>{labelFor(status)}</span></SelectItem>)}</SelectContent></Select></div>
      <SearchableResourcePicker id="deal-filter-contact" label="Contact" labelStyle="plain" className="min-w-44" value={Number(contactFilter) || 0} selectedOption={selectedContactOption?.id === undefined ? undefined : { id: selectedContactOption.id, label: selectedContactOption.name, description: [selectedContactOption.title, selectedContactOption.email ?? selectedContactOption.phone].filter(Boolean).join(" · "), data: selectedContactOption }} onChange={(value) => updateFilter("contact", value ? String(value) : "")} loadOptions={loadContactFilterOptions} placeholder="All contacts" searchPlaceholder="Search contacts…" loadingLabel="Loading contacts…" emptyLabel="No contacts found." noResultsLabel="No contacts match your search." renderOption={(option) => <FilterPersonOption option={option} />} renderSelectedOption={(option) => <FilterPersonOption option={option} />} />
      <SearchableResourcePicker id="deal-filter-property" label="Property" labelStyle="plain" className="min-w-44" value={Number(propertyFilter) || 0} selectedOption={selectedPropertyOption?.id === undefined ? undefined : { id: selectedPropertyOption.id, label: selectedPropertyOption.title, description: `${selectedPropertyOption.city} · ${formatCurrency(selectedPropertyOption.price)}`, data: selectedPropertyOption }} onChange={(value) => updateFilter("property", value ? String(value) : "")} loadOptions={loadDealPropertyOptions} placeholder="All properties" searchPlaceholder="Search properties…" loadingLabel="Loading properties…" emptyLabel="No properties found." noResultsLabel="No properties match your search." renderOption={(option) => <FilterPropertyOption option={option} />} renderSelectedOption={(option) => <FilterPropertyOption option={option} />} />
      {!isAgentUser && <SearchableResourcePicker id="deal-filter-agent" label="Agent" labelStyle="plain" className="min-w-44" value={Number(agentFilter) || 0} selectedOption={selectedAgentOption ? { id: selectedAgentOption.id, label: selectedAgentOption.name, description: selectedAgentOption.username ? `@${selectedAgentOption.username}` : undefined, data: selectedAgentOption } : undefined} onChange={(value) => updateFilter("agent", value ? String(value) : "")} loadOptions={loadAgentFilterOptions} placeholder="All agents" searchPlaceholder="Search agents…" loadingLabel="Loading agents…" emptyLabel="No agents found." noResultsLabel="No agents match your search." renderOption={(option) => <FilterPersonOption option={option} />} renderSelectedOption={(option) => <FilterPersonOption option={option} />} />}
      <div className="min-w-72"><label className="text-xs font-medium text-muted-foreground">Closed date range</label><DateRangePicker from={closedFromInput} to={closedToInput} onChange={({ from, to }) => { setClosedFromInput(from); setClosedToInput(to) }} /></div>
      {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}
      </div>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
      <NumericRangeFilter id="deal-listed-value-range" label="Listed value" min={filterInfo?.min_value} max={filterInfo?.max_value} value={valueRange} onChange={updateValueRange} format={formatSliderCurrency} />
      <NumericRangeFilter id="deal-final-value-range" label="Final deal value" min={filterInfo?.min_deal_value} max={filterInfo?.max_deal_value} value={dealValueRange} onChange={updateDealValueRange} format={formatSliderCurrency} />
      </div>
    </div>
          </div>
        </div>
      </motion.div>
      <div><section className={`min-w-0 overflow-hidden ${filtersOpen ? "rounded-b-md rounded-t-none" : "rounded-md"} border border-border bg-muted/60 dark:bg-muted/70`}><Table><TableHeader className="bg-foreground/[0.06] dark:bg-white/[0.06]"><TableRow><TableHead>Contact</TableHead><TableHead>Property</TableHead><TableHead>Status</TableHead><TableHead>Deal value</TableHead><TableHead>Agent</TableHead><TableHead>Closed</TableHead><TableHead className="w-48 min-w-48 max-w-48 text-end">Actions</TableHead></TableRow></TableHeader><TableBody className="[&_tr]:border-b-0 [&_tr:nth-child(even)]:bg-foreground/[0.04] dark:[&_tr:nth-child(even)]:bg-white/[0.04]">{loading ? <DealTableSkeleton /> : filteredDeals.length ? filteredDeals.map((deal) => { const dealDetailsPath = deal.id ? detailsPath(deal.id) : "/deals"; const dealEditPath = deal.id ? editPath(deal.id) : "/deals"; const canEdit = canEditDeal(deal); return <TableRow key={deal.id}><TableCell><div className="flex items-center gap-2">{deal.contact.lead_id !== undefined && can("lead.view") ? <Link className="shrink-0" to={`/pipeline?record=${deal.contact.lead_id}`} aria-label={`Open ${deal.contact.name}`}><PersonAvatar name={deal.contact.name} /></Link> : <PersonAvatar name={deal.contact.name} />}<div><div className="font-medium">{deal.contact.lead_id !== undefined && can("lead.view") ? <Link className="text-foreground hover:text-primary" to={`/pipeline?record=${deal.contact.lead_id}`}>{deal.contact.name}</Link> : deal.contact.name}</div><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{deal.contact.email ? <Mail className="size-3 shrink-0" aria-hidden="true" /> : <Phone className="size-3 shrink-0" aria-hidden="true" />}<span className="truncate">{deal.contact.email ?? deal.contact.phone ?? "—"}</span></div></div></div></TableCell><TableCell><div className="flex min-w-44 items-center gap-2">{deal.property.id !== undefined ? <Link className="shrink-0" to={`/properties/${deal.property.id}`} aria-label={`Open ${deal.property.title}`}><PropertyCover property={deal.property} /></Link> : <PropertyCover property={deal.property} />}<div className="min-w-0"><div className="truncate font-medium">{deal.property.id !== undefined ? <Link className="text-foreground hover:text-primary" to={`/properties/${deal.property.id}`}>{deal.property.title}</Link> : deal.property.title}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" aria-hidden="true" />{deal.property.city}</div></div></div></TableCell><TableCell><Badge className={statusPillClass[deal.status]}>{labelFor(deal.status)}</Badge></TableCell><TableCell><div className="flex items-center gap-1 whitespace-nowrap font-mono text-xs">{deal.deal_value !== deal.value && (deal.deal_value > deal.value ? <ArrowUp className="size-3 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> : <ArrowDown className="size-3 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />)}<div className="space-y-0.5">{deal.deal_value === deal.value ? <div className="text-foreground">{formatCurrency(deal.value)}</div> : <><div className="text-muted-foreground/60 line-through">{formatCurrency(deal.value)}</div><div className={deal.deal_value > deal.value ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{formatCurrency(deal.deal_value)}</div></>}</div></div></TableCell><TableCell><DealAgent agent={deal.agent} agentId={deal.agent_id} compact linkClassName="text-foreground hover:text-primary" linkVisuals /></TableCell><TableCell className="text-sm">{formatDate(deal.closed_at)}</TableCell><TableCell className="w-48 min-w-48 max-w-48 text-end"><div className="flex justify-end gap-1">{pendingDelete?.id === deal.id ? <><ActionTooltip label="Cancel deletion"><Button variant="ghost" size="sm" disabled={saving} onClick={() => setPendingDelete(null)}>Cancel</Button></ActionTooltip><ActionTooltip label="Permanently delete deal"><Button variant="destructive" size="sm" disabled={saving} onClick={() => void deleteDeal()}>{saving ? "Deleting…" : "Delete"}</Button></ActionTooltip></> : <><ActionTooltip label="Open deal details"><Button asChild variant="ghost" size="icon"><Link to={dealDetailsPath} aria-label={`Open details for ${deal.contact.name}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <Button asChild variant="ghost" size="icon"><Link to={dealEditPath} aria-label={`Edit deal ${deal.id}`}><Pencil /></Link></Button>}{canDelete && <Button variant="ghost" size="icon" aria-label={`Delete deal ${deal.id}`} className="text-destructive hover:text-destructive" onClick={() => setPendingDelete(deal)}><Trash2 /></Button>}</>}</div></TableCell></TableRow> }) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No deals match the current filters. {hasFilters ? <Button variant="link" size="sm" className="ms-1" onClick={clearFilters}>Clear filters</Button> : canCreate && <Button asChild variant="link" size="sm" className="ms-1"><Link to={createPath()}>Create a deal</Link></Button>}</TableCell></TableRow>}</TableBody></Table><ResourcePagination page={meta?.current_page ?? page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} /></section></div>
    </div>
    <ResourceDeleteDialog open={Boolean(pendingDeleteTarget)} onOpenChange={(open) => { if (!open && !saving) { setPendingDelete(null); setDeleteError("") } }} title="Delete this deal?" description={<>This permanently removes deal {pendingDeleteTarget?.id}. This action cannot be undone.</>} confirmLabel="Delete deal" pending={saving} error={deleteError} onConfirm={deleteDeal} />
  </div></DealRelationOptionsContext.Provider>
}

function DealTableSkeleton() {
  return <>{Array.from({ length: 10 }, (_, index) => <TableRow key={index} aria-hidden="true">
    <TableCell><div className="flex items-center gap-2"><Skeleton className="size-8 rounded-full" /><div className="space-y-1.5"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-36" /></div></div></TableCell>
    <TableCell><div className="flex min-w-44 items-center gap-2"><Skeleton className="h-10 w-[3.333rem] shrink-0 rounded-none" /><div className="space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div></div></TableCell>
    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    <TableCell><div className="space-y-1.5"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div></TableCell>
    <TableCell><div className="flex items-center gap-2"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-4 w-24" /></div></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell className="w-48 min-w-48 max-w-48"><div className="flex justify-end gap-1"><Skeleton className="size-8" /><Skeleton className="size-8" /><Skeleton className="size-8" /></div></TableCell>
  </TableRow>)}</>
}

function FilterPersonOption({ option }: { option: SearchableResourceOption }) {
  const agent = option.data as AgentOption | undefined
  return <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={option.label} avatar={agent?.avatar} size="sm" /><span className="min-w-0"><span className="block truncate">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span></span>
}

function FilterPropertyOption({ option }: { option: SearchableResourceOption }) {
  const property = normalizeDealProperty(option.data)
  return property ? <PropertyOption property={property} /> : <span className="min-w-0"><span className="block truncate">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span>
}
