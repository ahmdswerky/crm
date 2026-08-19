import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import { Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import type { Paginated, Permission, Role, RoleEnvelope } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const display = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value)
const labelFor = (value: string) => value.replaceAll(".", " / ").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const permissionAction = (name: string) => (name.split(".", 2)[1] ?? name).replaceAll("-", " ").toLowerCase()
const permissionActionOrder = ["view", "create", "edit", "delete", "restore"]
const permissionOrder = (permission: Permission) => {
  const action = permission.name.split(".", 2)[1]
  const index = action ? permissionActionOrder.indexOf(action) : -1
  return index === -1 ? permissionActionOrder.length : index
}

export function RolesPage() {
  const { isSuper } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const selectedId = Number(searchParams.get("record") ?? "") || undefined
  const mode = searchParams.get("mode")
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [meta, setMeta] = useState<Paginated<Role>["meta"] | null>(null)
  const [selected, setSelected] = useState<Role | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftPermissions, setDraftPermissions] = useState<string[]>([])
  const [permissionFilter, setPermissionFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  const loadRoles = async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<Paginated<Role>>(`${API_BASE_URL}/v1/roles?page=${page}`, { signal })
      setRoles(body.data)
      setMeta(body.meta)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load roles.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  const loadPermissions = async (signal?: AbortSignal) => {
    try {
      const body = await apiJson<{ data: Permission[] }>(`${API_BASE_URL}/v1/permissions`, { signal })
      setPermissions(body.data)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load permissions.")
    }
  }

  useEffect(() => {
    if (!isSuper) return
    const controller = new AbortController()
    void Promise.all([loadRoles(controller.signal), loadPermissions(controller.signal)])
    return () => controller.abort()
  }, [isSuper, page])

  useEffect(() => {
    if (mode === "create") {
      setSelected(null)
      setDraftName("")
      setDraftPermissions([])
      return
    }
    if (!selectedId) {
      setSelected(null)
      return
    }
    const listed = roles.find((role) => role.id === selectedId)
    if (listed) {
      setSelected(listed)
      setDraftName(listed.name)
      setDraftPermissions((listed.permissions ?? []).map((item) => item.name))
    }
    const controller = new AbortController()
    void apiJson<RoleEnvelope>(`${API_BASE_URL}/v1/roles/${selectedId}`, { signal: controller.signal })
      .then((body) => {
        setSelected(body.role)
        setDraftName(body.role.name)
        setDraftPermissions((body.role.permissions ?? []).map((item) => item.name))
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load the role.")
      })
    return () => controller.abort()
  }, [mode, roles, selectedId])

  const groupedPermissions = useMemo(() => {
    const normalized = permissionFilter.trim().toLowerCase()
    const filtered = permissions.filter((permission) => permission.name.toLowerCase().includes(normalized))
    return filtered.reduce<Record<string, Permission[]>>((groups, permission) => {
      const [group] = permission.name.split(".")
      ;(groups[group] ??= []).push(permission)
      return groups
    }, {})
  }, [permissionFilter, permissions])

  const updateParams = (next: Record<string, string | undefined>) => setSearchParams((current) => {
    const params = new URLSearchParams(current)
    Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value))
    return params
  })
  const openRecord = (id: number) => updateParams({ page: String(page), record: String(id), mode: undefined })
  const startCreate = () => updateParams({ page: String(page), record: undefined, mode: "create" })
  const closeEditor = () => updateParams({ page: String(page), record: undefined, mode: undefined })
  const togglePermission = (name: string, checked: boolean) => setDraftPermissions((current) => checked ? [...new Set([...current, name])] : current.filter((item) => item !== name))

  async function saveRole(event: FormEvent) {
    event.preventDefault()
    if (!draftName.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      const editing = Boolean(selected?.id)
      const body = editing
        ? { _method: "PUT" as const, name: draftName.trim(), permissions: draftPermissions }
        : { name: draftName.trim(), permissions: draftPermissions }
      const response = await apiJson<RoleEnvelope>(editing ? `${API_BASE_URL}/v1/roles/${selected?.id}` : `${API_BASE_URL}/v1/roles`, {
        method: "POST",
        body: JSON.stringify(body),
      })
      await loadRoles()
      if (response.role.id) openRecord(response.role.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the role.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteRole() {
    if (!selected?.id) return
    setSaving(true)
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/roles/${selected.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      setDeleteOpen(false)
      closeEditor()
      await loadRoles()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "Unable to delete the role.")
    } finally {
      setSaving(false)
    }
  }

  if (!isSuper) return <ForbiddenRoles />

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Settings / Access</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Roles & permissions</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Define the capabilities available to every Agent.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadRoles()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>
          <Button size="sm" onClick={startCreate}><Plus className="me-2 size-3.5" />New role</Button>
        </div>
      </div>
      {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <section className="min-w-0 border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="font-semibold">Role directory</h2><p className="text-xs text-muted-foreground">{meta?.total ?? roles.length} roles</p></div><ShieldCheck className="size-4 text-muted-foreground" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Role</TableHead><TableHead>Permissions</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={3}><Skeleton className="h-5 w-2/3" /></TableCell></TableRow>) : roles.length ? roles.map((role) => <TableRow key={role.id} data-state={selectedId === role.id ? "selected" : undefined} className="cursor-pointer" onClick={() => role.id && openRecord(role.id)}><TableCell className="font-medium">{role.name}</TableCell><TableCell><Badge variant="secondary">{role.permissions_count ?? role.permissions?.length ?? 0}</Badge></TableCell><TableCell className="font-mono text-xs text-muted-foreground">{display(role.created_at).slice(0, 10)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="h-32 text-center text-muted-foreground">No roles found.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <ResourcePagination page={page} lastPage={meta?.last_page ?? 1} disabled={loading} onPageChange={(nextPage) => updateParams({ page: String(nextPage), record: undefined, mode: undefined })} />
        </section>
        <section className="border border-border bg-card">
          {!mode && !selected ? <div className="grid min-h-96 place-items-center p-8 text-center"><div><ShieldCheck className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">Select a role</h2><p className="mt-1 text-sm text-muted-foreground">Inspect or change its permission set.</p></div></div> : <form onSubmit={saveRole} className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{selected ? "Role editor" : "New role"}</p><h2 className="mt-1 text-lg font-semibold">{selected ? selected.name : "Create a role"}</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Close editor" onClick={closeEditor}><X /></Button></div>
            <div className="space-y-2"><Label htmlFor="role-name">Role name</Label><Input id="role-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} required maxLength={255} /></div>
            <Separator />
            <div className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h3 className="font-medium">Permission set</h3><p className="text-xs text-muted-foreground">Changes are staged until you save.</p></div><Input className="max-w-48" placeholder="Filter permissions" value={permissionFilter} onChange={(event) => setPermissionFilter(event.target.value)} /></div>
              <div className="max-h-96 space-y-5 overflow-y-auto pe-1">{Object.entries(groupedPermissions).map(([group, items]) => <fieldset key={group} className="space-y-2.5"><legend className="text-sm font-semibold capitalize">{labelFor(group)}</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{[...items].sort((left, right) => permissionOrder(left) - permissionOrder(right)).map((permission) => { const checked = draftPermissions.includes(permission.name); return <label key={permission.name} className={`inline-flex cursor-pointer items-center gap-2 px-1 py-1 text-sm transition-colors ${checked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}><Checkbox checked={checked} onCheckedChange={(nextChecked) => togglePermission(permission.name, nextChecked === true)} aria-label={`Select ${permission.name}`} /><span>{permissionAction(permission.name)}</span></label> })}</div></fieldset>)}</div>
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4"><div>{selected && <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} disabled={saving}><Trash2 className="me-2 size-3.5" />Delete role</Button>}</div><Button type="submit" disabled={saving || !draftName.trim()}><Save className="me-2 size-3.5" />{saving ? "Saving…" : "Save changes"}</Button></div>
          </form>}
        </section>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {selected?.name}?</AlertDialogTitle><AlertDialogDescription>Agents assigned to this role will lose it. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={(event) => { event.preventDefault(); void deleteRole() }} disabled={saving}>{saving ? "Deleting…" : "Delete role"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}

function ForbiddenRoles() {
  return <ErrorState kind="forbidden" title="Roles are restricted" description="Only super admins can manage roles and permissions." actionLabel="Return to overview" actionTo="/" />
}
