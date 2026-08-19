import { EChartsLineChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-line-chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { OverviewRange, TrendPoint } from "../data"
import { RangeTabs } from "./range-tabs"

const revenueChartConfig = {
  value: { label: "This period", colors: { light: ["#1677a8"], dark: ["#78bce0"] } },
  previousValue: { label: "Previous period", colors: { light: ["#335c77"], dark: ["#b0cfdf"] } },
} satisfies ChartConfig

export function RevenuePerformance({ range, current = [], previous = [], isLoading, onRangeChange }: { range: OverviewRange; current?: TrendPoint[]; previous?: TrendPoint[]; isLoading: boolean; onRangeChange: (range: OverviewRange) => void }) {
  const data = current.map((point, index) => ({ ...point, previousValue: previous[index]?.value ?? 0 }))
  const previousPeriod = previousPeriodLabel[range]
  const config = { ...revenueChartConfig, value: { ...revenueChartConfig.value, label: `This ${range}` }, previousValue: { ...revenueChartConfig.previousValue, label: previousPeriod } }

  return <section className="min-w-0 rounded-3xl bg-card p-5 sm:col-span-2 sm:p-6 xl:col-span-2">
    {isLoading ? <ChartHeaderSkeleton /> : <header className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold tracking-tight">Revenue</h2><RangeTabs label="Revenue range" value={range} onChange={onRangeChange} /></header>}
    <div className="mt-4 h-72" aria-label={`Revenue by ${range}`} aria-busy={isLoading} role="img"><EChartsLineChart data={data} config={config} isLoading={isLoading} xDataKey="label" className="size-full" curveType="monotone" chartOptions={{ grid: { left: 52, right: 12, top: 16, bottom: 8 } }}><EChartsLineChart.Grid /><EChartsLineChart.XAxis dataKey="label" hideDots /><EChartsLineChart.YAxis tickFormatter={formatAxisCurrency} hideDots /><EChartsLineChart.Legend variant="circle" align="right" /><EChartsLineChart.Tooltip variant="frosted-glass" /><EChartsLineChart.Line dataKey="previousValue" strokeVariant="dashed" strokeWidth={2} /><EChartsLineChart.Line dataKey="value" strokeVariant="solid" strokeWidth={2.5}><EChartsLineChart.ActiveDot variant="ping" /></EChartsLineChart.Line></EChartsLineChart></div>
  </section>
}

function ChartHeaderSkeleton() { return <div className="flex items-center justify-between gap-4"><Skeleton className="h-6 w-24" /><Skeleton className="h-9 w-44 rounded-xl" /></div> }

const previousPeriodLabel: Record<OverviewRange, string> = { year: "Last year", month: "Last month", week: "Last week" }

function formatAxisCurrency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 0 }).format(value) }
