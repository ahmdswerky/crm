import { useEffect, useState } from "react"
import { BarChart3, Download, FileText, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "@/auth/auth-provider"
import { API_BASE_URL, ApiError, apiJson } from "@/api/client"
import type { ReportRun } from "@/api/contracts"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/shared/error-state"

type ReportList = { data: ReportRun[] }

export function ReportsPage() {
  const { can } = useAuth()
  const [reports, setReports] = useState<ReportRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async (signal?: AbortSignal) => {
    if (!can("report.view")) { setLoading(false); return }
    setLoading(true); setError("")
    try { setReports((await apiJson<ReportList>(`${API_BASE_URL}/v1/analytics/reports`, { signal })).data) } catch (caught) { if (!signal?.aborted) setError(caught instanceof ApiError ? caught.message : "Unable to load saved reports.") } finally { if (!signal?.aborted) setLoading(false) }
  }

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [can])
  if (!can("report.view")) return <ErrorState kind="forbidden" title="Reports are restricted" description="You do not have permission to view saved analytics reports." actionLabel="Return to overview" actionTo="/" />

  return <div className="space-y-6 p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-6">
      <div><div className="flex items-center gap-2 text-sm text-primary"><BarChart3 className="size-4" />Analytics archive</div><h1 className="mt-3 text-3xl font-semibold tracking-tight">Reports with a point of view.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Daily and monthly Sales & Pipeline snapshots, generated automatically and preserved exactly as they were completed.</p></div>
      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void load()} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button>
    </header>
    {error ? <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"><p role="alert" className="text-sm text-destructive">{error}</p></section> : <section className="overflow-hidden rounded-2xl border border-border bg-card">{loading ? <div className="space-y-2 p-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-18 animate-pulse rounded-xl bg-muted/60" />)}</div> : reports.length ? <div className="grid gap-2 p-3">{reports.map((report) => <ReportRow key={report.id} report={report} />)}</div> : <div className="px-5 py-16 text-center"><span className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground"><FileText className="size-5" /></span><p className="mt-4 font-medium">No saved reports yet</p><p className="mt-1 text-sm text-muted-foreground">The first archive entry appears after the next scheduled UTC run.</p></div>}</section>}
  </div>
}

function ReportRow({ report }: { report: ReportRun }) {
  return <Link to={`/reports/${report.id}`} className="group flex flex-wrap items-center justify-between gap-4 rounded-xl border border-transparent px-4 py-4 transition-colors hover:border-border hover:bg-muted/50"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"><FileText className="size-4" /></span><div><p className="font-medium">{report.cadence === "daily" ? "Daily" : "Monthly"} Sales & Pipeline</p><p className="mt-1 text-sm text-muted-foreground">{period(report.period_start, report.period_end)}</p></div></div><div className="flex items-center gap-5 text-sm"><span className="hidden font-mono text-xs text-muted-foreground sm:block">{runtime(report.duration_ms)}</span><StatusChip status={report.status} />{report.download_available && <Download className="size-4 text-muted-foreground" aria-label="CSV available" />}</div></Link>
}

function StatusChip({ status }: { status: ReportRun["status"] }) { const style = status === "completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"; return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{status}</span> }
function period(start: string, end: string) { return `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}` }
function runtime(value: number | null | undefined) { return value === null || value === undefined ? "—" : `${(value / 1000).toFixed(1)}s` }
