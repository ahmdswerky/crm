import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, BriefcaseBusiness, MapPin, Pencil, Phone, Trash2 } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { API_BASE_URL, ApiError, apiFetch, apiJson, readApiError } from "@/api/client"
import { useAuth } from "@/auth/auth-provider"
import { ActivityLogList } from "@/components/shared/activity-log-list"
import { ErrorState } from "@/components/shared/error-state"
import { ResourceDeleteDialog } from "@/components/shared/resource-delete-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountDialog } from "@/components/shared/account-dialog"
import { AccountContacts, ActionTooltip, type AccountDetails, type AccountDetailsEnvelope, unwrapAccountDetails } from "./shared"

function ForbiddenAccounts() { return <ErrorState kind="forbidden" title="Accounts are restricted" description="You do not have permission to view accounts." actionLabel="Return to overview" actionTo="/" /> }
function AccountDetailsState({ title, description, backTo = "/accounts" }: { title: string; description: string; backTo?: string }) { return <ErrorState kind="not-found" title={title} description={description} actionLabel="Return to accounts" actionTo={backTo} /> }
function DetailsMetric({ icon, label, value, action }: { icon: ReactNode; label: string; value: ReactNode; action?: ReactNode }) { return <div className="flex items-start gap-3 rounded-md px-3 py-3"><span className="mt-0.5 text-muted-foreground" aria-hidden="true">{icon}</span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{label}</p><div className="mt-1 font-medium text-foreground">{value}</div>{action && <div className="mt-1.5 text-xs font-medium">{action}</div>}</div></div> }
function AccountDetailsSkeleton() { return <div className="mx-auto max-w-[100rem] space-y-6 p-6 lg:p-8"><div className="pb-6"><Skeleton className="h-7 w-24" /><Skeleton className="mt-6 h-10 w-3/5" /><Skeleton className="mt-3 h-5 w-2/5" /><Skeleton className="mt-8 h-12 w-full" /></div><Skeleton className="h-72 w-full" /></div> }
function AccountDetailsLoadError({ message, backTo, onRetry }: { message: string; backTo: string; onRetry: () => void }) { return <div className="mx-auto max-w-xl p-6 lg:p-8"><div role="alert" className="border border-destructive/30 bg-destructive/5 p-5"><p className="font-semibold">Unable to open account</p><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-4 flex gap-2"><Button onClick={onRetry}>Try again</Button><Button asChild variant="outline"><Link to={backTo}>Back to accounts</Link></Button></div></div></div> }

export function AccountDetailsPage() {
  const { can } = useAuth()
  const { accountId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const id = Number(accountId)
  const [account, setAccount] = useState<AccountDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [accessError, setAccessError] = useState<"unauthorized" | "forbidden" | "missing" | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const returnQuery = searchParams.get("return")
  const indexHref = returnQuery ? `/accounts?${returnQuery}` : "/accounts"
  const loadAccount = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isInteger(id) || id < 1) return
    setLoading(true); setError(""); setAccessError(null)
    try { const body = await apiJson<AccountDetailsEnvelope>(`${API_BASE_URL}/v1/accounts/${id}`, { signal }); setAccount(unwrapAccountDetails(body)) }
    catch (caught) { if (caught instanceof DOMException && caught.name === "AbortError") return; if (caught instanceof ApiError) { if (caught.status === 401) setAccessError("unauthorized"); else if (caught.status === 403) setAccessError("forbidden"); else if (caught.status === 404) setAccessError("missing"); else setError(caught.message) } else setError(caught instanceof Error ? caught.message : "Unable to load this account.") }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [id])
  useEffect(() => { if (!can("account.view") || !Number.isInteger(id) || id < 1) { setLoading(false); return }; const controller = new AbortController(); void loadAccount(controller.signal); return () => controller.abort() }, [can, id, loadAccount])
  async function deleteCurrentAccount() { if (!account?.id) return; setDeleting(true); setDeleteError(""); try { const response = await apiFetch(`${API_BASE_URL}/v1/accounts/${account.id}`, { method: "DELETE" }); if (!response.ok) throw await readApiError(response); navigate(indexHref, { replace: true }) } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Unable to delete this account.") } finally { setDeleting(false) } }
  if (!can("account.view")) return <ForbiddenAccounts />
  if (!Number.isInteger(id) || id < 1) return <AccountDetailsState title="Account not found" description="The account identifier is invalid." backTo={indexHref} />
  if (loading) return <AccountDetailsSkeleton />
  if (accessError === "unauthorized") return <ErrorState kind="unauthorized" title="Your session has ended" description="Sign in again to continue working with accounts." actionLabel="Sign in" actionTo="/login" />
  if (accessError === "forbidden") return <ErrorState kind="forbidden" title="This account is restricted" description="You do not have access to this account record." actionLabel="Return to accounts" actionTo={indexHref} />
  if (accessError === "missing") return <AccountDetailsState title="Account not found" description="This account may have been removed or you may not have access to it." backTo={indexHref} />
  if (!account) return <AccountDetailsLoadError message={error || "Unable to load this account."} backTo={indexHref} onRetry={() => void loadAccount()} />
  const canEdit = can("account.edit"); const canDelete = can("account.delete")
  const hasContacts = account.contacts_count > 0
  return <main className="mx-auto max-w-[100rem] space-y-6 p-6 pb-24 lg:p-8"><header className="pb-5"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={indexHref}><ArrowLeft className="me-2 size-3.5" />Accounts</Link></Button><div className="mt-5 min-w-0"><p className="text-xs font-medium text-muted-foreground">CRM / Organizations</p><h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{account.name}</h1></div></div><div className="flex flex-wrap items-center gap-2">{canEdit && <ActionTooltip label="Edit account"><Button variant="outline" size="icon-sm" aria-label="Edit account" onClick={() => setEditOpen(true)}><Pencil /></Button></ActionTooltip>}{canDelete && (hasContacts ? <ActionTooltip label="Accounts with contacts cannot be deleted."><span tabIndex={0} className="inline-flex"><Button variant="outline" size="icon-sm" aria-label="Delete" className="text-destructive hover:text-destructive" disabled><Trash2 /></Button></span></ActionTooltip> : <ActionTooltip label="Delete account"><Button variant="outline" size="icon-sm" aria-label="Delete" className="text-destructive hover:text-destructive" onClick={() => { setDeleteError(""); setDeleteOpen(true) }}><Trash2 /></Button></ActionTooltip>)}</div></div></header><p className="sr-only" aria-live="polite">{error}</p>{error && <div role="alert" className="flex items-center justify-between gap-4 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{error}</span><Button variant="ghost" size="sm" className="shrink-0" onClick={() => setError("")}>Dismiss</Button></div>}<div className="min-w-0 space-y-8"><section aria-label="Account information" className="w-full max-w-md space-y-1 rounded-lg bg-muted/60 p-2 dark:bg-muted/70"><DetailsMetric icon={<BriefcaseBusiness className="size-4" />} label="Industry" value={account.industry} /><DetailsMetric icon={<Phone className="size-4" />} label="Phone" value={<a className="text-primary hover:text-foreground" href={`tel:${account.phone}`}>{account.phone}</a>} /><DetailsMetric icon={<MapPin className="size-4" />} label="Location" value={account.address} /></section><AccountContacts accountId={account.id} contactsCount={account.contacts_count} /><ActivityLogList model="account" id={account.id} title="Account activity" onReverted={() => void loadAccount()} /></div><AccountDialog open={editOpen} account={account} onOpenChange={setEditOpen} onSaved={(nextAccount) => setAccount((current) => current ? { ...nextAccount, contacts_count: current.contacts_count } : null)} /><ResourceDeleteDialog open={deleteOpen} onOpenChange={(open) => { if (!open && !deleting) { setDeleteOpen(false); setDeleteError("") } }} title={`Delete ${account.name}?`} description={<>This permanently removes {account.name} and its account record. This action cannot be undone.</>} confirmLabel="Delete account" pending={deleting} error={deleteError} onConfirm={deleteCurrentAccount} /></main>
}
