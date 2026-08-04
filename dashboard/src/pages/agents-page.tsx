import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, HandCoins, ImageIcon, Mail, Pencil, Phone, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, X } from "lucide-react"
import { z } from "zod"
import type { components as AuthComponents } from "@/api/generated/Auth"
import type { components as MarketingComponents } from "@/api/generated/Marketing"
import type { components as SalesComponents } from "@/api/generated/Sales"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePreviewDrawer } from "@/components/shared/resource-preview-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { DateRangePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type User = AuthComponents["schemas"]["User"]
type Role = AuthComponents["schemas"]["Role"]
type Permission = AuthComponents["schemas"]["Permission"]
type Lead = MarketingComponents["schemas"]["Lead"]
type Deal = SalesComponents["schemas"]["Deal"]
type UserEnvelope = { user: User }
type AgentFormValues = { name: string; username: string; email: string; phone: string; password: string; roles: string[] }

const emptyValues: AgentFormValues = { name: "", username: "", email: "", phone: "", password: "", roles: [] }
const labelFor = (value: string) => value.replaceAll(".", " / ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "—"
const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
const detailsPath = (id: number, returnSearch = "", edit = false) => {
  const params = new URLSearchParams()
  if (edit) params.set("mode", "edit")
  if (returnSearch) params.set("return", returnSearch)
  return `/agents/${id}${params.size ? `?${params}` : ""}`
}
const dealStatusPillClass: Record<Deal["status"], string> = {
  inquiry: "border-slate-500/20 bg-slate-500/10 text-slate-800 hover:bg-slate-500/10 dark:text-slate-200",
  viewing: "border-blue-500/20 bg-blue-500/10 text-blue-800 hover:bg-blue-500/10 dark:text-blue-200",
  offer_made: "border-amber-500/20 bg-amber-500/10 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100",
  legal: "border-violet-500/20 bg-violet-500/10 text-violet-900 hover:bg-violet-500/10 dark:text-violet-100",
  won: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/10 dark:text-emerald-100",
  lost: "border-red-500/20 bg-red-500/10 text-red-900 hover:bg-red-500/10 dark:text-red-100",
}
const leadStatusPillClass: Record<Lead["status"], string> = {
  pending: "border-amber-500/20 bg-amber-500/12 text-amber-950 hover:bg-amber-500/12 dark:text-amber-100",
  contacted: "border-blue-500/20 bg-blue-500/12 text-blue-950 hover:bg-blue-500/12 dark:text-blue-100",
  qualified: "border-emerald-500/20 bg-emerald-500/12 text-emerald-950 hover:bg-emerald-500/12 dark:text-emerald-100",
  unqualified: "border-red-500/20 bg-red-500/12 text-red-950 hover:bg-red-500/12 dark:text-red-100",
}

const agentSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  username: z.string().trim().min(1, "Enter a username."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  password: z.string().superRefine((value, context) => {
    if (value && value.length < 6) context.addIssue({ code: "custom", message: "Use at least 6 characters." })
  }),
  roles: z.array(z.string()),
})

function valuesFromUser(user: User): AgentFormValues {
  return { name: user.name, username: user.username, email: user.email, phone: user.phone, password: "", roles: (user.roles ?? []).map((role) => role.name) }
}

function toPayload(values: AgentFormValues, editing: boolean, includeRoles: boolean) {
  const base = { name: values.name.trim(), username: values.username.trim(), email: values.email.trim(), phone: values.phone.trim() }
  return editing
    ? { _method: "PUT" as const, ...base, ...(includeRoles ? { roles: values.roles } : {}) }
    : { user: { ...base, password: values.password, ...(includeRoles ? { roles: values.roles } : {}) } }
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

function RoleReference({ role, stopPropagation = true }: { role: { id?: number; name: string }; stopPropagation?: boolean }) {
  return role.id === undefined ? <Badge variant="secondary">{labelFor(role.name)}</Badge> : <Badge asChild variant="secondary"><Link to={`/settings/roles/${role.id}`} onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}>{labelFor(role.name)}</Link></Badge>
}

function PermissionBadge({ permission }: { permission: Permission }) {
  const [resource, action] = permission.name.split(".", 2)
  const actionClass = action === "delete"
    ? "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200"
    : action === "create"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      : action === "edit"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100"
        : "border-blue-500/25 bg-blue-500/10 text-blue-800 dark:text-blue-200"
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${actionClass}`} aria-label={permission.name}>
    {labelFor(action ?? resource.replaceAll("-", " "))}
  </span>
}

function PermissionGroups({ permissions, compact = false }: { permissions: Permission[]; compact?: boolean }) {
  const groups = new Map<string, Permission[]>()
  for (const permission of permissions) {
    const resource = permission.name.split(".", 1)[0]
    groups.set(resource, [...(groups.get(resource) ?? []), permission])
  }

  return <div className={compact ? "space-y-4" : "space-y-4 p-5"}>{[...groups.entries()].map(([resource, group]) => <div key={resource}><p className="mb-2 text-sm font-semibold text-foreground">{labelFor(resource)}</p><div className="flex flex-wrap gap-1.5">{group.map((permission) => <PermissionBadge key={permission.name} permission={permission} />)}</div></div>)}</div>
}

function DealPropertyCover({ property }: { property: Deal["property"] }) {
  const cover = property.images?.[0]
  const className = "h-10 w-[3.333rem]"
  return cover ? <img src={cover.thumbnail_url || cover.url} alt="" className={`${className} shrink-0 border border-border object-cover`} loading="lazy" /> : <span className={`${className} grid shrink-0 place-items-center border border-dashed border-border bg-muted/20 text-muted-foreground`} aria-hidden="true"><ImageIcon className="size-3.5" /></span>
}

function DealValue({ value, dealValue }: { value: number; dealValue: number }) {
  const changed = dealValue !== value
  const higher = dealValue > value
  const tone = higher ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
  return <div className="flex items-center gap-1 whitespace-nowrap font-mono text-xs" aria-label={`Deal value ${formatCurrency(dealValue)}; intended value ${formatCurrency(value)}`}>{changed && (higher ? <ArrowUp className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> : <ArrowDown className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />)}<div className="space-y-0.5">{changed ? <><div className="text-muted-foreground/60 line-through">{formatCurrency(value)}</div><div className={`${tone} text-base font-bold`}>{formatCurrency(dealValue)}</div></> : <div className="text-lg font-bold text-foreground">{formatCurrency(value)}</div>}</div></div>
}

function DealCommission({ dealValue, commissionRate }: { dealValue: number; commissionRate: number }) {
  const commission = dealValue * commissionRate / 100
  return <div className="inline-flex items-center gap-1.5 whitespace-nowrap" aria-label={`Commission ${formatCurrency(commission)}`}><HandCoins className="size-3.5 text-muted-foreground" aria-hidden="true" /><span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(commission)}</span></div>
}

function AgentDeals({ agentId, totalPotentialCommission, totalActualCommission }: { agentId: number; totalPotentialCommission?: number; totalActualCommission?: number }) {
  const { can } = useAuth()
  const canViewDeals = can("deal.view")
  const canViewContacts = can("contact.view")
  const canViewProperties = can("property.view")
  const [deals, setDeals] = useState<Deal[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const dealsHref = `/deals?agent=${agentId}`

  const loadDeals = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<Paginated<Deal>>(listUrl(`${API_BASE_URL}/v1/deals`, { agent: agentId, page: 1, per_page: 3 }), { signal })
      setDeals(body.data)
      setTotal(body.meta.total)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load this agent's deals.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    if (!canViewDeals) return
    const controller = new AbortController()
    void loadDeals(controller.signal)
    return () => controller.abort()
  }, [canViewDeals, loadDeals])

  if (!canViewDeals) return null

  return <section className="border border-border bg-card" aria-labelledby={`agent-deals-${agentId}`}><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex items-center gap-2"><h2 id={`agent-deals-${agentId}`} className="font-semibold">Deals</h2>{total !== null && <Badge variant="secondary" aria-label={`${total} deals`}>{total}</Badge>}</div><Button asChild variant="outline" size="sm"><Link to={dealsHref}>View all deals</Link></Button></header><div className="p-5">{loading ? <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void loadDeals()}>Try again</Button></div> : deals.length ? <div className="space-y-3">{deals.map((deal) => <article key={deal.id ?? `${deal.property.title}-${deal.contact.id}`} className="overflow-hidden border border-border"><div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4"><div className="flex min-w-0 items-center gap-2"><DealPropertyCover property={deal.property} /><div className="min-w-0"><div className="truncate font-medium">{canViewProperties && deal.property.id !== undefined ? <Link className="text-primary hover:text-foreground" to={`/properties/${deal.property.id}`}>{deal.property.title}</Link> : deal.property.title}</div><div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"><PersonAvatar name={deal.contact.name} size="sm" className="!size-4 [&_[data-slot=avatar-fallback]]:!text-[7px]" />{canViewContacts && deal.contact.id ? <Link className="truncate hover:text-primary" to={`/contacts/${deal.contact.id}`}>{deal.contact.name}</Link> : <span className="truncate">{deal.contact.name}</span>}</div></div></div><DealValue value={deal.value} dealValue={deal.deal_value} /></div><footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-muted/40 px-4 py-1.5"><Badge className={dealStatusPillClass[deal.status]}>{labelFor(deal.status)}</Badge><div className="ms-auto flex items-center gap-3"><DealCommission dealValue={deal.deal_value} commissionRate={deal.commission_rate} />{deal.id && <ActionTooltip label="View deal"><Button asChild variant="ghost" size="icon"><Link to={`/deals/${deal.id}`} aria-label={`View deal for ${deal.property.title}`}><ArrowRight className="size-4" /></Link></Button></ActionTooltip>}</div></footer></article>)}</div> : <div className="border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">No deals are assigned to this agent.</div>}</div><footer className="grid gap-3 border-t border-border bg-muted/40 p-4 sm:grid-cols-2"><div className="border border-border bg-card px-4 py-3"><p className="text-sm font-medium text-muted-foreground">Potential commission</p><p className="mt-2 font-mono text-lg font-semibold text-foreground">{formatCurrency(totalPotentialCommission ?? 0)}</p></div><div className="border border-border bg-card px-4 py-3"><p className="text-sm font-medium text-muted-foreground">Actual commission</p><p className="mt-2 font-mono text-lg font-semibold text-foreground">{formatCurrency(totalActualCommission ?? 0)}</p></div></footer></section>
}

function AgentLeads({ agentId }: { agentId: number }) {
  const { can } = useAuth()
  const canViewLeads = can("lead.view")
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const leadsHref = `/leads?assigned_agent=${agentId}`

  const loadLeads = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<Paginated<Lead>>(listUrl(`${API_BASE_URL}/v1/leads`, { assigned_agent: agentId, page: 1, per_page: 3 }), { signal })
      setLeads(body.data)
      setTotal(body.meta.total)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load assigned leads.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    if (!canViewLeads) return
    const controller = new AbortController()
    void loadLeads(controller.signal)
    return () => controller.abort()
  }, [canViewLeads, loadLeads])

  if (!canViewLeads) return null

  return <section className="border border-border bg-card" aria-labelledby={`agent-leads-${agentId}`}><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex items-center gap-2"><h2 id={`agent-leads-${agentId}`} className="font-semibold">Leads</h2>{total !== null && <Badge variant="secondary" aria-label={`${total} leads`}>{total}</Badge>}</div><Button asChild variant="outline" size="sm"><Link to={leadsHref}>View all leads</Link></Button></header><div className="p-5">{loading ? <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void loadLeads()}>Try again</Button></div> : leads.length ? <div className="divide-y divide-border border-y border-border">{leads.map((lead) => <div key={lead.id ?? lead.email} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0">{lead.id !== undefined ? <Link className="block truncate font-medium text-primary hover:text-foreground" to={`/leads/${lead.id}`}>{lead.name}</Link> : <span className="block truncate font-medium">{lead.name}</span>}<p className="mt-0.5 truncate text-sm text-muted-foreground">{lead.city}</p></div><Badge className={leadStatusPillClass[lead.status]}>{labelFor(lead.status)}</Badge></div>)}</div> : <div className="border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">No leads are assigned to this agent.</div>}</div></section>
}

function canDeleteAgent(currentUser: User | null, hasDeletePermission: boolean, agent: User): boolean {
  return hasDeletePermission && agent.is_super !== true && agent.id !== currentUser?.id
}

export function AgentsPage() {
  const { user, can, isSuper, refresh } = useAuth()
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
  const roleFilter = searchParams.get("role") ?? ""
  const accessFilter = searchParams.get("access") ?? ""
  const permissionFilter = searchParams.get("permission") ?? ""
  const createdFrom = searchParams.get("created_from") ?? ""
  const createdTo = searchParams.get("created_to") ?? ""
  const [queryInput, setQueryInput] = useState(query)
  const [createdFromInput, setCreatedFromInput] = useState(createdFrom)
  const [createdToInput, setCreatedToInput] = useState(createdTo)
  const [agents, setAgents] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [meta, setMeta] = useState<Paginated<User>["meta"] | null>(null)
  const [selected, setSelected] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [previewError, setPreviewError] = useState<{ message: string; status?: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const canDelete = can("user.delete")

  const loadAgents = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("")
    try {
      const body = await apiJson<Paginated<User>>(listUrl(`${API_BASE_URL}/v1/users`, {
        page,
        q: query,
        role: roleFilter,
        access: accessFilter,
        permission: permissionFilter,
        created_from: createdFrom,
        created_to: createdTo,
      }), { signal })
      setAgents(body.data); setMeta(body.meta)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load agents.")
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [accessFilter, createdFrom, createdTo, page, permissionFilter, query, roleFilter])

  useEffect(() => {
    if (!can("user.view")) return
    const controller = new AbortController(); void loadAgents(controller.signal)
    return () => controller.abort()
  }, [can, loadAgents])

  useEffect(() => {
    if (!isSuper) { setRoles([]); setPermissions([]); return }
    const controller = new AbortController()
    void Promise.all([
      apiJson<Paginated<Role>>(`${API_BASE_URL}/v1/roles`, { signal: controller.signal }),
      apiJson<{ data: Permission[] }>(`${API_BASE_URL}/v1/permissions`, { signal: controller.signal }),
    ]).then(([roleBody, permissionBody]) => { setRoles(roleBody.data); setPermissions(permissionBody.data) }).catch((caught) => {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load access options.")
    })
    return () => controller.abort()
  }, [isSuper])

  useEffect(() => {
    if (mode === "create") { setSelected(null); setPreviewError(null); setSelectionLoading(false); return }
    if (!selectedId) { setSelected(null); setPreviewError(null); setSelectionLoading(false); return }
    const listed = agents.find((agent) => agent.id === selectedId)
    setSelected(listed ?? null)
    setPreviewError(null)
    const controller = new AbortController(); setSelectionLoading(true)
    void apiJson<UserEnvelope>(`${API_BASE_URL}/v1/users/${selectedId}`, { signal: controller.signal }).then((body) => { setSelected(body.user) }).catch((caught) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setPreviewError({ message: caught instanceof Error ? caught.message : "Unable to load this agent.", status: caught instanceof ApiError ? caught.status : undefined })
    }).finally(() => { if (!controller.signal.aborted) setSelectionLoading(false) })
    return () => controller.abort()
  }, [agents, mode, selectedId])

  useEffect(() => {
    if (mode === "create") {
      navigate(`/agents/create${returnSearch ? `?return=${encodeURIComponent(returnSearch)}` : ""}`, { replace: true })
      return
    }
    if (mode !== "edit") return
    if (selectedId) navigate(detailsPath(selectedId, returnSearch, true), { replace: true })
    else setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("mode"); return next }, { replace: true })
  }, [mode, navigate, returnSearch, selectedId, setSearchParams])

  const setParams = (next: Record<string, string | undefined>) => setSearchParams((current) => {
    const params = new URLSearchParams(current); Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value)); return params
  })
  const updateFilter = (key: "role" | "access" | "permission", value: string) => setParams({ [key]: value || undefined, page: "1", record: undefined, mode: undefined })
  const clearFilters = () => setParams({ q: undefined, role: undefined, access: undefined, permission: undefined, created_from: undefined, created_to: undefined, page: "1", record: undefined, mode: undefined })

  useEffect(() => { setQueryInput(query); setCreatedFromInput(createdFrom); setCreatedToInput(createdTo) }, [createdFrom, createdTo, query])
  useEffect(() => {
    if (queryInput === query && createdFromInput === createdFrom && createdToInput === createdTo) return
    const timeout = window.setTimeout(() => setSearchParams((current) => {
      const params = new URLSearchParams(current)
      if (queryInput.trim()) params.set("q", queryInput.trim()); else params.delete("q")
      if (createdFromInput) params.set("created_from", createdFromInput); else params.delete("created_from")
      if (createdToInput) params.set("created_to", createdToInput); else params.delete("created_to")
      params.set("page", "1"); params.delete("record"); params.delete("mode"); return params
    }), 500)
    return () => window.clearTimeout(timeout)
  }, [createdFrom, createdFromInput, createdTo, createdToInput, query, queryInput, setSearchParams])

  const filteredAgents = agents
  const availableRoleNames = [...new Set(roles.map((role) => role.name))].sort()
  const availablePermissionNames = [...new Set(permissions.map((permission) => permission.name))].sort()
  const hasFilters = Boolean(query || roleFilter || accessFilter || permissionFilter || createdFrom || createdTo)
  const openAgent = (id: number) => setParams({ page: String(page), record: selectedId === id ? undefined : String(id), mode: undefined })
  async function deleteAgent() {
    if (!pendingDelete?.id || !canDeleteAgent(user, canDelete, pendingDelete)) return
    setDeleting(true); setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/users/${pendingDelete.id}`, { method: "DELETE" }); if (!response.ok) throw await readApiError(response)
      const deletedId = pendingDelete.id; setPendingDelete(null); setDeleteError(""); if (selectedId === deletedId) setParams({ record: undefined }); await loadAgents(); await refresh()
    } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this agent.") } finally { setDeleting(false) }
  }

  if (!can("user.view")) return <ForbiddenAgents />
  const canCreate = can("user.create"); const canEdit = can("user.edit")
  const createPath = `/agents/create${returnSearch ? `?return=${encodeURIComponent(returnSearch)}` : ""}`
  return <div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="text-xs font-medium text-muted-foreground">Administration / Staff</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Agents</h1><p className="mt-1 text-sm text-muted-foreground">Manage the people who work the CRM and their effective access.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void loadAgents()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canCreate && <Button asChild size="sm"><Link to={createPath}><Plus className="me-2 size-3.5" />New agent</Link></Button>}</div></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4"><div className="min-w-56 flex-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="agent-search">Search</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="agent-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name, username, email, phone, role…" /></div></div><div className="min-w-40"><label className="text-xs font-medium text-muted-foreground">Role</label><Select value={roleFilter || "all"} onValueChange={(value) => updateFilter("role", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem>{availableRoleNames.map((roleName) => <SelectItem key={roleName} value={roleName}>{labelFor(roleName)}</SelectItem>)}</SelectContent></Select></div><div className="min-w-36"><label className="text-xs font-medium text-muted-foreground">Access</label><Select value={accessFilter || "all"} onValueChange={(value) => updateFilter("access", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All access</SelectItem><SelectItem value="super">Super admin</SelectItem><SelectItem value="standard">Standard</SelectItem></SelectContent></Select></div><div className="min-w-44"><label className="text-xs font-medium text-muted-foreground">Permission</label><Select value={permissionFilter || "all"} onValueChange={(value) => updateFilter("permission", value === "all" ? "" : value)}><SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All permissions</SelectItem>{availablePermissionNames.map((permissionName) => <SelectItem key={permissionName} value={permissionName}>{labelFor(permissionName)}</SelectItem>)}</SelectContent></Select></div><div className="min-w-72"><label className="text-xs font-medium text-muted-foreground">Created date range</label><DateRangePicker from={createdFromInput} to={createdToInput} onChange={({ from, to }) => { setCreatedFromInput(from); setCreatedToInput(to) }} /></div>{hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}</div>
    <section data-testid="agents-table-surface" className="min-w-0 border border-border bg-card"><Table><TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Username</TableHead><TableHead>Phone</TableHead><TableHead>Roles</TableHead><TableHead>Access</TableHead><TableHead>Created</TableHead><TableHead className="w-48 min-w-48 max-w-48 text-end">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: 7 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-5 w-3/4" /></TableCell>)}</TableRow>) : filteredAgents.length ? filteredAgents.map((agent) => { const isPreviewing = selectedId === agent.id; const canDeleteThisAgent = canDeleteAgent(user, canDelete, agent); return <TableRow key={agent.id} data-state={isPreviewing ? "selected" : undefined} className="cursor-pointer" onClick={() => agent.id && openAgent(agent.id)}><TableCell><div className="flex items-center gap-2"><PersonAvatar name={agent.name} /><div className="min-w-0"><div className="truncate font-medium">{agent.name}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" aria-hidden="true" />{agent.email}</div></div></div></TableCell><TableCell className="text-sm text-muted-foreground">{agent.username}</TableCell><TableCell><span className="inline-flex items-center gap-1.5 text-sm"><Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />{agent.phone}</span></TableCell><TableCell><div className="flex max-w-56 flex-wrap gap-1">{agent.roles?.length ? agent.roles.map((role) => <RoleReference key={role.name} role={role} />) : <span className="text-xs text-muted-foreground">—</span>}</div></TableCell><TableCell>{agent.is_super ? <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-900 dark:text-blue-100"><ShieldCheck className="me-1 size-3" />Super admin</Badge> : <span className="text-xs text-muted-foreground">Standard</span>}</TableCell><TableCell className="text-sm text-muted-foreground">{formatDate(agent.created_at)}</TableCell><TableCell className="w-48 min-w-48 max-w-48 text-end"><div className="flex justify-end gap-1 [&_[data-slot=button]]:transition-none" onClick={(event) => event.stopPropagation()}><ActionTooltip label="Open agent details"><Button asChild variant={isPreviewing ? "secondary" : "ghost"} size="icon" aria-pressed={isPreviewing}><Link to={detailsPath(agent.id ?? 0, returnSearch)} aria-label={`Open details for ${agent.name}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit agent"><Button asChild variant="ghost" size="icon"><Link to={detailsPath(agent.id ?? 0, returnSearch, true)} aria-label={`Edit ${agent.name}`}><Pencil /></Link></Button></ActionTooltip>}{canDeleteThisAgent && <ActionTooltip label={`Delete ${agent.name}`}><Button variant="ghost" size="icon" aria-label={`Delete ${agent.name}`} className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setPendingDelete(agent) }}><Trash2 /></Button></ActionTooltip>}</div></TableCell></TableRow> }) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{hasFilters ? <>No agents match the current filters. <Button variant="link" size="sm" className="ms-1" onClick={clearFilters}>Clear filters</Button></> : <div><p>No agents found.</p>{canCreate && <Button asChild variant="link" size="sm" className="mt-1"><Link to={createPath}>Create an agent</Link></Button>}</div>}</TableCell></TableRow>}</TableBody></Table><ResourcePagination page={meta?.current_page ?? page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} /></section>
    <ResourcePreviewDrawer open={Boolean(selectedId && mode !== "create" && mode !== "edit")} onOpenChange={(open) => { if (!open) setParams({ record: undefined }) }} title="Agent preview" description="Read-only agent details and available actions.">
      {selectionLoading && !selected ? <div className="space-y-4 p-5"><Skeleton className="h-7 w-48" /><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></div> : previewError ? <div className="space-y-3 p-5"><h2 className="font-semibold">{previewError.status === 403 ? "Agent is restricted" : previewError.status === 404 ? "Agent not found" : "Unable to load agent"}</h2><p role="alert" className="text-sm text-destructive">{previewError.message}</p><Button variant="outline" size="sm" onClick={() => setParams({ record: undefined })}>Close preview</Button></div> : selected ? <AgentInspector agent={selected} returnSearch={returnSearch} canEdit={canEdit} canDelete={canDeleteAgent(user, canDelete, selected)} onDelete={() => { setDeleteError(""); setPendingDelete(selected) }} /> : <div className="p-5 text-sm text-muted-foreground">This agent could not be loaded.</div>}
    </ResourcePreviewDrawer>
    <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) { setPendingDelete(null); setDeleteError("") } }} title={`Delete ${pendingDelete?.name ?? "agent"}?`} description={<>This permanently removes {pendingDelete?.name ?? "this agent"} and revokes its CRM access. This action cannot be undone.</>} confirmLabel="Delete agent" pending={deleting} error={deleteError} onConfirm={deleteAgent} />
  </div>
}


function AgentForm({ create = false, form, title, saving, isSuper, roles, onCancel, onSubmit, formId }: { create?: boolean; form: ReturnType<typeof useForm<AgentFormValues>>; title: string; saving: boolean; isSuper: boolean; roles: Role[]; onCancel: () => void; onSubmit: () => void; formId?: string }) {
  const { register, formState: { errors }, watch, setValue } = form
  const selectedRoles = watch("roles")
  const toggleRole = (name: string, checked: boolean) => setValue("roles", checked ? [...new Set([...selectedRoles, name])] : selectedRoles.filter((role) => role !== name), { shouldDirty: true })
  return <form id={formId} onSubmit={onSubmit} className="w-full space-y-5 p-5">{!create && <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Agent editor</p><h2 className="mt-1 text-lg font-semibold">{title}</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Close editor" onClick={onCancel}><X /></Button></div>}<FieldGroup className="grid w-full gap-3 sm:grid-cols-2"><AgentInputField inputId="agent-name" label="Name" required error={errors.name?.message} className="sm:col-span-2"><InputGroupInput id="agent-name" aria-labelledby="agent-name-label" aria-invalid={Boolean(errors.name)} autoComplete="name" {...register("name")} className="h-9 px-2.5" /></AgentInputField><AgentInputField inputId="agent-username" label="Username" required error={errors.username?.message}><InputGroupInput id="agent-username" aria-labelledby="agent-username-label" aria-invalid={Boolean(errors.username)} autoComplete="username" {...register("username")} className="h-9 px-2.5" /></AgentInputField><AgentInputField inputId="agent-phone" label="Phone" required error={errors.phone?.message}><InputGroupInput id="agent-phone" aria-labelledby="agent-phone-label" aria-invalid={Boolean(errors.phone)} type="tel" autoComplete="tel" {...register("phone")} className="h-9 px-2.5" /></AgentInputField><AgentInputField inputId="agent-email" label="Email" required error={errors.email?.message} className="sm:col-span-2"><InputGroupInput id="agent-email" aria-labelledby="agent-email-label" aria-invalid={Boolean(errors.email)} type="email" autoComplete="email" {...register("email")} className="h-9 px-2.5" /></AgentInputField>{create && <AgentInputField inputId="agent-password" label="Password" required error={errors.password?.message} description="Use at least 6 characters." className="sm:col-span-2"><InputGroupInput id="agent-password" aria-labelledby="agent-password-label" aria-invalid={Boolean(errors.password)} type="password" autoComplete="new-password" required {...register("password")} className="h-9 px-2.5" /></AgentInputField>}</FieldGroup>{isSuper && <section className="border-t border-border pt-4"><p className="text-sm font-medium">Roles</p><p className="mt-1 text-xs text-muted-foreground">Assign roles to control this agent's effective permissions.</p><div className="mt-3 space-y-1">{roles.length ? roles.map((role) => <label key={role.id ?? role.name} className="flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50"><Checkbox checked={selectedRoles.includes(role.name)} onCheckedChange={(checked) => toggleRole(role.name, checked === true)} /><span>{labelFor(role.name)}</span></label>) : <p className="text-sm text-muted-foreground">No roles are available.</p>}</div></section>}{!create && <div className="flex justify-between gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Save className="me-2 size-3.5" />Save agent</>}</Button></div>}</form>
}

function AgentInputField({ inputId, label, required, error, description, className, children }: { inputId: string; label: string; required?: boolean; error?: string; description?: string; className?: string; children: ReactNode }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon>{children}{description && <InputGroupAddon align="block-end" className="border-t border-border/70 bg-muted/30 dark:bg-transparent"><InputGroupText className="px-0 text-xs font-normal">{description}</InputGroupText></InputGroupAddon>}</InputGroup><FieldError>{error}</FieldError></Field>
}

function AgentInspector({ agent, returnSearch, canEdit, canDelete, onDelete }: { agent: User; returnSearch: string; canEdit: boolean; canDelete: boolean; onDelete: () => void }) { return <div className="space-y-6 p-5"><header className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><PersonAvatar name={agent.name} size="lg" /><div className="min-w-0"><h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{agent.name}</h2><p className="mt-1 truncate text-sm text-muted-foreground">@{agent.username}</p></div></div><div className="flex shrink-0 gap-1"><ActionTooltip label="Open dedicated details"><Button asChild variant="outline" size="icon"><Link to={detailsPath(agent.id ?? 0, returnSearch)} aria-label="Open dedicated details"><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit agent"><Button asChild variant="outline" size="icon"><Link to={detailsPath(agent.id ?? 0, returnSearch, true)} aria-label="Edit agent"><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete agent"><Button variant="outline" size="icon" aria-label="Delete agent" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /></Button></ActionTooltip>}</div></header><div className="flex flex-wrap gap-2">{agent.is_super && <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-900 dark:text-blue-100"><ShieldCheck className="me-1 size-3" />Super admin</Badge>}{agent.roles?.map((role) => <RoleReference key={role.name} role={role} />)}</div><section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Contact</p><dl className="mt-4 grid gap-4 text-sm"><Info label="Email" value={<span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />{agent.email}</span>} /><Info label="Phone" value={<span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />{agent.phone}</span>} /></dl></section><section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Effective permissions</p>{agent.is_super ? <p className="mt-3 text-sm text-muted-foreground">Super admins inherit all available actions.</p> : agent.permissions?.length ? <PermissionGroups permissions={agent.permissions} compact /> : <p className="mt-3 text-sm text-muted-foreground">No effective permissions.</p>}</section><Separator /><p className="text-xs text-muted-foreground">Created {formatDate(agent.created_at)}</p></div> }

function Info({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }
function ForbiddenAgents() { return <ErrorState kind="forbidden" title="Agents are restricted" description="You do not have permission to view staff accounts." actionLabel="Return to overview" actionTo="/" /> }
function AgentDetailsState({ title, description }: { title: string; description: string }) { return <ErrorState kind="not-found" title={title} description={description} actionLabel="Return to agents" actionTo="/agents" /> }

export function AgentDetailsPage({ create = false }: { create?: boolean } = {}) {
  const { user, can, isSuper } = useAuth(); const navigate = useNavigate(); const { agentId } = useParams(); const id = Number(agentId); const [searchParams, setSearchParams] = useSearchParams()
  const returnSearch = searchParams.get("return") ?? ""
  const indexHref = returnSearch ? `/agents?${returnSearch}` : "/agents"
  const editing = !create && searchParams.get("mode") === "edit" && can("user.edit")
  const [agent, setAgent] = useState<User | null>(null); const [roles, setRoles] = useState<Role[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [deleting, setDeleting] = useState(false); const [deleteOpen, setDeleteOpen] = useState(false); const [deleteError, setDeleteError] = useState("")
  const form = useForm<AgentFormValues>({ resolver: zodResolver(agentSchema), defaultValues: emptyValues })
  const loadAgent = useCallback(async (signal?: AbortSignal) => { if (!can("user.view") || !Number.isInteger(id) || id < 1) { setLoading(false); return }; setLoading(true); setError(""); try { const body = await apiJson<UserEnvelope>(`${API_BASE_URL}/v1/users/${id}`, { signal }); setAgent(body.user); form.reset(valuesFromUser(body.user)) } catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load this agent.") } finally { if (!signal?.aborted) setLoading(false) } }, [can, form, id])
  useEffect(() => {
    if (create) {
      form.reset(emptyValues)
      setAgent(null)
      setError("")
      setLoading(false)
      return
    }
    const controller = new AbortController(); void loadAgent(controller.signal); return () => controller.abort()
  }, [create, form, loadAgent])
  useEffect(() => {
    if (!isSuper) { setRoles([]); return }
    const controller = new AbortController()
    void apiJson<Paginated<Role>>(`${API_BASE_URL}/v1/roles`, { signal: controller.signal }).then((body) => setRoles(body.data)).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load access options.") })
    return () => controller.abort()
  }, [isSuper])
  useEffect(() => {
    if (searchParams.get("mode") === "edit" && !can("user.edit")) setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("mode"); return next }, { replace: true })
  }, [can, searchParams, setSearchParams])
  const setEditMode = (enabled: boolean) => setSearchParams((current) => { const next = new URLSearchParams(current); if (enabled) next.set("mode", "edit"); else next.delete("mode"); return next }, { replace: true })
  const saveAgent = form.handleSubmit(async (values) => {
    if (!agent?.id) return
    setError("")
    try {
      const result = await apiJson<UserEnvelope>(`${API_BASE_URL}/v1/users/${agent.id}`, { method: "POST", body: JSON.stringify(toPayload(values, true, isSuper)) })
      setAgent(result.user); form.reset(valuesFromUser(result.user)); setEditMode(false)
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof AgentFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to save this agent.")
    }
  })
  const createAgent = form.handleSubmit(async (values) => {
    setError("")
    if (!values.password) {
      form.setError("password", { message: "Enter a password." })
      return
    }
    try {
      const result = await apiJson<UserEnvelope>(`${API_BASE_URL}/v1/users`, { method: "POST", body: JSON.stringify(toPayload(values, false, isSuper)) })
      if (result.user.id) navigate(detailsPath(result.user.id, returnSearch), { replace: true })
      else navigate(indexHref, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof AgentFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to create this agent.")
    }
  })
  async function deleteCurrentAgent() { if (!agent?.id || !canDeleteAgent(user, can("user.delete"), agent)) return; setDeleting(true); setDeleteError(""); try { const response = await apiFetch(`${API_BASE_URL}/v1/users/${agent.id}`, { method: "DELETE" }); if (!response.ok) throw await readApiError(response); navigate(indexHref, { replace: true }) } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this agent.") } finally { setDeleting(false) } }
  if (create && !can("user.create")) return <ErrorState kind="forbidden" title="Agent creation is restricted" description="You do not have permission to create agents." actionLabel="Return to agents" actionTo="/agents" />
  if (!create && !can("user.view")) return <ForbiddenAgents />
  if (create) return <main className="w-full space-y-6 p-6 pb-24 lg:p-8"><header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Back to agents</Link></Button><h1 className="mt-5 text-2xl font-semibold tracking-tight">New agent</h1></div><div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" onClick={() => navigate(indexHref)}>Cancel</Button><Button type="submit" form="agent-create-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create"}</Button></div></header>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}<AgentForm create form={form} formId="agent-create-form" title="Create agent" saving={form.formState.isSubmitting} isSuper={isSuper} roles={roles} onCancel={() => navigate(indexHref)} onSubmit={createAgent} /></main>
  if (!Number.isInteger(id) || id < 1) return <AgentDetailsState title="Agent not found" description="The agent identifier is invalid." />
  if (loading) return <div className="space-y-6 p-6 lg:p-8"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
  if (error || !agent) return <AgentDetailsState title="Unable to open agent" description={error || "This agent is no longer available."} />
  const canEdit = can("user.edit"); const canDelete = canDeleteAgent(user, can("user.delete"), agent)
  return <div className="space-y-6 p-6 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6"><div><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Back to agents</Link></Button><div className="mt-5 flex items-center gap-3"><PersonAvatar name={agent.name} size="lg" /><div><p className="text-xs font-medium text-muted-foreground">Agent details</p><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>{agent.roles?.map((role) => <RoleReference key={role.name} role={role} stopPropagation={false} />)}</div><p className="mt-1 text-sm text-muted-foreground">@{agent.username}</p></div></div></div><div className="flex items-center gap-2">{canEdit && <Button variant={editing ? "secondary" : "outline"} size="sm" onClick={() => { form.reset(valuesFromUser(agent)); setEditMode(!editing) }}><Pencil className="me-2 size-3.5" />{editing ? "Editing" : "Edit agent"}</Button>}{canDelete && <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setDeleteOpen(true) }}><Trash2 className="me-2 size-3.5" />Delete</Button>}</div></div>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{editing ? <AgentForm form={form} title={`Edit ${agent.name}`} saving={form.formState.isSubmitting} isSuper={isSuper} roles={roles} onCancel={() => { form.reset(valuesFromUser(agent)); setEditMode(false) }} onSubmit={saveAgent} /> : <><section className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Identity</h2></div><dl className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 lg:grid-cols-4"><Info label="Name" value={agent.name} /><Info label="Username" value={agent.username} /><Info label="Email" value={<span className="inline-flex items-center gap-1.5"><Mail className="size-3.5 text-muted-foreground" aria-hidden="true" />{agent.email}</span>} /><Info label="Phone" value={<span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />{agent.phone}</span>} /></dl></section><AgentDeals agentId={id} totalPotentialCommission={agent.total_potential_commission} totalActualCommission={agent.total_actual_commission} /><div className="grid gap-6 lg:grid-cols-2"><AgentLeads agentId={id} /><section className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Permissions</h2></div>{agent.is_super ? <div className="p-5"><span className="text-sm text-muted-foreground">Super admins inherit all available actions.</span></div> : agent.permissions?.length ? <PermissionGroups permissions={agent.permissions} /> : <div className="p-5"><span className="text-sm text-muted-foreground">No effective permissions.</span></div>}</section></div>{agent.id !== undefined && <ActivityLogList model="user" id={agent.id} title="Agent activity" onReverted={() => void loadAgent()} />}</>}<ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${agent.name}?`} description={<>This permanently removes {agent.name} and revokes its CRM access. This action cannot be undone.</>} confirmLabel="Delete agent" pending={deleting} error={deleteError} onConfirm={deleteCurrentAgent} /></div>
}
