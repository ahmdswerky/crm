import { useState } from "react"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { CalendarDays, Plus } from "lucide-react"
import { useAuth } from "@/auth/auth-provider"
import { apiJson } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { activityUrl, displayTime, dueLabel, getActivity, kinds, type Activity, type ActivityPage, type HistoryPage, type ActivityOptions } from "./api"
import { ActivityDialog, Choice } from "./activity-form"
import { t } from "@/lib/i18n"

function PageControls({ page, last, total, onPage }: { page: number; last: number; total: number; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground"><span>{t("{total} entries · Page {page} of {last}", { total, page, last })}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t("Previous")}</Button><Button size="sm" variant="outline" disabled={page >= last} onClick={() => onPage(page + 1)}>{t("Next")}</Button></div></div>
}


function HistoryValues({ snapshot }: { snapshot: HistoryPage["data"][number]["after"] }) {
  const fields = [
    ["Subject", snapshot.subject], ["Type", t(snapshot.kind)], ["State", t(snapshot.status)],
    ["Responsible agent", snapshot.assignee_name], ["Details", snapshot.details],
    ["Due date", snapshot.due_date ? displayTime(snapshot.due_date, true) : null],
    ["Start", snapshot.starts_at ? displayTime(snapshot.starts_at) : null],
    ["End", snapshot.ends_at ? displayTime(snapshot.ends_at) : null],
    ["Interaction time", snapshot.occurred_at ? displayTime(snapshot.occurred_at) : null],
    ["Outcome", snapshot.outcome && t(snapshot.outcome.replaceAll("_", " "))], ["Result summary", snapshot.summary],
    ["Linked records", snapshot.links.map((link) => link.label).join(" · ")],
  ]
  return <dl className="space-y-2">{fields.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="font-medium text-foreground">{t(label ?? "")}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>
}

type TimelineProps = { subject?: string; filters?: string; defaultAssigneeId?: number }
function ActivityScope({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15000 } } }))
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
export function InteractionTimeline(props: TimelineProps) {
  const { can } = useAuth()
  return can("activity.view") ? <ActivityScope><ActivityTimeline {...props} /></ActivityScope> : null
}
function ActivityTimeline({ subject, filters = "", defaultAssigneeId }: TimelineProps) {
  const { can } = useAuth()
  const [view, setView] = useState<"activities" | "history">(subject ? "history" : "activities")
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<{ activity?: Activity } | null>(null)
  const [opening, setOpening] = useState<number | null>(null)
  const [error, setError] = useState("")
  const params = new URLSearchParams(filters)
  if (subject) params.set("subject", subject)
  params.set("page", String(page)); params.set("per_page", "10")
  const list = useQuery({ queryKey: ["activities", "list", params.toString()], queryFn: () => apiJson<ActivityPage>(activityUrl("activities", params)), enabled: can("activity.view") && view === "activities" })
  const history = useQuery({ queryKey: ["activities", "history", params.toString()], queryFn: () => apiJson<HistoryPage>(activityUrl("activity-history", params)), enabled: can("activity.view") && view === "history" })
  if (!can("activity.view")) return null
  const result = view === "activities" ? list : history
  async function edit(id: number) {
    setError(""); setOpening(id)
    try { const result = await getActivity(id); setDialog({ activity: result.data }) }
    catch (caught) { setError(caught instanceof Error ? caught.message : t("Unable to load interaction.")) }
    finally { setOpening(null) }
  }
  return <section className="min-w-0 space-y-4 border-t border-border pt-5" aria-label={t("Sales interactions")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarDays className="size-4" aria-hidden="true" />{t("Activities & history")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("Interactions and follow-up work · Cairo time")}</p></div>{can("activity.create") && <Button size="sm" onClick={() => setDialog({})}><Plus className="size-4" aria-hidden="true" />{t("Add activity")}</Button>}</div>
    <div className="flex gap-2" role="group" aria-label={t("Interaction view")}><Button size="sm" variant={view === "activities" ? "secondary" : "ghost"} aria-pressed={view === "activities"} onClick={() => { setView("activities"); setPage(1) }}>{t("Activities")}</Button><Button size="sm" variant={view === "history" ? "secondary" : "ghost"} aria-pressed={view === "history"} onClick={() => { setView("history"); setPage(1) }}>{t("History")}</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result.isPending && <p role="status" className="text-sm text-muted-foreground">{t("Loading interactions…")}</p>}
    {result.isError && <div role="alert" className="text-sm text-destructive">{result.error.message}<Button variant="outline" onClick={() => void result.refetch()}>{t("Retry")}</Button></div>}
    {result.data?.data.length === 0 && <p className="border border-dashed border-border p-5 text-sm text-muted-foreground">{t(view === "history" ? "No interactions recorded yet." : "No activities match these filters.")}</p>}
    {view === "activities" && list.data && <ul className="divide-y divide-border">{list.data.data.map((activity) => <li key={activity.id} className="space-y-2 py-4 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-words font-medium">{activity.subject}</p><p className="mt-1 text-xs text-muted-foreground capitalize">{t(activity.kind)} · {activity.assignee.name}</p></div><Badge variant={dueLabel(activity) === "overdue" ? "destructive" : "secondary"}>{t(dueLabel(activity))}</Badge></div>
      <p className="text-xs text-muted-foreground">{activity.due_date ? displayTime(activity.due_date, true) : displayTime(activity.starts_at ?? activity.occurred_at)}</p>
      {activity.summary && <p className="whitespace-pre-wrap break-words text-sm">{activity.summary}</p>}
      {activity.details && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{activity.details}</p>}
      <p className="break-words text-xs text-muted-foreground">{activity.links.map((link) => `${link.label} (${link.subject})`).join(" · ")}</p>
      {activity.can_edit && <Button size="sm" variant="outline" disabled={opening !== null} onClick={() => void edit(activity.id)}>{t(opening === activity.id ? "Loading…" : activity.status === "scheduled" ? "Complete / update" : "Correct / void")}</Button>}
    </li>)}</ul>}
    {view === "history" && history.data && <ol className="space-y-0">{history.data.data.map((event) => <li key={event.id} className="border-s border-border ps-4 pb-5 last:pb-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{t(event.action)}</Badge><span className="text-xs text-muted-foreground">{displayTime(event.occurred_at)}</span></div><p className="mt-2 break-words text-sm font-medium">{event.after.subject}</p><p className="mt-1 text-xs text-muted-foreground capitalize">{t(event.after.kind)} · {event.actor_name} · {t(event.after.status)}</p>{event.after.summary && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.after.summary}</p>}
      <details className="mt-2 text-xs"><summary className="cursor-pointer py-1 text-primary focus-visible:bg-accent">{t("Saved details and changes")}</summary><div className="mt-3 grid gap-4 text-muted-foreground sm:grid-cols-2">{"subject" in event.before && <div><p className="mb-3 font-semibold text-foreground">{t("Before this change")}</p><HistoryValues snapshot={event.before} /></div>}<div><p className="mb-3 font-semibold text-foreground">{t("Saved interaction")}</p><HistoryValues snapshot={event.after} /></div></div></details>
    </li>)}</ol>}
    {result.data && <PageControls page={result.data.current_page} last={result.data.last_page} total={result.data.total} onPage={setPage} />}
    {dialog && <ActivityDialog subject={subject} activity={dialog.activity} defaultAssigneeId={defaultAssigneeId} onClose={() => setDialog(null)} />}
  </section>
}

export function ActivitiesPage() {
  return <ActivityScope><ActivitiesWorkspace /></ActivityScope>
}
function ActivitiesWorkspace() {
  const { can, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [record, setRecord] = useState(params.get("subject") ?? "")
  const options = useQuery({ queryKey: ["activities", "options"], queryFn: () => apiJson<ActivityOptions>(activityUrl("activities/options")), enabled: can("activity.view") })
  const set = (name: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); setParams(next) }
  if (!can("activity.view")) return <div className="p-6" role="alert">{t("You do not have permission to view activities.")}</div>
  return <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8"><header><p className="text-xs text-muted-foreground">{t("CRM / Work")}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("Activities")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("Plan your next interaction and keep the relationship history together.")}</p></header>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t("Due date filters")}>{["", "overdue", "today", "upcoming"].map((bucket) => <Button key={bucket} variant={(params.get("bucket") ?? "") === bucket ? "secondary" : "outline"} size="sm" aria-pressed={(params.get("bucket") ?? "") === bucket} onClick={() => set("bucket", bucket)}>{t(bucket || "All activities")}</Button>)}<Button size="sm" variant="ghost" onClick={() => set("assignee_id", String(user?.id ?? ""))}>{t("Assigned to me")}</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Choice label={t("Type filter")} value={params.get("kind") ?? "all"} choices={[{ value: "all", label: t("All types") }, ...kinds.map((value) => ({ value, label: t(value) }))]} onChange={(value) => set("kind", value === "all" ? "" : value)} /><Choice label={t("State filter")} value={params.get("status") ?? "all"} choices={["all", "scheduled", "completed", "cancelled", "voided"].map((value) => ({ value, label: t(value === "all" ? "All states" : value) }))} onChange={(value) => set("status", value === "all" ? "" : value)} />
      <Choice label={t("Agent filter")} value={params.get("assignee_id") ?? "all"} choices={[{ value: "all", label: t("All agents") }, ...(options.data?.agents ?? []).map((agent) => ({ value: String(agent.id), label: agent.name, avatar: agent.avatar }))]} onChange={(value) => set("assignee_id", value === "all" ? "" : value)} />
      <Field><FieldLabel htmlFor="activity-record-filter">{t("Linked record (type:id)")}</FieldLabel><form className="flex min-w-0 gap-2" onSubmit={(event) => { event.preventDefault(); set("subject", record) }}><Input id="activity-record-filter" dir="ltr" placeholder="lead:123" value={record} onChange={(e) => setRecord(e.target.value)} className="min-w-0 focus-visible:bg-accent" /><Button type="submit" variant="outline">{t("Filter")}</Button></form></Field></div>
    {options.isError && <p role="alert">{t("Agent choices could not load.")} <Button variant="outline" onClick={() => void options.refetch()}>{t("Retry")}</Button></p>}
    <ActivityTimeline key={params.toString()} filters={params.toString()} />
  </div>
}
