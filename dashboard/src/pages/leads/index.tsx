import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion } from "motion/react"
import { useForm } from "react-hook-form"
import { Link, useSearchParams } from "react-router-dom"
import { Briefcase, Building2, Check, ChevronDown, Funnel, ImageIcon, Inbox, Loader2, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, Save, Search, Trash2, UserRound, X } from "lucide-react"
import type { components as AuthComponents } from "@/api/generated/Auth"
import type { components as ContactComponents, paths as ContactPaths } from "@/api/generated/Contact"
import type { components as MarketingComponents, paths as MarketingPaths } from "@/api/generated/Marketing"
import type { components as SalesComponents } from "@/api/generated/Sales"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import type { Paginated } from "@/api/contracts"
import { listUrl } from "@/api/list-query"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { PhoneField } from "@/components/shared/phone-field"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { SearchableResourcePicker, type SearchableResourceOption, type SearchableResourcePage } from "@/components/shared/searchable-resource-picker"
import { emptyValues, leadSchema, LeadForm, type LeadFormValues } from "./details"
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanDropPlaceholder, KanbanItem, KanbanItemHandle, KanbanOverlay, type KanbanMoveEvent } from "@/components/reui/kanban"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

type Lead = MarketingComponents["schemas"]["Lead"]
type Account = ContactComponents["schemas"]["Account"]
type Deal = SalesComponents["schemas"]["Deal"]
type User = AuthComponents["schemas"]["User"]
type LeadStatus = Lead["status"]
type LeadSource = Exclude<Lead["source"], null | undefined>
type LeadUpdateRequest = MarketingPaths["/{id}"]["post"]["requestBody"]["content"]["application/json"]
type LeadCreateRequest = MarketingPaths["/"]["post"]["requestBody"]["content"]["application/json"]
type ContactUpdateRequest = ContactPaths["/contacts/{id}"]["post"]["requestBody"]["content"]["application/json"]
type LeadContactUpdatePayload = Pick<ContactUpdateRequest, "name" | "phone" | "account_id" | "_method"> & Partial<Pick<ContactUpdateRequest, "title" | "email">>
type LeadStats = Partial<Record<"pending_count" | "contacted_count" | "qualified_count" | "unqalified_count" | "unqualified_count", number>>
type LeadAccount = Pick<Account, "id" | "name" | "image">
type LeadDetail = Lead & { contact?: (NonNullable<Lead["contact"]> & { account?: LeadAccount | null }) | null }
type LeadInfoValues = { name: string; email: string; phone: string; title: string; city: string; address: string; companyName: string }
type LeadResponse = {
  data: Lead[]
  meta?: { current_page?: number; last_page?: number; total?: number }
  analytics?: { stats?: LeadStats }
  stats?: LeadStats
}
type LeadEnvelope = { lead: LeadDetail }
type DealListResponse = { data: Deal[]; meta?: { current_page?: number; last_page?: number; total?: number } }
type AccountListResponse = { data?: Account[]; accounts?: Account[]; meta?: { current_page?: number; last_page?: number; total?: number } }
type LeadStatusState = Record<LeadStatus, Lead[]>
type LeadPageState = Record<LeadStatus, number>
type LeadLastPageState = Record<LeadStatus, number>
type LeadLoadingState = Record<LeadStatus, boolean>
type LeadTotalState = Record<LeadStatus, number>

const filterMotionTransition = { type: "spring", stiffness: 500, damping: 42, mass: 0.65 } as const
const filterSlideTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

const statuses = [
  { value: "pending", label: "New Lead", shortLabel: "New Lead", color: "bg-amber-500", wash: "bg-amber-500/10", text: "text-amber-800 dark:text-amber-200" },
  { value: "contacted", label: "Contacted", shortLabel: "Contacted", color: "bg-blue-500", wash: "bg-blue-500/10", text: "text-blue-800 dark:text-blue-200" },
  { value: "unqualified", label: "Rejected", shortLabel: "Rejected", color: "bg-red-500", wash: "bg-red-500/10", text: "text-red-800 dark:text-red-200" },
  { value: "qualified", label: "Converted", shortLabel: "Converted", color: "bg-emerald-500", wash: "bg-emerald-500/10", text: "text-emerald-800 dark:text-emerald-200" },
] as const satisfies ReadonlyArray<{ value: LeadStatus; label: string; shortLabel: string; color: string; wash: string; text: string }>

const sources: LeadSource[] = ["facebook", "whatsapp", "instagram", "x"]
const sourceBrandClass: Record<LeadSource, string> = { facebook: "text-[#1877F2]", instagram: "text-[#E4405F]", whatsapp: "text-[#25D366]", x: "text-foreground" }
const dealStatusPillClass: Record<Deal["status"], string> = {
  inquiry: "border-slate-500/40 bg-slate-500/25 px-2.5 py-1.5 text-slate-950 backdrop-blur-md hover:bg-slate-500/30 dark:text-slate-100",
  viewing: "border-blue-500/40 bg-blue-500/25 px-2.5 py-1.5 text-blue-950 backdrop-blur-md hover:bg-blue-500/30 dark:text-blue-100",
  offer_made: "border-amber-500/40 bg-amber-500/25 px-2.5 py-1.5 text-amber-950 backdrop-blur-md hover:bg-amber-500/30 dark:text-amber-100",
  legal: "border-violet-500/40 bg-violet-500/25 px-2.5 py-1.5 text-violet-950 backdrop-blur-md hover:bg-violet-500/30 dark:text-violet-100",
  won: "border-emerald-500/40 bg-emerald-500/25 px-2.5 py-1.5 text-emerald-950 backdrop-blur-md hover:bg-emerald-500/30 dark:text-emerald-100",
  lost: "border-red-500/40 bg-red-500/25 px-2.5 py-1.5 text-red-950 backdrop-blur-md hover:bg-red-500/30 dark:text-red-100",
}

function emptyLeadState(): LeadStatusState { return { pending: [], contacted: [], unqualified: [], qualified: [] } }
function emptyPageState(): LeadPageState { return { pending: 0, contacted: 0, unqualified: 0, qualified: 0 } }
function firstPageState(): LeadPageState { return { pending: 1, contacted: 1, unqualified: 1, qualified: 1 } }
function lastPageState(): LeadLastPageState { return { pending: 1, contacted: 1, unqualified: 1, qualified: 1 } }
function emptyLoadingState(): LeadLoadingState { return { pending: false, contacted: false, unqualified: false, qualified: false } }
function emptyTotalState(): LeadTotalState { return { pending: 0, contacted: 0, unqualified: 0, qualified: 0 } }
function uniqueLeads(leads: Lead[]) {
  const seen = new Set<number>()
  return leads.filter((lead) => {
    if (lead.id === undefined) return true
    if (seen.has(lead.id)) return false
    seen.add(lead.id)
    return true
  })
}

function statusFor(value: string): LeadStatus | undefined { return statuses.some((item) => item.value === value) ? value as LeadStatus : undefined }

export function LeadsKanbanPage() {
  const { can, isSuper, user } = useAuth()
  const isAgentUser = user?.roles?.some((role) => role.name.toLowerCase() === "agent") === true
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(true)
  const selectedLeadId = Number(searchParams.get("record") ?? "") || null
  const setSelectedLeadId = (id: number | null) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (id === null) next.delete("record")
    else next.set("record", String(id))
    return next
  })
  const query = searchParams.get("q") ?? ""
  const statusFilter = searchParams.get("status") ?? ""
  const sourceFilter = searchParams.get("source") ?? ""
  const assignedAgentFilter = searchParams.get("assigned_agent") ?? ""
  const assignedAgentId = Number(assignedAgentFilter) || 0
  const statusFilters = statusFilter ? statusFilter.split(",").filter((value) => statuses.some((status) => status.value === value)) : []
  const [queryInput, setQueryInput] = useState(query)
  const [leads, setLeads] = useState<LeadStatusState>(() => emptyLeadState())
  const [stats, setStats] = useState<LeadStats>({})
  const [statsLoading, setStatsLoading] = useState(true)
  const [pages, setPages] = useState<LeadPageState>(() => emptyPageState())
  const [lastPages, setLastPages] = useState<LeadLastPageState>(() => lastPageState())
  const [loading, setLoading] = useState<LeadLoadingState>(() => emptyLoadingState())
  const [loadingMore, setLoadingMore] = useState<LeadLoadingState>(() => emptyLoadingState())
  const [totals, setTotals] = useState<LeadTotalState>(() => emptyTotalState())
  const [error, setError] = useState("")
  const [movingId, setMovingId] = useState<number | null>(null)
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null)
  const [selectedLeadLoading, setSelectedLeadLoading] = useState(false)
  const [selectedLeadError, setSelectedLeadError] = useState("")
  const [previewDeals, setPreviewDeals] = useState<Deal[]>([])
  const [previewDealsTotal, setPreviewDealsTotal] = useState(0)
  const [previewDealsLoading, setPreviewDealsLoading] = useState(false)
  const [previewDealsError, setPreviewDealsError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingLead, setDeletingLead] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [updatingLeadInfo, setUpdatingLeadInfo] = useState(false)
  const [updatingLeadStatus, setUpdatingLeadStatus] = useState<number | null>(null)
  const [updatingLeadAgent, setUpdatingLeadAgent] = useState<number | null>(null)
  const [updatingLeadAccount, setUpdatingLeadAccount] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creatingLead, setCreatingLead] = useState(false)
  const [createError, setCreateError] = useState("")
  const createForm = useForm<LeadFormValues>({ resolver: zodResolver(leadSchema), defaultValues: emptyValues })

  const loadColumn = useCallback(async (status: LeadStatus, nextPage: number, append: boolean, signal?: AbortSignal) => {
    const loadingSetter = append ? setLoadingMore : setLoading
    loadingSetter((current) => ({ ...current, [status]: true }))
    setError("")
    try {
      const endpoint = listUrl(`${API_BASE_URL}/v1/leads`, { page: nextPage, per_page: 5, q: query, status, source: sourceFilter, assigned_agent: assignedAgentId || undefined })
      const body = await apiJson<LeadResponse>(endpoint, { signal })
      setLeads((current) => ({ ...current, [status]: uniqueLeads(append ? [...current[status], ...body.data] : body.data) }))
      setPages((current) => ({ ...current, [status]: body.meta?.current_page ?? nextPage }))
      setLastPages((current) => ({ ...current, [status]: body.meta?.last_page ?? nextPage }))
      setTotals((current) => ({ ...current, [status]: body.meta?.total ?? body.data.length }))
      setStats(body.analytics?.stats ?? body.stats ?? {})
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load leads.")
    } finally {
      if (!signal?.aborted) loadingSetter((current) => ({ ...current, [status]: false }))
    }
  }, [assignedAgentId, query, sourceFilter])

  const refreshLeads = () => {
    setStatsLoading(true)
    void Promise.all(statuses.map((status) => loadColumn(status.value, 1, false))).finally(() => setStatsLoading(false))
  }

  useEffect(() => {
    if (!can("lead.view")) return
    const controller = new AbortController()
    setLeads(emptyLeadState())
    setPages(firstPageState())
    setLastPages(lastPageState())
    setTotals(emptyTotalState())
    setStats({})
    setStatsLoading(true)
    void Promise.all(statuses.map((status) => loadColumn(status.value, 1, false, controller.signal))).finally(() => {
      if (!controller.signal.aborted) setStatsLoading(false)
    })
    return () => controller.abort()
  }, [can, loadColumn])

  useEffect(() => {
    if (selectedLeadId === null) return
    const controller = new AbortController()
    setSelectedLead(null)
    setSelectedLeadLoading(true)
    setSelectedLeadError("")
    setUpdatingLeadAgent(null)
    setUpdatingLeadAccount(null)
    void apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads/${selectedLeadId}`, { signal: controller.signal }).then((body) => {
      setSelectedLead(body.lead)
    }).catch((caught) => {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setSelectedLeadError(caught instanceof Error ? caught.message : "Unable to load lead details.")
    }).finally(() => {
      if (!controller.signal.aborted) setSelectedLeadLoading(false)
    })
    return () => controller.abort()
  }, [selectedLeadId])

  useEffect(() => {
    const contactId = selectedLead?.contact?.id
    if (selectedLeadId === null || contactId === undefined) {
      setPreviewDeals([])
      setPreviewDealsTotal(0)
      setPreviewDealsLoading(false)
      setPreviewDealsError("")
      return
    }
    const controller = new AbortController()
    setPreviewDeals([])
    setPreviewDealsTotal(0)
    setPreviewDealsLoading(true)
    setPreviewDealsError("")
    void apiJson<DealListResponse>(listUrl(`${API_BASE_URL}/v1/deals`, { page: 1, per_page: 4, contact: contactId }), { signal: controller.signal }).then((body) => {
      setPreviewDeals(body.data)
      setPreviewDealsTotal(body.meta?.total ?? body.data.length)
    }).catch((caught) => {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setPreviewDealsError(caught instanceof Error ? caught.message : "Unable to load deals.")
    }).finally(() => {
      if (!controller.signal.aborted) setPreviewDealsLoading(false)
    })
    return () => controller.abort()
  }, [selectedLead?.contact?.id, selectedLeadId])

  const loadAgentOptions = useCallback(async (agentQuery: string, page: number, signal: AbortSignal): Promise<SearchableResourcePage> => {
    const body = await apiJson<Paginated<User>>(listUrl(`${API_BASE_URL}/v1/users`, { page, per_page: 30, q: agentQuery.trim() }), { signal })
    return {
      options: body.data.flatMap((user) => user.id === undefined ? [] : [{ id: user.id, label: user.name, description: ``, data: user }]),
      currentPage: body.meta.current_page,
      lastPage: body.meta.last_page,
    }
  }, [])

  const loadAccountOptions = useCallback(async (accountQuery: string, page: number, signal: AbortSignal): Promise<SearchableResourcePage> => {
    const body = await apiJson<AccountListResponse>(listUrl(`${API_BASE_URL}/v1/accounts`, { page, q: accountQuery.trim() }), { signal })
    const accounts = body.data ?? body.accounts ?? []
    return {
      options: accounts.map((account) => ({ id: account.id, label: account.name, description: account.industry, data: account })),
      currentPage: body.meta?.current_page ?? page,
      lastPage: body.meta?.last_page ?? page,
    }
  }, [])

  useEffect(() => { setQueryInput(query) }, [query])
  useEffect(() => {
    if (queryInput === query) return
    const timeout = window.setTimeout(() => setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (queryInput) next.set("q", queryInput)
      else next.delete("q")
      return next
    }), 500)
    return () => window.clearTimeout(timeout)
  }, [query, queryInput, setSearchParams])

  const updateFilter = (key: "status" | "source" | "assigned_agent", value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set(key, value)
    else next.delete(key)
    return next
  })
  const toggleStatusFilter = (status: LeadStatus) => updateFilter("status", statusFilters.includes(status) ? statusFilters.filter((value) => value !== status).join(",") : [...statusFilters, status].join(","))
  const clearFilters = () => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    ["q", "status", "source", "assigned_agent"].forEach((key) => next.delete(key))
    return next
  })

  const allLeads = useMemo(() => statuses.flatMap((status) => leads[status.value]), [leads])
  const openLeadPreview = (lead: Lead) => {
    if (lead.id === undefined) return
    setSelectedLead(null)
    setSelectedLeadLoading(true)
    setSelectedLeadError("")
    setPreviewDeals([])
    setPreviewDealsTotal(0)
    setPreviewDealsLoading(false)
    setPreviewDealsError("")
    setSelectedLeadId(lead.id)
  }
  const closeLeadPreview = () => {
    setSelectedLeadId(null)
    setSelectedLead(null)
    setSelectedLeadLoading(false)
    setSelectedLeadError("")
    setDeleteOpen(false)
    setDeleteError("")
    setUpdatingLeadAgent(null)
    setUpdatingLeadAccount(null)
    setPreviewDeals([])
    setPreviewDealsLoading(false)
    setPreviewDealsError("")
  }

  function requestDeleteLead() {
    if (!can("lead.delete") || !selectedLead || selectedLead.id === undefined || selectedLead.contact) return
    setDeleteError("")
    setDeleteOpen(true)
  }

  async function deleteLead() {
    if (!can("lead.delete") || !selectedLead || selectedLead.id === undefined || selectedLead.contact) return
    const deletedLead = selectedLead
    const deletedStatus = statusFor(deletedLead.status)
    setDeletingLead(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/leads/${deletedLead.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      if (deletedStatus) {
        setLeads((current) => ({ ...current, [deletedStatus]: current[deletedStatus].filter((lead) => lead.id !== deletedLead.id) }))
        setTotals((current) => ({ ...current, [deletedStatus]: Math.max(0, current[deletedStatus] - 1) }))
        setStats((current) => ({ ...current, [statKey(deletedStatus)]: Math.max(0, statCount(current, deletedStatus) - 1) }))
      }
      setDeleteOpen(false)
      closeLeadPreview()
      toast.success("Lead deleted.")
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this lead.")
    } finally {
      setDeletingLead(false)
    }
  }

  async function updateLeadInfo(values: LeadInfoValues) {
    if (!selectedLead || selectedLead.id === undefined) return false
    const name = values.name.trim()
    const email = values.email.trim()
    const phone = values.phone.trim()
    if (!name) { toast.error("Name is required."); return false }
    if (!phone) { toast.error("Phone is required."); return false }
    if (!selectedLead.contact && !email) { toast.error("Email is required for a lead."); return false }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { toast.error("Enter a valid email address."); return false }
    setUpdatingLeadInfo(true)
    try {
      if (selectedLead.contact) {
        if (selectedLead.contact.id === undefined) { toast.error("This contact cannot be updated because its ID is missing."); return false }
        const accountId = selectedLead.contact.account?.id
        if (accountId === undefined) { toast.error("This contact cannot be updated because its account ID is missing."); return false }
        const payload: LeadContactUpdatePayload = { name, phone, account_id: accountId, title: values.title.trim() || null, email: email || null, _method: "PUT" }
        const result = await apiJson<{ contact: ContactComponents["schemas"]["Contact"] }>(`${API_BASE_URL}/v1/contacts/${selectedLead.contact.id}`, { method: "POST", body: JSON.stringify(payload) })
        const savedContact = result.contact
        setSelectedLead((current) => current?.contact ? { ...current, contact: { ...current.contact, name: savedContact.name, title: savedContact.title, email: savedContact.email, phone: savedContact.phone } } : current)
        setLeads((current) => Object.fromEntries(statuses.map((status) => [status.value, current[status.value].map((item) => item.id === selectedLead.id ? { ...item, contact: item.contact ? { ...item.contact, name: savedContact.name, title: savedContact.title, email: savedContact.email, phone: savedContact.phone } : item.contact } : item)])) as LeadStatusState)
      } else {
        const payload: LeadUpdateRequest = { name, email, phone, status: selectedLead.status, city: values.city.trim(), address: values.address.trim() || null, company_name: values.companyName.trim() || null, source: selectedLead.source ?? null, _method: "PUT" }
        const result = await apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads/${selectedLead.id}`, { method: "POST", body: JSON.stringify(payload) })
        setSelectedLead(result.lead)
        setLeads((current) => Object.fromEntries(statuses.map((status) => [status.value, current[status.value].map((item) => item.id === selectedLead.id ? { ...item, ...result.lead } : item)])) as LeadStatusState)
      }
      toast.success("Information saved.")
      return true
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to save the information.")
      return false
    } finally {
      setUpdatingLeadInfo(false)
    }
  }

  async function updateLeadName(name: string) {
    if (!selectedLead) return false
    return updateLeadInfo({ ...leadInfoValues(selectedLead), name })
  }

  async function moveLead({ event, activeContainer, activeIndex, overContainer, overIndex }: KanbanMoveEvent) {
    if (!can("lead.edit")) return
    const id = Number(event.active.id)
  const lead = allLeads.find((item) => item.id === id)
    const previousStatus = statusFor(activeContainer)
    const nextStatus = statusFor(overContainer)
    if (!lead || lead.id === undefined || !previousStatus || !nextStatus || previousStatus === nextStatus) return
    if (nextStatus === "qualified" && (!lead.company_name?.trim() || !(lead.assigned_agent_id ?? lead.assigned_agent?.id))) {
      toast.error("Add a company and assign an agent before qualifying this lead.")
      return
    }
    setMovingId(id)
    setLeads((current) => ({
      ...current,
      [previousStatus]: current[previousStatus].filter((item) => item.id !== id),
      [nextStatus]: (() => { const nextLeads = current[nextStatus].filter((item) => item.id !== id); nextLeads.splice(Math.min(Math.max(overIndex, 0), nextLeads.length), 0, { ...lead, status: nextStatus }); return nextLeads })(),
    }))
    try {
      await apiJson<{ lead: Lead }>(`${API_BASE_URL}/v1/leads/${id}`, { method: "POST", body: JSON.stringify({ status: nextStatus, _method: "PUT" }) })
      setStats((current) => ({ ...current, [statKey(previousStatus)]: Math.max(0, statCount(current, previousStatus) - 1), [statKey(nextStatus)]: statCount(current, nextStatus) + 1 }))
    } catch (caught) {
      setLeads((current) => ({
        ...current,
        [nextStatus]: current[nextStatus].filter((item) => item.id !== id),
        [previousStatus]: (() => { const previousLeads = current[previousStatus].filter((item) => item.id !== id); previousLeads.splice(Math.min(Math.max(activeIndex, 0), previousLeads.length), 0, { ...lead, status: previousStatus }); return previousLeads })(),
      }))
      toast.error(caught instanceof Error ? caught.message : "Unable to update the lead status.")
    } finally { setMovingId(null) }
  }

  async function updateLeadStatus(nextStatus: LeadStatus) {
    if (!can("lead.edit") || !selectedLead || selectedLead.id === undefined) return
    const previousStatus = statusFor(selectedLead.status)
    if (!previousStatus || previousStatus === nextStatus) return
    if (nextStatus === "qualified" && (!selectedLead.company_name?.trim() || !(selectedLead.assigned_agent_id ?? selectedLead.assigned_agent?.id))) {
      toast.error("Add a company and assign an agent before qualifying this lead.")
      return
    }
    const id = selectedLead.id
    const boardLead = allLeads.find((item) => item.id === id) ?? selectedLead
    const previousIndex = leads[previousStatus].findIndex((item) => item.id === id)
    setUpdatingLeadStatus(id)
    setSelectedLead((current) => current ? { ...current, status: nextStatus } : current)
    setLeads((current) => ({
      ...current,
      [previousStatus]: current[previousStatus].filter((item) => item.id !== id),
      [nextStatus]: [...current[nextStatus].filter((item) => item.id !== id), { ...boardLead, status: nextStatus }],
    }))
    setTotals((current) => ({ ...current, [previousStatus]: Math.max(0, current[previousStatus] - 1), [nextStatus]: current[nextStatus] + 1 }))
    try {
      await apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads/${id}`, { method: "POST", body: JSON.stringify({ status: nextStatus, _method: "PUT" }) })
      setStats((current) => ({ ...current, [statKey(previousStatus)]: Math.max(0, statCount(current, previousStatus) - 1), [statKey(nextStatus)]: statCount(current, nextStatus) + 1 }))
    } catch (caught) {
      setSelectedLead((current) => current ? { ...current, status: previousStatus } : current)
      setLeads((current) => ({
        ...current,
        [nextStatus]: current[nextStatus].filter((item) => item.id !== id),
        [previousStatus]: (() => { const previousLeads = current[previousStatus].filter((item) => item.id !== id); previousLeads.splice(Math.min(Math.max(previousIndex, 0), previousLeads.length), 0, { ...boardLead, status: previousStatus }); return previousLeads })(),
      }))
      setTotals((current) => ({ ...current, [previousStatus]: current[previousStatus] + 1, [nextStatus]: Math.max(0, current[nextStatus] - 1) }))
      toast.error(caught instanceof Error ? caught.message : "Unable to update the lead status.")
    } finally { setUpdatingLeadStatus(null) }
  }

  async function updateLeadAgent(agentId: number, option?: SearchableResourceOption) {
    if (!can("lead.edit") || !selectedLead || selectedLead.id === undefined) return
    const id = selectedLead.id
    const previousAgentId = selectedLead.assigned_agent_id ?? selectedLead.assigned_agent?.id ?? null
    const previousAgent = selectedLead.assigned_agent
    const optionUser = option?.data as User | undefined
    const nextAgent = option ? { id: option.id, name: option.label, username: optionUser?.username ?? option.label, email: optionUser?.email ?? "" } : undefined
    const updateAgent = <T extends Lead>(lead: T, assignedAgentId: number | null, assignedAgent: Lead["assigned_agent"] | undefined): T => ({ ...lead, assigned_agent_id: assignedAgentId, assigned_agent: assignedAgent })
    const boardLead = allLeads.find((item) => item.id === id)
    setUpdatingLeadAgent(id)
    setSelectedLead((current) => current ? updateAgent(current, agentId, nextAgent) : current)
    setLeads((current) => Object.fromEntries(statuses.map((status) => [status.value, current[status.value].map((lead) => lead.id === id ? updateAgent(lead, agentId, nextAgent) : lead)])) as LeadStatusState)
    try {
      const result = await apiJson<LeadEnvelope>(`${API_BASE_URL}/v1/leads/${id}`, { method: "POST", body: JSON.stringify({ assigned_agent_id: agentId, _method: "PUT" }) })
      const savedAgent = result.lead.assigned_agent ?? nextAgent
      setSelectedLead((current) => current ? updateAgent(current, result.lead.assigned_agent_id ?? agentId, savedAgent) : current)
      setLeads((current) => Object.fromEntries(statuses.map((status) => [status.value, current[status.value].map((lead) => lead.id === id ? updateAgent(lead, result.lead.assigned_agent_id ?? agentId, savedAgent) : lead)])) as LeadStatusState)
    } catch (caught) {
      setSelectedLead((current) => current ? updateAgent(current, previousAgentId, previousAgent) : current)
      if (boardLead) setLeads((current) => Object.fromEntries(statuses.map((status) => [status.value, current[status.value].map((lead) => lead.id === id ? updateAgent(lead, previousAgentId, previousAgent) : lead)])) as LeadStatusState)
      toast.error(caught instanceof Error ? caught.message : "Unable to update the assigned agent.")
    } finally { setUpdatingLeadAgent(null) }
  }

  async function updateLeadAccount(accountId: number, option?: SearchableResourceOption) {
    if (!can("contact.edit") || !selectedLead?.contact || selectedLead.contact.id === undefined) return
    const contact = selectedLead.contact
    const previousAccount = contact.account
    const optionAccount = option?.data as Account | undefined
    const nextAccount = option ? { id: option.id, name: option.label, image: optionAccount?.image } : undefined
    setUpdatingLeadAccount(selectedLead.id ?? null)
    setSelectedLead((current) => current?.contact ? { ...current, contact: { ...current.contact, account: nextAccount } } : current)
    try {
      await apiJson<{ contact: ContactComponents["schemas"]["Contact"] }>(`${API_BASE_URL}/v1/contacts/${contact.id}`, {
        method: "POST",
        body: JSON.stringify({ name: contact.name, title: contact.title ?? null, email: contact.email ?? null, phone: contact.phone, account_id: accountId, _method: "PUT" }),
      })
    } catch (caught) {
      setSelectedLead((current) => current?.contact ? { ...current, contact: { ...current.contact, account: previousAccount } } : current)
      toast.error(caught instanceof Error ? caught.message : "Unable to update the account.")
    } finally { setUpdatingLeadAccount(null) }
  }

  function openCreateLead() {
    createForm.reset(emptyValues)
    setCreateError("")
    setCreateOpen(true)
  }

  function closeCreateLead() {
    if (creatingLead) return
    setCreateOpen(false)
    setCreateError("")
    createForm.reset(emptyValues)
  }

  const submitCreateLead = createForm.handleSubmit(async (values) => {
    setCreatingLead(true)
    setCreateError("")
    try {
      const payload: LeadCreateRequest = {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        status: "pending",
        city: values.city.trim(),
        address: values.address.trim() || null,
        company_name: values.company_name.trim() || null,
        source: values.source || null,
      }
      await apiJson<{ lead: Lead }>(`${API_BASE_URL}/v1/leads`, { method: "POST", body: JSON.stringify(payload) })
      setCreateOpen(false)
      createForm.reset(emptyValues)
      await Promise.all(statuses.map((status) => loadColumn(status.value, 1, false)))
      toast.success("Lead created.")
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => createForm.setError(field as keyof LeadFormValues, { message: messages[0] }))
      setCreateError(caught instanceof Error ? caught.message : "Unable to create this lead.")
    } finally {
      setCreatingLead(false)
    }
  })

  if (!can("lead.view")) return <ErrorState kind="forbidden" title="Lead access is restricted" description="You do not have permission to view leads." actionLabel="Return to overview" actionTo="/" />
  const progressTotal = statuses.reduce((sum, status) => sum + statCount(stats, status.value), 0)
  const progressSegments = statuses.map((status) => {
    const value = statCount(stats, status.value)
    return { status, value }
  })
  const progressGridColumns = progressTotal > 0 ? progressSegments.map(({ value }) => value > 0 ? `${value}fr` : "0fr").join(" ") : "repeat(4, minmax(0, 1fr))"
  const lastProgressLabelIndex = progressSegments.reduce((lastIndex, segment, index) => segment.value > 0 ? index : lastIndex, -1)
  const hasFilters = Boolean(query || statusFilter || sourceFilter || assignedAgentFilter)
  const hasLoading = Object.values(loading).some(Boolean)
  const displayedStatuses = statusFilters.length ? statuses.filter((status) => statusFilters.includes(status.value)) : statuses
  let visibleLeadCount = 0
  displayedStatuses.forEach((status) => { visibleLeadCount += leads[status.value].length })

  return <div className="space-y-6 p-6 lg:p-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Leads</h1><p className="mt-1 text-sm text-muted-foreground">Capture and qualify the next conversation.</p></div>
    <section className="rounded-md bg-card p-4 shadow-sm" aria-label="Lead status distribution">
      {statsLoading ? <LeadStatusDistributionSkeleton /> : <div className="relative grid w-full min-w-0 items-end pt-0" role="img" aria-label="Lead status distribution" style={{ gridTemplateColumns: progressGridColumns }}>
          <div className="absolute inset-x-0 bottom-0 h-2 rounded-full bg-muted" />
          {progressSegments.map(({ status, value }, index) => <div key={status.value} className="relative z-10 min-w-0">
            {value > 0 && index !== lastProgressLabelIndex && <span className="pointer-events-none block min-w-0 mb-4 break-words font-mono text-xs font-semibold tabular-nums text-foreground">{value} {status.label}</span>}
            <div className={`mt-0 h-2 w-full ${status.color} transition-[width] ${index === 0 ? "rounded-s-full" : ""} ${index === progressSegments.length - 1 ? "rounded-e-full" : ""}`} title={`${status.label}: ${value}`} />
          </div>)}
          {lastProgressLabelIndex >= 0 && <span className="pointer-events-none absolute end-0 top-0 z-20 whitespace-nowrap text-end font-mono text-xs font-semibold tabular-nums text-foreground">{progressSegments[lastProgressLabelIndex].value} {progressSegments[lastProgressLabelIndex].status.label}</span>}
      </div>}
    </section>
    <div className="relative">
      <div className="flex items-end justify-between gap-4">
        <div className="filter-tab filter-tab-roundout ms-3">
          <button type="button" aria-expanded={filtersOpen} aria-controls="leads-filter-panel" onClick={() => setFiltersOpen((open) => !open)} className="filter-tab-roundout-button inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors"><Funnel className="size-3.5" aria-hidden="true" /><span>Filter</span><motion.span animate={{ rotate: filtersOpen ? 180 : 0 }} transition={filterMotionTransition} className="inline-flex"><ChevronDown className="size-4" aria-hidden="true" /></motion.span></button>
        </div>
        <div className="mb-1 flex shrink-0 gap-2">
          <Button type="button" variant="outline" className="shrink-0" onClick={refreshLeads} disabled={statsLoading || Object.values(loading).some(Boolean) || Object.values(loadingMore).some(Boolean)}><RefreshCw className="size-4" />Refresh</Button>
          {can("lead.create") && <Button type="button" variant="outline" aria-label="Add new lead" onClick={openCreateLead}><Plus className="size-4" />Add new lead</Button>}
        </div>
      </div>
      <motion.div initial={false} animate={{ height: filtersOpen ? "auto" : 0 }} transition={filterSlideTransition} className="overflow-hidden">
        <div className="search-filter-card rounded-md bg-muted/60 shadow-sm dark:bg-muted/70">
          <div className="p-4">
            <div id="leads-filter-panel" aria-hidden={!filtersOpen}>
              <div className={`grid gap-3 pb-4 md:items-end ${isAgentUser ? "md:grid-cols-[minmax(0,1fr)_minmax(8rem,10rem)_9rem]" : "md:grid-cols-[minmax(0,1fr)_minmax(8rem,10rem)_9rem_minmax(13rem,16rem)]"}`}><div className="md:w-1/4 md:min-w-64"><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-kanban-search">Search leads</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="lead-kanban-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name, email, or phone" /></div></div><div><label className="text-xs font-medium text-muted-foreground">Status</label><ButtonGroup aria-label="Filter by status" className="mt-1 max-w-full overflow-hidden rounded-lg border border-input bg-transparent dark:bg-input/30">{statuses.map((status) => { const selected = statusFilters.includes(status.value); return <Tooltip key={status.value}><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label={status.label} aria-pressed={selected} onClick={() => toggleStatusFilter(status.value)} className={selected ? `${status.wash} ${status.text}` : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}><span className={`size-2.5 rounded-full ${status.color}`} /></Button></TooltipTrigger><TooltipContent side="top">{status.label}</TooltipContent></Tooltip> })}</ButtonGroup></div><div><label className="text-xs font-medium text-muted-foreground" htmlFor="lead-kanban-source">Source</label><Select value={sourceFilter || "all"} onValueChange={(value) => updateFilter("source", value === "all" ? "" : value)}><SelectTrigger id="lead-kanban-source" className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{sources.map((source) => <SelectItem key={source} value={source}><SourceOption source={source} /></SelectItem>)}</SelectContent></Select></div>{!isAgentUser && <SearchableResourcePicker id="lead-kanban-agent" label="Assigned agent" labelStyle="plain" value={assignedAgentId} onChange={(value) => updateFilter("assigned_agent", value ? String(value) : "")} loadOptions={loadAgentOptions} placeholder="All agents" searchPlaceholder="Search agents…" loadingLabel="Loading agents…" emptyLabel="No agents found." noResultsLabel="No agents match your search." renderOption={(option) => <AgentOption option={option} />} renderSelectedOption={(option) => <AgentOption option={option} />} />}</div>
              {hasFilters && <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button></div>}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
    {error && <div role="alert" className="bg-destructive/5 p-3 text-sm text-destructive">{error}<Button variant="link" size="sm" className="ms-2 h-auto px-0 text-destructive" onClick={() => statuses.forEach((status) => void loadColumn(status.value, 1, false))}>Try again</Button></div>}
    <Kanban value={leads} onValueChange={() => {}} getItemValue={(item) => String(item.id)} onMove={(event) => void moveLead(event)}><KanbanBoard>{displayedStatuses.map((status) => <LeadColumn key={status.value} status={status} leads={leads[status.value]} total={totals[status.value]} loading={loading[status.value]} loadingMore={loadingMore[status.value]} canLoadMore={pages[status.value] < lastPages[status.value]} onLoadMore={() => void loadColumn(status.value, pages[status.value] + 1, true)} movingId={movingId} canEdit={can("lead.edit")} onOpenLead={openLeadPreview} />)}</KanbanBoard><KanbanOverlay>{({ value, width }) => { const lead = allLeads.find((item) => String(item.id) === value); return lead ? <LeadCardOverlay lead={lead} width={width} /> : null }}</KanbanOverlay></Kanban>
    <LeadPreviewDialog open={selectedLeadId !== null} lead={selectedLead} loading={selectedLeadLoading} error={selectedLeadError} deals={previewDeals} dealsTotal={previewDealsTotal} dealsLoading={previewDealsLoading} dealsError={previewDealsError} isSuper={isSuper} canEdit={can("lead.edit")} canDelete={can("lead.delete")} canEditInfo={selectedLead?.contact ? can("contact.edit") : can("lead.edit")} canEditAccount={can("contact.edit")} updatingStatus={updatingLeadStatus === selectedLead?.id} updatingAgent={updatingLeadAgent === selectedLead?.id} updatingAccount={updatingLeadAccount === selectedLead?.id} updatingInfo={updatingLeadInfo} deleting={deletingLead} loadAgentOptions={loadAgentOptions} loadAccountOptions={loadAccountOptions} onStatusChange={(status) => void updateLeadStatus(status)} onAgentChange={(agentId, option) => void updateLeadAgent(agentId, option)} onAccountChange={(accountId, option) => void updateLeadAccount(accountId, option)} onInfoSave={updateLeadInfo} onNameSave={updateLeadName} onDelete={requestDeleteLead} onOpenChange={(open) => { if (!open) closeLeadPreview() }} />
    <Dialog open={createOpen} onOpenChange={(open) => open ? setCreateOpen(true) : closeCreateLead()}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] max-h-[80vh] min-w-3xl max-w-5xl overflow-hidden">
        <DialogHeader><DialogTitle>Create lead</DialogTitle></DialogHeader>
        {createError && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{createError}</div>}
        <div className="min-h-0 overflow-y-auto overscroll-contain pe-1">
          <LeadForm create modal form={createForm} formId="lead-create-modal-form" title="Create lead" saving={creatingLead} onCancel={closeCreateLead} onSubmit={submitCreateLead} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={closeCreateLead} disabled={creatingLead}>Cancel</Button><Button type="submit" form="lead-create-modal-form" disabled={creatingLead}>{creatingLead ? "Creating…" : "Create"}</Button></div>
      </DialogContent>
    </Dialog>
    <ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deletingLead) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${selectedLead?.name ?? "this lead"}?`} description={<>This permanently removes {selectedLead?.name ?? "this lead"}. This action cannot be undone.</>} confirmLabel="Delete lead" pending={deletingLead} error={deleteError} onConfirm={deleteLead} />
    {!hasLoading && !visibleLeadCount && <div className="px-5 py-12 text-center text-sm text-muted-foreground">{hasFilters ? "No leads match these filters." : "No leads found."}</div>}
  </div>
}

function LeadColumn({ status, leads, total, loading, loadingMore, canLoadMore, onLoadMore, movingId, canEdit, onOpenLead }: { status: typeof statuses[number]; leads: Lead[]; total: number; loading: boolean; loadingMore: boolean; canLoadMore: boolean; onLoadMore: () => void; movingId: number | null; canEdit: boolean; onOpenLead: (lead: Lead) => void }) {
  const [headerStuck, setHeaderStuck] = useState(false)
  const columnTopRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const sentinel = columnTopRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => setHeaderStuck(!entry.isIntersecting), { rootMargin: "-1px 0px 0px 0px", threshold: 0 })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const visibleLeads = uniqueLeads(leads)
  return <KanbanColumn value={status.value}><span ref={columnTopRef} className="pointer-events-none absolute top-0 size-px" aria-hidden="true" /><header className={`sticky top-0 z-10 flex items-center justify-between rounded-t-xl bg-card px-3 py-3 transition-shadow duration-200 ${headerStuck ? "shadow-[0_6px_10px_-6px_rgb(15_23_42_/_0.35)]" : ""}`}><div className="flex min-w-0 items-center gap-2"><span className={`size-2 rounded-full ${status.color}`} /><h2 className={`truncate text-sm font-semibold ${status.text}`}>{status.shortLabel}</h2></div><Badge variant="secondary" className="font-mono text-xs tabular-nums">{total}</Badge></header><KanbanColumnContent value={status.value}>{loading && !visibleLeads.length ? <ColumnSkeleton /> : visibleLeads.map((lead, index) => <Fragment key={`${status.value}-${lead.id ?? `${lead.email}-${lead.phone}-${index}`}`}><KanbanDropPlaceholder value={status.value} index={index}><LeadCardPlaceholder /></KanbanDropPlaceholder><LeadCard lead={lead} moving={movingId === lead.id} canEdit={canEdit} onOpen={() => onOpenLead(lead)} /></Fragment>)}<KanbanDropPlaceholder value={status.value} index={visibleLeads.length}><LeadCardPlaceholder /></KanbanDropPlaceholder>{!loading && !visibleLeads.length && <div className="flex flex-col items-center justify-center px-3 py-10 text-center text-muted-foreground"><span className="mb-2 flex size-9 items-center justify-center rounded-full bg-background/80 shadow-sm"><Inbox className="size-4" aria-hidden="true" /></span><p className="text-xs font-medium text-foreground/70">No leads in this stage.</p></div>}<ColumnLoadTrigger enabled={canLoadMore} loading={loadingMore} onLoadMore={onLoadMore} /></KanbanColumnContent></KanbanColumn>
}

function LeadCard({ lead, moving = false, canEdit = false, onOpen }: { lead: Lead; moving?: boolean; canEdit?: boolean; onOpen: () => void }) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const pointerMoved = useRef(false)
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    pointerStart.current = { x: event.clientX, y: event.clientY }
    pointerMoved.current = false
  }
  const handlePointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current || pointerMoved.current) return
    pointerMoved.current = Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y) >= 8
  }
  const handlePointerUpCapture = () => {
    const shouldOpen = pointerStart.current !== null && !pointerMoved.current
    pointerStart.current = null
    pointerMoved.current = false
    if (shouldOpen) onOpen()
  }
  return <KanbanItem value={String(lead.id)} disabled={!canEdit} placeholder={<LeadCardPlaceholder />} onPointerDownCapture={handlePointerDownCapture} onPointerMoveCapture={handlePointerMoveCapture} onPointerUpCapture={handlePointerUpCapture}><KanbanItemHandle><LeadCardContent lead={lead} moving={moving} /></KanbanItemHandle></KanbanItem>
}

function LeadCardOverlay({ lead, width }: { lead: Lead; width: number | null }) {
  return <div className="rotate-1" style={width !== null ? { width } : undefined}><LeadCardContent lead={lead} /></div>
}

function LeadCardContent({ lead, moving = false }: { lead: Lead; moving?: boolean }) {
  const displayName = lead.contact?.name ?? lead.name
  const displayPhone = lead.contact ? lead.contact.phone : lead.phone
  const displayEmail = lead.contact ? lead.contact.email : lead.email
  return <article className={`w-full rounded-xl bg-background p-3 shadow-md ${moving ? "opacity-60" : ""}`}><div className="flex items-start gap-2.5"><PersonAvatar name={displayName} size="sm" /><h3 className="min-w-0 flex-1 truncate pt-0.5 text-sm font-semibold">{displayName}</h3></div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground">{displayPhone && <span className="flex items-center gap-2 truncate"><Phone className="size-3 shrink-0" aria-hidden="true" />{displayPhone}</span>}{displayEmail && <span className="flex items-center gap-2 truncate"><Mail className="size-3 shrink-0" aria-hidden="true" />{displayEmail}</span>}</div><footer className="-mx-3 -mb-3 mt-3 flex items-center justify-between rounded-b-xl bg-foreground/10 px-3 py-2.5">{lead.source ? <span aria-label={`Source: ${lead.source}`} className={`inline-flex items-center ${sourceBrandClass[lead.source]}`}><SourceMark source={lead.source} /></span> : <span />}{lead.assigned_agent ? <span className="flex min-w-0 items-center gap-1.5"><span className="max-w-28 truncate text-xs text-muted-foreground">{lead.assigned_agent.name}</span><PersonAvatar name={lead.assigned_agent.name} size="sm" aria-label={`Assigned agent ${lead.assigned_agent.name}`} /></span> : <span />}</footer></article>
}

function LeadTitleEditor({ displayName, canEdit, saving, onSave }: { displayName: string; canEdit: boolean; saving: boolean; onSave: (name: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayName)

  useEffect(() => {
    setDraft(displayName)
    setEditing(false)
  }, [displayName])

  const cancel = () => { setDraft(displayName); setEditing(false) }
  const save = async () => {
    const name = draft.trim()
    if (!name) { toast.error("Name is required."); return }
    if (await onSave(name)) setEditing(false)
  }

  return <div className="group flex min-w-0 items-center gap-3">
    <PersonAvatar name={displayName} size="lg" />
    <DialogTitle className={editing ? "sr-only" : "min-w-0 truncate"}>{displayName}</DialogTitle>
    {editing ? <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Input aria-label="Lead name" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save() } if (event.key === "Escape") cancel() }} disabled={saving} className="h-8 min-w-0 max-w-md flex-1" />
      <Button type="button" size="icon-sm" aria-label="Save lead name" onClick={() => void save()} disabled={saving}><Check aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel editing lead name" onClick={cancel} disabled={saving}><X aria-hidden="true" /></Button>
    </div> : canEdit && <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit lead name" className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" onClick={() => setEditing(true)}><Pencil aria-hidden="true" /></Button>}
  </div>
}

function LeadPreviewDialog({ open, lead, loading, error, deals, dealsTotal, dealsLoading, dealsError, isSuper, canEdit, canDelete, canEditInfo, canEditAccount, updatingStatus, updatingAgent, updatingAccount, updatingInfo, deleting, loadAgentOptions, loadAccountOptions, onStatusChange, onAgentChange, onAccountChange, onInfoSave, onNameSave, onDelete, onOpenChange }: { open: boolean; lead: LeadDetail | null; loading: boolean; error: string; deals: Deal[]; dealsTotal: number; dealsLoading: boolean; dealsError: string; isSuper: boolean; canEdit: boolean; canDelete: boolean; canEditInfo: boolean; canEditAccount: boolean; updatingStatus: boolean; updatingAgent: boolean; updatingAccount: boolean; updatingInfo: boolean; deleting: boolean; loadAgentOptions: (query: string, page: number, signal: AbortSignal) => Promise<SearchableResourcePage>; loadAccountOptions: (query: string, page: number, signal: AbortSignal) => Promise<SearchableResourcePage>; onStatusChange: (status: LeadStatus) => void; onAgentChange: (agentId: number, option?: SearchableResourceOption) => void; onAccountChange: (accountId: number, option?: SearchableResourceOption) => void; onInfoSave: (values: LeadInfoValues) => Promise<boolean>; onNameSave: (name: string) => Promise<boolean>; onDelete: () => void; onOpenChange: (open: boolean) => void }) {
  if (!open) return <Dialog open={false} onOpenChange={onOpenChange} />
  if (loading) return <Dialog open onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] max-w-3xl"><LeadPreviewSkeleton /></DialogContent></Dialog>
  if (error) return <Dialog open onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] max-w-3xl"><div className="space-y-2 py-4"><p className="font-medium">Unable to load lead details</p><p role="alert" className="text-sm text-destructive">{error}</p></div></DialogContent></Dialog>
  if (!lead) return <Dialog open onOpenChange={onOpenChange}><DialogContent className="max-h-[80vh] max-w-3xl"><p className="py-4 text-sm text-muted-foreground">This lead could not be loaded.</p></DialogContent></Dialog>
  const displayName = lead.contact?.name ?? lead.name
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[80vh] min-w-3xl max-w-5xl overflow-hidden">
      <DialogHeader className="pe-16"><LeadTitleEditor displayName={displayName} canEdit={canEditInfo} saving={updatingInfo} onSave={onNameSave} /></DialogHeader>
      {canDelete && (lead.contact ? <Tooltip><TooltipTrigger asChild><span tabIndex={0} className="absolute top-2 end-10 inline-flex rounded-md"><Button type="button" variant="ghost" size="icon-sm" aria-label="Delete lead" disabled className="text-destructive"><Trash2 aria-hidden="true" /></Button></span></TooltipTrigger><TooltipContent>Leads with contacts can't be deleted.</TooltipContent></Tooltip> : <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete lead" title="Delete lead" disabled={deleting} onClick={onDelete} className="absolute top-2 end-10 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 aria-hidden="true" /></Button>)}
      <ScrollArea className="max-h-[calc(80vh-5rem)]"><div className="p-4"><div className="flex flex-wrap gap-2"><LeadStatusMenu status={lead.status} canEdit={canEdit} canQualify={Boolean(lead.company_name?.trim() && (lead.assigned_agent_id ?? lead.assigned_agent?.id))} updating={updatingStatus} onChange={onStatusChange} />{lead.source && <Badge variant="secondary" className={`gap-1.5 ${sourceBrandClass[lead.source]}`}><SourceMark source={lead.source} /><span className="capitalize">{lead.source}</span></Badge>}</div><div className="mt-5 flex flex-col gap-6 lg:flex-row"><div className="min-w-0 flex-1 lg:w-2/3"><LeadInfoCard lead={lead} canEdit={canEditInfo} updating={updatingInfo} onSave={onInfoSave} /></div><aside className="min-w-0 lg:w-1/3"><LeadAgentCard lead={lead} canEdit={canEdit} updating={updatingAgent} loadOptions={loadAgentOptions} onChange={onAgentChange} /><LeadAccountCard account={lead.contact?.account} canEdit={canEditAccount && lead.contact?.id !== undefined} updating={updatingAccount} loadOptions={loadAccountOptions} onChange={onAccountChange} /></aside></div>{lead.contact?.id !== undefined && <LeadDealsPreview contactId={lead.contact.id} deals={deals} total={dealsTotal} loading={dealsLoading} error={dealsError} />}{isSuper && lead.id !== undefined && <ActivityLogList model="lead" id={lead.id} title="Lead activity" className="mt-5" />}</div></ScrollArea>
    </DialogContent>
  </Dialog>
}

function leadInfoValues(lead: LeadDetail): LeadInfoValues {
  return {
    name: lead.contact?.name ?? lead.name,
    email: lead.contact ? lead.contact.email ?? "" : lead.email,
    phone: lead.contact?.phone ?? lead.phone,
    title: lead.contact?.title ?? "",
    city: lead.city,
    address: lead.address ?? "",
    companyName: lead.company_name ?? "",
  }
}

function LeadInfoCard({ lead, canEdit, updating, onSave }: { lead: LeadDetail; canEdit: boolean; updating: boolean; onSave: (values: LeadInfoValues) => Promise<boolean> }) {
  const hasContact = Boolean(lead.contact)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<LeadInfoValues>(() => leadInfoValues(lead))

  useEffect(() => {
    setDraft(leadInfoValues(lead))
    setEditing(false)
  }, [lead])

  const update = (field: keyof LeadInfoValues) => (event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, [field]: event.target.value }))
  const cancel = () => { setDraft(leadInfoValues(lead)); setEditing(false) }
  const save = async () => { if (await onSave(draft)) setEditing(false) }

  return <div className="relative rounded-lg bg-muted/40 p-4">
    {canEdit && !editing && <Button type="button" variant="ghost" size="icon-sm" className="absolute top-2 end-2" aria-label="Edit lead information" onClick={() => setEditing(true)}><Pencil aria-hidden="true" /></Button>}
    {editing ? <div className="space-y-2.5">
      <PhoneField aria-label="Phone" placeholder="Phone" value={draft.phone} onValueChange={(value) => setDraft((current) => ({ ...current, phone: value }))} disabled={updating} />
      <InputGroup><InputGroupAddon><Mail aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Email" type="email" value={draft.email} onChange={update("email")} placeholder="Email" disabled={updating} /></InputGroup>
      {hasContact ? <InputGroup><InputGroupAddon><Briefcase aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Contact title" value={draft.title} onChange={update("title")} placeholder="Role in company" disabled={updating} /></InputGroup> : <><InputGroup><InputGroupAddon><MapPin aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="City" value={draft.city} onChange={update("city")} placeholder="City" disabled={updating} /></InputGroup><InputGroup><InputGroupAddon><MapPin aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Address" value={draft.address} onChange={update("address")} placeholder="Address" disabled={updating} /></InputGroup><InputGroup><InputGroupAddon><Building2 aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label="Company name" value={draft.companyName} onChange={update("companyName")} placeholder="Company name" disabled={updating} /></InputGroup></>}
      <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={updating}><X className="me-1.5 size-3.5" />Cancel</Button><Button type="button" size="sm" onClick={() => void save()} disabled={updating}><Save className="me-1.5 size-3.5" />{updating ? "Saving…" : "Save"}</Button></div>
    </div> : <div className="flex flex-col gap-3 pe-8 text-sm">
      {draft.phone && <a className="flex min-w-0 items-center gap-2 text-primary hover:text-foreground" href={`tel:${draft.phone}`}><Phone className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{draft.phone}</span></a>}
      {draft.email && <a className="flex min-w-0 items-center gap-2 text-primary hover:text-foreground" href={`mailto:${draft.email}`}><Mail className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{draft.email}</span></a>}
      {hasContact && draft.title && <span className="flex min-w-0 items-center gap-2"><Briefcase className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate">{draft.title}</span></span>}
      {draft.address && <span className="flex min-w-0 items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="break-words">{draft.address}</span></span>}
      {draft.city && <span className="flex min-w-0 items-center gap-2"><MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />{draft.city}</span>}
      {draft.companyName && <span className="flex min-w-0 items-center gap-2"><Building2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate">{draft.companyName}</span></span>}
    </div>}
  </div>
}

function LeadStatusMenu({ status, canEdit, canQualify, updating, onChange }: { status: LeadStatus; canEdit: boolean; canQualify: boolean; updating: boolean; onChange: (status: LeadStatus) => void }) {
  const current = statuses.find((item) => item.value === status)
  const content = <><span className={`size-2 rounded-full ${current?.color ?? "bg-muted-foreground"}`} />{current?.label ?? status}{canEdit && <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />}</>
  if (!canEdit) return <Badge variant="secondary" className="gap-1.5">{content}</Badge>
  return <DropdownMenu><DropdownMenuTrigger asChild><Badge asChild variant="secondary" className="cursor-pointer gap-1.5"><button type="button" disabled={updating} aria-label="Change lead status">{content}</button></Badge></DropdownMenuTrigger><DropdownMenuContent align="start">{statuses.map((item) => { const disabled = updating || (item.value === "qualified" && status !== "qualified" && !canQualify); return <DropdownMenuItem key={item.value} disabled={disabled} onSelect={() => onChange(item.value)}><span className={`size-2 rounded-full ${item.color}`} />{item.label}{item.value === status && <Check className="ms-auto size-3.5" aria-hidden="true" />}</DropdownMenuItem> })}</DropdownMenuContent></DropdownMenu>
}

function LeadAgentCard({ lead, canEdit, updating, loadOptions, onChange }: { lead: LeadDetail; canEdit: boolean; updating: boolean; loadOptions: (query: string, page: number, signal: AbortSignal) => Promise<SearchableResourcePage>; onChange: (agentId: number, option?: SearchableResourceOption) => void }) {
  const agent = lead.assigned_agent
  const emptyState = <div className="mt-3 flex items-center gap-2 rounded-md bg-background/60 p-2.5 text-sm text-muted-foreground"><span className="flex size-7 items-center justify-center rounded-full bg-muted"><UserRound className="size-3.5" aria-hidden="true" /></span><span>Unassigned</span></div>
  const currentOption = agent ? { id: agent.id, label: agent.name, description: `@${agent.username}`, data: agent } : undefined
  return <section className="rounded-lg bg-muted/40 p-3">{canEdit ? <div className={updating ? "pointer-events-none opacity-60" : undefined}><SearchableResourcePicker id={`lead-dialog-agent-${lead.id}`} label="Agent" labelStyle="plain" value={lead.assigned_agent_id ?? agent?.id ?? 0} selectedOption={currentOption} onChange={onChange} loadOptions={loadOptions} placeholder="Choose an agent" searchPlaceholder="Search agents…" loadingLabel="Searching agents…" emptyLabel="No agents found." noResultsLabel="No agents match your search." renderOption={(option) => <AgentOption option={option} />} renderSelectedOption={(option) => <AgentOption option={option} />} /></div> : agent ? <div className="mt-3 flex items-center gap-2"><PersonAvatar name={agent.name} size="sm" /><span className="truncate text-sm font-medium">{agent.name}</span></div> : emptyState}</section>
}

function AccountLogo({ account, className = "size-8" }: { account: Pick<Account, "name" | "image">; className?: string }) { return account.image ? <img src={account.image.thumbnail_url || account.image.url} alt={`${account.name} logo`} className={`${className} shrink-0 rounded-md border border-border bg-white object-contain p-1 dark:bg-white`} /> : <span className={`grid ${className} shrink-0 place-items-center rounded-md border border-dashed border-border bg-white dark:bg-white`}><Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" /></span> }

function LeadAccountOption({ option }: { option: SearchableResourceOption }) { const account = option.data as Account | undefined; return <span className="flex min-w-0 flex-1 items-center gap-2.5"><AccountLogo account={{ name: option.label, image: account?.image }} /><span className="min-w-0"><span className="block truncate font-medium">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span></span> }

function LeadAccountCard({ account, canEdit, updating, loadOptions, onChange }: { account: LeadAccount | null | undefined; canEdit: boolean; updating: boolean; loadOptions: (query: string, page: number, signal: AbortSignal) => Promise<SearchableResourcePage>; onChange: (accountId: number, option?: SearchableResourceOption) => void }) {
  const emptyState = <div className="mt-3 flex items-center gap-2 rounded-md bg-background/60 p-2.5 text-sm text-muted-foreground"><span className="flex size-7 items-center justify-center rounded-full bg-muted"><Building2 className="size-3.5" aria-hidden="true" /></span><span>No account linked</span></div>
  const currentOption = account?.id !== undefined ? { id: account.id, label: account.name, data: account } : undefined
  return <section className="mt-4 rounded-lg bg-muted/40 p-3">{canEdit ? <div className={updating ? "pointer-events-none opacity-60" : undefined}><SearchableResourcePicker id="lead-dialog-account" label="Account" labelStyle="plain" value={account?.id ?? 0} selectedOption={currentOption} onChange={onChange} loadOptions={loadOptions} placeholder="Choose an account" searchPlaceholder="Search accounts…" loadingLabel="Searching accounts…" emptyLabel="No accounts found." noResultsLabel="No accounts match your search." renderOption={(option) => <LeadAccountOption option={option} />} renderSelectedOption={(option) => <span className="flex min-w-0 items-center gap-2"><AccountLogo account={{ name: option.label, image: (option.data as Account | undefined)?.image }} /><span className="truncate">{option.label}</span></span>} /></div> : account?.name ? <div className="mt-3 flex items-center gap-2"><AccountLogo account={account} />{account.id !== undefined ? <Link className="truncate font-medium text-primary hover:text-foreground" to={`/accounts/${account.id}`}>{account.name}</Link> : <span className="truncate font-medium">{account.name}</span>}</div> : emptyState}</section>
}

function LeadDealsPreview({ contactId, deals, total, loading, error }: { contactId?: number; deals: Deal[]; total: number; loading: boolean; error: string }) {
  return <section className="mt-6 rounded-lg bg-muted/40 p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Deals</h3>{contactId !== undefined && <Button asChild size="sm"><Link to="/deals/create">New deal</Link></Button>}</div>{loading ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="overflow-hidden rounded-lg bg-background shadow-sm"><Skeleton className="aspect-[4/3] w-full" /><div className="space-y-2 p-3"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-5 w-3/5" /></div></div>)}</div> : error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : !contactId || !deals.length ? <div className="flex flex-col items-center justify-center gap-2 py-8 text-center"><span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm"><Inbox className="size-5" aria-hidden="true" /></span><p className="text-sm font-medium text-foreground/75">No deals yet</p></div> : <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{deals.slice(0, 3).map((deal, index) => { const cover = deal.property.images?.[0]; const hasMoreDeals = deals.length > 3 || total > 3; const dealHref = deal.id !== undefined ? `/deals/${deal.id}` : undefined; return <article key={deal.id ?? `${deal.property.id}-${index}`} className="relative overflow-hidden rounded-lg bg-background shadow-sm">{dealHref ? <Link to={dealHref} aria-label={`Open deal for ${deal.property.title}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><div className="relative aspect-[4/3] bg-muted/30">{cover ? <img src={cover.thumbnail_url || cover.url} alt={deal.property.title} className="size-full object-cover" loading="lazy" /> : <div className="grid size-full place-items-center text-muted-foreground"><ImageIcon className="size-5" aria-hidden="true" /></div>}<Badge variant="secondary" className={`absolute end-2 top-2 text-[11px] capitalize ${dealStatusPillClass[deal.status]}`}>{deal.status.replaceAll("_", " ")}</Badge></div><div className="space-y-2 p-3"><p className="truncate text-xs text-muted-foreground">{deal.property.title}</p><p className="truncate font-mono text-sm font-semibold tabular-nums">{formatDealValue(deal.deal_value)}</p></div></Link> : <><div className="relative aspect-[4/3] bg-muted/30">{cover ? <img src={cover.thumbnail_url || cover.url} alt={deal.property.title} className="size-full object-cover" loading="lazy" /> : <div className="grid size-full place-items-center text-muted-foreground"><ImageIcon className="size-5" aria-hidden="true" /></div>}<Badge variant="secondary" className={`absolute end-2 top-2 text-[11px] capitalize ${dealStatusPillClass[deal.status]}`}>{deal.status.replaceAll("_", " ")}</Badge></div><div className="space-y-2 p-3"><p className="truncate text-xs text-muted-foreground">{deal.property.title}</p><p className="truncate font-mono text-sm font-semibold tabular-nums">{formatDealValue(deal.deal_value)}</p></div></>}{index === 2 && hasMoreDeals && <Link className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/75 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black/85" to={`/deals?contact=${contactId}`}>View all deals</Link>}</article> })}</div>}</section>
}

function formatDealValue(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function LeadPreviewSkeleton() {
  return <div className="space-y-5"><div className="flex items-center gap-3"><Skeleton className="size-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-4/5" /></div></div><div className="flex gap-2"><Skeleton className="h-6 w-24 rounded-full" /><Skeleton className="h-6 w-20 rounded-full" /></div><div className="rounded-lg bg-muted/40 p-3"><Skeleton className="h-3 w-32" /><div className="mt-3 grid gap-2 sm:grid-cols-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-36" /></div></div><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></div>
}

function LeadStatusDistributionSkeleton() {
  return <div className="space-y-3" role="status" aria-label="Loading lead status distribution"><div className="flex items-center justify-between gap-3"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-20" /></div><Skeleton className="h-2 w-full rounded-full" /></div>
}

function statKey(status: LeadStatus): keyof LeadStats { return status === "unqualified" ? "unqualified_count" : `${status}_count` as keyof LeadStats }
function statCount(stats: LeadStats, status: LeadStatus) { return stats[statKey(status)] ?? (status === "unqualified" ? stats.unqalified_count ?? 0 : 0) }

function SourceOption({ source }: { source: LeadSource }) { return <span className={`flex items-center gap-2 capitalize ${sourceBrandClass[source]}`}><SourceMark source={source} />{source}</span> }
function AgentOption({ option }: { option: SearchableResourceOption }) { const agent = option.data as User | undefined; return <span className="flex min-w-0 items-center gap-2"><PersonAvatar name={option.label} avatar={agent?.avatar} size="sm" /><span className="min-w-0"><span className="block truncate">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span></span> }
function SourceMark({ source }: { source: LeadSource }) { return source === "facebook" ? <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current"><path d="M13.5 21v-7h2.5l.5-3h-3V9.5c0-.9.3-1.5 1.6-1.5H16V5.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4V11H7.5v3h2.4v7h3.6Z" /></svg> : source === "instagram" ? <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.8]"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.7" r=".8" className="fill-current stroke-none" /></svg> : source === "whatsapp" ? <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current stroke-[1.8]"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.8 8.2c.2-.4.4-.4.7.4l.7 1.7c.1.3.1.5-.1.7l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.4-.2.7-.1l1.7.7c.3.3.4.3.4.5v.5c0 .3 0 .5-.4.7-.5.3-1.1.4-1.7.4-1.3-.2-2.5-.8-3.5-1.8s-1.6-2.2-1.8-3.5c-.1-.6.1-1.2.4-1.7Z" className="fill-current stroke-none" /></svg> : <span aria-hidden="true" className="text-sm font-semibold leading-none">𝕏</span> }
function LeadCardPlaceholder() { return <div className="min-h-36 rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 p-3" aria-hidden="true" /> }
function LeadCardSkeleton() { return <div className="rounded-xl bg-background p-3 shadow-sm"><div className="flex items-center gap-2.5"><Skeleton className="size-7 rounded-full" /><Skeleton className="h-4 flex-1" /></div><div className="mt-4 space-y-2"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /></div><div className="-mx-3 -mb-3 mt-4 flex items-center justify-between rounded-b-xl bg-foreground/10 px-3 py-2.5"><Skeleton className="size-4 rounded-sm" /><Skeleton className="h-3 w-20" /></div></div> }
function ColumnSkeleton() { return <div className="space-y-4">{Array.from({ length: 2 }, (_, index) => <LeadCardSkeleton key={index} />)}</div> }
function ColumnLoadTrigger({ enabled, loading, onLoadMore }: { enabled: boolean; loading: boolean; onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !enabled || loading) return
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) onLoadMore() }, { rootMargin: "320px 0px" })
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, loading, onLoadMore])
  return <div ref={ref} className="flex min-h-6 items-center justify-center text-muted-foreground" aria-live="polite">{loading && <Loader2 className="size-3.5 animate-spin" aria-label="Loading more leads" />}</div>
}
