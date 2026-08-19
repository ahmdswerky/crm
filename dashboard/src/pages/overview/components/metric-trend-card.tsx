import { ArrowDownRight, ArrowUpRight, Building2, ChartNoAxesCombined, CircleDollarSign, UsersRound } from "lucide-react"
import { EChartsAreaChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-area-chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { Metric } from "../data"

export function MetricTrendCard({ label, metric, isLoading }: { label: Metric["label"]; metric?: Metric; isLoading: boolean }) {
  const positive = (metric?.change ?? 0) >= 0
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight
  const MetricIcon = metricIcons[label]
  const trendClass = positive ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
  const chartConfig = {
    value: {
      label,
      colors: positive
        ? { light: ["#047857"], dark: ["#6ee7b7"] }
        : { light: ["#b91c1c"], dark: ["#fca5a5"] },
    },
  } satisfies ChartConfig

  return <article className="relative min-h-48 overflow-hidden rounded-3xl bg-card px-5 pb-0 pt-5 outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 sm:px-6">
    {isLoading ? <><div className="flex items-center justify-between gap-2.5"><Skeleton className="h-4 w-24" /><Skeleton className="size-11 rounded-2xl" /></div><div className="mt-4 flex items-end gap-2"><Skeleton className="h-9 w-28" /><Skeleton className="h-3.5 w-12" /></div></> : <><div className="flex items-center justify-between gap-2.5"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground"><MetricIcon className="size-5" aria-hidden="true" /></span></div><div className="mt-3 flex items-end gap-2"><p className="font-mono text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-[2rem]">{metric?.value ?? "—"}</p>{metric && <span className={`mb-1 inline-flex items-center text-xs font-semibold tabular-nums ${trendClass}`}><TrendIcon className="me-0.5 size-3.5" aria-hidden="true" />{Math.abs(metric.change).toFixed(1)}%</span>}</div></>}
    <div className="absolute inset-x-0 bottom-0 h-18" aria-label={`${label} trend`} aria-busy={isLoading} role="img"><EChartsAreaChart data={metric?.trend ?? []} config={chartConfig} isLoading={isLoading} xDataKey="label" className="size-full" curveType="monotone" chartOptions={{ grid: { left: 0, right: 0, top: 8, bottom: 0, outerBoundsMode: "none" }, yAxis: { type: "value", show: false, min: 0, boundaryGap: ["12%", "18%"] } }}><EChartsAreaChart.Area dataKey="value" variant="gradient" strokeVariant="solid" strokeWidth={2} /></EChartsAreaChart></div>
  </article>
}

const metricIcons = {
  "New Leads": UsersRound,
  "Conversion Rate": ChartNoAxesCombined,
  Revenue: CircleDollarSign,
  Properties: Building2,
} as const
