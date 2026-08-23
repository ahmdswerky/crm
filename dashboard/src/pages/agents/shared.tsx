import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router-dom"
import { ArrowDown, ArrowRight, ArrowUp, AtSign, BriefcaseBusiness, CircleQuestionMark, Dices, Eye, EyeOff, HandCoins, ImageIcon, KeyRound, Mail, Save, ShieldCheck, UserRound, type LucideIcon } from "lucide-react"
import { z } from "zod"
import type { components as AuthComponents } from "@/api/generated/Auth"
import type { components as MarketingComponents } from "@/api/generated/Marketing"
import type { components as SalesComponents } from "@/api/generated/Sales"
import { API_BASE_URL, apiJson, ApiError } from "@/api/client"
import { listUrl } from "@/api/list-query"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { SingleMediaField } from "@/components/shared/single-media-field"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { PhoneField } from "@/components/shared/phone-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableHead } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type User = AuthComponents["schemas"]["User"]
export type Role = AuthComponents["schemas"]["Role"]
export type Permission = AuthComponents["schemas"]["Permission"]
type Lead = MarketingComponents["schemas"]["Lead"]
type Deal = SalesComponents["schemas"]["Deal"]
export type UserEnvelope = { user: User }
export type AgentFormValues = { name: string; username: string; email: string; phone: string; password: string; roles: string[] }

export const emptyValues: AgentFormValues = { name: "", username: "", email: "", phone: "", password: "", roles: [] }
export const labelFor = (value: string) => value.replaceAll(".", " / ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)
export const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value)
const formatCommissionCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
export const detailsPath = (id: number, returnSearch = "", edit = false) => {
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

export const agentSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  username: z.string().trim().min(1, "Enter a username."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  password: z.string().superRefine((value, context) => { if (value && value.length < 6) context.addIssue({ code: "custom", message: "Use at least 6 characters." }) }),
  roles: z.array(z.string()),
})

export function valuesFromUser(user: User): AgentFormValues {
  return { name: user.name, username: user.username, email: user.email, phone: user.phone, password: "", roles: (user.roles ?? []).map((role) => role.name) }
}

export function toPayload(values: AgentFormValues, editing: boolean, includeRoles: boolean) {
  const base = { name: values.name.trim(), username: values.username.trim(), email: values.email.trim(), phone: values.phone.trim() }
  return editing ? { _method: "PUT" as const, ...base, ...(includeRoles ? { roles: values.roles } : {}) } : { user: { ...base, password: values.password, ...(includeRoles ? { roles: values.roles } : {}) } }
}

export function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

export function RoleReference({ role, stopPropagation = true }: { role: { id?: number; name: string }; stopPropagation?: boolean }) {
  return role.id === undefined ? <Badge variant="secondary">{labelFor(role.name)}</Badge> : <Badge asChild variant="secondary"><Link to={`/settings/roles/${role.id}`} onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}>{labelFor(role.name)}</Link></Badge>
}

export function AgentCommissionHeaders({ visible }: { visible: boolean }) {
  return <><TableHead>Manager</TableHead>{visible && <TableHead>Commission</TableHead>}</>
}

function EmptyCommissionLine() { return <span data-testid="empty-commission-line" className="block h-px w-20 bg-muted-foreground/30" aria-hidden="true" /> }

export function AgentCommissionCells({ agent, visible }: { agent: User; visible: boolean }) {
  if (!visible) return null
  if (agent.is_super) return <TableCell><EmptyCommissionLine /></TableCell>
  const potential = typeof agent.total_potential_commission === "number" ? formatCommissionCurrency(agent.total_potential_commission) : "—"
  const actual = typeof agent.total_actual_commission === "number" ? formatCommissionCurrency(agent.total_actual_commission) : "—"
  return <TableCell><div className="flex items-center gap-2 whitespace-nowrap"><Badge variant="secondary" className="font-mono text-xs">{typeof agent.commission_rate !== "number" ? "—" : `${formatNumber(agent.commission_rate)}%`}</Badge><span className="font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">{actual}</span><Tooltip><TooltipTrigger asChild><button type="button" aria-label={`Potential commission ${potential}`} className="text-muted-foreground transition-colors hover:text-foreground" onClick={(event) => event.stopPropagation()}><CircleQuestionMark className="size-3.5" aria-hidden="true" /></button></TooltipTrigger><TooltipContent side="top">Potential commission: {potential}</TooltipContent></Tooltip></div></TableCell>
}

export function AgentAccessCell({ agent }: { agent: User }) {
  return <><TableCell><div className="flex max-w-64 flex-wrap gap-1">{agent.roles?.length ? agent.roles.map((role) => <RoleReference key={role.name} role={role} />) : !agent.is_super && <span className="text-xs text-muted-foreground">—</span>}{agent.is_super && <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-900 dark:text-blue-100"><ShieldCheck className="me-1 size-3" />Super admin</Badge>}</div></TableCell><AgentManagerCell manager={agent.manager} /></>
}

function AgentManagerCell({ manager }: { manager?: User | null }) {
  return <TableCell>{manager ? <div className="flex min-w-36 items-center gap-2"><PersonAvatar name={manager.name} avatar={manager.avatar} size="sm" /><BriefcaseBusiness className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><Link className="truncate text-sm font-medium hover:text-primary" to={`/agents/${manager.id ?? 0}`} onClick={(event) => event.stopPropagation()}>{manager.name}</Link></div> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
}

function PermissionBadge({ permission }: { permission: Permission }) {
  const [resource, action] = permission.name.split(".", 2)
  const actionClass = action === "delete" ? "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-200" : action === "create" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : action === "edit" ? "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100" : "border-blue-500/25 bg-blue-500/10 text-blue-800 dark:text-blue-200"
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${actionClass}`} aria-label={permission.name}>{labelFor(action ?? resource.replaceAll("-", " "))}</span>
}

export function PermissionGroups({ permissions, compact = false }: { permissions: Permission[]; compact?: boolean }) {
  const groups = new Map<string, Permission[]>()
  for (const permission of permissions) groups.set(permission.name.split(".", 1)[0], [...(groups.get(permission.name.split(".", 1)[0]) ?? []), permission])
  return <div className={compact ? "space-y-4" : "space-y-4 p-5"}>{[...groups.entries()].map(([resource, group]) => <div key={resource}><p className="mb-2 text-sm font-semibold text-foreground">{labelFor(resource)}</p><div className="flex flex-wrap gap-1.5">{group.map((permission) => <PermissionBadge key={permission.name} permission={permission} />)}</div></div>)}</div>
}

function DealPropertyCover({ property }: { property: Deal["property"] }) {
  const cover = property.images?.[0]
  const className = "h-10 w-[3.333rem]"
  return cover ? <img src={cover.thumbnail_url || cover.url} alt="" className={`${className} shrink-0 border border-border object-cover`} loading="lazy" /> : <span className={`${className} grid shrink-0 place-items-center border border-dashed border-border bg-muted/20 text-muted-foreground`} aria-hidden="true"><ImageIcon className="size-3.5" /></span>
}

function DealValue({ value, dealValue }: { value: number; dealValue: number }) {
  const changed = dealValue !== value; const higher = dealValue > value; const tone = higher ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"
  return <div className="flex items-center gap-1 whitespace-nowrap font-mono text-xs" aria-label={`Deal value ${formatCurrency(dealValue)}; intended value ${formatCurrency(value)}`}>{changed && (higher ? <ArrowUp className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> : <ArrowDown className="size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />)}<div className="space-y-0.5">{changed ? <><div className="text-muted-foreground/60 line-through">{formatCurrency(value)}</div><div className={`${tone} text-base font-bold`}>{formatCurrency(dealValue)}</div></> : <div className="text-lg font-bold text-foreground">{formatCurrency(value)}</div>}</div></div>
}

function DealCommission({ dealValue, commissionRate }: { dealValue: number; commissionRate: number }) {
  const commission = dealValue * commissionRate / 100
  return <div className="inline-flex items-center gap-1.5 whitespace-nowrap" aria-label={`Commission ${formatCurrency(commission)}`}><HandCoins className="size-3.5 text-muted-foreground" aria-hidden="true" /><span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(commission)}</span></div>
}

export function AgentDeals({ agentId, totalPotentialCommission, totalActualCommission }: { agentId: number; totalPotentialCommission?: number; totalActualCommission?: number }) {
  const { can } = useAuth(); const canViewDeals = can("deal.view"); const canViewContacts = can("contact.view"); const canViewProperties = can("property.view")
  const [deals, setDeals] = useState<Deal[]>([]); const [total, setTotal] = useState<number | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("")
  const loadDeals = useCallback(async (signal?: AbortSignal) => { setLoading(true); setError(""); try { const body = await apiJson<Paginated<Deal>>(listUrl(`${API_BASE_URL}/v1/deals`, { agent: agentId, page: 1, per_page: 3 }), { signal }); setDeals(body.data); setTotal(body.meta.total) } catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError") ) setError(caught instanceof Error ? caught.message : "Unable to load this agent's deals.") } finally { if (!signal?.aborted) setLoading(false) } }, [agentId])
  useEffect(() => { if (!canViewDeals) return; const controller = new AbortController(); void loadDeals(controller.signal); return () => controller.abort() }, [canViewDeals, loadDeals])
  if (!canViewDeals) return null
  return <section className="border border-border bg-card" aria-labelledby={`agent-deals-${agentId}`}><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex items-center gap-2"><h2 id={`agent-deals-${agentId}`} className="font-semibold">Deals</h2>{total !== null && <Badge variant="secondary" aria-label={`${total} deals`}>{total}</Badge>}</div><Button asChild variant="outline" size="sm"><Link to={`/deals?agent=${agentId}`}>View all deals</Link></Button></header><div className="p-5">{loading ? <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void loadDeals()}>Try again</Button></div> : deals.length ? <div className="space-y-3">{deals.map((deal) => <article key={deal.id ?? `${deal.property.title}-${deal.contact.id}`} className="overflow-hidden border border-border"><div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4"><div className="flex min-w-0 items-center gap-2"><DealPropertyCover property={deal.property} /><div className="min-w-0"><div className="truncate font-medium">{canViewProperties && deal.property.id !== undefined ? <Link className="text-primary hover:text-foreground" to={`/properties/${deal.property.id}`}>{deal.property.title}</Link> : deal.property.title}</div><div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"><PersonAvatar name={deal.contact.name} size="sm" className="!size-4 [&_[data-slot=avatar-fallback]]:!text-[7px]" />{canViewContacts && deal.contact.id ? <Link className="truncate hover:text-primary" to={`/contacts/${deal.contact.id}`}>{deal.contact.name}</Link> : <span className="truncate">{deal.contact.name}</span>}</div></div></div><DealValue value={deal.value} dealValue={deal.deal_value} /></div><footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-muted/40 px-4 py-1.5"><Badge className={dealStatusPillClass[deal.status]}>{labelFor(deal.status)}</Badge><div className="ms-auto flex items-center gap-3"><DealCommission dealValue={deal.deal_value} commissionRate={deal.commission_rate} />{deal.id && <ActionTooltip label="View deal"><Button asChild variant="ghost" size="icon"><Link to={`/deals/${deal.id}`} aria-label={`View deal for ${deal.property.title}`}><ArrowRight className="size-4" /></Link></Button></ActionTooltip>}</div></footer></article>)}</div> : <div className="border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">No deals are assigned to this agent.</div>}</div><footer className="grid gap-3 border-t border-border bg-muted/40 p-4 sm:grid-cols-2"><div className="border border-border bg-card px-4 py-3"><p className="text-sm font-medium text-muted-foreground">Potential commission</p><p className="mt-2 font-mono text-lg font-semibold text-foreground">{formatCurrency(totalPotentialCommission ?? 0)}</p></div><div className="border border-border bg-card px-4 py-3"><p className="text-sm font-medium text-muted-foreground">Actual commission</p><p className="mt-2 font-mono text-lg font-semibold text-foreground">{formatCurrency(totalActualCommission ?? 0)}</p></div></footer></section>
}

export function AgentLeads({ agentId }: { agentId: number }) {
  const { can } = useAuth(); const canViewLeads = can("lead.view"); const [leads, setLeads] = useState<Lead[]>([]); const [total, setTotal] = useState<number | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("")
  const loadLeads = useCallback(async (signal?: AbortSignal) => { setLoading(true); setError(""); try { const body = await apiJson<Paginated<Lead>>(listUrl(`${API_BASE_URL}/v1/leads`, { assigned_agent: agentId, page: 1, per_page: 3 }), { signal }); setLeads(body.data); setTotal(body.meta.total) } catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load assigned leads.") } finally { if (!signal?.aborted) setLoading(false) } }, [agentId])
  useEffect(() => { if (!canViewLeads) return; const controller = new AbortController(); void loadLeads(controller.signal); return () => controller.abort() }, [canViewLeads, loadLeads])
  if (!canViewLeads) return null
  return <section className="border border-border bg-card" aria-labelledby={`agent-leads-${agentId}`}><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex items-center gap-2"><h2 id={`agent-leads-${agentId}`} className="font-semibold">Leads</h2>{total !== null && <Badge variant="secondary" aria-label={`${total} leads`}>{total}</Badge>}</div><Button asChild variant="outline" size="sm"><Link to={`/pipeline?assigned_agent=${agentId}`}>View all leads</Link></Button></header><div className="p-5">{loading ? <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void loadLeads()}>Try again</Button></div> : leads.length ? <div className="divide-y divide-border border-y border-border">{leads.map((lead) => <div key={lead.id ?? lead.email} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0">{lead.id !== undefined ? <Link className="block truncate font-medium text-primary hover:text-foreground" to={`/leads/${lead.id}`}>{lead.name}</Link> : <span className="block truncate font-medium">{lead.name}</span>}<p className="mt-0.5 truncate text-sm text-muted-foreground">{lead.city}</p></div><Badge className={leadStatusPillClass[lead.status]}>{labelFor(lead.status)}</Badge></div>)}</div> : <div className="border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">No leads are assigned to this agent.</div>}</div></section>
}

export function canDeleteAgent(currentUser: User | null, hasDeletePermission: boolean, agent: User) { return hasDeletePermission && agent.is_super !== true && agent.id !== currentUser?.id }

function AgentInputField({ error, children }: { error?: string; children: ReactNode }) {
  return <Field>{children}<FieldError>{error}</FieldError></Field>
}

function AgentInputIcon({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="relative"><span className="pointer-events-none absolute start-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" aria-hidden="true"><Icon className="size-4" /></span>{children}</div>
}

function AgentPasswordInput({ inputProps, visible, onGenerate, onToggleVisibility }: { inputProps: ComponentProps<typeof Input>; visible: boolean; onGenerate: () => void; onToggleVisibility: () => void }) {
  return <div className="relative"><span className="pointer-events-none absolute start-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" aria-hidden="true"><KeyRound className="size-4" /></span><Input {...inputProps} type={visible ? "text" : "password"} className="ps-9 pe-20" /><div className="absolute end-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5"><ActionTooltip label="Generate strong password"><Button type="button" variant="ghost" size="icon-xs" aria-label="Generate strong password" onClick={onGenerate}><Dices /></Button></ActionTooltip><ActionTooltip label={visible ? "Hide password" : "Show password"}><Button type="button" variant="ghost" size="icon-xs" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={onToggleVisibility}>{visible ? <EyeOff /> : <Eye />}</Button></ActionTooltip></div></div>
}

function generateStrongPassword() {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*_-+="]
  const alphabet = groups.join("")
  const randomValues = new Uint32Array(16)
  crypto.getRandomValues(randomValues)
  const characters = groups.map((group, index) => group[randomValues[index] % group.length])
  for (let index = groups.length; index < randomValues.length; index += 1) characters.push(alphabet[randomValues[index] % alphabet.length])
  for (let index = characters.length - 1; index > 0; index -= 1) { const swapIndex = randomValues[index] % (index + 1); [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]] }
  return characters.join("")
}

function AgentFields({ create, form, isSuper, roles }: { create: boolean; form: ReturnType<typeof useForm<AgentFormValues>>; isSuper: boolean; roles: Role[] }) {
  const { register, formState: { errors }, watch, setValue } = form
  const selectedRoles = watch("roles")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const generatePassword = () => setValue("password", generateStrongPassword(), { shouldDirty: true, shouldValidate: true })
  const toggleRole = (name: string, checked: boolean) => {
    const isAgentRole = name.toLowerCase() === "agent"
    const hasRole = selectedRoles.some((role) => role.toLowerCase() === name.toLowerCase())
    const nextRoles = checked
      ? isAgentRole
        ? hasRole ? selectedRoles : [...selectedRoles, name]
        : [...selectedRoles.filter((role) => role.toLowerCase() !== "agent"), name]
      : selectedRoles.filter((role) => role.toLowerCase() !== name.toLowerCase())
    setValue("roles", [...new Set(nextRoles)], { shouldDirty: true })
  }
  return <FieldGroup className="w-full"><AgentInputField error={errors.name?.message}><AgentInputIcon icon={UserRound}><Input id="agent-name" aria-label="Name" placeholder="Name" aria-invalid={Boolean(errors.name)} autoComplete="name" className="ps-9" {...register("name")} /></AgentInputIcon></AgentInputField><AgentInputField error={errors.username?.message}><AgentInputIcon icon={AtSign}><Input id="agent-username" aria-label="Username" placeholder="Username" aria-invalid={Boolean(errors.username)} autoComplete="username" className="ps-9" {...register("username")} /></AgentInputIcon></AgentInputField><AgentInputField error={errors.phone?.message}><PhoneField id="agent-phone" aria-label="Phone" placeholder="Phone" aria-invalid={Boolean(errors.phone)} autoComplete="tel" value={watch("phone")} onValueChange={(value) => setValue("phone", value, { shouldDirty: true, shouldValidate: true })} /></AgentInputField><AgentInputField error={errors.email?.message}><AgentInputIcon icon={Mail}><Input id="agent-email" aria-label="Email" placeholder="Email" aria-invalid={Boolean(errors.email)} type="email" autoComplete="email" className="ps-9" {...register("email")} /></AgentInputIcon></AgentInputField>{create && <AgentInputField error={errors.password?.message}><AgentPasswordInput inputProps={{ id: "agent-password", "aria-label": "Password", placeholder: "Password", "aria-invalid": Boolean(errors.password), autoComplete: "new-password", required: true, ...register("password") }} visible={passwordVisible} onGenerate={generatePassword} onToggleVisibility={() => setPasswordVisible((visible) => !visible)} /></AgentInputField>}{isSuper && <section className="border-t border-border pt-4"><p className="text-sm font-medium">Roles</p><p className="mt-1 text-xs text-muted-foreground">Assign roles to control this agent's effective permissions.</p><div className="mt-3 space-y-1">{roles.length ? roles.map((role) => <label key={role.id ?? role.name} className="flex items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/50"><Checkbox checked={selectedRoles.some((selectedRole) => selectedRole.toLowerCase() === role.name.toLowerCase())} onCheckedChange={(checked) => toggleRole(role.name, checked === true)} /><span>{labelFor(role.name)}</span></label>) : <p className="text-sm text-muted-foreground">No roles are available.</p>}</div></section>}</FieldGroup>
}

export function AgentDialog({ open, mode, agent, isSuper, roles, onOpenChange, onSaved }: { open: boolean; mode: "create" | "edit"; agent?: User | null; isSuper: boolean; roles: Role[]; onOpenChange: (open: boolean) => void; onSaved: (user: User) => void }) {
  const form = useForm<AgentFormValues>({ resolver: zodResolver(agentSchema), defaultValues: emptyValues })
  const [error, setError] = useState("")
  useEffect(() => { if (!open) return; form.reset(mode === "create" ? { ...emptyValues, roles: ["agent"] } : agent ? valuesFromUser(agent) : emptyValues); setError("") }, [agent, form, mode, open])
  const submit = form.handleSubmit(async (values) => {
    setError("")
    if (mode === "create" && !values.password) { form.setError("password", { message: "Enter a password." }); return }
    if (mode === "edit" && !agent?.id) return
    try {
      const endpoint = mode === "create" ? `${API_BASE_URL}/v1/users` : `${API_BASE_URL}/v1/users/${agent?.id}`
      const result = await apiJson<UserEnvelope>(endpoint, { method: "POST", body: JSON.stringify(toPayload(values, mode === "edit", isSuper)) })
      onSaved(result.user)
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof AgentFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : mode === "create" ? "Unable to create this agent." : "Unable to save this agent.")
    }
  })
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{mode === "create" ? "Create agent" : `Edit ${agent?.name ?? "agent"}`}</DialogTitle></DialogHeader><form id="agent-create-form" onSubmit={submit} className="space-y-5">{mode === "edit" && agent?.id !== undefined && <div className="border-b border-border pb-5"><SingleMediaField ownerType="user" ownerId={agent.id} collection="main" label="Agent avatar" description="Upload or replace this agent's avatar." disabled={form.formState.isSubmitting} /></div>}<AgentFields create={mode === "create"} form={form} isSuper={isSuper} roles={roles} />{error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="agent-create-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? mode === "create" ? "Creating…" : "Saving…" : mode === "create" ? "Create" : <><Save className="me-2 size-3.5" />Save agent</>}</Button></DialogFooter></form></DialogContent></Dialog>
}

export function ForbiddenAgents() { return <ErrorState kind="forbidden" title="Agents are restricted" description="You do not have permission to view staff accounts." actionLabel="Return to overview" actionTo="/" /> }
export function AgentDetailsState({ title, description }: { title: string; description: string }) { return <ErrorState kind="not-found" title={title} description={description} actionLabel="Return to agents" actionTo="/agents" /> }
