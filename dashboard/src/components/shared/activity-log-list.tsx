import { useCallback, useEffect, useState } from "react"
import { ChevronRight, Circle, History, KeyRound, Pencil, Plus, RefreshCw, RotateCcw, ShieldCheck, Trash2, Undo2 } from "lucide-react"
import type { components as ActivityLogComponents, paths as ActivityLogPaths } from "@/api/generated/ActivityLog"
import { API_BASE_URL, ApiError, apiJson } from "@/api/client"
import { useAuth } from "@/auth/auth-provider"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge, type BadgeProps } from "@/components/reui/badge"
import { Frame, FramePanel } from "@/components/reui/frame"
import { Timeline, TimelineContent, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle } from "@/components/reui/timeline"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ActivityLog = ActivityLogComponents["schemas"]["ActivityLog"]
type ActivityModel = NonNullable<ActivityLogComponents["schemas"]["ActivitySubject"]["type"]>
type ActivityLogListResponse = ActivityLogPaths["/"]["get"]["responses"][200]["content"]["application/json"]
type ActivityLogEnvelope = ActivityLogPaths["/{id}/revert"]["post"]["responses"][200]["content"]["application/json"]

type ActivityLogListProps = {
  model: ActivityModel
  id: number
  title?: string
  perPage?: number
  className?: string
  onReverted?: () => void
}

const eventTone: Record<ActivityLog["event"], NonNullable<BadgeProps["variant"]>> = {
  created: "success-light",
  updated: "info-light",
  deleted: "destructive-light",
  restored: "success-light",
  reverted: "primary-light",
  roles_updated: "warning-light",
  password_updated: "primary-light",
}

function titleFor(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatActivityTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1_000))
  if (elapsedSeconds < 60) return "just now"
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)} minute${elapsedSeconds >= 120 ? "s" : ""} ago`
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3_600)} hour${elapsedSeconds >= 7_200 ? "s" : ""} ago`
  if (elapsedSeconds < 2_592_000) return `${Math.floor(elapsedSeconds / 86_400)} day${elapsedSeconds >= 172_800 ? "s" : ""} ago`
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function initials(name: string | null) {
  return (name ?? "System").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "S"
}

function EventIcon({ event }: { event: ActivityLog["event"] }) {
  const Icon = ({
    created: Plus,
    updated: Pencil,
    deleted: Trash2,
    restored: RotateCcw,
    reverted: Undo2,
    roles_updated: ShieldCheck,
    password_updated: KeyRound,
  } as const)[event] ?? Circle
  return <Icon className="size-3.5" />
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.join(", ") || "—"
  return "Updated"
}

function changedFields(activity: ActivityLog) {
  const before = activity.changes.before
  const after = activity.changes.after

  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .slice(0, 4)
    .map((field) => ({
      field: titleFor(field),
      before: displayValue(before[field]),
      after: displayValue(after[field]),
    }))
}

export function ActivityLogList({ model, id, title = "Activity", perPage = 5, className, onReverted }: ActivityLogListProps) {
  const { can } = useAuth()
  const canView = can("activity-log.view")
  const canRevert = can("activity-log.revert")
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [meta, setMeta] = useState<ActivityLogListResponse["meta"] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pendingRevert, setPendingRevert] = useState<ActivityLog | null>(null)
  const [revertReason, setRevertReason] = useState("")
  const [revertError, setRevertError] = useState("")
  const [reverting, setReverting] = useState(false)
  const headingId = `activity-${model}-${id}`

  const loadLogs = useCallback(async (signal?: AbortSignal) => {
    if (!canView || !Number.isInteger(id) || id < 1) return

    setLoading(true)
    setError("")
    const params = new URLSearchParams({
      per_page: String(Math.min(Math.max(perPage, 1), 100)),
      page: String(page),
    })
    params.append("subjects[]", `${model}:${id}`)

    try {
      const response = await apiJson<ActivityLogListResponse>(`${API_BASE_URL}/v1/activity-logs?${params}`, { signal })
      setLogs((current) => page === 1 ? response.data : [...current, ...response.data])
      setMeta(response.meta)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : "Unable to load activity.")
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [canView, id, model, page, perPage])

  useEffect(() => setPage(1), [id, model])

  useEffect(() => {
    if (!canView) return
    const controller = new AbortController()
    void loadLogs(controller.signal)
    return () => controller.abort()
  }, [canView, loadLogs])

  function openRevert(activity: ActivityLog) {
    setPendingRevert(activity)
    setRevertReason("")
    setRevertError("")
  }

  function refreshLogs() {
    if (page === 1) {
      void loadLogs()
      return
    }
    setPage(1)
  }

  function loadMore() {
    if (loading || !meta || page >= meta.last_page) return
    setPage((current) => current + 1)
  }

  function closeRevert() {
    if (reverting) return
    setPendingRevert(null)
    setRevertReason("")
    setRevertError("")
  }

  async function revertActivity() {
    if (!pendingRevert || !canRevert || !pendingRevert.revert.allowed) return

    const reason = revertReason.trim()
    if (reason.length < 3) {
      setRevertError("Enter a reason of at least 3 characters.")
      return
    }

    setReverting(true)
    setRevertError("")

    try {
      await apiJson<ActivityLogEnvelope>(`${API_BASE_URL}/v1/activity-logs/${pendingRevert.id}/revert`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      closeRevert()
      if (page === 1) void loadLogs()
      else setPage(1)
      onReverted?.()
    } catch (caught) {
      const message = caught instanceof ApiError
        ? caught.fields.reason?.[0] ?? caught.message
        : caught instanceof Error
          ? caught.message
          : "Unable to revert this activity."
      setRevertError(message)
    } finally {
      setReverting(false)
    }
  }

  if (!canView || !Number.isInteger(id) || id < 1) return null

  return <section className={cn("border-t border-border pt-6", className)} aria-labelledby={headingId}>
    <ActivityHeader id={headingId} title={title} model={model} loading={loading} onRefresh={refreshLogs} />

    <div className="mt-4">
      {error && <ActivityError message={error} loading={loading} onRetry={() => void loadLogs()} />}
      {loading && logs.length === 0 && <ActivityLoading />}
      {!loading && !error && logs.length === 0 && <ActivityEmpty model={model} />}
      {logs.length > 0 && <ActivityStream logs={logs} canRevert={canRevert} reverting={reverting} onRevert={openRevert} />}
      {!error && meta && page < meta.last_page && <div className="mt-5 flex justify-center"><Button type="button" variant="outline" size="sm" onClick={loadMore} disabled={loading}>{loading ? "Loading…" : "Load more activity"}</Button></div>}
    </div>

    <ActivityRevertDialog
      activity={pendingRevert}
      reason={revertReason}
      error={revertError}
      reverting={reverting}
      onOpenChange={(open) => { if (!open) closeRevert() }}
      onReasonChange={setRevertReason}
      onConfirm={() => void revertActivity()}
    />
  </section>
}

function ActivityHeader({ id, title, model, loading, onRefresh }: { id: string; title: string; model: ActivityModel; loading: boolean; onRefresh: () => void }) {
  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Recorded changes to this {model}.</p>
    </div>
    <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
      <RefreshCw className="me-2 size-3.5" />
      Refresh
    </Button>
  </header>
}

function ActivityError({ message, loading, onRetry }: { message: string; loading: boolean; onRetry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
    <span>{message}</span>
    <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={loading}>Try again</Button>
  </div>
}

function ActivityLoading() {
  return <div className="space-y-4" aria-label="Loading activity">
    <ActivitySkeleton />
    <ActivitySkeleton />
    <ActivitySkeleton />
  </div>
}

function ActivityEmpty({ model }: { model: ActivityModel }) {
  return <div className="border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
    <History className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
    <p className="mt-2 text-sm font-medium">No activity recorded</p>
    <p className="mt-1 text-sm text-muted-foreground">Changes to this {model} will appear here.</p>
  </div>
}

function ActivityStream({ logs, canRevert, reverting, onRevert }: { logs: ActivityLog[]; canRevert: boolean; reverting: boolean; onRevert: (activity: ActivityLog) => void }) {
  return <Timeline defaultValue={logs.length}>
    {logs.map((activity, index) => <ActivityEntry key={activity.id} activity={activity} step={index + 1} canRevert={canRevert} reverting={reverting} onRevert={onRevert} />)}
  </Timeline>
}

function ActivityEntry({ activity, step, canRevert, reverting, onRevert }: { activity: ActivityLog; step: number; canRevert: boolean; reverting: boolean; onRevert: (activity: ActivityLog) => void }) {
  const changes = changedFields(activity)
  const hasAuditDetails = changes.length > 0 || Boolean(activity.metadata.reason)

  return <TimelineItem step={step} className="ms-10 pb-10 last:pb-0">
    <TimelineHeader>
      <TimelineSeparator className="-left-7 h-[calc(100%-1.75rem)] translate-y-7" />
      <div className="flex flex-wrap items-center gap-2 pe-8">
        <TimelineTitle className="text-sm font-semibold">{activity.description}</TimelineTitle>
        <Badge variant={eventTone[activity.event]} size="sm">{titleFor(activity.event)}</Badge>
      </div>
      <TimelineIndicator className="-left-7 size-6 border-none bg-muted text-muted-foreground">
        <EventIcon event={activity.event} />
      </TimelineIndicator>
    </TimelineHeader>
    <TimelineContent className="mt-2">
      <Frame stacked dense spacing="sm">
        <Collapsible defaultOpen className="group/collapsible">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger className="flex min-w-0 grow items-center gap-2 px-3 py-1.5 text-left">
              <Avatar size="sm">
                <AvatarFallback>{initials(activity.causer.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-xs font-medium text-muted-foreground">{activity.causer.name ?? "System"}</span>
              <time dateTime={activity.created_at} className="text-xs text-muted-foreground">{formatActivityTime(activity.created_at)}</time>
              <ChevronRight className="ms-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
            {canRevert && activity.revert.allowed && <Button type="button" variant="ghost" size="sm" className="me-1 shrink-0" onClick={() => onRevert(activity)} disabled={reverting}>
              <RotateCcw className="me-1.5 size-3.5" />
              Revert
            </Button>}
          </div>
          <CollapsibleContent>
            <FramePanel>
              {hasAuditDetails ? <ActivityDetails changes={changes} reason={activity.metadata.reason} /> : <p className="text-sm leading-relaxed text-muted-foreground">{activity.description}</p>}
            </FramePanel>
          </CollapsibleContent>
        </Collapsible>
      </Frame>
    </TimelineContent>
  </TimelineItem>
}

function ActivityDetails({ changes, reason }: { changes: ReturnType<typeof changedFields>; reason: string | null }) {
  return <>
    {changes.length > 0 && <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {changes.map((change) => <div key={change.field} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{change.field}</dt>
        <dd className="mt-1 break-words"><span className="text-muted-foreground">{change.before}</span><span className="mx-2 text-muted-foreground">→</span><span>{change.after}</span></dd>
      </div>)}
    </dl>}
    {reason && <p className={cn("text-sm leading-6 text-muted-foreground", changes.length > 0 && "mt-3")}>Reason: {reason}</p>}
  </>
}

function ActivityRevertDialog({ activity, reason, error, reverting, onOpenChange, onReasonChange, onConfirm }: {
  activity: ActivityLog | null
  reason: string
  error: string
  reverting: boolean
  onOpenChange: (open: boolean) => void
  onReasonChange: (reason: string) => void
  onConfirm: () => void
}) {
  return <AlertDialog open={Boolean(activity)} onOpenChange={onOpenChange}>
    <AlertDialogContent size="sm">
      <AlertDialogHeader>
        <AlertDialogMedia><RotateCcw /></AlertDialogMedia>
        <AlertDialogTitle>Revert this activity?</AlertDialogTitle>
        <AlertDialogDescription>This restores the affected record to the state before this change. Add a reason so the reversal is auditable.</AlertDialogDescription>
      </AlertDialogHeader>
      <Textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} aria-label="Reason for reverting activity" placeholder="Why should this change be reverted?" maxLength={500} disabled={reverting} aria-invalid={Boolean(error)} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={reverting}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={reverting} onClick={(event) => { event.preventDefault(); onConfirm() }}>{reverting ? "Reverting…" : "Revert activity"}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
}

function ActivitySkeleton() {
  return <div className="flex gap-3">
    <Skeleton className="mt-1 size-3 shrink-0 rounded-full" />
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-3 w-full" />
    </div>
  </div>
}
