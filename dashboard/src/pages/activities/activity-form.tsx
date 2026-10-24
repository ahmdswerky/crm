import { useState } from "react"
import { ArrowUpLeft, Ban, BriefcaseBusiness, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronDown, CircleUserRound, Clock3, FileText, House, Link2, Loader2, Mail, MessageSquare, Phone, PhoneIncoming, PhoneMissed, PhoneOff, Plus, Search, SlidersHorizontal, Sparkles, UserRoundX, Users, Voicemail } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuth } from "@/auth/auth-provider"
import { apiJson, ApiError } from "@/api/client"
import type { components } from "@/api/generated/Activity"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ActivityDateField } from "./activity-date-field"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { activityUrl, kinds, outcomes, type Activity, type ActivityLink, type ActivityOptions } from "./api"
import { t } from "@/lib/i18n"

const typeIcons = { call: Phone, email: Mail, message: MessageSquare, meeting: Users, viewing: House, note: FileText, task: CheckCircle2 }
const recordIcons: Record<string, typeof House> = { deal: BriefcaseBusiness, lead: CircleUserRound, contact: CircleUserRound, property: House }
const outcomeIcons: Record<string, typeof Phone> = { reached: PhoneIncoming, unanswered: PhoneMissed, busy: PhoneOff, voicemail: Voicemail, wrong_number: Ban, attended: CheckCircle2, no_show: UserRoundX }
const titles = { call: "Call", email: "Email", message: "Message", meeting: "Meeting", viewing: "Viewing", note: "Note", task: "Task" }
const subjectStarters = {
  call: ["Follow-up call", "Property requirements", "Price discussion"], email: ["Property shortlist", "Requested documents", "Follow-up email"],
  message: ["Availability check", "Viewing confirmation", "Quick follow-up"], meeting: ["Requirements review", "Offer discussion", "Next steps"],
  viewing: ["Property viewing", "Second viewing", "Virtual tour"], note: ["Client preferences", "Property feedback", "Important update"], task: ["Follow up with client", "Send property shortlist", "Prepare documents"],
}
function summaryStarters(kind: Values["kind"], outcome: string): [string, string][] {
  if (outcome === "unanswered") return [["Try again later", "No answer; try again later."], ["Message sent", "No answer; follow-up message sent."]]
  if (outcome === "busy") return [["Try again later", "Line busy; try again later."], ["Callback agreed", "Client was busy; agreed to call back."]]
  if (outcome === "voicemail") return [["Voicemail left", "Left a voicemail requesting a callback."], ["Try again later", "Reached voicemail; will try again later."]]
  if (outcome === "wrong_number") return [["Check contact details", "Wrong number; contact details need checking."]]
  if (outcome === "no_show") return [["Follow-up needed", "Client did not attend; follow-up needed."], ["Reschedule requested", "Client did not attend; rescheduling requested."]]
  if (kind === "viewing") return [["Interested", "Client liked the property; requested more details."], ["Not a match", "Property did not match the client's preferences."], ["Considering offer", "Client is considering an offer."]]
  if (kind === "meeting") return [["Next steps agreed", "Reviewed requirements and agreed on next steps."], ["Awaiting decision", "Discussed the offer; awaiting a decision."], ["More options needed", "Client requested more options."]]
  return [["Requirements discussed", "Discussed property requirements and preferences."], ["Pricing reviewed", "Reviewed pricing and available options."], ["Follow-up agreed", "Agreed to follow up with more details."]]
}

const schema = z.object({
  kind: z.enum(["call", "email", "message", "meeting", "viewing", "note", "task"]),
  subject: z.string().trim().min(1, t("Enter a subject.")).max(200), details: z.string().max(10000),
  status: z.enum(["scheduled", "completed", "cancelled", "voided"]),
  assignee: z.string().min(1, t("Choose a responsible agent.")), links: z.array(z.string()).min(1, t("Link at least one record.")),
  dueDate: z.string(), startsAt: z.string(), endsAt: z.string(), occurredAt: z.string(), outcome: z.string(), summary: z.string().max(2000),
}).superRefine((value, context) => {
  const error = (path: keyof typeof value, message: string) => context.addIssue({ code: "custom", path: [path], message })
  if (value.status === "completed" && outcomes[value.kind]) {
    if (!outcomes[value.kind]?.includes(value.outcome)) error("outcome", t("Choose an outcome."))
    if (!value.summary.trim()) error("summary", t("Add a short result summary."))
  }
  if (value.status === "scheduled" && value.kind === "task" && Boolean(value.dueDate) === Boolean(value.startsAt)) error("dueDate", t("Choose a due date or a start time."))
  if (value.status === "scheduled" && value.kind !== "task" && !value.startsAt) error("startsAt", t("Choose a start time."))
  for (const path of ["startsAt", "endsAt", "occurredAt"] as const) {
    if (value[path] && Number.isNaN(new Date(value[path]).getTime())) error(path, t("Choose a valid date and time."))
  }
  if (value.endsAt && (!value.startsAt || value.endsAt < value.startsAt)) error("endsAt", t("End must follow start."))
})
type Values = z.infer<typeof schema>
function localTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function Choice({ label, value, onChange, choices, disabled = false }: { label: string; value: string; onChange: (value: string) => void; choices: { value: string; label: string; avatar?: ActivityOptions["agents"][number]["avatar"] }[]; disabled?: boolean }) {
  return <Field><FieldLabel>{label}</FieldLabel><Select value={value || "__empty"} onValueChange={(v) => onChange(v === "__empty" ? "" : v)} disabled={disabled}><SelectTrigger aria-label={label} className="w-full focus-visible:bg-accent"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__empty">{t("Choose…")}</SelectItem>{choices.map((choice) => <SelectItem value={choice.value} key={choice.value} textValue={choice.label}>{"avatar" in choice && <span aria-hidden="true"><PersonAvatar name={choice.label} avatar={choice.avatar} className="!size-5" /></span>}{choice.label}</SelectItem>)}</SelectContent></Select></Field>
}

export function ActivityDialog({ subject, activity, defaultAssigneeId, onClose }: { subject?: string; activity?: Activity; defaultAssigneeId?: number; onClose: () => void }) {
  const params = new URLSearchParams(subject ? { subject } : {})
  const options = useQuery({ queryKey: ["activities", "options", subject], queryFn: () => apiJson<ActivityOptions>(activityUrl("activities/options", params)) })
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="flex max-h-[94svh] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-[42rem]">
    <DialogHeader className="relative shrink-0 border-b border-border px-5 py-4 pe-12 sm:px-6 sm:py-4">
      <div className="flex items-center gap-4"><div className="min-w-0 flex-1"><DialogTitle className="text-xl">{t(activity ? "Update interaction" : "Add activity")}</DialogTitle><DialogDescription className="mt-1.5 max-w-96 text-xs leading-5">{t("Capture the result or plan your next step.")}</DialogDescription></div><img src="/images/activity-composer.svg" alt="" className="hidden h-12 w-20 shrink-0 sm:block [@media(max-height:450px)]:hidden" /></div>
    </DialogHeader>
    {options.isPending ? <div role="status" className="flex items-center justify-center gap-2 p-12 text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />{t("Loading activity…")}</div> : options.isError ? <div role="alert" className="space-y-3 p-6">{options.error.message}<Button variant="outline" onClick={() => void options.refetch()}>{t("Retry")}</Button></div> : <ActivityForm subject={subject} activity={activity} defaultAssigneeId={defaultAssigneeId} options={options.data} onClose={onClose} />}
  </DialogContent></Dialog>
}

function ActivityForm({ subject, activity, defaultAssigneeId, options, onClose }: { subject?: string; activity?: Activity; defaultAssigneeId?: number; options: ActivityOptions; onClose: () => void }) {
  const { user } = useAuth()
  const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr"
  const queryClient = useQueryClient()
  const initialLinks = activity?.links ?? (options.suggestions.length ? options.suggestions : subject ? [{ subject, label: subject }] : [])
  const [selectedRecords, setSelectedRecords] = useState<ActivityLink[]>(initialLinks)
  const [linksOpen, setLinksOpen] = useState(initialLinks.length === 0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [taskUsesTime, setTaskUsesTime] = useState(Boolean(activity?.starts_at))
  const [type, setType] = useState("lead")
  const [search, setSearch] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState("")
  const records = useQuery({ queryKey: ["activities", "records", type, searchTerm], queryFn: () => apiJson<ActivityOptions>(activityUrl("activities/options", new URLSearchParams({ type, search: searchTerm }))), enabled: !activity && linksOpen })
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: {
    kind: activity?.kind ?? "call", subject: activity?.subject ?? "", details: activity?.details ?? "", status: activity?.status ?? "completed",
    assignee: String(activity?.assignee_id ?? (options.agents.find((agent) => agent.id === defaultAssigneeId)?.id ?? options.agents.find((agent) => agent.id === user?.id)?.id ?? "")),
    links: initialLinks.map((link) => link.subject), dueDate: activity?.due_date ?? "", startsAt: localTime(activity?.starts_at), endsAt: localTime(activity?.ends_at), occurredAt: localTime(activity?.occurred_at), outcome: activity?.outcome ?? "", summary: activity?.summary ?? "",
  } })
  // RHF subscriptions drive dependent type/state fields.
  // eslint-disable-next-line react-hooks/incompatible-library
  const values = form.watch()
  const errors = Object.values(form.formState.errors).map((item) => item.message).filter(Boolean)
  const statusChoices = activity ? activity.status === "scheduled" ? ["scheduled", "completed", "cancelled"] : activity.status === "completed" ? ["completed", "voided"] : ["cancelled", "scheduled", "voided"] : values.kind === "note" ? ["completed"] : ["completed", "scheduled"]
  function toggle(link: ActivityLink) {
    const next = selectedRecords.some((item) => item.subject === link.subject) ? selectedRecords.filter((item) => item.subject !== link.subject) : [...selectedRecords, link]
    setSelectedRecords(next); form.setValue("links", next.map((item) => item.subject), { shouldValidate: true })
  }
  async function save(data: Values) {
    setError("")
    const timestamp = (value: string, original?: string | null) => original && value === localTime(original) ? original : value ? new Date(value).toISOString() : null
    const fields = { subject: data.subject, details: data.details || null, status: data.status, assignee_id: Number(data.assignee),
      due_date: data.kind === "task" ? data.dueDate || null : null, starts_at: timestamp(data.startsAt, activity?.starts_at), ends_at: timestamp(data.endsAt, activity?.ends_at),
      occurred_at: data.status === "scheduled" ? null : timestamp(data.occurredAt, activity?.occurred_at), outcome: data.status === "scheduled" ? null : data.outcome || null, summary: data.status === "scheduled" ? null : data.summary || null }
    const body: components["schemas"]["CreateActivity"] | components["schemas"]["UpdateActivity"] = activity
      ? { ...fields, _method: "PUT", version: activity.version }
      : { ...fields, kind: data.kind, links: data.links }
    try {
      await apiJson(activityUrl(activity ? `activities/${activity.id}` : "activities"), { method: "POST", body: JSON.stringify(body) })
      await queryClient.invalidateQueries({ queryKey: ["activities"] })
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 409 ? t("This activity changed. Close this form and reload the interaction before saving again.") : caught instanceof Error ? caught.message : t("Unable to save activity."))
      if (caught instanceof ApiError && caught.status !== 409) setError([caught.message, ...Object.values(caught.fields).flat()].join(" "))
    }
  }
  const assignee = options.agents.find((agent) => String(agent.id) === values.assignee) ?? activity?.assignee
  const summaryRequired = values.status === "completed" && Boolean(outcomes[values.kind])
  return <form onSubmit={form.handleSubmit(save, (invalid) => {
    if (invalid.links) setLinksOpen(true)
    if (invalid.assignee || invalid.details || invalid.occurredAt || invalid.endsAt || invalid.startsAt && values.status !== "scheduled" || invalid.summary && !outcomes[values.kind]) setDetailsOpen(true)
  })} className="flex min-h-0 min-w-0 flex-col overflow-hidden">
    <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
      {(error || errors.length > 0) && <div role="alert" className="break-words rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error || errors.join(" ")}</div>}
      <Field className="gap-2.5"><FieldLabel>{t("Activity type")}</FieldLabel>
        <ToggleGroup type="single" dir={direction} value={values.kind} disabled={Boolean(activity)} aria-label={t("Activity type")} className="grid w-full grid-cols-4 gap-1.5 sm:grid-cols-7" onValueChange={(kind) => {
          if (!kind) return
          form.setValue("kind", kind as Values["kind"]); form.setValue("outcome", "")
          if (kind === "note") form.setValue("status", "completed")
        }}>
          {kinds.map((kind) => { const Icon = typeIcons[kind]; return <ToggleGroupItem key={kind} value={kind} aria-label={t(titles[kind])} className="relative flex h-14 min-w-0 flex-col gap-1.5 rounded-md border border-border bg-background px-1 text-xs font-normal data-[state=on]:border-primary/50 data-[state=on]:bg-accent data-[state=on]:text-primary"><Icon aria-hidden="true" className="size-5" />{t(titles[kind])}{values.kind === kind && <Check aria-hidden="true" className="absolute end-1 top-1 size-2.5" />}</ToggleGroupItem> })}
        </ToggleGroup>
      </Field>
      {!activity && values.kind !== "note" ? <ToggleGroup type="single" dir={direction} value={values.status} aria-label={t("State")} className="grid w-full grid-cols-2 gap-1 rounded-md bg-muted/60 p-1" onValueChange={(value) => { if (value) form.setValue("status", value as Values["status"]) }}>
        <ToggleGroupItem value="completed" className="h-auto min-h-12 min-w-0 gap-1.5 rounded-sm px-2 text-xs leading-4 whitespace-normal data-[state=on]:bg-background data-[state=on]:text-foreground sm:min-h-10"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0">{t("Log interaction")}</span></ToggleGroupItem>
        <ToggleGroupItem value="scheduled" className="h-auto min-h-12 min-w-0 gap-1.5 rounded-sm px-2 text-xs leading-4 whitespace-normal data-[state=on]:bg-background data-[state=on]:text-foreground sm:min-h-10"><CalendarClock aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0">{t("Schedule follow-up")}</span></ToggleGroupItem>
      </ToggleGroup> : activity && statusChoices.length > 1 && <Choice label={t("State")} value={values.status} choices={statusChoices.map((value) => ({ value, label: t(value) }))} onChange={(value) => form.setValue("status", value as Values["status"])} />}
      <Field data-invalid={Boolean(form.formState.errors.subject)} className="gap-2">
        <FieldLabel htmlFor="activity-subject">{t("Subject")}<span aria-hidden="true" className="text-destructive">*</span></FieldLabel>
        <Input id="activity-subject" placeholder={t(subjectStarters[values.kind][0])} {...form.register("subject")} aria-required aria-invalid={Boolean(form.formState.errors.subject)} className="h-10 focus-visible:bg-accent" />
        {!activity && <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Subject suggestions")}>{subjectStarters[values.kind].map((english) => t(english)).map((text) => <Button key={text} type="button" variant="ghost" size="sm" className="h-auto min-h-8 max-w-full gap-1 rounded-sm bg-muted/50 px-2 py-1 text-start text-xs font-normal whitespace-normal hover:bg-accent" onClick={() => form.setValue("subject", text, { shouldDirty: true, shouldValidate: true })}><Plus aria-hidden="true" className="size-3 shrink-0" />{text}</Button>)}</div>}
      </Field>
      {values.status === "scheduled" && <section aria-label={t("Schedule")} className="space-y-3 border-y border-border bg-muted/20 py-4">
        <p className="flex items-center gap-2 text-sm font-medium"><CalendarDays aria-hidden="true" className="size-4 text-primary" />{t("When should this happen?")}</p>
        {values.kind === "task" && !taskUsesTime ? <ActivityDateField label={t("Due date")} dateOnly value={values.dueDate} onChange={(value) => form.setValue("dueDate", value, { shouldDirty: true, shouldValidate: true })} required invalid={Boolean(form.formState.errors.dueDate)} description={t("Date-only deadline · Cairo time")} /> : <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <ActivityDateField label={t("Start time")} value={values.startsAt} onChange={(value) => form.setValue("startsAt", value, { shouldDirty: true, shouldValidate: true })} required invalid={Boolean(form.formState.errors.startsAt || form.formState.errors.dueDate)} />
          <ActivityDateField label={t("End time (optional)")} value={values.endsAt} onChange={(value) => form.setValue("endsAt", value, { shouldDirty: true, shouldValidate: true })} invalid={Boolean(form.formState.errors.endsAt)} />
        </div>}
        {values.kind === "task" && <Button type="button" variant="link" className="h-auto gap-1.5 px-0 text-xs" onClick={() => {
          setTaskUsesTime(!taskUsesTime)
          form.setValue("dueDate", ""); form.setValue("startsAt", ""); form.setValue("endsAt", "")
        }}><Clock3 aria-hidden="true" className="size-3.5" />{t(taskUsesTime ? "Use a date-only deadline" : "Set a specific time instead")}</Button>}
        {(values.kind !== "task" || taskUsesTime) && <p className="text-xs text-muted-foreground">{t("Times use your device timezone.")}</p>}
      </section>}
      {summaryRequired && <Field data-invalid={Boolean(form.formState.errors.outcome)} className="gap-2.5"><FieldLabel>{t("Outcome")}<span aria-hidden="true" className="text-destructive">*</span></FieldLabel>
        <ToggleGroup type="single" dir={direction} value={values.outcome} aria-label={t("Outcome")} className="flex w-full flex-wrap justify-start gap-2" onValueChange={(value) => { if (value) form.setValue("outcome", value, { shouldDirty: true, shouldValidate: true }) }}>
          {outcomes[values.kind]!.map((outcome) => { const Icon = outcomeIcons[outcome]; return <ToggleGroupItem value={outcome} key={outcome} className="min-h-9 gap-1.5 rounded-md border border-border px-2.5 text-xs font-normal data-[state=on]:border-primary/50 data-[state=on]:bg-accent data-[state=on]:text-primary"><Icon aria-hidden="true" className="size-3.5" /><span className="capitalize">{t(outcome.replaceAll("_", " "))}</span>{values.outcome === outcome && <Check aria-hidden="true" className="size-3" />}</ToggleGroupItem> })}
        </ToggleGroup>
      </Field>}
      {(summaryRequired || values.kind === "note") && <Field data-invalid={Boolean(form.formState.errors.summary)} className="gap-2">
        <FieldLabel htmlFor={values.kind === "note" ? "activity-details" : "activity-summary"}>{t(values.kind === "note" ? "Details" : "Result summary (required)")}</FieldLabel>
        <InputGroup className="overflow-hidden rounded-md">
          <InputGroupTextarea id={values.kind === "note" ? "activity-details" : "activity-summary"} placeholder={t(values.kind === "note" ? "What should the team know?" : "What happened, and what comes next?")} {...form.register(values.kind === "note" ? "details" : "summary")} aria-required={summaryRequired} aria-invalid={Boolean(form.formState.errors.summary)} className="min-h-20 px-3 py-3 focus-visible:bg-accent/30" />
          <InputGroupAddon align="block-end" className="flex-wrap justify-between gap-1 border-t border-border bg-muted/20 py-2 text-[11px]"><span className="flex items-center gap-1.5"><FileText aria-hidden="true" className="size-3" />{t(values.kind === "note" ? "Keep useful context for your team" : "Capture the result and next step")}</span><span dir="ltr" className="tabular-nums">{(values.kind === "note" ? values.details : values.summary).length.toLocaleString()} / {values.kind === "note" ? "10,000" : "2,000"}</span></InputGroupAddon>
        </InputGroup>
        {summaryRequired && <div className="space-y-2 pt-1"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles aria-hidden="true" className="size-3.5" />{t("Quick summaries · click to fill, then edit")}</p><div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Summary suggestions")}>{summaryStarters(values.kind, values.outcome).map(([label, text]) => [t(label), t(text)]).map(([label, text]) => <Button key={text} type="button" title={text} variant="outline" size="sm" className="h-auto min-h-9 max-w-full justify-start gap-1.5 rounded-md px-2.5 py-1.5 text-start text-xs font-normal whitespace-normal" onClick={() => form.setValue("summary", text, { shouldDirty: true, shouldValidate: true })}><ArrowUpLeft aria-hidden="true" className="size-3 shrink-0 rtl:-scale-x-100" />{label}</Button>)}</div></div>}
      </Field>}
      <Collapsible open={linksOpen} onOpenChange={setLinksOpen} className="space-y-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium"><Link2 className="size-4 text-muted-foreground" aria-hidden="true" />{t("Linked records")}{activity && <span className="font-normal text-muted-foreground">{t("(fixed)")}</span>}</p>
          {!activity && <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="group">{t(linksOpen ? "Done" : "Edit links")}<ChevronDown aria-hidden="true" className="size-4 group-data-[state=open]:rotate-180" /></Button></CollapsibleTrigger>}
        </div>
        <div className="flex flex-wrap gap-2">{selectedRecords.map((link) => { const Icon = recordIcons[link.subject.split(":")[0]] ?? Link2; return <Badge key={link.subject} variant="secondary" className="h-auto max-w-full gap-1.5 whitespace-normal rounded-md py-1 text-start"><Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" /><span className="min-w-0 break-words">{link.label}</span></Badge> })}{!selectedRecords.length && <p className="text-sm text-muted-foreground">{t("Choose at least one record below.")}</p>}</div>
        {!activity && <CollapsibleContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t("This interaction will appear on every linked record. Review the suggested links before saving.")}</p>
          <ul className="space-y-1">{selectedRecords.map((link) => <li className="flex min-w-0 items-center justify-between gap-2 text-sm" key={link.subject}><span className="break-words">{link.label}</span><Button type="button" size="sm" variant="ghost" onClick={() => toggle(link)} aria-label={t("Remove {label}", { label: link.label })}>{t("Remove")}</Button></li>)}</ul>
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice label={t("Record type")} value={type} choices={["lead", "contact", "deal", "property"].map((value) => ({ value, label: t(value) }))} onChange={(value) => { if (value) setType(value) }} />
            <Field><FieldLabel htmlFor="activity-search">{t("Find record")}</FieldLabel><div className="flex gap-2"><Input id="activity-search" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 focus-visible:bg-accent" /><Button type="button" variant="outline" onClick={() => setSearchTerm(search)}><Search aria-hidden="true" className="size-3.5" />{t("Find")}</Button></div></Field>
          </div>
          {records.isError && <p role="alert">{t("Unable to load records.")} <Button type="button" variant="outline" onClick={() => void records.refetch()}>{t("Retry")}</Button></p>}
          {records.isFetching && <p role="status">{t("Loading records…")}</p>}
          <div className="max-h-32 overflow-y-auto">{records.data?.records.filter((link) => !selectedRecords.some((selected) => selected.subject === link.subject)).map((link) => <Button className="h-auto w-full justify-start whitespace-normal break-words text-start" type="button" key={link.subject} variant="ghost" onClick={() => toggle(link)}><Plus aria-hidden="true" className="size-3.5" />{link.label}<span dir="ltr" className="ms-auto text-xs text-muted-foreground">{link.subject}</span></Button>)}</div>
        </CollapsibleContent>}
      </Collapsible>
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="border-t border-border pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 py-2"><div className="flex min-w-0 max-w-full items-center gap-2.5"><PersonAvatar name={assignee?.name ?? t("No agent")} avatar={assignee?.avatar} /><div className="min-w-0"><p className="break-words text-xs font-medium">{t("Assigned to {name}", { name: assignee?.name ?? t("no agent") })}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{t(values.status === "completed" && !values.occurredAt ? "Happened now" : values.status === "scheduled" ? "Planned follow-up" : "Interaction details")}</p></div></div>
          <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="group ms-auto shrink-0 gap-1.5 text-xs"><SlidersHorizontal aria-hidden="true" className="size-3.5" />{t("More details")}<ChevronDown aria-hidden="true" className="size-3 group-data-[state=open]:rotate-180" /></Button></CollapsibleTrigger></div>
        <CollapsibleContent className="space-y-4 pt-4">
          <Choice label={t("Responsible agent")} value={values.assignee} disabled={Boolean(activity && !activity.can_reassign)} choices={[...options.agents, ...(activity && !options.agents.some((agent) => agent.id === activity.assignee_id) ? [activity.assignee] : [])].map((agent) => ({ value: String(agent.id), label: agent.name, avatar: agent.avatar }))} onChange={(value) => form.setValue("assignee", value)} />
          {values.status === "completed" && <ActivityDateField label={t("Interaction time")} value={values.occurredAt} onChange={(value) => form.setValue("occurredAt", value)} description={t("Leave blank to use now. Times use your device timezone.")} />}
          {values.kind !== "note" && <Field><FieldLabel htmlFor="activity-details">{t("Details (optional)")}</FieldLabel><Textarea id="activity-details" {...form.register("details")} className="focus-visible:bg-accent" /></Field>}
          {values.status === "completed" && !outcomes[values.kind] && <Field><FieldLabel htmlFor="activity-summary">{t("Result summary (optional)")}</FieldLabel><Textarea id="activity-summary" {...form.register("summary")} className="focus-visible:bg-accent" /></Field>}
          {values.status !== "scheduled" && values.kind !== "note" && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <ActivityDateField label={t("Start time (optional)")} value={values.startsAt} onChange={(value) => form.setValue("startsAt", value)} />
            <ActivityDateField label={t("End time (optional)")} value={values.endsAt} onChange={(value) => form.setValue("endsAt", value)} />
          </div>}
        </CollapsibleContent>
      </Collapsible>
      {values.status === "voided" && <p className="text-sm text-muted-foreground">{t("Voiding is final. The original interaction and every correction remain in history.")}</p>}
    </div>
    <DialogFooter className="m-0 shrink-0 flex-row items-center justify-between rounded-none px-5 py-3 sm:px-6">
      <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>{t("Cancel")}</Button>
      <Button disabled={form.formState.isSubmitting} className="min-h-10 gap-2">{form.formState.isSubmitting ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Check aria-hidden="true" className="size-4" />}{t(form.formState.isSubmitting ? "Saving…" : "Save activity")}</Button>
    </DialogFooter>
  </form>
}
