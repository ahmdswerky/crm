import { EChartsBarChart, type ChartConfig } from "@/components/evilcharts/charts/echarts-bar-chart"

export type AgentPerformanceColorMode = "by-agent" | "highlight-best"

export interface AgentPerformanceRow {
  id: string | number
  name: string
  wonDeals: number
  leadsAssigned: number
  wonValue: number
  series?: Record<string, number>
}

const wonValueColor = "#a78bfa"
const openedValueColor = "#64748b"

export function AgentPerformanceCard({ rows, colorMode = "by-agent", maxAgents = 8, className = "" }: { rows: AgentPerformanceRow[]; colorMode?: AgentPerformanceColorMode; maxAgents?: number; className?: string }) {
  const chartRows = rows.slice(0, Math.max(1, maxAgents))
  const totalWonValue = rows.reduce((total, row) => total + row.wonValue, 0)
  const seriesKeys = Array.from(new Set(chartRows.flatMap((row) => Object.keys(row.series ?? {}))))
  const activeSeriesKeys = seriesKeys.length ? seriesKeys : ["wonValue"]
  const chartConfig = buildChartConfig(activeSeriesKeys)
  const chartData = chartRows.map((row) => Object.fromEntries([['name', row.name], ...activeSeriesKeys.map((key) => [key, key === "wonValue" ? row.wonValue : row.series?.[key] ?? 0])]))
  const chartHeight = Math.max(248, Math.min(320, chartRows.length * 42 + 42))

  return <section className={`min-w-0 overflow-hidden rounded-3xl bg-card p-5 sm:p-6 ${className}`}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted-foreground">Agent performance</p><p className="mt-1 flex items-baseline gap-2"><span className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(totalWonValue)}</span><span className="text-sm text-muted-foreground">total won value across agents</span></p></div></header>

    {chartRows.length ? <div className="mt-3" style={{ height: chartHeight }} aria-label="Agent performance by won value" role="img">
      <EChartsBarChart data={chartData} config={chartConfig} xDataKey="name" className="size-full" stackType={activeSeriesKeys.length > 1 ? "stacked" : "default"} barRadius={6} barCategoryGap={18} barGap={4} animation animationType="center-out" enableMaxValueHighlight={colorMode === "highlight-best"}>
        <EChartsBarChart.XAxis dataKey="name" tickFormatter={formatAgentName} hideDots />
        {activeSeriesKeys.map((key) => <EChartsBarChart.Bar key={key} dataKey={key} enableHoverHighlight />)}
        <EChartsBarChart.Tooltip variant="frosted-glass" />
        <EChartsBarChart.Legend variant="rounded-square" align="right" verticalAlign="top" />
      </EChartsBarChart>
    </div> : <p className="py-12 text-center text-sm text-muted-foreground">No agent activity was captured for this period.</p>}
  </section>
}

function buildChartConfig(keys: string[]): ChartConfig {
  return Object.fromEntries(keys.map((key) => [key, {
    label: key === "wonValue" ? "Won value" : formatSeriesLabel(key),
    colors: {
      light: [key === "wonValue" ? wonValueColor : openedValueColor],
      dark: [key === "wonValue" ? wonValueColor : openedValueColor],
    },
  }]))
}

function formatAgentName(value: string) {
  const parts = value.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.slice(0, 1) ?? ""}.` : value
}

function formatSeriesLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}
