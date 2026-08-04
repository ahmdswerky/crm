import { useCallback, useEffect, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, BriefcaseBusiness, Building2, Eye, MapPin, Pencil, Phone, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react"
import { z } from "zod"
import type { components as ContactComponents, paths as ContactPaths } from "@/api/generated/Contact"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { ResourcePreviewDrawer } from "@/components/shared/resource-preview-drawer"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { DateRangePicker } from "@/components/ui/date-picker"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { Badge } from "@/components/ui/badge"

type Account = ContactComponents["schemas"]["Account"]
type AccountDetails = ContactComponents["schemas"]["AccountDetails"]
type Contact = ContactComponents["schemas"]["Contact"]
type AccountCreateRequest = ContactPaths["/accounts"]["post"]["requestBody"]["content"]["application/json"]
type AccountEnvelope = { account?: Account; data?: Account }
type AccountDetailsEnvelope = ContactPaths["/accounts/{id}"]["get"]["responses"][200]["content"]["application/json"]
type AccountListBody = { data?: Account[]; accounts?: Account[]; meta?: { current_page?: number; last_page?: number; total?: number } }
type AccountFormValues = AccountCreateRequest
type AccountContactPreview = Pick<Contact, "id" | "name" | "phone" | "title" | "email">

const accountSchema = z.object({
  name: z.string().trim().min(1, "Enter an account name."),
  industry: z.string().trim().min(1, "Enter an industry."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  address: z.string().trim().min(1, "Enter an address."),
})

const emptyValues: AccountFormValues = { name: "", industry: "", phone: "", address: "" }
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "—"
const detailsPath = (id: number, returnSearch = "", edit = false) => {
  const params = new URLSearchParams()
  if (edit) params.set("mode", "edit")
  if (returnSearch) params.set("return", returnSearch)
  return `/accounts/${id}${params.size ? `?${params}` : ""}`
}

function valuesFromAccount(account: Account): AccountFormValues {
  return { name: account.name, industry: account.industry, phone: account.phone, address: account.address }
}

function toPayload(values: AccountFormValues): AccountCreateRequest {
  return { name: values.name.trim(), industry: values.industry.trim(), phone: values.phone.trim(), address: values.address.trim() }
}

function unwrapAccount(body: AccountEnvelope): Account | null {
  const value = body.account ?? body.data
  return value && typeof value === "object" && !Array.isArray(value) ? value : null
}

function unwrapAccountDetails(body: AccountDetailsEnvelope): AccountDetails { return body.account }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function numberValue(value: unknown): number | undefined { return typeof value === "number" && Number.isFinite(value) ? value : undefined }
function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined }
function normalizeAccountContact(value: unknown): AccountContactPreview | undefined {
  if (!isRecord(value)) return undefined
  const id = numberValue(value.id)
  const name = stringValue(value.name)
  const phone = stringValue(value.phone)
  if (id === undefined || !name || !phone) return undefined
  return { id, name, phone, title: stringValue(value.title) ?? null, email: stringValue(value.email) ?? null }
}
function accountContactsFrom(body: unknown): AccountContactPreview[] {
  if (!isRecord(body)) return []
  const values = Array.isArray(body.data) ? body.data : Array.isArray(body.contacts) ? body.contacts : []
  return values.map(normalizeAccountContact).filter((contact): contact is AccountContactPreview => contact !== undefined)
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

export function AccountsPage() {
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
  const industryFilter = searchParams.get("industry") ?? ""
  const phoneFilter = searchParams.get("phone") ?? ""
  const addressFilter = searchParams.get("address") ?? ""
  const createdFrom = searchParams.get("created_from") ?? ""
  const createdTo = searchParams.get("created_to") ?? ""
  const [queryInput, setQueryInput] = useState(query)
  const [industryInput, setIndustryInput] = useState(industryFilter)
  const [phoneInput, setPhoneInput] = useState(phoneFilter)
  const [addressInput, setAddressInput] = useState(addressFilter)
  const [createdFromInput, setCreatedFromInput] = useState(createdFrom)
  const [createdToInput, setCreatedToInput] = useState(createdTo)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [meta, setMeta] = useState<AccountListBody["meta"] | null>(null)
  const [selected, setSelected] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [previewError, setPreviewError] = useState<{ message: string; status?: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<AccountListBody>(listUrl(`${API_BASE_URL}/v1/accounts`, {
        page,
        q: query,
        industry: industryFilter,
        phone: phoneFilter,
        address: addressFilter,
        created_from: createdFrom,
        created_to: createdTo,
      }), { signal })
      setAccounts(Array.isArray(body.data) ? body.data : Array.isArray(body.accounts) ? body.accounts : [])
      setMeta(body.meta ?? null)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load accounts.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [addressFilter, createdFrom, createdTo, industryFilter, page, phoneFilter, query])

  useEffect(() => {
    if (!can("account.view")) return
    const controller = new AbortController()
    void loadAccounts(controller.signal)
    return () => controller.abort()
  }, [can, loadAccounts])

  useEffect(() => {
    if (mode === "edit" && selectedId) {
      navigate(detailsPath(selectedId, returnSearch, true), { replace: true })
      return
    }
    if (!selectedId) {
      setSelected(null)
      setPreviewError(null)
      setSelectionLoading(false)
      return
    }
    const listed = accounts.find((account) => account.id === selectedId)
    if (listed) setSelected(listed)
    const controller = new AbortController()
    setSelectionLoading(true)
    setPreviewError(null)
    void apiJson<AccountEnvelope>(`${API_BASE_URL}/v1/accounts/${selectedId}`, { signal: controller.signal })
      .then((body) => {
        const account = unwrapAccount(body)
        if (account) setSelected(account)
        else throw new Error("The account response did not contain a usable account record.")
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setSelected(null)
          setPreviewError({ message: caught instanceof Error ? caught.message : "Unable to load this account.", status: caught instanceof ApiError ? caught.status : undefined })
        }
      })
      .finally(() => { if (!controller.signal.aborted) setSelectionLoading(false) })
    return () => controller.abort()
  }, [accounts, mode, navigate, returnSearch, selectedId])

  useEffect(() => {
    if (mode !== "create") return
    const createReturnParams = new URLSearchParams(searchParams)
    createReturnParams.delete("record")
    createReturnParams.delete("mode")
    const createReturn = createReturnParams.toString()
    navigate(`/accounts/create${createReturn ? `?return=${encodeURIComponent(createReturn)}` : ""}`, { replace: true })
  }, [mode, navigate, searchParams])

  const setParams = (next: Record<string, string | undefined>) => setSearchParams((current) => {
    const params = new URLSearchParams(current)
    Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value))
    return params
  })

  useEffect(() => {
    setQueryInput(query); setIndustryInput(industryFilter); setPhoneInput(phoneFilter); setAddressInput(addressFilter); setCreatedFromInput(createdFrom); setCreatedToInput(createdTo)
  }, [addressFilter, createdFrom, createdTo, industryFilter, phoneFilter, query])

  useEffect(() => {
    if (queryInput === query && industryInput === industryFilter && phoneInput === phoneFilter && addressInput === addressFilter && createdFromInput === createdFrom && createdToInput === createdTo) return
    const timeout = window.setTimeout(() => setSearchParams((current) => {
      const params = new URLSearchParams(current)
      const values: Record<string, string> = { q: queryInput.trim(), industry: industryInput.trim(), phone: phoneInput.trim(), address: addressInput.trim(), created_from: createdFromInput, created_to: createdToInput }
      Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key))
      params.set("page", "1"); params.delete("record"); params.delete("mode")
      return params
    }), 500)
    return () => window.clearTimeout(timeout)
  }, [addressFilter, addressInput, createdFrom, createdFromInput, createdTo, createdToInput, industryFilter, industryInput, phoneFilter, phoneInput, query, queryInput, setSearchParams])

  const safePage = meta?.current_page ?? page
  const lastPage = meta?.last_page ?? 1
  const visibleAccounts = accounts
  const hasFilters = Boolean(query || industryFilter || phoneFilter || addressFilter || createdFrom || createdTo)

  const updatePage = (nextPage: number) => setParams({ page: String(nextPage), record: undefined, mode: undefined })
  const openAccount = (id: number) => selectedId === id && !mode ? setParams({ record: undefined }) : setParams({ page: String(safePage), record: String(id), mode: undefined })
  async function deleteAccount() {
    if (!pendingDelete?.id) return
    setDeleting(true); setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/accounts/${pendingDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      const deletedId = pendingDelete.id; setPendingDelete(null)
      if (selectedId === deletedId) setParams({ record: undefined, mode: undefined })
      await loadAccounts()
    } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this account.") } finally { setDeleting(false) }
  }

  if (!can("account.view")) return <ForbiddenAccounts />
  const canCreate = can("account.create"); const canEdit = can("account.edit"); const canDelete = can("account.delete")
  const createPath = `/accounts/create${returnSearch ? `?return=${encodeURIComponent(returnSearch)}` : ""}`
  const previewOpen = Boolean(selectedId && mode !== "create" && mode !== "edit")

  return <div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="text-xs font-medium text-muted-foreground">CRM / Organizations</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Accounts</h1><p className="mt-1 text-sm text-muted-foreground">Keep company context clear across contacts and deals.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void loadAccounts()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canCreate && <Button asChild size="sm"><Link to={createPath}><Plus className="me-2 size-3.5" />New account</Link></Button>}</div></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4"><div className="min-w-56 flex-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="account-search">Search</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="account-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name, industry, phone, address…" /></div></div><FilterInput id="account-industry-filter" label="Industry" value={industryInput} onChange={setIndustryInput} placeholder="Any industry" /><FilterInput id="account-phone-filter" label="Phone" value={phoneInput} onChange={setPhoneInput} placeholder="Any phone" /><FilterInput id="account-address-filter" label="Address" value={addressInput} onChange={setAddressInput} placeholder="Any address" /><div className="min-w-72"><label className="text-xs font-medium text-muted-foreground">Created date range</label><DateRangePicker from={createdFromInput} to={createdToInput} onChange={({ from, to }) => { setCreatedFromInput(from); setCreatedToInput(to) }} /></div>{hasFilters && <Button variant="ghost" size="sm" onClick={() => setParams({ q: undefined, industry: undefined, phone: undefined, address: undefined, created_from: undefined, created_to: undefined, page: "1", record: undefined, mode: undefined })}><X className="me-1.5 size-3.5" />Clear</Button>}</div>
    <section data-testid="accounts-table-surface" className="min-w-0 border border-border bg-card"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Industry</TableHead><TableHead>Phone</TableHead><TableHead>Address</TableHead><TableHead>Created</TableHead><TableHead className="w-48 min-w-48 max-w-48 text-end">Actions</TableHead></TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: 6 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-5 w-3/4" /></TableCell>)}</TableRow>) : visibleAccounts.length ? visibleAccounts.map((account) => { const isPreviewing = selectedId === account.id && !mode; return <TableRow key={account.id} data-state={selectedId === account.id ? "selected" : undefined} className="cursor-pointer" onClick={() => openAccount(account.id)}><TableCell><div className="font-medium">{account.name}</div></TableCell><TableCell>{account.industry}</TableCell><TableCell><span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />{account.phone}</span></TableCell><TableCell><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />{account.address}</span></TableCell><TableCell className="text-sm text-muted-foreground">{formatDate(account.created_at)}</TableCell><TableCell className="w-48 min-w-48 max-w-48 text-end"><div className="flex justify-end gap-1 [&_[data-slot=button]]:transition-none" onClick={(event) => event.stopPropagation()}><ActionTooltip label="Open account details"><Button asChild variant={isPreviewing ? "secondary" : "ghost"} size="icon" aria-pressed={isPreviewing}><Link to={detailsPath(account.id, returnSearch)} aria-label={`Open details for ${account.name}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit account"><Button asChild variant="ghost" size="icon"><Link to={detailsPath(account.id, returnSearch, true)} aria-label={`Edit ${account.name}`}><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete account"><Button variant="ghost" size="icon" aria-label={`Delete ${account.name}`} className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setPendingDelete(account) }}><Trash2 /></Button></ActionTooltip>}</div></TableCell></TableRow> }) : <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">{hasFilters ? <>No accounts match the current filters. <Button variant="link" size="sm" className="ms-1" onClick={() => setParams({ q: undefined, industry: undefined, phone: undefined, address: undefined, created_from: undefined, created_to: undefined, page: "1" })}>Clear filters</Button></> : <div><p>No accounts found.</p>{canCreate && <Button asChild variant="link" size="sm" className="mt-1"><Link to={createPath}>Create an account</Link></Button>}</div>}</TableCell></TableRow>}</TableBody></Table><ResourcePagination page={safePage} lastPage={lastPage} disabled={loading} onPageChange={updatePage} /></section>
    <ResourcePreviewDrawer open={previewOpen} onOpenChange={(open) => { if (!open) setParams({ record: undefined }) }} title="Account preview" description="Read-only account details and available actions.">
      {selectionLoading && !selected ? <div className="space-y-4 p-5"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></div> : previewError ? <div className="space-y-3 p-5"><h2 className="font-semibold">{previewError.status === 403 ? "Account is restricted" : previewError.status === 404 ? "Account not found" : "Unable to load account"}</h2><p role="alert" className="text-sm text-destructive">{previewError.message}</p><Button variant="outline" size="sm" onClick={() => setParams({ record: undefined })}>Close preview</Button></div> : selected ? <AccountInspector account={selected} detailsHref={detailsPath(selected.id, returnSearch)} editHref={detailsPath(selected.id, returnSearch, true)} canEdit={canEdit} canDelete={canDelete} onDelete={() => { setDeleteError(""); setPendingDelete(selected) }} /> : <div className="p-5 text-sm text-muted-foreground">This account could not be loaded.</div>}
    </ResourcePreviewDrawer>
    <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) { setPendingDelete(null); setDeleteError("") } }} title={`Delete ${pendingDelete?.name ?? "account"}?`} description={<>This permanently removes {pendingDelete?.name ?? "this account"} and its account record. This action cannot be undone.</>} confirmLabel="Delete account" pending={deleting} error={deleteError} onConfirm={deleteAccount} />
  </div>
}

function FilterInput({ id, label, value, onChange, placeholder, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) { return <div className="min-w-36"><label className="text-xs font-medium text-muted-foreground" htmlFor={id}>{label}</label><Input id={id} className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div> }

function AccountInspector({ account, detailsHref, editHref, canEdit, canDelete, onDelete }: { account: Account; detailsHref: string; editHref: string; canEdit: boolean; canDelete: boolean; onDelete: () => void }) { return <div className="space-y-6 p-5"><header className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Account record</p><h2 className="mt-1 truncate text-xl font-semibold tracking-tight">{account.name}</h2><p className="mt-1 text-sm text-muted-foreground">{account.industry}</p></div><div className="flex shrink-0 gap-1"><ActionTooltip label="Open dedicated details"><Button asChild variant="outline" size="icon"><Link to={detailsHref} aria-label="Open dedicated details"><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit account"><Button asChild variant="outline" size="icon"><Link to={editHref} aria-label="Edit account"><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete account"><Button variant="outline" size="icon" aria-label="Delete account" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /></Button></ActionTooltip>}</div></header><section className="border-t border-border pt-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Organization</p><dl className="mt-4 grid gap-4 text-sm"><Info label="Industry" value={account.industry} /><Info label="Phone" value={<span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />{account.phone}</span>} /><Info label="Address" value={<span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />{account.address}</span>} /></dl></section><Separator /><p className="text-xs text-muted-foreground">Created {formatDate(account.created_at)}</p></div> }

function Info({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }
function ForbiddenAccounts() { return <ErrorState kind="forbidden" title="Accounts are restricted" description="You do not have permission to view accounts." actionLabel="Return to overview" actionTo="/" /> }
function AccountDetailsState({ title, description, backTo = "/accounts" }: { title: string; description: string; backTo?: string }) { return <ErrorState kind="not-found" title={title} description={description} actionLabel="Return to accounts" actionTo={backTo} /> }

export function AccountDetailsPage({ create = false }: { create?: boolean } = {}) {
  const { can } = useAuth()
  const { accountId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = Number(accountId)
  const [account, setAccount] = useState<AccountDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [accessError, setAccessError] = useState<"unauthorized" | "forbidden" | "missing" | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const form = useForm<AccountFormValues>({ resolver: zodResolver(accountSchema), defaultValues: emptyValues })
  const editing = !create && searchParams.get("mode") === "edit" && can("account.edit")
  const returnQuery = searchParams.get("return")
  const indexHref = returnQuery ? `/accounts?${returnQuery}` : "/accounts"

  const loadAccount = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isInteger(id) || id < 1) return
    setLoading(true)
    setError("")
    setAccessError(null)
    try {
      const body = await apiJson<AccountDetailsEnvelope>(`${API_BASE_URL}/v1/accounts/${id}`, { signal })
      const nextAccount = unwrapAccountDetails(body)
      setAccount(nextAccount)
      form.reset(valuesFromAccount(nextAccount))
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      if (caught instanceof ApiError) {
        if (caught.status === 401) setAccessError("unauthorized")
        else if (caught.status === 403) setAccessError("forbidden")
        else if (caught.status === 404) setAccessError("missing")
        else setError(caught.message)
      } else setError(caught instanceof Error ? caught.message : "Unable to load this account.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [form, id])

  useEffect(() => {
    if (create) {
      form.reset(emptyValues)
      setAccount(null)
      setError("")
      setLoading(false)
      return
    }
    if (!can("account.view") || !Number.isInteger(id) || id < 1) { setLoading(false); return }
    const controller = new AbortController()
    void loadAccount(controller.signal)
    return () => controller.abort()
  }, [can, create, form, id, loadAccount])

  function setEditMode(enabled: boolean) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (enabled) next.set("mode", "edit")
      else next.delete("mode")
      return next
    })
  }

  const saveAccount = form.handleSubmit(async (values) => {
    if (!account?.id) return
    setError("")
    try {
      const result = await apiJson<AccountEnvelope>(`${API_BASE_URL}/v1/accounts/${account.id}`, {
        method: "POST",
        body: JSON.stringify({ ...toPayload(values), _method: "PUT" }),
      })
      const nextAccount = unwrapAccount(result)
      if (!nextAccount) throw new Error("The update response did not contain a usable account record.")
      setAccount((current) => current ? { ...nextAccount, contacts_count: current.contacts_count } : null)
      form.reset(valuesFromAccount(nextAccount))
      setEditMode(false)
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof AccountFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to save this account.")
    }
  })

  const createAccount = form.handleSubmit(async (values) => {
    setError("")
    try {
      const result = await apiJson<AccountEnvelope>(`${API_BASE_URL}/v1/accounts`, { method: "POST", body: JSON.stringify(toPayload(values)) })
      const nextAccount = unwrapAccount(result)
      if (!nextAccount?.id) {
        navigate(indexHref, { replace: true })
        return
      }
      const detailsParams = returnQuery ? new URLSearchParams({ return: returnQuery }) : undefined
      navigate(`/accounts/${nextAccount.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof AccountFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to create this account.")
    }
  })

  async function deleteCurrentAccount() {
    if (!account?.id) return
    setDeleting(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/accounts/${account.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      navigate(indexHref, { replace: true })
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this account.")
    } finally {
      setDeleting(false)
    }
  }

  if (create && !can("account.create")) return <ErrorState kind="forbidden" title="Account creation is restricted" description="You do not have permission to create accounts." actionLabel="Return to accounts" actionTo="/accounts" />
  if (!create && !can("account.view")) return <ForbiddenAccounts />
  if (create) return <main className="mx-auto max-w-[100rem] space-y-8 p-6 pb-24 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
      <div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Back to accounts</Link></Button><h1 className="mt-5 text-2xl font-semibold tracking-tight">New account</h1></div>
      <div className="flex shrink-0 items-center gap-2"><Button type="button" variant="outline" onClick={() => navigate(indexHref)}>Cancel</Button><Button type="submit" form="account-create-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Creating…" : "Create"}</Button></div>
    </header>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
    <AccountDetailsEditor create form={form} formId="account-create-form" hideToolbar saving={form.formState.isSubmitting} onCancel={() => navigate(indexHref)} onSubmit={createAccount} />
  </main>
  if (!Number.isInteger(id) || id < 1) return <AccountDetailsState title="Account not found" description="The account identifier is invalid." backTo={indexHref} />
  if (loading) return <AccountDetailsSkeleton />
  if (accessError === "unauthorized") return <ErrorState kind="unauthorized" title="Your session has ended" description="Sign in again to continue working with accounts." actionLabel="Sign in" actionTo="/login" />
  if (accessError === "forbidden") return <ErrorState kind="forbidden" title="This account is restricted" description="You do not have access to this account record." actionLabel="Return to accounts" actionTo={indexHref} />
  if (accessError === "missing") return <AccountDetailsState title="Account not found" description="This account may have been removed or you may not have access to it." backTo={indexHref} />
  if (!account) return <AccountDetailsLoadError message={error || "Unable to load this account."} backTo={indexHref} onRetry={() => void loadAccount()} />

  const canEdit = can("account.edit")
  const canDelete = can("account.delete")

  return <main className="mx-auto max-w-[100rem] space-y-6 p-6 pb-24 lg:p-8">
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Accounts</Link></Button><div className="mt-5 min-w-0"><p className="text-xs font-medium text-muted-foreground">CRM / Organizations</p><h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{account.name}</h1></div></div>
        <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => void loadAccount()} disabled={form.formState.isSubmitting || deleting}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canEdit && <Button size="sm" variant={editing ? "secondary" : "default"} onClick={() => { form.reset(valuesFromAccount(account)); setEditMode(!editing) }}><Pencil className="me-2 size-3.5" />{editing ? "Editing" : "Edit account"}</Button>}{canDelete && <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setDeleteOpen(true) }}><Trash2 className="me-2 size-3.5" />Delete</Button>}</div>
      </div>
    </header>

    <p className="sr-only" aria-live="polite">{error}</p>
    {error && <div role="alert" className="flex items-center justify-between gap-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setError("")}>Dismiss</Button></div>}

    {editing ? <AccountDetailsEditor form={form} saving={form.formState.isSubmitting} onCancel={() => { form.reset(valuesFromAccount(account)); setEditMode(false) }} onSubmit={saveAccount} /> : <div className="min-w-0 space-y-8">
        <section className="grid border-y border-border sm:grid-cols-3"><DetailsMetric label="Industry" value={account.industry} /><DetailsMetric label="Phone" value={<a className="text-primary hover:text-foreground" href={`tel:${account.phone}`}>{account.phone}</a>} action={<a className="text-primary hover:text-foreground" href={`tel:${account.phone}`}>Call</a>} /><DetailsMetric label="Location" value={<span className="inline-flex items-start gap-1.5"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />{account.address}</span>} /></section>
        <AccountContacts accountId={account.id} contactsCount={account.contacts_count} />
        <ActivityLogList model="account" id={account.id} title="Account activity" onReverted={() => void loadAccount()} />
    </div>}

    <ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${account.name}?`} description={<>This permanently removes {account.name} and its account record. This action cannot be undone.</>} confirmLabel="Delete account" pending={deleting} error={deleteError} onConfirm={deleteCurrentAccount} />
  </main>
}

function DetailsMetric({ label, value, action }: { label: string; value: ReactNode; action?: ReactNode }) { return <div className="border-b border-border p-5 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><div className="mt-2 font-medium text-foreground">{value}</div>{action && <div className="mt-2 text-xs font-medium">{action}</div>}</div> }
function AccountContacts({ accountId, contactsCount }: { accountId: number; contactsCount: number }) {
  const { can } = useAuth()
  const canViewContacts = can("contact.view")
  const [contacts, setContacts] = useState<AccountContactPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const contactsHref = `/contacts?account=${accountId}`

  const loadContacts = useCallback(async (signal?: AbortSignal) => {
    if (!canViewContacts) return
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<unknown>(listUrl(`${API_BASE_URL}/v1/contacts`, { account: accountId, page: 1, per_page: 4 }), { signal })
      setContacts(accountContactsFrom(body))
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load contacts for this account.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [accountId, canViewContacts])

  useEffect(() => {
    if (!canViewContacts) return
    const controller = new AbortController()
    void loadContacts(controller.signal)
    return () => controller.abort()
  }, [canViewContacts, loadContacts])

  if (!canViewContacts) return null

  return <section className="border-t border-border pt-5" aria-labelledby={`account-contacts-${accountId}`}>
    <header className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h2 id={`account-contacts-${accountId}`} className="text-lg font-semibold tracking-tight">Contacts</h2><Badge variant="secondary" aria-label={`${contactsCount} contacts`}>{contactsCount}</Badge></div><p className="mt-1 text-sm text-muted-foreground">People connected to this account.</p></div><Button asChild variant="outline" size="sm"><Link to={contactsHref}>View all contacts</Link></Button></header>
    <div className="mt-4">{loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 w-full" />)}</div> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void loadContacts()}>Try again</Button></div> : contacts.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{contacts.map((contact) => <article key={contact.id} className="flex min-h-36 flex-col border border-border bg-muted/20 p-4"><div className="flex min-w-0 items-center gap-3"><PersonAvatar name={contact.name} /><div className="min-w-0"><p className="truncate font-medium">{contact.name}</p><p className="truncate text-xs text-muted-foreground">{contact.title || "No title recorded"}</p></div></div><Button asChild variant="outline" size="sm" className="mt-auto w-full"><Link to={`/contacts/${contact.id}`} aria-label={`Open ${contact.name}`}>Open contact</Link></Button></article>)}</div> : <div className="border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">No contacts are associated with this account.</div>}</div>
  </section>
}
function AccountInputField({ inputId, label, error, icon, children, className }: { inputId: string; label: string; error?: string; icon: ReactNode; children: ReactNode; className?: string }) {
  const labelId = `${inputId}-label`
  return <Field className={className}><InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{icon}{label}<span className="font-normal text-muted-foreground">(required)</span></span></InputGroupText></InputGroupAddon>{children}</InputGroup><FieldError>{error}</FieldError></Field>
}

function AccountDetailsEditor({ create = false, form, saving, onCancel, onSubmit, hideToolbar = false, formId }: { create?: boolean; form: ReturnType<typeof useForm<AccountFormValues>>; saving: boolean; onCancel: () => void; onSubmit: () => void; hideToolbar?: boolean; formId?: string }) {
  const { register, formState: { errors } } = form
  const inputClassName = "h-9 rounded-none border-0 px-2.5 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
  return <form id={formId} onSubmit={onSubmit} className={hideToolbar ? "w-full" : "w-full border-t border-border pt-5"}>
    {!hideToolbar && <div className="sticky top-0 z-10 -mt-5 border-b border-border bg-background py-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">{create ? "Create account" : "Edit account"}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Organization information</h2></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? (create ? "Creating…" : "Saving…") : create ? "Create" : <><Save className="me-2 size-3.5" />Save changes</>}</Button></div></div></div>}
    <FieldGroup className={`${hideToolbar ? "mt-0" : "mt-6"} grid w-full gap-4 sm:grid-cols-2`}>
      <AccountInputField inputId="account-details-name" label="Name" error={errors.name?.message} icon={<Building2 className="size-3.5" aria-hidden="true" />}><InputGroupInput id="account-details-name" aria-labelledby="account-details-name-label" aria-invalid={Boolean(errors.name)} autoComplete="organization" {...register("name")} className={inputClassName} /></AccountInputField>
      <AccountInputField inputId="account-details-industry" label="Industry" error={errors.industry?.message} icon={<BriefcaseBusiness className="size-3.5" aria-hidden="true" />}><InputGroupInput id="account-details-industry" aria-labelledby="account-details-industry-label" aria-invalid={Boolean(errors.industry)} {...register("industry")} className={inputClassName} /></AccountInputField>
      <AccountInputField inputId="account-details-phone" label="Phone" error={errors.phone?.message} icon={<Phone className="size-3.5" aria-hidden="true" />}><InputGroupInput id="account-details-phone" aria-labelledby="account-details-phone-label" aria-invalid={Boolean(errors.phone)} type="tel" autoComplete="tel" {...register("phone")} className={inputClassName} /></AccountInputField>
      <AccountInputField inputId="account-details-address" label="Address" error={errors.address?.message} icon={<MapPin className="size-3.5" aria-hidden="true" />}><InputGroupInput id="account-details-address" aria-labelledby="account-details-address-label" aria-invalid={Boolean(errors.address)} autoComplete="street-address" {...register("address")} className={inputClassName} /></AccountInputField>
    </FieldGroup>
  </form>
}
function AccountDetailsSkeleton() { return <div className="mx-auto max-w-[100rem] space-y-6 p-6 lg:p-8"><div className="border-b border-border pb-6"><Skeleton className="h-7 w-24" /><Skeleton className="mt-6 h-10 w-3/5" /><Skeleton className="mt-3 h-5 w-2/5" /><Skeleton className="mt-8 h-12 w-full" /></div><Skeleton className="h-72 w-full" /></div> }
function AccountDetailsLoadError({ message, backTo, onRetry }: { message: string; backTo: string; onRetry: () => void }) { return <div className="mx-auto max-w-xl p-6 lg:p-8"><div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p className="font-semibold">Unable to open account</p><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-4 flex gap-2"><Button onClick={onRetry}>Try again</Button><Button asChild variant="outline"><Link to={backTo}>Back to accounts</Link></Button></div></div></div> }
