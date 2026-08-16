import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiJson } from "@/api/client"
import { OverviewPage } from "./index"

vi.mock("@/api/client", () => ({
  API_BASE_URL: "http://api.test/api",
  apiJson: vi.fn(),
}))

vi.mock("@/components/evilcharts/charts/echarts-area-chart", () => ({
  EChartsAreaChart: Object.assign(({ children, isLoading }: { children?: ReactNode; isLoading?: boolean }) => <div data-testid="area-chart" data-loading={isLoading}>{children}</div>, { Area: () => null }),
}))

vi.mock("@/components/evilcharts/charts/echarts-line-chart", () => ({
  EChartsLineChart: Object.assign(({ children, isLoading }: { children?: ReactNode; isLoading?: boolean }) => <div data-testid="line-chart" data-loading={isLoading}>{children}</div>, { Grid: () => null, XAxis: () => null, YAxis: () => null, Legend: () => null, Tooltip: () => null, Line: ({ children }: { children?: ReactNode }) => <>{children}</>, ActiveDot: () => null }),
}))

vi.mock("@/components/evilcharts/charts/echarts-bar-chart", () => ({
  EChartsBarChart: Object.assign(({ children, isLoading }: { children?: ReactNode; isLoading?: boolean }) => <div data-testid="bar-chart" data-loading={isLoading}>{children}</div>, { XAxis: () => null, YAxis: () => null, Tooltip: () => null, Bar: () => null }),
}))

const apiJsonMock = vi.mocked(apiJson)

describe("OverviewPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    apiJsonMock.mockImplementation((input) => Promise.resolve(responseFor(String(input))))
  })

  it("loads every overview section from its dashboard endpoint", async () => {
    render(<MemoryRouter><OverviewPage /></MemoryRouter>)

    await waitFor(() => expect(screen.getAllByText("API customer")).not.toHaveLength(0))
    expect(screen.getAllByText("API property")).not.toHaveLength(0)
    expect(screen.getByText("API account")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Sales leaderboard by month" })).toHaveAttribute("aria-busy", "false")
    expect(apiJsonMock).toHaveBeenCalledWith("http://api.test/api/v1/analytics/metrics", expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(apiJsonMock.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining([
      "http://api.test/api/v1/analytics/customers",
      "http://api.test/api/v1/analytics/deals",
      "http://api.test/api/v1/analytics/accounts",
      "http://api.test/api/v1/analytics/properties",
      "http://api.test/api/v1/analytics/leaderboard?range=month",
      "http://api.test/api/v1/analytics/revenue?range=month",
    ]))
  })

  it("reloads only the changed chart range", async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><OverviewPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getAllByText("API customer")).not.toHaveLength(0))
    apiJsonMock.mockClear()

    const weekButtons = screen.getAllByRole("button", { name: "Week" })
    await user.click(weekButtons[0])
    await waitFor(() => expect(apiJsonMock).toHaveBeenCalledWith("http://api.test/api/v1/analytics/revenue?range=week", expect.anything()))
    expect(apiJsonMock).toHaveBeenCalledTimes(1)
    const updatedWeekButtons = await screen.findAllByRole("button", { name: "Week" })
    expect(updatedWeekButtons[0]).toHaveAttribute("aria-pressed", "true")
    expect(updatedWeekButtons[1]).toHaveAttribute("aria-pressed", "false")

    await user.click(updatedWeekButtons[1])
    await waitFor(() => expect(apiJsonMock).toHaveBeenCalledWith("http://api.test/api/v1/analytics/leaderboard?range=week", expect.anything()))
    expect(apiJsonMock).toHaveBeenCalledTimes(2)
    const finalWeekButtons = await screen.findAllByRole("button", { name: "Week" })
    expect(finalWeekButtons[1]).toHaveAttribute("aria-pressed", "true")
  })

  it("uses EvilCharts loading while dashboard requests are pending", () => {
    apiJsonMock.mockImplementation(() => new Promise(() => undefined))
    render(<MemoryRouter><OverviewPage /></MemoryRouter>)

    expect(screen.getAllByTestId("area-chart")).toHaveLength(4)
    expect(screen.getAllByTestId("area-chart").every((chart) => chart.dataset.loading === "true")).toBe(true)
    expect(screen.getByTestId("line-chart")).toHaveAttribute("data-loading", "true")
    expect(screen.getByTestId("bar-chart")).toHaveAttribute("data-loading", "true")
  })
})

function responseFor(url: string) {
  if (url.endsWith("/metrics")) return { metrics: { new_leads: metric(12), conversion_rate: metric(22), revenue: metric(32), properties: metric(42) } }
  if (url.includes("/leaderboard")) return { leaderboard: { range: "month", data: [{ name: "API agent", value: 1000 }] } }
  if (url.includes("/revenue")) return { revenue: { range: "month", current: [{ label: "1", value: 1000 }], previous: [{ label: "1", value: 800 }] } }
  if (url.endsWith("/customers")) return { customers: [{ id: 1, name: "API customer", company: "API company", account_logo: null, position: "API position" }] }
  if (url.endsWith("/deals")) return { deals: [{ id: 1, name: "API property", customer: "API customer", deal_value: 1000, status: "inquiry" }] }
  if (url.endsWith("/accounts")) return { accounts: [{ id: 1, name: "API account", logo: null, industry: "API industry", leads_count: 1 }] }
  if (url.endsWith("/properties")) return { properties: [{ id: 1, name: "API property", status: "showing", price: 1000 }] }
  throw new Error(`Unhandled request ${url}`)
}

function metric(value: number) {
  return { value, change: 1, trend: [{ label: "1", value }] }
}
