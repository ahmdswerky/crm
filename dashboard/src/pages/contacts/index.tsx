import { useCallback, useEffect, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, Building2, CalendarDays, Eye, Mail, Pencil, Phone, RefreshCw, Save, Search, Trash2, UserRound, X } from "lucide-react"
import { z } from "zod"
import type { components as ContactComponents, paths as ContactPaths } from "@/api/generated/Contact"
import { API_BASE_URL, apiFetch, apiJson, ApiError, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { PhoneField } from "@/components/shared/phone-field"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { ResourcePreviewDrawer } from "@/components/shared/resource-preview-drawer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { SearchableResourcePicker, type SearchableResourceOption, type SearchableResourcePage } from "@/components/shared/searchable-resource-picker"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Contact = ContactComponents["schemas"]["Contact"]
type Account = ContactComponents["schemas"]["Account"]
type Lead = ContactComponents["schemas"]["Lead"]
type AccountSummary = Pick<Account, "id" | "name"> & Partial<Omit<Account, "id" | "name">>
type ContactRecord = Omit<Contact, "account" | "lead"> & { account?: AccountSummary; account_id?: number; lead?: Lead }
type ContactUpdateRequest = ContactPaths["/contacts/{id}"]["post"]["requestBody"]["content"]["application/json"]
type ContactBasePayload = Pick<ContactUpdateRequest, "name" | "phone" | "account_id"> & Partial<Pick<ContactUpdateRequest, "title" | "email">>
type ContactUpdatePayload = Pick<ContactUpdateRequest, "_method" | "name" | "phone" | "account_id"> & Partial<Pick<ContactUpdateRequest, "title" | "email">>
type ContactEnvelope = { contact: Contact }

const contactPermission = { view: "contact.view", edit: "contact.edit", delete: "contact.delete" } as const

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter a contact name."),
  title: z.string(),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")),
  phone: z.string().trim().min(1, "Enter a phone number."),
  account_id: z.number().int("Choose an account.").min(1, "Choose an account.").max(10, "Choose an account from the documented range."),
})

type ContactFormValues = z.infer<typeof contactSchema>
type ContactListBody = { data?: unknown[]; contacts?: unknown[]; meta?: { current_page?: number; last_page?: number } }
const emptyValues: ContactFormValues = { name: "", title: "", email: "", phone: "", account_id: 0 }

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
function normalizeAccount(value: unknown): AccountSummary | undefined {
  if (!isRecord(value)) return undefined
  const id = numberValue(value.id)
  const name = stringValue(value.name)
  if (id === undefined || !name) return undefined
  const industry = stringValue(value.industry)
  const phone = stringValue(value.phone)
  const address = stringValue(value.address)
  const createdAt = stringValue(value.created_at)
  return {
    id,
    name,
    ...(industry ? { industry } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(createdAt ? { created_at: createdAt } : {}),
  }
}
function normalizeLead(value: unknown): Lead | undefined {
  if (!isRecord(value)) return undefined
  const id = numberValue(value.id)
  const name = stringValue(value.name)
  const email = stringValue(value.email)
  const phone = stringValue(value.phone)
  const city = stringValue(value.city)
  const status = stringValue(value.status)
  if (id === undefined || !name || !email || !phone || !city || !status || !["pending", "contacted", "qualified", "unqualified"].includes(status)) return undefined
  const source = value.source === null ? null : stringValue(value.source)
  return {
    id,
    name,
    email,
    phone,
    city,
    status: status as Lead["status"],
    ...(value.address === null ? { address: null } : stringValue(value.address) ? { address: stringValue(value.address) } : {}),
    ...(value.company_name === null ? { company_name: null } : stringValue(value.company_name) ? { company_name: stringValue(value.company_name) } : {}),
    ...(source === null || source === "facebook" || source === "whatsapp" || source === "instagram" || source === "x" ? { source } : {}),
  }
}
function normalizeContact(value: unknown): ContactRecord | undefined {
  if (!isRecord(value)) return undefined
  const id = numberValue(value.id)
  const name = stringValue(value.name)
  if (id === undefined || !name) return undefined
  const phone = stringValue(value.phone) ?? "—"
  const accountId = numberValue(value.account_id)
  const account = normalizeAccount(value.account)
  const lead = normalizeLead(value.lead)
  const createdAt = stringValue(value.created_at)
  return {
    id,
    name,
    phone,
    title: value.title === null ? null : stringValue(value.title),
    email: value.email === null ? null : stringValue(value.email),
    ...(account ? { account } : {}),
    ...(accountId !== undefined ? { account_id: accountId } : {}),
    ...(lead ? { lead } : {}),
    ...(createdAt ? { created_at: createdAt } : {}),
  }
}
function collectionValues(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (!isRecord(body)) return []
  if (Array.isArray(body.data)) return body.data
  if (isRecord(body.data)) return collectionValues(body.data)
  if (Array.isArray(body.contacts)) return body.contacts
  if (Array.isArray(body.accounts)) return body.accounts
  return []
}
function collectionItems<T>(body: unknown, normalize: (value: unknown) => T | undefined): T[] {
  return collectionValues(body).map(normalize).filter((value): value is T => value !== undefined)
}
function searchableResourcePage(body: unknown, options: SearchableResourceOption[], requestedPage: number): SearchableResourcePage {
  const meta = isRecord(body) && isRecord(body.meta) ? body.meta : {}
  return { options, currentPage: numberValue(meta.current_page) ?? requestedPage, lastPage: numberValue(meta.last_page) ?? requestedPage }
}
async function loadAccountOptions(query: string, page: number, signal: AbortSignal): Promise<SearchableResourcePage> {
  const params = new URLSearchParams({ page: String(page) })
  if (query.trim()) params.set("q", query.trim())
  const body = await apiJson<unknown>(`${API_BASE_URL}/v1/accounts?${params}`, { signal })
  const options = collectionItems(body, normalizeAccount).map((account) => ({ id: account.id, label: account.name, description: account.industry ?? account.address }))
  return searchableResourcePage(body, options, page)
}
function valuesFromContact(contact: ContactRecord): ContactFormValues { return { name: contact.name, title: contact.title ?? "", email: contact.email ?? "", phone: contact.phone, account_id: contact.account?.id ?? contact.account_id ?? 0 } }
function toBasePayload(values: ContactFormValues): ContactBasePayload { return { name: values.name.trim(), title: values.title.trim() || null, email: values.email.trim() || null, phone: values.phone.trim(), account_id: values.account_id } }
function formatDate(value?: string) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) }
function detailsPath(id: number, returnSearch = "", edit = false) {
  const params = new URLSearchParams()
  if (edit) params.set("mode", "edit")
  if (returnSearch) params.set("return", returnSearch)
  return `/contacts/${id}${params.size ? `?${params}` : ""}`
}

export function ContactsPage() {
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
  const titleFilter = searchParams.get("title") ?? ""
  const accountFilter = searchParams.get("account") ?? ""
  const [queryInput, setQueryInput] = useState(query)
  const [titleInput, setTitleInput] = useState(titleFilter)
  const [contacts, setContacts] = useState<ContactRecord[]>([])
  const [meta, setMeta] = useState<ContactListBody["meta"] | null>(null)
  const [selected, setSelected] = useState<ContactRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [previewError, setPreviewError] = useState<{ message: string; status?: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [pendingDelete, setPendingDelete] = useState<ContactRecord | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const loadContacts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("")
    try {
      const body = await apiJson<ContactListBody>(listUrl(`${API_BASE_URL}/v1/contacts`, {
        page,
        q: query,
        title: titleFilter,
        account: accountFilter,
      }), { signal })
      const nextContacts = collectionItems(body, normalizeContact)
      setContacts(nextContacts)
      setMeta(body.meta ?? null)
      return nextContacts
    }
    catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return []; setError(caught instanceof Error ? caught.message : "Unable to load contacts."); return [] }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [accountFilter, page, query, titleFilter])
  useEffect(() => {
    if (!can(contactPermission.view)) return
    const controller = new AbortController(); void loadContacts(controller.signal)
    return () => controller.abort()
  }, [can, loadContacts])
  useEffect(() => {
    if (mode === "edit") {
      if (selectedId) navigate(detailsPath(selectedId, returnSearch, true), { replace: true })
      else setSearchParams((current) => { const next = new URLSearchParams(current); next.delete("mode"); return next })
      return
    }
    if (mode === "create") {
      navigate(`/contacts${returnSearch ? `?${returnSearch}` : ""}`, { replace: true })
      return
    }
    if (!selectedId) { setSelected(null); setPreviewError(null); setSelectionLoading(false); return }
    const listed = contacts.find((contact) => contact.id === selectedId)
    setSelected(listed ?? null)
    const controller = new AbortController()
    setSelectionLoading(true)
    setPreviewError(null)
    void apiJson<ContactEnvelope>(`${API_BASE_URL}/v1/contacts/${selectedId}`, { signal: controller.signal }).then((body) => {
      const normalized = normalizeContact(body.contact)
      if (!normalized) throw new Error("The contact response did not contain a usable contact record.")
      setSelected(normalized)
    }).catch((caught) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setSelected(null)
      setPreviewError({ message: caught instanceof Error ? caught.message : "Unable to load this contact.", status: caught instanceof ApiError ? caught.status : undefined })
    }).finally(() => { if (!controller.signal.aborted) setSelectionLoading(false) })
    return () => controller.abort()
  }, [contacts, mode, navigate, returnSearch, selectedId, setSearchParams])

  const setParams = (next: Record<string, string | undefined>) => setSearchParams((current) => { const params = new URLSearchParams(current); Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value)); return params })
  const updateFilter = (key: "account", value: string) => setParams({ [key]: value || undefined, page: "1", record: undefined, mode: undefined })
  const clearFilters = () => setParams({ q: undefined, title: undefined, account: undefined, page: "1", record: undefined, mode: undefined })
  useEffect(() => { setQueryInput(query) }, [query])
  useEffect(() => { setTitleInput(titleFilter) }, [titleFilter])
  useEffect(() => {
    if (queryInput === query && titleInput === titleFilter) return
    const timeout = window.setTimeout(() => setSearchParams((current) => { const params = new URLSearchParams(current); const values: Record<string, string> = { q: queryInput, title: titleInput }; Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key)); params.set("page", "1"); params.delete("record"); params.delete("mode"); return params }), 500)
    return () => window.clearTimeout(timeout)
  }, [query, queryInput, setSearchParams, titleFilter, titleInput])

  const currentPage = meta?.current_page ?? page
  const lastPage = meta?.last_page ?? 1
  const visibleContacts = contacts
  const hasFilters = Boolean(query || titleFilter || accountFilter)
  useEffect(() => { if (!loading && page > lastPage) setSearchParams((current) => { const params = new URLSearchParams(current); params.set("page", String(lastPage)); params.delete("record"); params.delete("mode"); return params }) }, [lastPage, loading, page, setSearchParams])

  const openContact = (id: number) => selectedId === id && !mode ? setParams({ record: undefined }) : setParams({ record: String(id), mode: undefined })
  const requestDelete = (contact: ContactRecord) => { setPendingDelete(contact); setDeleteError(""); setNotice("") }
  async function deleteContact() {
    if (!pendingDelete?.id) return
    setDeleting(true); setDeleteError("")
    try { const response = await apiFetch(`${API_BASE_URL}/v1/contacts/${pendingDelete.id}`, { method: "DELETE" }); if (!response.ok) throw await readApiError(response); const deletedId = pendingDelete.id; setPendingDelete(null); if (selectedId === deletedId) setParams({ record: undefined, mode: undefined }); await loadContacts(); setNotice("Contact deleted.") }
    catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this contact.") }
    finally { setDeleting(false) }
  }

  if (!can(contactPermission.view)) return <ForbiddenContacts />
  const canEdit = can(contactPermission.edit); const canDelete = can(contactPermission.delete)
  const previewOpen = Boolean(selectedId && mode !== "create" && mode !== "edit")
  return <div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="text-xs font-medium text-muted-foreground">CRM / People</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Contacts</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Keep the people behind every account visible, connected, and easy to reach.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setNotice(""); void loadContacts() }} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button></div></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{notice && <div role="status" className="border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{notice}</div>}
    <div className="space-y-3 border-b border-border pb-4"><div className="flex flex-wrap items-end gap-3"><div className="min-w-56 flex-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="contact-search">Search people and accounts</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="contact-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Name, title, email, phone, account…" /></div></div><div className="min-w-44"><label className="text-xs font-medium text-muted-foreground" htmlFor="contact-title-filter">Title</label><Input id="contact-title-filter" className="mt-1" value={titleInput} onChange={(event) => setTitleInput(event.target.value)} placeholder="Any title" /></div><SearchableResourcePicker id="contact-account-filter" label="Account" labelStyle="plain" value={Number(accountFilter) || 0} onChange={(value) => updateFilter("account", String(value))} loadOptions={loadAccountOptions} placeholder="All accounts" searchPlaceholder="Search accounts…" loadingLabel="Searching accounts…" emptyLabel="No accounts found." noResultsLabel="No accounts match your search." renderOption={(option) => <span className="min-w-0"><span className="block truncate font-medium">{option.label}</span>{option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}</span>} renderSelectedOption={(option) => <span className="truncate">{option.label}</span>} className="min-w-48" />{hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="me-1.5 size-3.5" />Clear</Button>}</div></div>
    <section data-testid="contacts-table-surface" className="min-w-0 border border-border bg-card">
      <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Account</TableHead><TableHead>Reach</TableHead><TableHead className="w-48 min-w-48 max-w-48 text-end">Actions</TableHead></TableRow></TableHeader><TableBody>
        {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={4}><Skeleton className="h-5 w-3/4" /></TableCell></TableRow>) : visibleContacts.length ? visibleContacts.map((contact) => {
          const isPreviewing = selectedId === contact.id && !mode
          const accountId = contact.account?.id ?? contact.account_id
          return <TableRow key={contact.id} data-state={selectedId === contact.id ? "selected" : undefined} className="cursor-pointer" onClick={() => openContact(contact.id)}>
            <TableCell><div className="flex min-w-0 items-center gap-3"><PersonAvatar name={contact.name} size="sm" /><div className="min-w-0"><div className="truncate font-medium">{contact.name}</div><div className="truncate text-xs text-muted-foreground">{contact.title}</div></div></div></TableCell>
            <TableCell onClick={(event) => event.stopPropagation()}>{contact.account ? <Link className="inline-flex max-w-44 items-center gap-1.5 truncate text-sm text-primary hover:text-foreground" to={`/accounts/${contact.account.id}`}><Building2 className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{contact.account.name}</span></Link> : accountId ? <Link className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-foreground" to={`/accounts/${accountId}`}><Building2 className="size-3.5" aria-hidden="true" />Account #{accountId}</Link> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
            <TableCell><div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5 truncate"><Mail className="size-3.5 shrink-0" aria-hidden="true" />{contact.email || "No email"}</span><span className="inline-flex items-center gap-1.5 truncate"><span className="size-3.5 shrink-0 text-center" aria-hidden="true">☎</span>{contact.phone}</span></div></TableCell>
            <TableCell className="w-48 min-w-48 max-w-48 text-end"><div className="flex justify-end gap-1 [&_[data-slot=button]]:transition-none" onClick={(event) => event.stopPropagation()}><ActionTooltip label="Open dedicated details"><Button asChild variant={isPreviewing ? "secondary" : "ghost"} size="icon" aria-pressed={isPreviewing}><Link to={detailsPath(contact.id, returnSearch)} aria-label={`Open details for ${contact.name}`}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit contact"><Button asChild variant="ghost" size="icon"><Link to={detailsPath(contact.id, returnSearch, true)} aria-label={`Edit ${contact.name}`}><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete contact"><Button variant="ghost" size="icon" aria-label={`Delete ${contact.name}`} className="text-destructive hover:text-destructive" onClick={() => requestDelete(contact)}><Trash2 /></Button></ActionTooltip>}</div></TableCell>
          </TableRow>
        }) : <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">{hasFilters ? <>No contacts match the current filters. <Button variant="link" size="sm" className="ms-1" onClick={clearFilters}>Clear filters</Button></> : <div><p>No contacts found.</p></div>}</TableCell></TableRow>}
      </TableBody></Table><ResourcePagination page={currentPage} lastPage={lastPage} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage), record: undefined, mode: undefined })} />
    </section>
    <ResourcePreviewDrawer open={previewOpen} onOpenChange={(open) => { if (!open) setParams({ record: undefined }) }} title="Contact preview" description="Read-only contact details and available actions.">
      {selectionLoading && !selected ? <div className="space-y-4 p-5"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-32 w-full" /></div> : previewError ? <div className="space-y-3 p-5"><h2 className="font-semibold">{previewError.status === 403 ? "Contact is restricted" : previewError.status === 404 ? "Contact not found" : "Unable to load contact"}</h2><p role="alert" className="text-sm text-destructive">{previewError.message}</p><Button variant="outline" size="sm" onClick={() => setParams({ record: undefined })}>Close preview</Button></div> : selected ? <ContactInspector contact={selected} detailsHref={detailsPath(selected.id, returnSearch)} editHref={detailsPath(selected.id, returnSearch, true)} canEdit={canEdit} canDelete={canDelete} canViewAccount={can("account.view")} canViewLead={can("lead.view")} onDelete={() => requestDelete(selected)} /> : <div className="p-5 text-sm text-muted-foreground">This contact could not be loaded.</div>}
    </ResourcePreviewDrawer>
    <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) { setPendingDelete(null); setDeleteError("") } }} title={`Delete ${pendingDelete?.name ?? "contact"}?`} description={<>This permanently removes {pendingDelete?.name ?? "this contact"}. This action cannot be undone.</>} confirmLabel="Delete contact" pending={deleting} error={deleteError} onConfirm={deleteContact} />
  </div>
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) { return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip> }
function ContactInspector({ contact, detailsHref, editHref, canEdit, canDelete, canViewAccount, canViewLead, onDelete }: { contact: ContactRecord | null; detailsHref: string; editHref: string; canEdit: boolean; canDelete: boolean; canViewAccount: boolean; canViewLead: boolean; onDelete: () => void }) {
  if (!contact) return null
  return <div className="flex min-h-full flex-col">
    <div className="space-y-5 p-5">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><PersonAvatar name={contact.name} size="lg" /><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Contact record</p><h2 className="mt-1 truncate text-lg font-semibold">{contact.name}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{contact.title || "—"}</p></div></div><div className="flex shrink-0 gap-1"><ActionTooltip label="Open dedicated details"><Button asChild variant="outline" size="icon"><Link to={detailsHref} aria-label="Open dedicated details"><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label="Edit contact"><Button asChild variant="outline" size="icon"><Link to={editHref} aria-label="Edit contact"><Pencil /></Link></Button></ActionTooltip>}{canDelete && <ActionTooltip label="Delete contact"><Button variant="outline" size="icon" aria-label="Delete contact" className="text-destructive hover:text-destructive" onClick={onDelete}><Trash2 /></Button></ActionTooltip>}</div></div>
    <Badge variant="secondary" className="w-fit gap-1.5"><UserRound className="size-3.5" aria-hidden="true" />Person</Badge>
    <Separator /><div><p className="text-xs font-medium text-muted-foreground">Reach this person</p><dl className="mt-3 grid gap-4 text-sm"><Info icon={<Mail />} label="Email" value={contact.email ?? "—"} /><Info icon={<span aria-hidden="true">☎</span>} label="Phone" value={contact.phone} /></dl></div>
    <section className="border border-border bg-muted/20 p-4"><div className="flex items-start gap-3"><Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Account</p><p className="mt-1 truncate font-semibold">{canViewAccount && contact.account ? <Link className="text-primary hover:text-foreground" to={`/accounts/${contact.account.id}`}>{contact.account.name}</Link> : contact.account?.name ?? "No account recorded"}</p>{contact.account?.industry && <p className="mt-1 truncate text-xs text-muted-foreground">{contact.account.industry}</p>}</div></div></section>
    <Separator /><div><p className="text-xs font-medium text-muted-foreground">Relationship context</p><dl className="mt-3 grid gap-4 text-sm"><Info icon={<CalendarDays />} label="Added" value={formatDate(contact.created_at)} /></dl></div>
    </div>
    {contact.lead && canViewLead && <footer className="mt-auto border-t border-border bg-muted/20 p-5"><LeadShowLink lead={contact.lead} prominent className="w-full" /></footer>}
  </div>
}
function Info({ icon, label, value, href }: { icon?: ReactNode; label: string; value: string; href?: string }) { const content = href ? <Link className="text-primary hover:text-foreground" to={href}>{value}</Link> : value; return <div><dt className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon && <span className="[&>svg]:size-3.5" aria-hidden="true">{icon}</span>}{label}</dt><dd className="mt-1 font-medium">{content}</dd></div> }
function ForbiddenContacts() { return <ErrorState kind="forbidden" title="Contacts are restricted" description="You do not have permission to view contacts." actionLabel="Return to overview" actionTo="/" /> }

export function ContactDetailsPage() {
  const { can } = useAuth()
  const { contactId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const id = Number(contactId)
  const [contact, setContact] = useState<ContactRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [missing, setMissing] = useState(false)
  const [accessError, setAccessError] = useState<"unauthorized" | "forbidden" | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const form = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema), defaultValues: emptyValues })
  const editing = searchParams.get("mode") === "edit" && can(contactPermission.edit)
  const returnSearch = searchParams.get("return") ?? ""
  const indexHref = returnSearch ? `/contacts?${returnSearch}` : "/contacts"

  const loadContact = useCallback(async (signal?: AbortSignal) => {
    if (!can(contactPermission.view) || !Number.isInteger(id) || id < 1) { setLoading(false); return }
    setLoading(true); setError(""); setMissing(false); setAccessError(null)
    try {
      const body = await apiJson<ContactEnvelope>(`${API_BASE_URL}/v1/contacts/${id}`, { signal })
      const normalized = normalizeContact(body.contact)
      if (!normalized) throw new Error("The contact response did not contain a usable contact record.")
      setContact(normalized); form.reset(valuesFromContact(normalized))
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      if (caught instanceof ApiError && caught.status === 401) setAccessError("unauthorized")
      else if (caught instanceof ApiError && caught.status === 403) setAccessError("forbidden")
      else if (caught instanceof ApiError && caught.status === 404) setMissing(true)
      else setError(caught instanceof Error ? caught.message : "Unable to load this contact.")
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [can, form, id])

  useEffect(() => {
    const controller = new AbortController()
    void loadContact(controller.signal)
    return () => controller.abort()
  }, [form, loadContact])

  function setEditMode(enabled: boolean) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (enabled) next.set("mode", "edit")
      else next.delete("mode")
      return next
    })
  }

  const saveContact = form.handleSubmit(async (values) => {
    if (!contact?.id) return
    const accountId = contact.account?.id ?? contact.account_id
    if (!accountId) {
      setError("This contact cannot be updated because its response does not include the account ID required by the API.")
      return
    }
    setError("")
    try {
      const payload: ContactUpdatePayload = { ...toBasePayload(values), account_id: accountId, _method: "PUT" }
      const result = await apiJson<ContactEnvelope>(`${API_BASE_URL}/v1/contacts/${contact.id}`, { method: "POST", body: JSON.stringify(payload) })
      const normalized = normalizeContact(result.contact)
      if (!normalized) throw new Error("The update response did not contain a usable contact record.")
      setContact(normalized); form.reset(valuesFromContact(normalized)); setEditMode(false)
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof ContactFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : "Unable to save this contact.")
    }
  })

  async function deleteCurrentContact() {
    if (!contact?.id) return
    setDeleting(true); setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/contacts/${contact.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      navigate(indexHref, { replace: true })
    } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this contact.") }
    finally { setDeleting(false) }
  }

  if (!can(contactPermission.view)) return <ForbiddenContacts />
  if (!Number.isInteger(id) || id < 1) return <ContactDetailsState title="Contact not found" description="The contact identifier is invalid." backTo={indexHref} />
  if (loading) return <ContactDetailsSkeleton />
  if (accessError === "unauthorized") return <ErrorState kind="unauthorized" title="Your session has ended" description="Sign in again to continue working with contacts." actionLabel="Sign in" actionTo="/login" />
  if (accessError === "forbidden") return <ErrorState kind="forbidden" title="This contact is restricted" description="You do not have access to this contact record." actionLabel="Return to contacts" actionTo={indexHref} />
  if (missing) return <ContactDetailsState title="Contact not found" description="This contact may have been removed or you may not have access to it." backTo={indexHref} />
  if (!contact) return <ContactDetailsLoadError message={error || "Unable to load this contact."} backTo={indexHref} onRetry={() => void loadContact()} />

  const canEdit = can(contactPermission.edit)
  const canDelete = can(contactPermission.delete)
  const accountName = contact.account?.name ?? "No account recorded"
  const accountLink = contact.account && can("account.view") ? <Link className="text-primary hover:text-foreground" to={`/accounts/${contact.account.id}`}>{contact.account.name}</Link> : accountName

  return <main className="mx-auto max-w-[100rem] space-y-6 p-6 pb-24 lg:p-8">
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Contacts</Link></Button><div className="mt-5 flex min-w-0 items-center gap-3"><PersonAvatar name={contact.name} size="lg" /><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">CRM / People</p><h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{contact.name}</h1><p className="mt-1 truncate text-sm text-muted-foreground">{contact.title || "No title recorded"}</p></div></div></div>
        <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => void loadContact()} disabled={form.formState.isSubmitting || deleting}><RefreshCw className="me-2 size-3.5" />Refresh</Button>{canEdit && <Button size="sm" variant={editing ? "secondary" : "default"} onClick={() => { form.reset(valuesFromContact(contact)); setEditMode(!editing) }}><Pencil className="me-2 size-3.5" />{editing ? "Editing" : "Edit contact"}</Button>}{canDelete && <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setDeleteOpen(true) }}><Trash2 className="me-2 size-3.5" />Delete</Button>}</div>
      </div>
    </header>

    <p className="sr-only" aria-live="polite">{error}</p>
    {error && <div role="alert" className="flex items-center justify-between gap-4 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setError("")}>Dismiss</Button></div>}

    {editing ? <ContactDetailsEditor form={form} saving={form.formState.isSubmitting} accountLink={accountLink} onCancel={() => { form.reset(valuesFromContact(contact)); setEditMode(false) }} onSubmit={saveContact} /> : <><ContactMobileActionBar contact={contact} /><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start"><div className="min-w-0 space-y-8"><section className="grid border-y border-border sm:grid-cols-2"><DetailsMetric label="Phone" value={contact.phone} action={contact.phone ? <a className="text-primary hover:text-foreground" href={`tel:${contact.phone}`}>Call</a> : undefined} /><DetailsMetric label="Email" value={contact.email || "No email recorded"} action={contact.email ? <a className="text-primary hover:text-foreground" href={`mailto:${contact.email}`}>Email</a> : undefined} /></section><section className="border-t border-border pt-5"><h2 className="text-lg font-semibold tracking-tight">Account</h2>{contact.account ? <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2"><ContactInfo label="Organization" value={accountLink} /><ContactInfo label="Industry" value={contact.account.industry || "—"} /><ContactInfo label="Phone" value={contact.account.phone ? <a className="text-primary hover:text-foreground" href={`tel:${contact.account.phone}`}>{contact.account.phone}</a> : "—"} /><ContactInfo label="Address" value={contact.account.address || "—"} /></div> : <p className="mt-3 text-sm text-muted-foreground">No account is included in this contact record.</p>}</section>{contact.id !== undefined && <ActivityLogList model="contact" id={contact.id} title="Contact activity" onReverted={() => void loadContact()} />}</div><div className="hidden xl:block"><ContactActionRail contact={contact} /></div></div></>}

    <ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${contact.name}?`} description={<>This permanently removes {contact.name}. This action cannot be undone.</>} confirmLabel="Delete contact" pending={deleting} error={deleteError} onConfirm={deleteCurrentContact} />
  </main>
}

function DetailsMetric({ label, value, action }: { label: string; value: ReactNode; action?: ReactNode }) { return <div className="border-b border-border p-5 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><div className="mt-2 font-medium text-foreground">{value}</div>{action && <div className="mt-2 text-xs font-medium">{action}</div>}</div> }
function ContactInfo({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div> }

function LeadShowLink({ lead, className, prominent = false }: { lead: Lead | null | undefined; className?: string; prominent?: boolean }) {
  const { can } = useAuth()
  if (!lead || !can("lead.view")) return null
  return <Button asChild variant={prominent ? "default" : "outline"} size={prominent ? "lg" : "sm"} className={className}><Link to={`/leads/${lead.id}`}>Open lead</Link></Button>
}

function ContactMobileActionBar({ contact }: { contact: ContactRecord }) {
  return <aside className="flex flex-wrap justify-end gap-2 border-y border-border py-3 xl:hidden">{contact.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${contact.email}`}><Mail className="me-1.5 size-3.5" />Email</a></Button>}{contact.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${contact.phone}`}><Phone className="me-1.5 size-3.5" />Call</a></Button>}<LeadShowLink lead={contact.lead} className="w-full" /></aside>
}

function ContactActionRail({ contact }: { contact: ContactRecord }) {
  return <aside className="border-t border-border pt-5 xl:sticky xl:top-20"><p className="text-xs font-medium text-muted-foreground">Reachability</p><div className="mt-4 flex items-center gap-3"><PersonAvatar name={contact.name} /><div className="min-w-0"><p className="truncate font-semibold">{contact.name}</p><p className="truncate text-xs text-muted-foreground">{contact.title || "No title recorded"}</p></div></div>{(contact.email || contact.phone) ? <><div className="mt-5 space-y-3 border-t border-border pt-4">{contact.phone && <a className="flex items-center gap-2 text-sm text-primary hover:text-foreground" href={`tel:${contact.phone}`}><Phone className="size-3.5" aria-hidden="true" /><span>{contact.phone}</span></a>}{contact.email && <a className="flex items-center gap-2 text-sm text-primary hover:text-foreground" href={`mailto:${contact.email}`}><Mail className="size-3.5" aria-hidden="true" /><span className="truncate">{contact.email}</span></a>}</div><div className="mt-5 flex flex-wrap gap-2">{contact.email && <Button asChild variant="outline" size="sm"><a href={`mailto:${contact.email}`}><Mail className="me-1.5 size-3.5" />Email</a></Button>}{contact.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${contact.phone}`}><Phone className="me-1.5 size-3.5" />Call</a></Button>}</div></> : <p className="mt-3 text-sm text-muted-foreground">No contact method recorded.</p>}<LeadShowLink lead={contact.lead} className="mt-5 w-full" /></aside>
}

function BlockStartField({ inputId, label, required, error, icon, children, className, plain = false }: { inputId: string; label: string; required?: boolean; error?: string; icon?: ReactNode; children: ReactNode; className?: string; plain?: boolean }) {
  const labelId = `${inputId}-label`
  return <Field className={className}>{plain ? <><FieldLabel id={labelId} htmlFor={inputId}>{label}{required && <span className="font-normal text-muted-foreground"> (required)</span>}</FieldLabel>{children}</> : <InputGroup className="h-auto! overflow-hidden"><InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{icon}{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon>{children}</InputGroup>}<FieldError>{error}</FieldError></Field>
}

function ContactDetailsEditor({ form, saving, accountLink, onCancel, onSubmit }: { form: ReturnType<typeof useForm<ContactFormValues>>; saving: boolean; accountLink: ReactNode; onCancel: () => void; onSubmit: () => void }) {
  const { register, setValue, watch, formState: { errors } } = form
  const inputClassName = "h-8 rounded-none border-0 px-2.5 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
  return <form onSubmit={onSubmit} className="w-full border-t border-border pt-5">
    <div className="sticky top-0 z-10 -mt-5 border-b border-border bg-background py-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">Edit contact</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Contact information</h2></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Save className="me-2 size-3.5" />Save changes</>}</Button></div></div></div>
    <FieldGroup className="mt-6 grid w-full gap-4 sm:grid-cols-2">
      <BlockStartField inputId="contact-details-name" label="Name" required error={errors.name?.message}><InputGroupInput id="contact-details-name" aria-labelledby="contact-details-name-label" {...register("name")} className={inputClassName} /></BlockStartField>
      <BlockStartField inputId="contact-details-title" label="Title" error={errors.title?.message}><InputGroupInput id="contact-details-title" aria-labelledby="contact-details-title-label" {...register("title")} className={inputClassName} /></BlockStartField>
      <BlockStartField plain inputId="contact-details-phone" label="Phone" required error={errors.phone?.message}><PhoneField id="contact-details-phone" aria-labelledby="contact-details-phone-label" aria-invalid={Boolean(errors.phone)} value={watch("phone")} onValueChange={(value) => setValue("phone", value, { shouldDirty: true, shouldValidate: true })} /></BlockStartField>
      <BlockStartField inputId="contact-details-email" label="Email" error={errors.email?.message}><InputGroupInput id="contact-details-email" aria-labelledby="contact-details-email-label" type="email" {...register("email")} className={inputClassName} /></BlockStartField>
      <Field className="sm:col-span-2"><FieldLabel>Account</FieldLabel><div className="border border-border bg-muted/20 px-3 py-2 text-sm font-medium">{accountLink}</div><p className="mt-2 text-xs text-muted-foreground">The documented Accounts collection has no typed response, so this relationship stays read-only here.</p></Field>
    </FieldGroup>
  </form>
}

function ContactDetailsSkeleton() { return <div className="mx-auto max-w-[100rem] space-y-6 p-6 lg:p-8"><div className="border-b border-border pb-6"><Skeleton className="h-7 w-24" /><Skeleton className="mt-6 h-10 w-3/5" /><Skeleton className="mt-3 h-5 w-2/5" /><Skeleton className="mt-8 h-12 w-full" /></div><div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]"><Skeleton className="h-64 w-full" /><Skeleton className="h-72 w-full" /></div></div> }
function ContactDetailsState({ title, description, backTo }: { title: string; description: string; backTo: string }) { return <ErrorState kind="not-found" title={title} description={description} actionLabel="Return to contacts" actionTo={backTo} /> }
function ContactDetailsLoadError({ message, backTo, onRetry }: { message: string; backTo: string; onRetry: () => void }) { return <div className="mx-auto max-w-xl p-6 lg:p-8"><div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p className="font-semibold">Unable to open contact</p><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-4 flex gap-2"><Button onClick={onRetry}>Try again</Button><Button asChild variant="outline"><Link to={backTo}>Back to contacts</Link></Button></div></div></div> }
