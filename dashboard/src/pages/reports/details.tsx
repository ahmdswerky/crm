import { useEffect, useMemo, useState } from "react"
import { Building2, CalendarDays, ChartNoAxesCombined, CircleDollarSign, CircleQuestionMark, Download, RefreshCw, UsersRound, type LucideIcon } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { useAuth } from "@/auth/auth-provider"
import { API_BASE_URL, ApiError, apiFetch, apiJson } from "@/api/client"
import type { ReportRunDetail } from "@/api/contracts"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AgentPerformanceCard, type AgentPerformanceRow } from "@/components/shared/agent-performance-card"
import { ErrorState } from "@/components/shared/error-state"
import { statusChartColorToken, type DealStatus } from "@/components/shared/deal-status"
import { EChartsRadialChart, type EChartsRadialDatum } from "@/components/evilcharts/charts/echarts-radial-chart"
import type { ChartConfig } from "@/components/evilcharts/ui/echarts-chart"

type RecordValue = Record<string, unknown>

export function ReportDetailsPage() {
  const { reportRunId } = useParams()
  const { can } = useAuth()
  const [report, setReport] = useState<ReportRunDetail | null>(null)
  const [error, setError] = useState("")
  const [reloadToken, setReloadToken] = useState(0)
  const [isReloading, setIsReloading] = useState(false)
  const { summary, pipeline, pipelineRows, agentRows, inventoryRows } = useMemo(() => {
    const snapshot = asRecord(report?.snapshot)
    const pipeline = asRecord(snapshot?.pipeline)
    return {
      summary: asRecord(snapshot?.summary),
      pipeline,
      pipelineRows: records(pipeline?.by_status),
      agentRows: records(snapshot?.agent_performance).map((row) => ({ id: String(row.agent_id ?? row.agent_name ?? "unassigned"), name: String(row.agent_name ?? "Unassigned"), wonDeals: numeric(row.won_deals), leadsAssigned: numeric(row.leads_assigned), wonValue: numeric(row.won_value), series: { opened_value: numeric(row.opened_value), wonValue: numeric(row.won_value) } })),
      inventoryRows: records(snapshot?.inventory),
    }
  }, [report])
  useEffect(() => { if (!can("report.view")) return; const controller = new AbortController(); setError(""); void apiJson<{ report: ReportRunDetail }>(`${API_BASE_URL}/v1/analytics/reports/${reportRunId}`, { signal: controller.signal }).then((response) => setReport(response.report)).catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof ApiError ? caught.message : "Unable to load this report.") }).finally(() => { if (!controller.signal.aborted) setIsReloading(false) }); return () => controller.abort() }, [can, reloadToken, reportRunId])
  const handleReload = () => { setIsReloading(true); setReloadToken((value) => value + 1) }
  if (!can("report.view")) return <ErrorState kind="forbidden" title="Reports are restricted" description="You do not have permission to view saved analytics reports." actionLabel="Return to overview" actionTo="/" />
  if (error) return <ErrorState kind="not-found" title="Report unavailable" description={error} actionLabel="Return to reports" actionTo="/reports" />
  if (!report || isReloading) return <ReportDetailsLoading />
  if (report.status === "failed") return <FailedReport report={report} />

  return <div className="space-y-6 p-6 lg:p-8">
    <header className="border-b border-border pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><Link to="/reports" className="text-sm text-primary hover:text-foreground">← Report archive</Link><div className="mt-4 flex flex-wrap items-center gap-3"><CalendarDays className="size-5 text-primary" aria-hidden="true" /><h1 className="text-3xl font-semibold tracking-tight">{reportTitle(report)}</h1></div><p className="mt-2 text-sm text-muted-foreground">{report.cadence === "daily" ? "Daily record" : "Monthly record"} · Runtime {runtime(report.duration_ms)} · captured {report.generated_at ? new Date(report.generated_at).toLocaleString() : "—"}</p></div><div className="flex items-center gap-2"><ReloadButton isLoading={isReloading} onClick={handleReload} />{report.download_available && <DownloadButton report={report} />}</div></div>
    </header>
    <MetricShelf summary={summary} inventoryRows={inventoryRows} />
    <div><PipelineChart rows={pipelineRows} activeCount={numeric(pipeline?.active_count)} activeValue={numeric(pipeline?.active_value)} /></div>
    <div className={agentRows.length < 10 ? "grid gap-6 xl:grid-cols-2" : "grid gap-6"}><AgentPerformanceCard rows={agentRows} /><InventoryChart rows={inventoryRows} /></div>
  </div>
}

function ReportDetailsLoading() {
  return <div className="space-y-6 p-6 lg:p-8" aria-busy="true" aria-label="Loading report">
    <header className="border-b border-border pb-6"><Skeleton className="h-4 w-24" /><div className="mt-4 flex items-center gap-3"><Skeleton className="size-5 rounded-full" /><Skeleton className="h-9 w-48" /></div><Skeleton className="mt-3 h-4 w-72" /></header>
    <MetricShelfSkeleton />
    <PipelineCardSkeleton />
    <div className="grid gap-6 xl:grid-cols-2"><AgentPerformanceLoadingSkeleton /><InventoryCardSkeleton /></div>
  </div>
}

function MetricShelfSkeleton() {
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <article key={index} className="relative overflow-hidden rounded-3xl bg-card px-5 pb-5 pt-5 sm:px-6"><div className="flex items-center justify-between gap-2.5"><Skeleton className="h-4 w-24" /><Skeleton className="size-11 rounded-2xl" /></div><Skeleton className="mt-4 h-9 w-28" /><Skeleton className="mt-3 h-3.5 w-32" /></article>)}</section>
}

function PipelineCardSkeleton() {
  return <section className="rounded-3xl bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><Skeleton className="h-6 w-24" /><Skeleton className="h-9 w-28" /></div><div className="mt-6"><EChartsRadialChart data={[]} config={{}} variant="semi" isLoading /></div></section>
}

function AgentPerformanceLoadingSkeleton() {
  return <section className="min-w-0 overflow-hidden rounded-3xl bg-card p-5 sm:p-6"><div><Skeleton className="h-3.5 w-28" /><Skeleton className="mt-2 h-8 w-36" /></div><div className="mt-3 flex h-[248px] items-end gap-3 px-2 pb-7">{["h-20", "h-28", "h-16", "h-36", "h-24", "h-44", "h-32", "h-28"].map((height, index) => <Skeleton key={index} className={`min-w-0 flex-1 rounded-t-md ${height}`} />)}</div></section>
}

function InventoryCardSkeleton() {
  return <section className="rounded-3xl bg-card p-5 sm:p-6"><Skeleton className="h-4 w-32" /><Skeleton className="mt-2 h-6 w-44" /><div className="mt-7 space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-xl bg-muted/60 p-4"><div className="flex items-start justify-between gap-4"><div><Skeleton className="h-4 w-24" /><Skeleton className="mt-2 h-3 w-32" /></div><Skeleton className="h-4 w-8" /></div><Skeleton className="mt-3 h-1.5 w-full rounded-full" /></div>)}</div></section>
}

function MetricShelf({ summary, inventoryRows }: { summary: RecordValue | undefined; inventoryRows: RecordValue[] }) {
  const propertyCount = inventoryRows.reduce((sum, row) => sum + numeric(row.count), 0)
  const metrics: Array<{ label: string; value: string | number; note: string; icon: LucideIcon }> = [{ label: "New Leads", value: numeric(summary?.new_leads), note: "Leads created in period", icon: UsersRound }, { label: "Conversion Rate", value: `${numeric(summary?.lead_conversion_rate).toFixed(1)}%`, note: `${numeric(summary?.converted_leads)} converted leads`, icon: ChartNoAxesCombined }, { label: "Revenue", value: formatCurrency(numeric(summary?.won_value)), note: `${numeric(summary?.won_deals)} deals won`, icon: CircleDollarSign }, { label: "Properties", value: propertyCount, note: "Listings at capture", icon: Building2 }]
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, note, icon: Icon }) => <article key={label} className="relative overflow-hidden rounded-3xl bg-card px-5 pb-5 pt-5 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 sm:px-6"><div className="flex items-center justify-between gap-2.5"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground"><Icon className="size-5" aria-hidden="true" /></span></div><div className="mt-3 flex items-end gap-2"><p className="font-mono text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-[2rem]">{value}</p></div><p className="mt-2 text-xs text-muted-foreground">{note}</p></article>)}</section>
}

function PipelineChart({ rows, activeCount, activeValue }: { rows: RecordValue[]; activeCount: number; activeValue: number }) {
  const chartRows = useMemo(() => rows.map((row) => ({ status: String(row.status), count: numeric(row.count), value: numeric(row.value) })).filter((row) => row.status), [rows])
  const totalCount = useMemo(() => activeCount || chartRows.reduce((sum, row) => sum + row.count, 0), [activeCount, chartRows])
  const chartData = useMemo<EChartsRadialDatum[]>(() => chartRows.map((row) => ({ name: row.status, value: row.count, maxValue: totalCount, detail: formatCurrency(row.value) })), [chartRows, totalCount])
  const config = useMemo(() => chartRows.reduce<ChartConfig>((result, row) => {
    const status = row.status as DealStatus
    const token = statusChartColorToken[status]
    result[row.status] = { label: formatStatus(row.status), colors: { light: [token ? `var(${token})` : "var(--primary)"], dark: [token ? `var(${token})` : "var(--primary)"] } }
    return result
  }, {}), [chartRows])

  return <section className="rounded-3xl bg-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold tracking-tight">Pipeline</h2><div className="flex items-center gap-1.5"><Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-xs" aria-label="Explain pipeline value" className="text-muted-foreground hover:text-foreground"><CircleQuestionMark className="size-4" aria-hidden="true" /></Button></TooltipTrigger><TooltipContent side="bottom" align="end" className="grid min-w-52 gap-2.5"><p className="text-xs leading-4">Active pipeline value for this report period, broken down by status.</p><div className="grid gap-1.5 font-mono tabular-nums">{chartRows.map((row) => { const token = statusChartColorToken[row.status as DealStatus]; return <span key={row.status} className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: token ? `var(${token})` : "var(--primary)" }} aria-hidden="true" /><span className="capitalize">{formatStatus(row.status)}</span><span className="ms-auto ps-3">{formatCurrency(row.value)}</span></span> })}</div></TooltipContent></Tooltip><span className="font-mono text-3xl font-semibold tracking-tight text-foreground/70">{formatCurrency(activeValue)}</span></div></div>{chartRows.length ? <div className="mt-6"><EChartsRadialChart data={chartData} config={config} variant="semi" /></div> : <p className="py-12 text-center text-sm text-muted-foreground">No pipeline activity was captured for this period.</p>}</section>
}

function InventoryChart({ rows }: { rows: RecordValue[] }) {
  const total = rows.reduce((sum, row) => sum + numeric(row.count), 0)
  return <section className="rounded-3xl bg-card p-5 sm:p-6"><p className="text-sm font-medium text-muted-foreground">Property inventory</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Listing mix at capture</h2><div className="mt-7 space-y-3">{rows.length ? rows.slice(0, 6).map((row) => <div key={`${row.status}-${row.purpose}-${row.type}`} className="rounded-xl bg-muted/60 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium capitalize">{String(row.type).replaceAll("_", " ")}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{String(row.status)} · {String(row.purpose)}</p></div><span className="font-mono text-sm">{numeric(row.count)}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary/75" style={{ width: `${total ? numeric(row.count) / total * 100 : 0}%` }} /></div></div>) : <p className="py-12 text-center text-sm text-muted-foreground">No inventory rows were captured for this period.</p>}</div></section>
}

function FailedReport({ report }: { report: ReportRunDetail }) { return <div className="space-y-6 p-6 lg:p-8"><header className="rounded-2xl border border-border bg-card p-6"><Link to="/reports" className="text-sm text-primary hover:text-foreground">← Report archive</Link><h1 className="mt-4 text-2xl font-semibold tracking-tight">Report unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{period(report.period_start, report.period_end)}</p></header><section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6"><p className="font-medium text-destructive">This report could not be generated.</p><p className="mt-1 text-sm text-muted-foreground">The reporting queue recorded the failure and will preserve it for operational follow-up.</p></section></div> }
function ReloadButton({ isLoading, onClick }: { isLoading: boolean; onClick: () => void }) { return <Button type="button" size="sm" className="rounded-lg border-black/20 bg-black text-white hover:bg-black/90 dark:border-white/20 dark:bg-white dark:text-black dark:hover:bg-white/90" disabled={isLoading} onClick={onClick}><RefreshCw className={`me-2 size-3.5 ${isLoading ? "animate-spin" : ""}`} />Reload</Button> }
function DownloadButton({ report }: { report: ReportRunDetail }) { const download = async () => { const response = await apiFetch(`${API_BASE_URL}/v1/analytics/reports/${report.id}/download`); if (!response.ok) return; const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `sales-pipeline-${report.period_start.slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url) }; return <Button size="sm" className="rounded-lg border-black/20 bg-black text-white hover:bg-black/90 dark:border-white/20 dark:bg-white dark:text-black dark:hover:bg-white/90" onClick={() => void download()}><Download className="me-2 size-3.5" />Download CSV</Button> }
function asRecord(value: unknown): RecordValue | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as RecordValue : undefined }
function records(value: unknown): RecordValue[] { return Array.isArray(value) ? value.map(asRecord).filter((item): item is RecordValue => item !== undefined) : [] }
function numeric(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : 0 }
function formatCurrency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) }
function period(start: string, end: string) { return `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}` }
function reportTitle(report: ReportRunDetail) { return report.cadence === "daily" ? new Date(report.period_start).toLocaleDateString() : period(report.period_start, report.period_end) }
function runtime(value: number | null | undefined) { return value === null || value === undefined ? "—" : `${(value / 1000).toFixed(1)}s` }
function formatStatus(value: string) { return value.replaceAll("_", " ") }
