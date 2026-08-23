import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { motion } from "motion/react"
import { ChevronDown, Eye, Funnel, Mail, Pencil, Phone, Plus, RefreshCw, Search, Trash2, X } from "lucide-react"
import { API_BASE_URL, apiFetch, apiJson, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AgentCommissionCells, AgentCommissionHeaders, AgentAccessCell, AgentDialog, ActionTooltip, canDeleteAgent, detailsPath, ForbiddenAgents, type Role, type User, type UserEnvelope } from "./shared"

const filterMotionTransition = { type: "spring", stiffness: 500, damping: 42, mass: 0.65 } as const
const filterSlideTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

export function AgentsPage() {
  const { user, can, isSuper, refresh } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const selectedId = Number(searchParams.get("record") ?? "") || undefined
  const mode = searchParams.get("mode")
  const returnParams = new URLSearchParams(searchParams); returnParams.delete("record"); returnParams.delete("mode")
  const returnSearch = returnParams.toString()
  const query = searchParams.get("q") ?? ""
  const [queryInput, setQueryInput] = useState(query)
  const [agents, setAgents] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [meta, setMeta] = useState<Paginated<User>["meta"] | null>(null)
  const [selected, setSelected] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const canDelete = can("user.delete")
  const showCommissionColumns = user?.roles?.some((role) => role.name.toLowerCase() === "agent") !== true

  const loadAgents = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("")
    try {
      const body = await apiJson<Paginated<User>>(listUrl(`${API_BASE_URL}/v1/users`, { page, with: "manager", q: query }), { signal })
      setAgents(body.data); setMeta(body.meta)
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load agents.")
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [page, query])

  useEffect(() => { if (!can("user.view")) return; const controller = new AbortController(); void loadAgents(controller.signal); return () => controller.abort() }, [can, loadAgents])
  useEffect(() => {
    if (!isSuper) { setRoles([]); return }
    const controller = new AbortController()
    void apiJson<Paginated<Role>>(`${API_BASE_URL}/v1/roles`, { signal: controller.signal }).then((body) => setRoles(body.data)).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load roles.") })
    return () => controller.abort()
  }, [isSuper])
  useEffect(() => {
    if (mode === "edit" && !selectedId) setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("mode"); return next }, { replace: true })
  }, [mode, selectedId, setSearchParams])
  useEffect(() => {
    if (mode !== "edit" || !selectedId) { setSelected(null); return }
    setSelected(agents.find((agent) => agent.id === selectedId) ?? null)
    const controller = new AbortController()
    void apiJson<UserEnvelope>(`${API_BASE_URL}/v1/users/${selectedId}`, { signal: controller.signal }).then((body) => setSelected(body.user)).catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load this agent.") })
    return () => controller.abort()
  }, [agents, mode, selectedId])

  const setParams = (next: Record<string, string | undefined>) => setSearchParams((current) => { const params = new URLSearchParams(current); Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value)); return params })
  const clearFilters = () => setParams({ q: undefined, page: "1", record: undefined, mode: undefined })
  useEffect(() => { setQueryInput(query) }, [query])
  useEffect(() => { if (queryInput === query) return; const timeout = window.setTimeout(() => setSearchParams((current) => { const params = new URLSearchParams(current); if (queryInput.trim()) params.set("q", queryInput.trim()); else params.delete("q"); params.set("page", "1"); params.delete("record"); params.delete("mode"); return params }), 500); return () => window.clearTimeout(timeout) }, [query, queryInput, setSearchParams])

  const hasFilters = Boolean(query)
  async function deleteAgent() {
    if (!pendingDelete?.id || !canDeleteAgent(user, canDelete, pendingDelete)) return
    setDeleting(true); setDeleteError("")
    try { const response = await apiFetch(`${API_BASE_URL}/v1/users/${pendingDelete.id}`, { method: "DELETE" }); if (!response.ok) throw await readApiError(response); const deletedId = pendingDelete.id; setPendingDelete(null); if (selectedId === deletedId) setParams({ record: undefined }); await loadAgents(); await refresh() } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this agent.") } finally { setDeleting(false) }
  }
  if (!can("user.view")) return <ForbiddenAgents />
  const canCreate = can("user.create"); const canEdit = can("user.edit")
  const columnCount = showCommissionColumns ? 7 : 6
  const openCreate = () => setParams({ record: undefined, mode: "create" })
  const openEdit = (agent: User) => setParams({ record: String(agent.id ?? 0), mode: "edit" })
  const closeDialog = () => setParams({ mode: undefined, record: undefined })
  const saveDialog = async (savedAgent: User) => {
    if (!savedAgent.id) {
      closeDialog()
      return
    }
    navigate(detailsPath(savedAgent.id, returnSearch), { replace: true })
  }
  return <><div className="space-y-6 p-6 lg:p-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Agents</h1><p className="mt-1 text-sm text-muted-foreground">Manage the people who work the CRM and their effective access.</p></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
<div className="relative"><div className="flex items-end justify-between gap-4"><div className="filter-tab filter-tab-roundout ms-3"><button type="button" aria-expanded={filtersOpen} aria-controls="agents-filter-panel" onClick={() => setFiltersOpen((open) => !open)} className="filter-tab-roundout-button inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors"><Funnel className="size-3.5" aria-hidden="true" /><span>Filter</span><motion.span animate={{ rotate: filtersOpen ? 180 : 0 }} transition={filterMotionTransition} className="inline-flex"><ChevronDown className="size-4" aria-hidden="true" /></motion.span></button></div><div className="mb-1 flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => void loadAgents()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canCreate && <Button type="button" variant="outline" size="sm" onClick={openCreate}><Plus className="me-2 size-3.5" />New agent</Button>}</div></div><motion.div initial={false} animate={{ height: filtersOpen ? "auto" : 0 }} transition={filterSlideTransition} className="overflow-hidden"><div className="search-filter-card rounded-t-md rounded-b-none bg-muted/60 shadow-sm dark:bg-muted/70"><div className="p-4"><div id="agents-filter-panel" aria-hidden={!filtersOpen}><div className="flex flex-wrap items-end gap-3"><div className="w-full"><label className="text-xs font-medium text-muted-foreground" htmlFor="agent-search">Search loaded agents</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="agent-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name, username, email, phone, role…" /></div></div>{hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}</div></div></div></div></motion.div><section data-testid="agents-table-surface" className={`min-w-0 overflow-hidden ${filtersOpen ? "rounded-b-md rounded-t-none" : "rounded-md"} border border-border bg-card`}><Table><TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Username</TableHead><TableHead>Phone</TableHead><TableHead>Access</TableHead><AgentCommissionHeaders visible={showCommissionColumns} /><TableHead className="w-48 min-w-48 max-w-48 text-end">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: columnCount }, (_, cell) => <TableCell key={cell}><Skeleton className="h-5 w-3/4" /></TableCell>)}</TableRow>) : agents.length ? agents.map((agent) => { const canDeleteThisAgent = canDeleteAgent(user, canDelete, agent); return <TableRow key={agent.id} className="cursor-pointer" onClick={() => agent.id && navigate(detailsPath(agent.id, returnSearch))}><TableCell><div className="flex items-center gap-2"><PersonAvatar name={agent.name} avatar={agent.avatar} /><div className="min-w-0"><div className="truncate font-medium">{agent.name}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="size-3" aria-hidden="true" />{agent.email}</div></div></div></TableCell><TableCell className="text-sm text-muted-foreground">{agent.username}</TableCell><TableCell><span className="inline-flex items-center gap-1.5 text-sm"><Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />{agent.phone}</span></TableCell><AgentAccessCell agent={agent} /><AgentCommissionCells agent={agent} visible={showCommissionColumns} /><TableCell className="w-48 min-w-48 max-w-48 text-end"><div className="flex justify-end gap-1 [&_[data-slot=button]]:transition-none" onClick={(event) => event.stopPropagation()}><ActionTooltip label="Open agent details"><Button asChild variant="ghost" size="icon"><Link to={detailsPath(agent.id ?? 0, returnSearch)} aria-label={`Open details for ${agent.name}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit agent"><Button type="button" variant="ghost" size="icon" onClick={() => openEdit(agent)} aria-label={`Edit ${agent.name}`}><Pencil /></Button></ActionTooltip>}{canDeleteThisAgent && <ActionTooltip label={`Delete ${agent.name}`}><Button variant="ghost" size="icon" aria-label={`Delete ${agent.name}`} className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setPendingDelete(agent) }}><Trash2 /></Button></ActionTooltip>}</div></TableCell></TableRow> }) : <TableRow><TableCell colSpan={columnCount} className="h-32 text-center text-muted-foreground">{hasFilters ? <>No agents match the current filters. <Button variant="link" size="sm" className="ms-1" onClick={clearFilters}>Clear filters</Button></> : <div><p>No agents found.</p>{canCreate && <Button type="button" variant="link" size="sm" className="mt-1" onClick={openCreate}>Create an agent</Button>}</div>}</TableCell></TableRow>}</TableBody></Table><ResourcePagination page={meta?.current_page ?? page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} /></section></div>
    <AgentDialog open={mode === "create" || (mode === "edit" && Boolean(selected))} mode={mode === "create" ? "create" : "edit"} agent={selected} isSuper={isSuper} roles={roles} onOpenChange={(open) => { if (!open) closeDialog() }} onSaved={(savedAgent) => void saveDialog(savedAgent)} />
    <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) { setPendingDelete(null); setDeleteError("") } }} title={`Delete ${pendingDelete?.name ?? "agent"}?`} description={<>This permanently removes {pendingDelete?.name ?? "this agent"} and revokes its CRM access. This action cannot be undone.</>} confirmLabel="Delete agent" pending={deleting} error={deleteError} onConfirm={deleteAgent} />
  </div></>
}
