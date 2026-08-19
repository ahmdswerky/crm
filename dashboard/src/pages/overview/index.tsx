import { useCallback, useEffect, useState } from "react"
import { API_BASE_URL, apiJson } from "@/api/client"
import type { OverviewAccount as OverviewAccountResponse, OverviewCustomer, OverviewDeal as OverviewDealResponse, OverviewLeaderboard, OverviewMetrics, OverviewProperty as OverviewPropertyResponse, OverviewRevenue } from "@/api/contracts"
import { AccountCard, CustomerCard, DealCard, PropertyCard } from "./components/overview-data-cards"
import { MetricTrendCard } from "./components/metric-trend-card"
import { RevenuePerformance } from "./components/revenue-performance"
import { SalesLeaderboard } from "./components/sales-leaderboard"
import type { Customer, LeaderboardEntry, Metric, OverviewAccount, OverviewDeal, OverviewProperty, OverviewRange, TrendPoint } from "./data"

const overviewUrl = `${API_BASE_URL}/v1/analytics`

const metricDefinitions: Array<{ key: keyof OverviewMetrics; label: Metric["label"] }> = [
  { key: "new_leads", label: "New Leads" },
  { key: "conversion_rate", label: "Conversion Rate" },
  { key: "revenue", label: "Revenue" },
  { key: "properties", label: "Properties" },
]

export function OverviewPage() {
  const [leaderboardRange, setLeaderboardRange] = useState<OverviewRange>("month")
  const [revenueRange, setRevenueRange] = useState<OverviewRange>("month")
  const [metrics, setMetrics] = useState<Partial<Record<Metric["label"], Metric>>>({})
  const [customers, setCustomers] = useState<Customer[]>([])
  const [deals, setDeals] = useState<OverviewDeal[]>([])
  const [accounts, setAccounts] = useState<OverviewAccount[]>([])
  const [properties, setProperties] = useState<OverviewProperty[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [revenue, setRevenue] = useState<{ current: TrendPoint[]; previous: TrendPoint[] }>({ current: [], previous: [] })
  const [kpiLoading, setKpiLoading] = useState(true)
  const [customersLoading, setCustomersLoading] = useState(true)
  const [dealsLoading, setDealsLoading] = useState(true)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [propertiesLoading, setPropertiesLoading] = useState(true)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [revenueLoading, setRevenueLoading] = useState(true)

  const loadMetrics = useCallback(async (signal?: AbortSignal) => {
    setKpiLoading(true)
    try {
      const { metrics: response } = await apiJson<{ metrics: OverviewMetrics }>(`${overviewUrl}/metrics`, { signal })
      if (!signal?.aborted) setMetrics(toMetrics(response))
    } catch {
      // Keep the card empty rather than substituting stale or fabricated values.
    } finally {
      if (!signal?.aborted) setKpiLoading(false)
    }
  }, [])

  const loadCustomers = useCallback(async (signal?: AbortSignal) => {
    setCustomersLoading(true)
    try {
      const { customers: response } = await apiJson<{ customers: OverviewCustomer[] }>(`${overviewUrl}/customers`, { signal })
      if (!signal?.aborted) setCustomers(response.map(toCustomer))
    } catch {
      // Keep the card empty rather than substituting stale or fabricated values.
    } finally {
      if (!signal?.aborted) setCustomersLoading(false)
    }
  }, [])

  const loadDeals = useCallback(async (signal?: AbortSignal) => {
    setDealsLoading(true)
    try {
      const { deals: response } = await apiJson<{ deals: OverviewDealResponse[] }>(`${overviewUrl}/deals`, { signal })
      if (!signal?.aborted) setDeals(response.map(toDeal))
    } catch {
      // Keep the card empty rather than substituting stale or fabricated values.
    } finally {
      if (!signal?.aborted) setDealsLoading(false)
    }
  }, [])

  const loadAccounts = useCallback(async (signal?: AbortSignal) => {
    setAccountsLoading(true)
    try {
      const { accounts: response } = await apiJson<{ accounts: OverviewAccountResponse[] }>(`${overviewUrl}/accounts`, { signal })
      if (!signal?.aborted) setAccounts(response.map(toAccount))
    } catch {
      // Keep the card empty rather than substituting stale or fabricated values.
    } finally {
      if (!signal?.aborted) setAccountsLoading(false)
    }
  }, [])

  const loadProperties = useCallback(async (signal?: AbortSignal) => {
    setPropertiesLoading(true)
    try {
      const { properties: response } = await apiJson<{ properties: OverviewPropertyResponse[] }>(`${overviewUrl}/properties`, { signal })
      if (!signal?.aborted) setProperties(response.map(toProperty))
    } catch {
      // Keep the card empty rather than substituting stale or fabricated values.
    } finally {
      if (!signal?.aborted) setPropertiesLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadMetrics(controller.signal)
    void loadCustomers(controller.signal)
    void loadDeals(controller.signal)
    void loadAccounts(controller.signal)
    void loadProperties(controller.signal)
    return () => controller.abort()
  }, [loadAccounts, loadCustomers, loadDeals, loadMetrics, loadProperties])

  useEffect(() => {
    const controller = new AbortController()
    setLeaderboardLoading(true)
    void apiJson<{ leaderboard: OverviewLeaderboard }>(`${overviewUrl}/leaderboard?range=${leaderboardRange}`, { signal: controller.signal })
      .then(({ leaderboard: response }) => { if (!controller.signal.aborted) setLeaderboard(response.data) })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setLeaderboardLoading(false) })
    return () => controller.abort()
  }, [leaderboardRange])

  useEffect(() => {
    const controller = new AbortController()
    setRevenueLoading(true)
    void apiJson<{ revenue: OverviewRevenue }>(`${overviewUrl}/revenue?range=${revenueRange}`, { signal: controller.signal })
      .then(({ revenue: response }) => { if (!controller.signal.aborted) setRevenue({ current: response.current, previous: response.previous }) })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setRevenueLoading(false) })
    return () => controller.abort()
  }, [revenueRange])

  const selectLeaderboardRange = useCallback((range: OverviewRange) => {
    if (range === leaderboardRange) return
    setLeaderboardLoading(true)
    setLeaderboardRange(range)
  }, [leaderboardRange])

  const selectRevenueRange = useCallback((range: OverviewRange) => {
    if (range === revenueRange) return
    setRevenueLoading(true)
    setRevenueRange(range)
  }, [revenueRange])

  return <main className="space-y-5 p-5 sm:p-6 lg:p-8">
    <section aria-label="Key metrics" className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">{metricDefinitions.map(({ key, label }) => <MetricTrendCard key={key} label={label} metric={metrics[label]} isLoading={kpiLoading} />)}</section>
    <section aria-label="Performance charts" className="grid gap-5 xl:grid-cols-3"><RevenuePerformance range={revenueRange} current={revenue.current} previous={revenue.previous} isLoading={revenueLoading} onRangeChange={selectRevenueRange} /><SalesLeaderboard range={leaderboardRange} data={leaderboard} isLoading={leaderboardLoading} onRangeChange={selectLeaderboardRange} /></section>
    <section aria-label="Record summaries" className="grid gap-5 xl:grid-cols-2"><CustomerCard data={customers} isLoading={customersLoading} /><DealCard data={deals} isLoading={dealsLoading} /><AccountCard data={accounts} isLoading={accountsLoading} /><PropertyCard data={properties} isLoading={propertiesLoading} /></section>
  </main>
}

function toMetrics(response: OverviewMetrics): Partial<Record<Metric["label"], Metric>> {
  return Object.fromEntries(metricDefinitions.map(({ key, label }) => [label, { label, value: formatMetricValue(key, response[key].value), change: response[key].change, trend: response[key].trend }])) as Partial<Record<Metric["label"], Metric>>
}

function toCustomer(customer: OverviewCustomer): Customer { return { id: customer.id, name: customer.name, company: customer.company ?? "—", accountLogo: customer.account_logo, position: customer.position ?? "—" } }
function toDeal(deal: OverviewDealResponse): OverviewDeal { return { id: deal.id, name: deal.name, customer: deal.customer ?? "—", dealValue: deal.deal_value, status: deal.status } }
function toAccount(account: OverviewAccountResponse): OverviewAccount { return { id: account.id, name: account.name, logo: account.logo, industry: account.industry ?? "—", leadsCount: account.leads_count } }
function toProperty(property: OverviewPropertyResponse): OverviewProperty { return { id: property.id, name: property.name, status: property.status, price: property.price } }

function formatMetricValue(key: keyof OverviewMetrics, value: number) {
  if (key === "conversion_rate") return `${value.toFixed(1)}%`
  if (key === "revenue") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value)
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}
