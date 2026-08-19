/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/auth/auth-provider"
import type { components as ContactComponents, paths as ContactPaths } from "@/api/generated/Contact"
import { API_BASE_URL, apiJson } from "@/api/client"
import { listUrl } from "@/api/list-query"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { PhoneField } from "@/components/shared/phone-field"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Field, FieldError, FieldGroup } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { BriefcaseBusiness, Building2, Mail, MapPin, Phone, Save } from "lucide-react"
import { Link } from "react-router-dom"
import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"

export type Account = ContactComponents["schemas"]["Account"]
export type AccountDetails = ContactComponents["schemas"]["AccountDetails"]
export type AccountListRecord = Account & { contacts_count?: number }
type Contact = ContactComponents["schemas"]["Contact"]
export type AccountCreateRequest = ContactPaths["/accounts"]["post"]["requestBody"]["content"]["application/json"]
export type AccountEnvelope = { account?: Account; data?: Account }
export type AccountDetailsEnvelope = ContactPaths["/accounts/{id}"]["get"]["responses"][200]["content"]["application/json"]
export type AccountListBody = { data?: AccountListRecord[]; accounts?: AccountListRecord[]; meta?: { current_page?: number; last_page?: number; total?: number } }
export type AccountFormValues = AccountCreateRequest
type AccountContactPreview = Pick<Contact, "id" | "name" | "phone" | "title" | "email">

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Enter an account name."),
  industry: z.string().trim().min(1, "Enter an industry."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  address: z.string().trim().min(1, "Enter an address."),
})

export const emptyValues: AccountFormValues = { name: "", industry: "", phone: "", address: "" }
export const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "—"
export function detailsPath(id: number, returnSearch = "", edit = false) {
  const params = new URLSearchParams()
  if (edit) params.set("mode", "edit")
  if (returnSearch) params.set("return", returnSearch)
  return `/accounts/${id}${params.size ? `?${params}` : ""}`
}
export function valuesFromAccount(account: Account): AccountFormValues { return { name: account.name, industry: account.industry, phone: account.phone, address: account.address } }
export function toPayload(values: AccountFormValues): AccountCreateRequest { return { name: values.name.trim(), industry: values.industry.trim(), phone: values.phone.trim(), address: values.address.trim() } }
export function unwrapAccount(body: AccountEnvelope): Account | null {
  const value = body.account ?? body.data
  return value && typeof value === "object" && !Array.isArray(value) ? value : null
}
export function unwrapAccountDetails(body: AccountDetailsEnvelope): AccountDetails { return body.account }

export function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="top">{label}</TooltipContent></Tooltip>
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) }
function accountContactsFrom(body: unknown): AccountContactPreview[] {
  if (!isRecord(body)) return []
  const values = Array.isArray(body.data) ? body.data : Array.isArray(body.contacts) ? body.contacts : []
  return values.flatMap((value) => {
    if (!isRecord(value) || typeof value.id !== "number" || typeof value.name !== "string" || typeof value.phone !== "string") return []
    return [{ id: value.id, name: value.name, phone: value.phone, title: typeof value.title === "string" ? value.title : null, email: typeof value.email === "string" ? value.email : null }]
  })
}

export function AccountContacts({ accountId, contactsCount }: { accountId: number; contactsCount: number }) {
  const { can } = useAuth()
  const canViewContacts = can("contact.view")
  const [contacts, setContacts] = useState<AccountContactPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const contactsHref = `/contacts?account=${accountId}`
  const loadContacts = useCallback(async (signal?: AbortSignal) => {
    if (!canViewContacts) return
    setLoading(true); setError("")
    try { setContacts(accountContactsFrom(await apiJson<unknown>(listUrl(`${API_BASE_URL}/v1/contacts`, { account: accountId, page: 1, per_page: 16 }), { signal }))) }
    catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Unable to load contacts for this account.") }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [accountId, canViewContacts])
  useEffect(() => { if (!canViewContacts) return; const controller = new AbortController(); void loadContacts(controller.signal); return () => controller.abort() }, [canViewContacts, loadContacts])
  if (!canViewContacts) return null
  return <section className="rounded-xl bg-muted/60 p-4 dark:bg-muted/70" aria-labelledby={`account-contacts-${accountId}`}><header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h2 id={`account-contacts-${accountId}`} className="text-lg font-semibold tracking-tight">Contacts</h2><Badge variant="secondary" aria-label={`${contactsCount} contacts`}>{contactsCount}</Badge></div><Button asChild variant="outline" size="sm"><Link to={contactsHref}>View all contacts</Link></Button></header><div className="mt-4">{loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 16 }, (_, index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)}</div> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={() => void loadContacts()}>Try again</Button></div> : contacts.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{contacts.map((contact) => <article key={contact.id} className="w-full rounded-xl bg-background p-3 shadow-md"><div className="flex items-start gap-2.5"><PersonAvatar name={contact.name} size="sm" /><h3 className="min-w-0 flex-1 truncate pt-0.5 text-sm font-semibold">{contact.name}</h3></div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground"><span className="flex items-center gap-2 truncate"><Phone className="size-3 shrink-0" aria-hidden="true" />{contact.phone}</span>{contact.email && <span className="flex items-center gap-2 truncate"><Mail className="size-3 shrink-0" aria-hidden="true" />{contact.email}</span>}</div><footer className="-mx-3 -mb-3 mt-3 flex items-center justify-between rounded-b-xl bg-foreground/10 px-3 py-2.5"><span className="truncate text-xs text-muted-foreground">{contact.title || "Contact"}</span><Link to={`/contacts/${contact.id}`} aria-label={`Open ${contact.name}`} className="text-xs font-medium text-foreground hover:text-primary">Open contact</Link></footer></article>)}</div> : <div className="border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground">No contacts are associated with this account.</div>}</div></section>
}

function AccountInputField({ error, icon, children, plain = false }: { error?: string; icon?: ReactNode; children: ReactNode; plain?: boolean }) {
  return <Field>{plain ? children : <InputGroup><InputGroupAddon className="bg-transparent">{icon}</InputGroupAddon>{children}</InputGroup>}<FieldError>{error}</FieldError></Field>
}

export function AccountEditor({ create = false, form, saving, onCancel, onSubmit, hideToolbar = false, formId, media }: { create?: boolean; form: UseFormReturn<AccountFormValues>; saving: boolean; onCancel: () => void; onSubmit: () => void; hideToolbar?: boolean; formId?: string; media?: ReactNode }) {
  const { register, setValue, watch, formState: { errors } } = form
  const inputClassName = "h-9 rounded-none border-0 px-2.5 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
  return <form id={formId} onSubmit={onSubmit} className={hideToolbar ? "w-full" : "w-full border-t border-border pt-5"}>{!hideToolbar && <div className="sticky top-0 z-10 -mt-5 border-b border-border bg-background py-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">{create ? "Create account" : "Edit account"}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Organization information</h2></div><div className="flex gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? (create ? "Creating…" : "Saving…") : create ? "Create" : <><Save className="me-2 size-3.5" />Save changes</>}</Button></div></div></div>}<FieldGroup className={`${hideToolbar ? "mt-0" : "mt-6"} w-full gap-4`}>{media && <div>{media}</div>}<AccountInputField error={errors.name?.message} icon={<Building2 className="size-3.5" aria-hidden="true" />}><InputGroupInput id="account-details-name" aria-label="Name" aria-invalid={Boolean(errors.name)} autoComplete="organization" placeholder="Name" {...register("name")} className={inputClassName} /></AccountInputField><AccountInputField error={errors.industry?.message} icon={<BriefcaseBusiness className="size-3.5" aria-hidden="true" />}><InputGroupInput id="account-details-industry" aria-label="Industry" aria-invalid={Boolean(errors.industry)} placeholder="Industry" {...register("industry")} className={inputClassName} /></AccountInputField><AccountInputField plain error={errors.phone?.message}><PhoneField id="account-details-phone" aria-label="Phone" aria-invalid={Boolean(errors.phone)} autoComplete="tel" placeholder="Phone" value={watch("phone")} onValueChange={(value) => setValue("phone", value, { shouldDirty: true, shouldValidate: true })} /></AccountInputField><AccountInputField error={errors.address?.message} icon={<MapPin className="size-3.5" aria-hidden="true" />}><InputGroupInput id="account-details-address" aria-label="Address" aria-invalid={Boolean(errors.address)} autoComplete="street-address" placeholder="Address" {...register("address")} className={inputClassName} /></AccountInputField></FieldGroup></form>
}
