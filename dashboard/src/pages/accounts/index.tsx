import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react"
import { ChevronDown, Eye, Funnel, ImageIcon, MapPin, Pencil, Phone, Plus, RefreshCw, Search, Trash2, X } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { API_BASE_URL, apiFetch, apiJson, readApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AccountDialog } from "@/components/shared/account-dialog"
import { ActionTooltip, detailsPath, type Account, type AccountListBody, type AccountListRecord } from "./shared"
import { t } from "@/lib/i18n"

const filterMotionTransition = { type: "spring", stiffness: 500, damping: 42, mass: 0.65 } as const
const filterSlideTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const }

function ForbiddenAccounts() { return <ErrorState kind="forbidden" title={t("Accounts are restricted")} description={t("You do not have permission to view accounts.")} actionLabel={t("Return to overview")} actionTo="/" /> }
function AccountImage({ name, image }: { name: string; image: Account["image"] }) { return image ? <img src={image.thumbnail_url || image.url} alt={`${name} logo`} className="size-10 rounded-md border border-border bg-white object-contain p-1 dark:bg-white" /> : <div aria-label={t("No image for {name}", { name: name })} className="grid size-10 place-items-center rounded-md border border-dashed border-border bg-white dark:bg-white"><ImageIcon className="size-4 text-muted-foreground" aria-hidden="true" /></div> }

export function AccountsPage() {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const query = searchParams.get("q") ?? ""
  const returnParams = new URLSearchParams(searchParams)
  returnParams.delete("record")
  returnParams.delete("mode")
  const returnSearch = returnParams.toString()
  const [queryInput, setQueryInput] = useState(query)
  const [accounts, setAccounts] = useState<AccountListRecord[]>([])
  const [meta, setMeta] = useState<AccountListBody["meta"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
  const [deleteError, setDeleteError] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<AccountListBody>(listUrl(`${API_BASE_URL}/v1/accounts`, { page, q: query }), { signal })
      setAccounts(Array.isArray(body.data) ? body.data : Array.isArray(body.accounts) ? body.accounts : [])
      setMeta(body.meta ?? null)
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : t("Unable to load accounts."))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    if (!can("account.view")) return
    const controller = new AbortController()
    void loadAccounts(controller.signal)
    return () => controller.abort()
  }, [can, loadAccounts])
  useEffect(() => { setQueryInput(query) }, [query])
  useEffect(() => {
    if (queryInput === query) return
    const timeout = window.setTimeout(() => setSearchParams((current) => {
      const params = new URLSearchParams(current)
      if (queryInput.trim()) params.set("q", queryInput.trim())
      else params.delete("q")
      params.set("page", "1")
      return params
    }), 500)
    return () => window.clearTimeout(timeout)
  }, [query, queryInput, setSearchParams])

  const setParams = (next: Record<string, string | undefined>) => setSearchParams((current) => {
    const params = new URLSearchParams(current)
    Object.entries(next).forEach(([key, value]) => value === undefined ? params.delete(key) : params.set(key, value))
    return params
  })
  const safePage = meta?.current_page ?? page
  const lastPage = meta?.last_page ?? 1
  const hasFilters = Boolean(query)
  const canCreate = can("account.create")
  const canEdit = can("account.edit")
  const canDelete = can("account.delete")

  function openCreateDialog() { setEditingAccount(null); setDialogOpen(true) }
  function openEditDialog(account: Account) { setEditingAccount(account); setDialogOpen(true) }
  async function deleteAccount() {
    if (!pendingDelete?.id) return
    setDeleting(true)
    setDeleteError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}/v1/accounts/${pendingDelete.id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      setPendingDelete(null)
      await loadAccounts()
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : t("Unable to delete this account."))
    } finally {
      setDeleting(false)
    }
  }

  if (!can("account.view")) return <ForbiddenAccounts />
  return <div className="space-y-6 p-6 lg:p-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">{t("Accounts")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("Keep company context clear across contacts and deals.")}</p></div>
    {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="relative">
      <div className="flex items-end justify-between gap-4"><div className="filter-tab filter-tab-roundout ms-3"><button type="button" aria-expanded={filtersOpen} aria-controls="accounts-filter-panel" onClick={() => setFiltersOpen((open) => !open)} className="filter-tab-roundout-button inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium text-foreground transition-colors"><Funnel className="size-3.5" aria-hidden="true" /><span>{t("Filter")}</span><motion.span animate={{ rotate: filtersOpen ? 180 : 0 }} transition={filterMotionTransition} className="inline-flex"><ChevronDown className="size-4" aria-hidden="true" /></motion.span></button></div><div className="mb-1 flex shrink-0 gap-2"><Button type="button" variant="outline" className="shrink-0" onClick={() => void loadAccounts()} disabled={loading}><RefreshCw className="size-4" />{t("Refresh")}</Button>{canCreate && <Button type="button" variant="outline" onClick={openCreateDialog}><Plus className="size-4" />{t("New account")}</Button>}</div></div>
      <motion.div initial={false} animate={{ height: filtersOpen ? "auto" : 0 }} transition={filterSlideTransition} className="overflow-hidden"><div className="search-filter-card rounded-t-md rounded-b-none bg-muted/60 shadow-sm dark:bg-muted/70"><div className="p-4" id="accounts-filter-panel" aria-hidden={!filtersOpen}><div className="flex items-end gap-3"><div className="min-w-56 flex-1"><label className="text-xs font-medium text-muted-foreground" htmlFor="account-search">{t("Search")}</label><div className="relative mt-1"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input id="account-search" className="ps-8" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder={t("Name, industry, phone, address…")} /></div></div>{hasFilters && <Button variant="ghost" size="sm" onClick={() => setParams({ q: undefined, page: "1" })}><X className="me-1.5 size-3.5" />{t("Clear")}</Button>}</div></div></div></motion.div>
      <section data-testid="accounts-table-surface" className={`min-w-0 overflow-hidden ${filtersOpen ? "rounded-b-md rounded-t-none" : "rounded-md"} border border-border bg-muted/60 dark:bg-muted/70`}><Table><TableHeader className="bg-foreground/[0.06] dark:bg-white/[0.06]"><TableRow><TableHead className="w-14">{t("Image")}</TableHead><TableHead>{t("Account")}</TableHead><TableHead>{t("Industry")}</TableHead><TableHead>{t("Phone")}</TableHead><TableHead>{t("Address")}</TableHead><TableHead className="text-end">{t("Leads")}</TableHead><TableHead className="w-32 text-end">{t("Actions")}</TableHead></TableRow></TableHeader><TableBody className="[&_tr]:border-b-0 [&_tr:nth-child(even)]:bg-foreground/[0.04] dark:[&_tr:nth-child(even)]:bg-white/[0.04]">{loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>{Array.from({ length: 7 }, (_, cell) => <TableCell key={cell}><Skeleton className="h-5 w-3/4" /></TableCell>)}</TableRow>) : accounts.length ? accounts.map((account) => { const hasContacts = (account.contacts_count ?? 0) > 0; return <TableRow key={account.id}><TableCell><AccountImage name={account.name} image={account.image} /></TableCell><TableCell><div className="font-medium">{account.name}</div></TableCell><TableCell>{account.industry}</TableCell><TableCell><span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" aria-hidden="true" />{account.phone}</span></TableCell><TableCell><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-muted-foreground" aria-hidden="true" />{account.address}</span></TableCell><TableCell className="text-end font-mono text-sm tabular-nums">{account.contacts_count ?? "—"}</TableCell><TableCell className="text-end"><div className="flex justify-end gap-1"><ActionTooltip label={t("View account")}><Button asChild variant="ghost" size="icon-sm"><Link to={detailsPath(account.id, returnSearch)} aria-label={t("View {name}", { name: account.name })}><Eye /></Link></Button></ActionTooltip>{canEdit && <ActionTooltip label={t("Edit account")}><Button type="button" variant="ghost" size="icon-sm" aria-label={t("Edit {name}", { name: account.name })} onClick={() => openEditDialog(account)}><Pencil /></Button></ActionTooltip>}{canDelete && (hasContacts ? <ActionTooltip label={t("Accounts with contacts cannot be deleted.")}><span tabIndex={0} className="inline-flex"><Button type="button" variant="ghost" size="icon-sm" aria-label={t("Delete {name}", { name: account.name })} className="text-destructive hover:text-destructive" disabled><Trash2 /></Button></span></ActionTooltip> : <ActionTooltip label={t("Delete account")}><Button type="button" variant="ghost" size="icon-sm" aria-label={t("Delete {name}", { name: account.name })} className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setPendingDelete(account) }}><Trash2 /></Button></ActionTooltip>)}</div></TableCell></TableRow> }) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{hasFilters ? <>{t("No accounts match the current filters.")} <Button variant="link" size="sm" className="ms-1" onClick={() => setParams({ q: undefined, page: "1" })}>{t("Clear filters")}</Button></> : <div><p>{t("No accounts found.")}</p>{canCreate && <Button type="button" variant="link" size="sm" className="mt-1" onClick={openCreateDialog}>{t("Create an account")}</Button>}</div>}</TableCell></TableRow>}</TableBody></Table><ResourcePagination page={safePage} lastPage={lastPage} disabled={loading} onPageChange={(nextPage) => setParams({ page: String(nextPage) })} /></section>
    </div>
    <AccountDialog open={dialogOpen} account={editingAccount} onOpenChange={setDialogOpen} onSaved={() => void loadAccounts()} />
    <ResourceDeleteDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deleting) { setPendingDelete(null); setDeleteError("") } }} title={t("Delete {name}?", { name: pendingDelete?.name ?? t("account") })} description={t("This permanently removes {name} and its account record. This action cannot be undone.", { name: pendingDelete?.name ?? t("this account") })} confirmLabel={t("Delete account")} pending={deleting} error={deleteError} onConfirm={deleteAccount} />
  </div>
}
