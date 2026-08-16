import { EChartsBarChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-bar-chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { LeaderboardEntry, OverviewRange } from "../data"
import { RangeTabs } from "./range-tabs"

const leaderboardChartConfig = {
  value: { label: "Sales", colors: { light: ["#1677a8"], dark: ["#78bce0"] } },
} satisfies ChartConfig

export function SalesLeaderboard({ range, data = [], isLoading, onRangeChange }: { range: OverviewRange; data?: LeaderboardEntry[]; isLoading: boolean; onRangeChange: (range: OverviewRange) => void }) {
  const chartHeight = Math.max(288, data.length * 48 + 32)

  return <section className="min-w-0 overflow-hidden rounded-3xl bg-card p-5 sm:p-6">
    {isLoading ? <ChartHeaderSkeleton /> : <header className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-semibold tracking-tight">Sales leaderboard</h2><RangeTabs label="Sales leaderboard range" value={range} onChange={onRangeChange} /></header>}
    <div className="-mx-5 mt-6 sm:-mx-6" style={{ height: chartHeight }} aria-label={`Sales leaderboard by ${range}`} aria-busy={isLoading} role="img"><EChartsBarChart data={data} config={leaderboardChartConfig} isLoading={isLoading} xDataKey="name" className="size-full" layout="horizontal" barRadius={5} barCategoryGap={14} enableMaxValueHighlight chartOptions={{ grid: { left: 104, right: 0, top: 4, bottom: 0 } }}><EChartsBarChart.XAxis tickFormatter={formatCompactCurrency} hideDots /><EChartsBarChart.YAxis dataKey="name" hideDots /><EChartsBarChart.Tooltip variant="frosted-glass" /><EChartsBarChart.Bar dataKey="value" variant="default" /></EChartsBarChart></div>
  </section>
}

function ChartHeaderSkeleton() { return <div className="flex items-center justify-between gap-4"><Skeleton className="h-6 w-36" /><Skeleton className="h-9 w-44 rounded-xl" /></div> }

function formatCompactCurrency(value: string) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(Number(value)) }
