import { useCallback, useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import type { Paginated } from "@/api/contracts"
import { API_BASE_URL, apiFetch, apiJson, readApiError } from "@/api/client"
import { useAuth } from "@/auth/auth-provider"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AgentDeals, AgentDetailsState, AgentDialog, AgentLeads, canDeleteAgent, ForbiddenAgents, PermissionGroups, RoleReference, type Role, type User, type UserEnvelope } from "./shared"

export function AgentShowPage() {
  const { user, can, isSuper } = useAuth()
  const navigate = useNavigate()
  const { agentId } = useParams()
  const id = Number(agentId)
  const [searchParams, setSearchParams] = useSearchParams()
  const returnSearch = searchParams.get("return") ?? ""
  const indexHref = returnSearch ? `/agents?${returnSearch}` : "/agents"
  const editing = searchParams.get("mode") === "edit" && can("user.edit")
  const [agent, setAgent] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const loadAgent = useCallback(async (signal?: AbortSignal) => {
    if (!can("user.view") || !Number.isInteger(id) || id < 1) { setLoading(false); return }
    setLoading(true); setError("")
    try { const body = await apiJson<UserEnvelope>(`${API_BASE_URL}/v1/users/${id}`, { signal }); setAgent(body.user) } catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load this agent.") } finally { if (!signal?.aborted) setLoading(false) }
  }, [can, id])

  useEffect(() => { const controller = new AbortController(); void loadAgent(controller.signal); return () => controller.abort() }, [loadAgent])
  useEffect(() => {
    if (!isSuper) { setRoles([]); return }
    const controller = new AbortController()
    void apiJson<Paginated<Role>>(`${API_BASE_URL}/v1/roles`, { signal: controller.signal }).then((body) => setRoles(body.data)).catch(() => undefined)
    return () => controller.abort()
  }, [isSuper])
  useEffect(() => { if (searchParams.get("mode") === "edit" && !can("user.edit")) setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("mode"); return next }, { replace: true }) }, [can, searchParams, setSearchParams])

  const setEditMode = (enabled: boolean) => setSearchParams((current) => { const next = new URLSearchParams(current); if (enabled) next.set("mode", "edit"); else next.delete("mode"); return next }, { replace: true })
  const saveResult = (updated: User) => { setAgent(updated); setEditMode(false) }
  async function deleteCurrentAgent() {
    if (!agent?.id || !canDeleteAgent(user, can("user.delete"), agent)) return
    setDeleting(true); setDeleteError("")
    try { const response = await apiFetch(`${API_BASE_URL}/v1/users/${agent.id}`, { method: "DELETE" }); if (!response.ok) throw await readApiError(response); navigate(indexHref, { replace: true }) } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this agent.") } finally { setDeleting(false) }
  }

  if (!can("user.view")) return <ForbiddenAgents />
  if (!Number.isInteger(id) || id < 1) return <AgentDetailsState title="Agent not found" description="The agent identifier is invalid." />
  if (loading) return <div className="space-y-6 p-6 lg:p-8"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
  if (error || !agent) return <AgentDetailsState title="Unable to open agent" description={error || "This agent is no longer available."} />
  const canEdit = can("user.edit")
  const canDelete = canDeleteAgent(user, can("user.delete"), agent)
  return <div className="space-y-6 p-6 lg:p-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6"><div><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Back to agents</Link></Button><div className="mt-5 flex items-center gap-3"><PersonAvatar name={agent.name} avatar={agent.avatar} size="lg" /><div><h2 className="text-xs font-medium text-muted-foreground">Agent details</h2><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>{agent.roles?.map((role) => <RoleReference key={role.name} role={role} stopPropagation={false} />)}</div><p className="mt-1 text-sm text-muted-foreground">@{agent.username}</p></div></div></div><div className="flex items-center gap-2">{canEdit && <Button variant={editing ? "secondary" : "outline"} size="sm" onClick={() => setEditMode(!editing)}><Pencil className="me-2 size-3.5" />{editing ? "Editing" : "Edit agent"}</Button>}{canDelete && <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setDeleteOpen(true) }}><Trash2 className="me-2 size-3.5" />Delete</Button>}</div></div>{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}<section className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Identity</h2></div><dl className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 lg:grid-cols-4"><Info label="Username" value={agent.username} /><Info label="Email" value={agent.email} /><Info label="Phone" value={agent.phone} /></dl></section><AgentDeals agentId={id} totalPotentialCommission={agent.total_potential_commission} totalActualCommission={agent.total_actual_commission} /><div className="grid gap-6 lg:grid-cols-2"><AgentLeads agentId={id} /><section className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Permissions</h2></div>{agent.is_super ? <div className="p-5"><span className="text-sm text-muted-foreground">Super admins inherit all available actions.</span></div> : agent.permissions?.length ? <PermissionGroups permissions={agent.permissions} /> : <div className="p-5"><span className="text-sm text-muted-foreground">No effective permissions.</span></div>}</section></div>{agent.id !== undefined && <ActivityLogList model="user" id={agent.id} title="Agent activity" onReverted={() => void loadAgent()} />}<AgentDialog open={editing} mode="edit" agent={agent} isSuper={isSuper} roles={roles} onOpenChange={(open) => { if (!open) setEditMode(false) }} onSaved={saveResult} /><ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${agent.name}?`} description={<>This permanently removes {agent.name} and revokes its CRM access. This action cannot be undone.</>} confirmLabel="Delete agent" pending={deleting} error={deleteError} onConfirm={deleteCurrentAgent} /></div>
}

function Info({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }
