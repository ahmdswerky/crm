import { cloneElement, isValidElement, useCallback, useEffect, useId, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Building2, Eye, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Save, Search, Trash2, UserRound, X } from "lucide-react"
import { z } from "zod"
import type { components as AuthComponents } from "@/api/generated/Auth"
import type { components as ContactComponents } from "@/api/generated/Contact"
import type { components as MarketingComponents } from "@/api/generated/Marketing"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import type { Paginated } from "@/api/contracts"
import { listUrl } from "@/api/list-query"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { PhoneField } from "@/components/shared/phone-field"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePreviewDrawer } from "@/components/shared/resource-preview-drawer"
import { SearchableResourcePicker, type SearchableResourceOption, type SearchableResourcePage } from "@/components/shared/searchable-resource-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupTextarea, InputGroupText } from "@/components/ui/input-group"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Lead = MarketingComponents["schemas"]["Lead"]
type Account = ContactComponents["schemas"]["Account"]
type LeadListRecord = Lead & { has_contact?: boolean }
type LeadContact = NonNullable<Lead["contact"]>
type User = AuthComponents["schemas"]["User"]
type AgentOption = { id: number; name: string; username: string; avatar?: User["avatar"] }
type LeadEnvelope = { lead: Lead }
type AccountListResponse = { data?: Account[]; accounts?: Account[]; meta?: { current_page?: number; last_page?: number } }
const statuses = ["pending", "contacted", "qualified", "unqualified"] as const
const sources = ["facebook", "whatsapp", "instagram", "x"] as const

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Enter a lead name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  status: z.enum(statuses),
  city: z.string().trim().min(1, "Enter a city."),
  address: z.string(),
  company_name: z.string(),
  source: z.enum(sources).or(z.literal("")),
})

export type LeadFormValues = z.infer<typeof leadSchema>

export const emptyValues: LeadFormValues = {
  name: "", email: "", phone: "", status: "pending", city: "", address: "", company_name: "", source: "",
}

const statusPillClass: Record<Lead["status"], string> = {
  pending: "border-amber-500/20 bg-amber-500/12 text-amber-950 hover:bg-amber-500/12 dark:text-amber-100",
  contacted: "border-blue-500/20 bg-blue-500/12 text-blue-950 hover:bg-blue-500/12 dark:text-blue-100",
  qualified: "border-emerald-500/20 bg-emerald-500/12 text-emerald-950 hover:bg-emerald-500/12 dark:text-emerald-100",
  unqualified: "border-red-500/20 bg-red-500/12 text-red-950 hover:bg-red-500/12 dark:text-red-100",
}

const statusTextClass: Record<Lead["status"], string> = {
  pending: "text-amber-700/80 dark:text-amber-300/80",
  contacted: "text-blue-700/80 dark:text-blue-300/80",
  qualified: "text-emerald-700/80 dark:text-emerald-300/80",
  unqualified: "text-red-700/80 dark:text-red-300/80",
}

const sourceBrandClass: Record<Exclude<Lead["source"], null | undefined>, string> = {
  facebook: "text-[#1877F2]",
  instagram: "text-[#E4405F]",
  whatsapp: "text-[#25D366]",
  x: "text-black dark:text-white",
}

function valuesFromLead(lead: Lead): LeadFormValues {
  return {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    city: lead.city,
    address: lead.address ?? "",
    company_name: lead.company_name ?? "",
    source: lead.source ?? "",
  }
}

function toPayload(values: LeadFormValues) {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    status: values.status,
    city: values.city.trim(),
    address: values.address.trim() || null,
    company_name: values.company_name.trim() || null,
    source: values.source || null,
  }
}

export function LeadsPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const selectedId = Number(searchParams.get("record") ?? "") || undefined
  const mode = searchParams.get("mode")
  const query = searchParams.get("q") ?? ""
  const statusFilter = searchParams.get("status") ?? ""
  const sourceFilter = searchParams.get("source") ?? ""
  const cityFilter = searchParams.get("city") ?? ""
  const companyFilter = searchParams.get("company") ?? ""
  const assignedAgentFilter = searchParams.get("assigned_agent") ?? ""
  const [queryInput, setQueryInput] = useState(query)
  const [cityInput, setCityInput] = useState(cityFilter)
  const [companyInput, setCompanyInput] = useState(companyFilter)
  const [leads, setLeads] = useState<LeadListRecord[]>([])
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [meta, setMeta] = useState<Paginated<Lead>["meta"] | null>(null)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [pendingDelete, setPendingDelete] = useState<Lead | null>(null)

  const loadLeads = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const endpoint = listUrl(`${API_BASE_URL}/v1/leads`, {
        page,
        q: query,
        status: statusFilter,
        source: sourceFilter,
        city: cityFilter,
        company: companyFilter,
        assigned_agent: assignedAgentFilter,
      })
      const body = await apiJson<Paginated<LeadListRecord>>(endpoint, { signal })
      setLeads(body.data)
      setMeta(body.meta)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load leads.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [assignedAgentFilter, cityFilter, companyFilter, page, query, sourceFilter, statusFilter])

  useEffect(() => {
    if (!can("lead.view")) return
    const controller = new AbortController()
    void loadLeads(controller.signal)
    return () => controller.abort()
  }, [can, loadLeads])

  useEffect(() => {
    if (!can("user.view")) return
    const controller = new AbortController()
    setAgentsLoading(true)
    void apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users`, { signal: controller.signal })
      .then(async (firstPage) => {
        const remainingPages = await Promise.all(Array.from({ length: Math.max(0, firstPage.meta.last_page - 1) }, (_, index) => apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users?page=${index + 2}`, { signal: controller.signal })))
        const users = [firstPage, ...remainingPages].flatMap((pageBody) => pageBody.data)
        setAgentOptions(users.filter((user): user is User & { id: number } => user.id !== undefined).map((user) => ({ id: user.id, name: user.name, username: user.username, avatar: user.avatar })))
      })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setAgentOptions([]) })
      .finally(() => { if (!controller.signal.aborted) setAgentsLoading(false) })
    return () => controller.abort()
  }, [can])

  useEffect(() => {
    if (mode !== "edit" || !selectedId) return
    const returnSearch = new URLSearchParams(searchParams)
    returnSearch.delete("record")
    returnSearch.delete("mode")
    navigate(`/leads/${selectedId}?${new URLSearchParams({ mode: "edit", ...(returnSearch.toString() ? { return: returnSearch.toString() } : {}) })}`, { replace: true })
  }, [mode, navigate, searchParams, selectedId])

  useEffect(() => {
    if (mode !== "create") return
    const returnSearch = new URLSearchParams(searchParams)
    returnSearch.delete("record")
    returnSearch.delete("mode")
    const createParams = returnSearch.toString() ? new URLSearchParams({ return: returnSearch.toString() }) : undefined
    navigate(`/leads/create${createParams ? `?${createParams}` : ""}`, { replace: true })
  }, [mode, navigate, searchParams])

  useEffect(() => {
    if (!selectedId || mode === "create" || mode === "edit") {
      setSelected(null)
      setPreviewError("")
      setPreviewLoading(false)
      return
    }
    const listed = leads.find((lead) => lead.id === selectedId)
    if (listed) setSelected(listed)
    setPreviewLoading(true)
    setPreviewError("")
    const controller = new AbortController()
    void apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads/${selectedId}`, { signal: controller.signal })
      .then((body) => setSelected(body.lead))
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setSelected(null)
          setPreviewError(caught instanceof Error ? caught.message : "Unable to load this lead.")
        }
      })
      .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false) })
    return () => controller.abort()
  }, [leads, mode, selectedId])

  const setParams = useCallback((next: Record<string, string | undefined>) => setSearchParams((current) => {
    const params = new URLSearchParams(current)
    Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value))
    return params
  }), [setSearchParams])
  const updateFilter = (key: "q" | "status" | "source" | "city" | "company" | "assigned_agent", value: string) => setParams({
    [key]: value || undefined,
    page: "1",
    record: undefined,
    mode: undefined,
  })
  const clearFilters = () => setParams({ q: undefined, status: undefined, source: undefined, city: undefined, company: undefined, assigned_agent: undefined, page: "1", record: undefined, mode: undefined })

  useEffect(() => { setQueryInput(query) }, [query])
  useEffect(() => { setCityInput(cityFilter) }, [cityFilter])
  useEffect(() => { setCompanyInput(companyFilter) }, [companyFilter])
  useEffect(() => {
    if (queryInput === query && cityInput === cityFilter && companyInput === companyFilter) return
    const timeout = window.setTimeout(() => setSearchParams((current) => {
      const params = new URLSearchParams(current)
      if (queryInput) params.set("q", queryInput)
      else params.delete("q")
      if (cityInput) params.set("city", cityInput)
      else params.delete("city")
      if (companyInput) params.set("company", companyInput)
      else params.delete("company")
      params.set("page", "1")
      params.delete("record")
      params.delete("mode")
      return params
    }), 500)
    return () => window.clearTimeout(timeout)
  }, [cityFilter, cityInput, companyFilter, companyInput, query, queryInput, setSearchParams])
  useEffect(() => {
    const lastPage = meta?.last_page
    if (lastPage && page > lastPage) setParams({ page: String(lastPage), record: undefined })
  }, [meta?.last_page, page, setParams])

  const returnSearch = new URLSearchParams(searchParams)
  returnSearch.delete("record")
  returnSearch.delete("mode")
  const leadPath = (id: number, edit = false) => {
    const params = new URLSearchParams()
    if (edit) params.set("mode", "edit")
    if (returnSearch.toString()) params.set("return", returnSearch.toString())
    return `/leads/${id}${params.size ? `?${params}` : ""}`
  }
  const leadCreatePath = () => {
    if (!returnSearch.toString()) return "/leads/create"
    return `/leads/create?${new URLSearchParams({ return: returnSearch.toString() })}`
  }
  const openLead = (id: number) => selectedId === id ? setParams({ record: undefined }) : setParams({ record: String(id), mode: undefined })
  const closePreview = () => setParams({ record: undefined })
  const requestDelete = (lead: Lead) => { setPendingDelete(lead); setPreviewError("") }

  async function deleteLead() {
    if (!pendingDelete?.id) return
    setSaving(true)
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/leads/${pendingDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      const deletedId = pendingDelete.id
      setPendingDelete(null)
      if (selectedId === deletedId) closePreview()
      await loadLeads()
    } catch (caught) {
      setPreviewError(caught instanceof Error ? caught.message : "Unable to delete this lead.")
    } finally {
      setSaving(false)
    }
  }

  if (!can("lead.view")) return <ForbiddenLeads />
  const canCreate = can("lead.create")
  const canEdit = can("lead.edit")
  const canDelete = can("lead.delete")
  const hasFilters = Boolean(query || statusFilter || sourceFilter || cityFilter || companyFilter || assignedAgentFilter)
  const previewOpen = Boolean(selectedId && mode !== "create" && mode !== "edit")
  const listedAgents = Array.from(new Map([...leads, ...(selected ? [selected] : [])].flatMap((lead) => lead.assigned_agent ? [[String(lead.assigned_agent.id), { id: lead.assigned_agent.id, name: lead.assigned_agent.name, username: lead.assigned_agent.username }] as const] : []).concat(agentOptions.map((agent) => [String(agent.id), agent] as const))).values())

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div><p className="text-xs font-medium text-muted-foreground">CRM / Pipeline</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Leads</h1><p className="mt-1 text-sm text-muted-foreground">Capture and qualify the next conversation.</p></div>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void loadLeads()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canCreate && <Button asChild size="sm"><Link to={leadCreatePath()}><Plus className="me-2 size-3.5" />New lead</Link></Button>}</div>
      </div>
      {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
        <div className="min-w-56 flex-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-search">Search</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="lead-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name, email, phone, company…" /></div></div>
        <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-status-filter">Status</label><Select value={statusFilter || "all"} onValueChange={(value) => updateFilter("status", value === "all" ? "" : value)}><SelectTrigger id="lead-status-filter" className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statuses.map((status) => <SelectItem key={status} value={status}><StatusOption status={status} /></SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-source-filter">Source</label><Select value={sourceFilter || "all"} onValueChange={(value) => updateFilter("source", value === "all" ? "" : value)}><SelectTrigger id="lead-source-filter" className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{sources.map((source) => <SelectItem key={source} value={source}><SourceOption source={source} /></SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-city-filter">City</label><Input id="lead-city-filter" className="mt-1" value={cityInput} onChange={(event) => setCityInput(event.target.value)} placeholder="Any city" /></div>
        <div className="min-w-40"><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-company-filter">Company</label><Input id="lead-company-filter" className="mt-1" value={companyInput} onChange={(event) => setCompanyInput(event.target.value)} placeholder="Any company" /></div>
        <div className="min-w-48"><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-assigned-agent-filter">Assigned agent</label><Select value={assignedAgentFilter || "all"} onValueChange={(value) => updateFilter("assigned_agent", value === "all" ? "" : value)} disabled={agentsLoading && listedAgents.length === 0}><SelectTrigger id="lead-assigned-agent-filter" className="mt-1 w-full"><SelectValue placeholder={agentsLoading ? "Loading agents…" : "All agents"} /></SelectTrigger><SelectContent><SelectItem value="all">All agents</SelectItem>{listedAgents.map((agent) => <SelectItem key={agent.id} value={String(agent.id)}><AgentOption agent={agent} /></SelectItem>)}</SelectContent></Select></div>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}
      </div>
      <section data-testid="leads-table-surface" className="min-w-0 border border-border bg-card">
        <Table><TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead><TableHead>City</TableHead><TableHead>Assigned agent</TableHead><TableHead className="w-48 min-w-48 max-w-48 text-end">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-5 w-3/4" /></TableCell></TableRow>) : leads.length ? leads.map((lead) => {
            const leadId = lead.id
            const isPreviewing = selectedId === lead.id && !mode

            return <TableRow key={leadId ?? lead.email} data-state={selectedId === leadId ? "selected" : undefined} className={leadId !== undefined ? "cursor-pointer" : undefined} onClick={() => leadId !== undefined && openLead(leadId)}><TableCell><div className="font-medium">{lead.name}</div><div className="text-xs text-muted-foreground">{lead.email} · {lead.phone}</div></TableCell><TableCell><Badge className={statusPillClass[lead.status]}>{lead.status}</Badge></TableCell><TableCell>{lead.source ? <SourceIcon source={lead.source} /> : <span className="text-sm text-muted-foreground">—</span>}</TableCell><TableCell>{lead.city}</TableCell><TableCell><LeadAgent agent={lead.assigned_agent} linkEnabled={can("user.view")} /></TableCell><TableCell className="w-48 min-w-48 max-w-48 text-end"><div className="flex justify-end gap-1 [&_[data-slot=button]]:transition-none" onClick={(event) => event.stopPropagation()}>{leadId !== undefined && <><ActionTooltip label="View Details"><Button asChild variant={isPreviewing ? "secondary" : "ghost"} size="icon" aria-pressed={isPreviewing}><Link to={leadPath(leadId)} aria-label={`Open details for ${lead.name}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit lead"><Button asChild variant="ghost" size="icon"><Link to={leadPath(leadId, true)} aria-label={`Edit ${lead.name}`}><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete lead"><Button variant="ghost" size="icon" aria-label={`Delete ${lead.name}`} className="text-destructive hover:text-destructive" onClick={() => requestDelete(lead)}><Trash2 /></Button></ActionTooltip>}</>}</div></TableCell></TableRow>
          }) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">{hasFilters ? <>No leads match the current filters. <Button variant="link" size="sm" className="ms-1" onClick={clearFilters}>Clear filters</Button></> : <>No leads found. {canCreate && <Button asChild variant="link" size="sm" className="ms-1"><Link to={leadCreatePath()}>Create a lead</Link></Button>}</>}</TableCell></TableRow>}</TableBody></Table>
        <ResourcePagination page={meta?.current_page ?? page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} />
      </section>
      <ResourcePreviewDrawer open={previewOpen} onOpenChange={(open) => { if (!open) closePreview() }} title="Lead preview" description="Read-only lead details and available actions.">
        {previewLoading && !selected ? <div className="space-y-4 p-5"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-40 w-full" /></div> : previewError ? <div className="p-5"><p role="alert" className="text-sm text-destructive">{previewError}</p><Button className="mt-4" variant="outline" size="sm" onClick={closePreview}>Close preview</Button></div> : <LeadInspector lead={selected} canEdit={canEdit} canDelete={canDelete} detailsPath={leadPath} onDelete={() => { if (selected) requestDelete(selected) }} />}
      </ResourcePreviewDrawer>
      <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) { setPendingDelete(null); setPreviewError("") } }} title={`Delete ${pendingDelete?.name ?? "lead"}?`} description={<>This permanently removes {pendingDelete?.name ?? "this lead"}. This action cannot be undone.</>} confirmLabel="Delete lead" pending={saving} error={previewError} onConfirm={deleteLead} />
    </div>
  )
}

export function LeadForm({ create = false, modal = false, form, title, saving, onCancel, onSubmit, formId }: { create?: boolean; modal?: boolean; form: ReturnType<typeof useForm<LeadFormValues>>; title: string; saving: boolean; onCancel: () => void; onSubmit: () => void; formId?: string }) {
  const { register, formState: { errors }, setValue, watch } = form
  const iconOnly = create && modal
  const compact = create && !modal
  const inputClassName = create ? "h-8 rounded-none border-0 px-2.5 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0" : undefined
  const TextInput = iconOnly ? InputGroupInput : Input
  const TextareaInput = iconOnly ? InputGroupTextarea : Textarea
  const fieldClassName = iconOnly ? undefined : inputClassName
  const nameField = <FormField compact={compact} iconOnly={iconOnly} icon={<UserRound />} label="Name" required error={errors.name?.message}><TextInput className={fieldClassName} placeholder={iconOnly ? "Lead name" : undefined} {...register("name")} /></FormField>
  const phoneField = <FormField plain compact={compact} iconOnly={iconOnly} label="Phone" required error={errors.phone?.message}><PhoneField className="w-full" variant={compact || iconOnly ? "sm" : "default"} placeholder={iconOnly ? "Phone number" : undefined} value={watch("phone")} onValueChange={(value) => setValue("phone", value, { shouldDirty: true, shouldValidate: true })} /></FormField>
  const emailField = <FormField compact={compact} iconOnly={iconOnly} icon={<Mail />} label="Email" required error={errors.email?.message}><TextInput className={fieldClassName} type="email" placeholder={iconOnly ? "Email address" : undefined} {...register("email")} /></FormField>
  const statusField = <LeadSelectField compact={compact} id="lead-status" label="Status" required error={errors.status?.message} value={watch("status")} onValueChange={(value) => setValue("status", value as LeadFormValues["status"], { shouldValidate: true })}>{statuses.map((status) => <SelectItem key={status} value={status}><StatusOption status={status} /></SelectItem>)}</LeadSelectField>
  const cityField = <FormField compact={compact} iconOnly={iconOnly} icon={<MapPin />} label="City" required error={errors.city?.message}><TextInput className={fieldClassName} placeholder={iconOnly ? "City" : undefined} {...register("city")} /></FormField>
  const sourceField = <LeadSelectField compact={compact} iconOnly={iconOnly} id="lead-source" label="Source" value={watch("source") || "none"} onValueChange={(value) => setValue("source", value === "none" ? "" : value as LeadFormValues["source"], { shouldValidate: true })} placeholder={iconOnly ? "Lead source (optional)" : "No recorded source"}><SelectItem value="none">No recorded source</SelectItem>{sources.map((source) => <SelectItem key={source} value={source}><SourceOption source={source} /></SelectItem>)}</LeadSelectField>
  const loadAccountOptions = useCallback(async (accountQuery: string, page: number, signal: AbortSignal): Promise<SearchableResourcePage> => {
    const body = await apiJson<AccountListResponse>(listUrl(`${API_BASE_URL}/v1/accounts`, { page, per_page: 30, q: accountQuery.trim() }), { signal })
    const accounts = body.data ?? body.accounts ?? []
    return {
      options: accounts.map((account) => ({ id: account.id, label: account.name, description: account.industry, data: account })),
      currentPage: body.meta?.current_page ?? page,
      lastPage: body.meta?.last_page ?? page,
    }
  }, [])
  const companyField = <SearchableResourcePicker<string> id="lead-company" label="Company" labelStyle={iconOnly ? "icon-only" : "plain"} icon={<Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />} value={watch("company_name")} valueMode="label" onChange={(value) => setValue("company_name", value, { shouldDirty: true, shouldValidate: true })} error={errors.company_name?.message} loadOptions={loadAccountOptions} placeholder={iconOnly ? "Company (optional)" : "Choose a company"} searchPlaceholder="Search companies…" loadingLabel="Searching companies…" emptyLabel="No companies found." noResultsLabel="No companies match your search." renderOption={(option) => <LeadAccountOption option={option} showDescription={!modal} />} renderSelectedOption={(option) => <LeadAccountOption option={option} selected />} />
  const addressField = <FormField compact={compact} iconOnly={iconOnly} label="Address" error={errors.address?.message} className="sm:col-span-2"><TextareaInput className={iconOnly ? undefined : create ? "min-h-20 rounded-none border-0 px-2.5 py-2 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0" : undefined} placeholder={iconOnly ? "Address (optional)" : undefined} {...register("address")} /></FormField>
  const fields = create ? <FieldGroup className="grid w-full gap-4 sm:grid-cols-2">{nameField}{emailField}{phoneField}{companyField}{sourceField}{cityField}{addressField}</FieldGroup> : <FieldGroup className="grid gap-3 sm:grid-cols-2">{nameField}{phoneField}<div className="sm:col-span-2">{emailField}</div>{statusField}{cityField}<div className="sm:col-span-2">{sourceField}</div><div className="sm:col-span-2">{companyField}</div>{addressField}</FieldGroup>
  return <form id={formId} onSubmit={onSubmit} className={create ? "w-full" : "space-y-5 p-5"}><div className={create ? "min-w-0" : undefined}>{!create && <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Lead editor</p><h2 className="mt-1 text-lg font-semibold">{title}</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Close editor" onClick={onCancel}><X /></Button></div>}<div className={create ? "mt-0" : undefined}>{fields}</div>{!create && <div className="flex justify-between gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Save className="me-2 size-3.5" />Save lead</>}</Button></div>}</div></form>
}

function LeadAccountOption({ option, selected = false, showDescription = true }: { option: SearchableResourceOption; selected?: boolean; showDescription?: boolean }) {
  const account = option.data as Account | undefined
  const image = account?.image
  const logo = image
    ? <img src={image.thumbnail_url || image.url} alt={`${option.label} logo`} className="size-8 shrink-0 rounded-md border border-border bg-white object-contain p-1 dark:bg-white" />
    : <span className="grid size-8 shrink-0 place-items-center rounded-md border border-dashed border-border bg-white dark:bg-white"><Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" /></span>

  return <span className="flex min-w-0 flex-1 items-center gap-2.5">{logo}<span className="min-w-0"><span className={selected ? "block truncate" : "block truncate font-medium"}>{option.label}</span>{!selected && showDescription && option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span></span>
}

function FormField({ label, required, error, className, compact = false, iconOnly = false, icon, children, plain = false }: { label: string; required?: boolean; error?: string; className?: string; compact?: boolean; iconOnly?: boolean; icon?: ReactNode; children: React.ReactNode; plain?: boolean }) {
  const id = useId()
  const labelId = `${id}-label`
  const control = isValidElement<{ id?: string; "aria-label"?: string; "aria-labelledby"?: string; "data-slot"?: string }>(children) ? cloneElement(children, { id, ...(iconOnly ? { "aria-label": label } : {}), ...(compact ? { "aria-labelledby": labelId, "data-slot": "input-group-control" } : {}) }) : children
  const iconControl = isValidElement<{ className?: string; "aria-hidden"?: boolean }>(icon) ? cloneElement(icon, { "aria-hidden": true, className: "size-4 shrink-0 text-muted-foreground" }) : icon
  if (plain) return <Field className={className}>{!iconOnly && <FieldLabel htmlFor={id}>{label}{required && <span className="font-normal text-muted-foreground"> (required)</span>}</FieldLabel>}{control}<FieldError>{error}</FieldError></Field>
  if (iconOnly) return <Field className={className}><InputGroup>{iconControl && <InputGroupAddon className="bg-transparent">{iconControl}</InputGroupAddon>}{control}</InputGroup><FieldError>{error}</FieldError></Field>
  if (compact) return <Field className={className}><InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon>{control}</InputGroup><FieldError>{error}</FieldError></Field>
  return <Field className={className}><FieldLabel htmlFor={id}>{label}{required && <span className="font-normal text-muted-foreground"> (required)</span>}</FieldLabel>{control}<FieldError>{error}</FieldError></Field>
}

function LeadSelectField({ id, label, required, error, compact = false, iconOnly = false, icon, value, onValueChange, placeholder, children }: { id: string; label: string; required?: boolean; error?: string; compact?: boolean; iconOnly?: boolean; icon?: ReactNode; value: string; onValueChange: (value: string) => void; placeholder?: string; children: ReactNode }) {
  const labelId = `${id}-label`
  const select = <Select value={value} onValueChange={onValueChange}><SelectTrigger id={id} aria-label={iconOnly ? label : undefined} aria-labelledby={compact ? labelId : undefined} className={compact || iconOnly ? "h-8 w-full rounded-none border-0 bg-transparent px-2.5 shadow-none focus-visible:border-0 focus-visible:ring-0" : "w-full"}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{children}</SelectContent></Select>
  const iconControl = isValidElement<{ className?: string; "aria-hidden"?: boolean }>(icon) ? cloneElement(icon, { "aria-hidden": true, className: "size-4 shrink-0 text-muted-foreground" }) : icon
  if (iconOnly) return <Field><InputGroup>{iconControl && <InputGroupAddon className="bg-transparent">{iconControl}</InputGroupAddon>}{select}</InputGroup><FieldError>{error}</FieldError></Field>
  if (compact) return <Field><InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon>{select}</InputGroup><FieldError>{error}</FieldError></Field>
  return <Field><FieldLabel htmlFor={id}>{label}{required && <span className="font-normal text-muted-foreground"> (required)</span>}</FieldLabel>{select}<FieldError>{error}</FieldError></Field>
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

function SourceMark({ source }: { source: Exclude<Lead["source"], null | undefined> }) {
  return source === "facebook" ? <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current"><path d="M13.5 21v-7h2.5l.5-3h-3V9.5c0-.9.3-1.5 1.6-1.5H16V5.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4V11H7.5v3h2.4v7h3.6Z" /></svg>
    : source === "instagram" ? <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.8]"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.7" r=".8" className="fill-current stroke-none" /></svg>
      : source === "whatsapp" ? <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.8]"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.8 8.2c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.4-.2.7-.1l1.7.7c.3.1.4.3.4.5v.5c0 .3 0 .5-.4.7-.5.3-1.1.5-1.7.4-1.3-.2-2.5-.8-3.5-1.8s-1.6-2.2-1.8-3.5c-.1-.6.1-1.2.4-1.7Z" className="fill-current stroke-none" /></svg>
        : <span aria-hidden="true" className="text-sm font-semibold leading-none">𝕏</span>
}

function SourceIcon({ source }: { source: Exclude<Lead["source"], null | undefined> }) {
  return <Tooltip><TooltipTrigger asChild><span className={`inline-flex size-7 items-center justify-center ${sourceBrandClass[source]}`}><SourceMark source={source} /></span></TooltipTrigger><TooltipContent side="top" className="capitalize">{source}</TooltipContent></Tooltip>
}

function SourceOption({ source }: { source: Exclude<Lead["source"], null | undefined> }) {
  return <span className={`flex items-center gap-2 ${sourceBrandClass[source]}`}><SourceMark source={source} /><span className="capitalize">{source}</span></span>
}

function StatusOption({ status }: { status: Lead["status"] }) {
  return <span className={`capitalize ${statusTextClass[status]}`}>{status}</span>
}

function AgentOption({ agent }: { agent: AgentOption }) {
  return <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={agent.name} avatar={agent.avatar} size="sm" /><span className="min-w-0"><span className="block truncate">{agent.name}</span></span></span>
}

function LeadAgent({ agent, linkEnabled }: { agent: Lead["assigned_agent"] | null | undefined; linkEnabled: boolean }) {
  if (!agent) return <span className="text-sm text-muted-foreground">Unassigned</span>
  const content = <AgentOption agent={agent} />
  return linkEnabled ? <Link className="block min-w-40 text-primary hover:text-foreground" to={`/agents/${agent.id}`} onClick={(event) => event.stopPropagation()}>{content}</Link> : content
}

function LeadInspector({ lead, canEdit, canDelete, detailsPath, onDelete }: { lead: Lead | null; canEdit: boolean; canDelete: boolean; detailsPath: (id: number, edit?: boolean) => string; onDelete: () => void }) {
  const { can } = useAuth()
  if (!lead || lead.id === undefined) return null
  const canViewContact = can("contact.view")
  return <div className="space-y-5 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Lead record</p><h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{lead.name}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{lead.email}</p></div><div className="flex shrink-0 gap-1"><ActionTooltip label="Open dedicated details"><Button asChild variant="outline" size="icon"><Link to={detailsPath(lead.id)} aria-label="Open dedicated details"><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit lead"><Button asChild variant="outline" size="icon"><Link to={detailsPath(lead.id, true)} aria-label="Edit lead"><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete lead"><Button variant="outline" size="icon" aria-label="Delete lead" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /></Button></ActionTooltip>}</div></div><div className="flex flex-wrap gap-2"><Badge className={statusPillClass[lead.status]}>{lead.status}</Badge>{lead.source && <Badge variant="secondary" className={`gap-1.5 ${sourceBrandClass[lead.source]}`}><SourceMark source={lead.source} /><span className="capitalize">{lead.source}</span></Badge>}</div><Separator /><section><p className="text-xs font-medium text-muted-foreground">Reach this lead</p><dl className="mt-3 grid gap-4 text-sm"><Info label="Email" value={<a className="break-all text-primary hover:text-foreground" href={`mailto:${lead.email}`}>{lead.email}</a>} /><Info label="Phone" value={<a className="text-primary hover:text-foreground" href={`tel:${lead.phone}`}>{lead.phone}</a>} /></dl></section><Separator /><dl className="grid gap-4 text-sm"><Info label="City" value={lead.city} /><Info label="Company" value={lead.company_name ?? "—"} /><Info label="Address" value={lead.address ?? "—"} /><Info label="Assigned agent" value={<LeadAgent agent={lead.assigned_agent} linkEnabled={can("user.view")} />} /></dl>{lead.contact && <><Separator /><section><p className="text-xs font-medium text-muted-foreground">Connected contact</p><div className="mt-3 flex items-center gap-3"><PersonAvatar name={lead.contact.name} size="sm" /><div className="min-w-0">{canViewContact ? <Link className="block truncate font-medium text-primary hover:text-foreground" to={`/contacts/${lead.contact.id}`}>{lead.contact.name}</Link> : <p className="truncate font-medium">{lead.contact.name}</p>}{lead.contact.title && <p className="truncate text-xs text-muted-foreground">{lead.contact.title}</p>}</div></div></section></>}</div>
}

function Info({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }

function ForbiddenLeads() { return <ErrorState kind="forbidden" title="Leads are restricted" description="You do not have permission to view leads." actionLabel="Return to overview" actionTo="/" /> }

export function LeadDetailsPage({ create = false }: { create?: boolean } = {}) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const { leadId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = Number(leadId)
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const form = useForm<LeadFormValues>({ resolver: zodResolver(leadSchema), defaultValues: emptyValues })
  const editing = searchParams.get("mode") === "edit" && can("lead.edit")
  const returnSearch = searchParams.get("return") ?? ""
  const indexPath = `/leads${returnSearch ? `?${returnSearch}` : ""}`

  const loadLead = useCallback(async (signal?: AbortSignal) => {
    if (!can("lead.view") || !Number.isInteger(id) || id < 1) return
    setLoading(true)
    setError("")
    setErrorStatus(null)
    try {
      const body = await apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads/${id}`, { signal })
      setLead(body.lead)
      form.reset(valuesFromLead(body.lead))
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(caught instanceof Error ? caught.message : "Unable to load this lead.")
        setErrorStatus(caught instanceof ApiError ? caught.status : null)
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [can, form, id])

  useEffect(() => {
    const controller = new AbortController()
    if (create) {
      form.reset(emptyValues)
      setLead(null)
      setError("")
      setErrorStatus(null)
      setLoading(false)
      return () => controller.abort()
    }
    void loadLead(controller.signal)
    return () => controller.abort()
  }, [create, form, loadLead])

  const submitCreate = form.handleSubmit(async (values) => {
    setSaving(true)
    setError("")
    try {
      const result = await apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads`, { method: "POST", body: JSON.stringify(toPayload(values)) })
      if (!result.lead.id) {
        navigate(indexPath, { replace: true })
        return
      }
      const detailsParams = returnSearch ? new URLSearchParams({ return: returnSearch }) : undefined
      navigate(`/leads/${result.lead.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof LeadFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to create this lead.")
    } finally {
      setSaving(false)
    }
  })

  if (create && !can("lead.create")) return <ErrorState kind="forbidden" title="Lead creation is restricted" description="You do not have permission to create leads." actionLabel="Return to leads" actionTo="/leads" />
  if (!create && !can("lead.view")) return <ForbiddenLeads />
  if (!create && (!Number.isInteger(id) || id < 1)) return <LeadDetailsState kind="not-found" title="Lead not found" description="The lead identifier is invalid." />
  if (!create && loading) return <div className="space-y-6 p-6 lg:p-8"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
  if (create) return <main className="mx-auto max-w-[100rem] space-y-6 p-6 pb-24 lg:p-8"><header className="flex flex-wrap items-end justify-between gap-6"><div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexPath}><ArrowLeft className="me-2 size-3.5" />Back to leads</Link></Button><h1 className="mt-4 text-2xl font-semibold tracking-tight">New Lead</h1></div><div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" onClick={() => navigate(indexPath)}>Cancel</Button><Button type="submit" form="lead-create-form" disabled={saving}>{saving ? "Creating…" : "Create"}</Button></div></header>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}<LeadForm create form={form} formId="lead-create-form" title="Create lead" saving={saving} onCancel={() => navigate(indexPath)} onSubmit={submitCreate} /></main>
  if (!lead) {
    const kind = errorStatus === 401 ? "unauthorized" : errorStatus === 403 ? "forbidden" : "not-found"
    const title = errorStatus === 401 ? "Your session has expired" : errorStatus === 403 ? "Lead is restricted" : errorStatus === 404 ? "Lead not found" : "Unable to open lead"
    return <LeadDetailsState kind={kind} title={title} description={error || "This lead is no longer available."} />
  }

  const clearEditMode = () => setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("mode"); return next }, { replace: true })
  const submitEdit = form.handleSubmit(async (values) => {
    if (values.status === "qualified" && (!values.company_name.trim() || !(lead.assigned_agent_id ?? lead.assigned_agent?.id))) {
      if (!values.company_name.trim()) form.setError("company_name", { message: "A company is required before qualifying a lead." })
      setError("Add a company and assign an agent before qualifying this lead.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const result = await apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads/${id}`, { method: "POST", body: JSON.stringify({ ...toPayload(values), _method: "PUT" }) })
      setLead(result.lead)
      form.reset(valuesFromLead(result.lead))
      clearEditMode()
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof LeadFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to save this lead.")
    } finally { setSaving(false) }
  })
  const deleteLead = async () => {
    setSaving(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/leads/${id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      navigate(indexPath, { replace: true })
    } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this lead.") }
    finally { setSaving(false) }
  }

  return <div className="space-y-6 p-6 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6"><div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexPath}><ArrowLeft className="me-2 size-3.5" />Back to leads</Link></Button><h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{lead.name}</h1><p className="mt-1 truncate text-sm text-muted-foreground">{lead.email} · {lead.phone}</p></div><div className="flex flex-wrap gap-2"><Badge className={statusPillClass[lead.status]}>{lead.status}</Badge>{lead.source && <Badge variant="secondary" className={`gap-1.5 ${sourceBrandClass[lead.source]}`}><SourceMark source={lead.source} /><span className="capitalize">{lead.source}</span></Badge>}{can("lead.edit") && !editing && <Button asChild variant="outline" size="sm"><Link to={`/leads/${id}?${new URLSearchParams({ mode: "edit", ...(returnSearch ? { return: returnSearch } : {}) })}`}><Pencil className="me-2 size-3.5" />Edit lead</Link></Button>}{can("lead.delete") && <ActionTooltip label="Delete lead"><Button variant="outline" size="icon" aria-label="Delete lead" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 /></Button></ActionTooltip>}</div></div>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{editing ? <section className="border border-border bg-card"><LeadForm form={form} title={`Edit ${lead.name}`} saving={saving} onCancel={() => { form.reset(valuesFromLead(lead)); clearEditMode() }} onSubmit={submitEdit} /></section> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]"><div className="min-w-0 space-y-6"><section className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Lead details</h2></div><dl className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2"><Info label="Email" value={<a className="break-all text-primary hover:text-foreground" href={`mailto:${lead.email}`}>{lead.email}</a>} /><Info label="Phone" value={<a className="text-primary hover:text-foreground" href={`tel:${lead.phone}`}>{lead.phone}</a>} /><Info label="City" value={lead.city} /><Info label="Company" value={lead.company_name ?? "—"} /><Info label="Address" value={lead.address ?? "—"} /><Info label="Assigned agent" value={<LeadAgent agent={lead.assigned_agent} linkEnabled={can("user.view")} />} /></dl></section>{lead.id !== undefined && <ActivityLogList model="lead" id={lead.id} title="Lead activity" onReverted={() => void loadLead()} />}</div><LeadContactCard contact={lead.contact} /></div>}<ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${lead.name}?`} description={<>This permanently removes {lead.name}. This action cannot be undone.</>} confirmLabel="Delete lead" pending={saving} error={deleteError} onConfirm={deleteLead} /></div>
}

function LeadContactCard({ contact }: { contact: LeadContact | null | undefined }) {
  const { can } = useAuth()

  if (!contact) return <section className="border border-dashed border-border bg-muted/20 p-5"><h2 className="font-semibold">Contact</h2><p className="mt-2 text-sm text-muted-foreground">No contact is connected to this lead yet.</p></section>

  const canViewContact = can("contact.view")
  return <aside className="h-fit border border-border bg-muted/20 xl:sticky xl:top-20"><div className="border-b border-border p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium text-muted-foreground">Contact</p>{canViewContact && <Button asChild variant="outline" size="sm"><Link to={`/contacts/${contact.id}`}>Open contact</Link></Button>}</div><div className="mt-3 flex min-w-0 items-center gap-3"><PersonAvatar name={contact.name} size="lg" /><div className="min-w-0"><h2 className="truncate text-lg font-semibold">{canViewContact ? <Link className="text-primary hover:text-foreground" to={`/contacts/${contact.id}`}>{contact.name}</Link> : contact.name}</h2>{contact.title && <p className="truncate text-sm text-muted-foreground">{contact.title}</p>}</div></div></div><div className="space-y-3 p-5">{contact.phone && <a className="flex items-center gap-2 text-sm text-primary hover:text-foreground" href={`tel:${contact.phone}`}><Phone className="size-3.5 shrink-0" aria-hidden="true" /><span>{contact.phone}</span></a>}{contact.email && <a className="flex min-w-0 items-center gap-2 text-sm text-primary hover:text-foreground" href={`mailto:${contact.email}`}><Mail className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{contact.email}</span></a>}</div></aside>
}

function LeadDetailsState({ kind, title, description }: { kind: "unauthorized" | "forbidden" | "not-found"; title: string; description: string }) { return <ErrorState kind={kind} title={title} description={description} actionLabel="Return to leads" actionTo="/leads" /> }
