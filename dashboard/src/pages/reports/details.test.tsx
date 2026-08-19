import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiJson } from "@/api/client"
import type { ReportRunDetail } from "@/api/contracts"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ReportDetailsPage } from "./details"

const can = (permission: string) => permission === "report.view"
const radialRenders = vi.fn()
const agentCardRenders = vi.fn()

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can }) }))

vi.mock("@/api/client", () => ({
  API_BASE_URL: "http://api.test/api",
  ApiError: class ApiError extends Error {},
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
}))

vi.mock("@/components/evilcharts/charts/echarts-radial-chart", () => ({
  EChartsRadialChart: ({ isLoading }: { isLoading?: boolean }) => {
    radialRenders(isLoading ?? false)
    return <div data-testid="radial-chart" data-loading={isLoading ?? false} />
  },
}))

vi.mock("@/components/shared/agent-performance-card", () => ({
  AgentPerformanceCard: () => {
    agentCardRenders()
    return <div data-testid="agent-performance-chart" />
  },
}))

const apiJsonMock = vi.mocked(apiJson)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function report(newLeads: number): ReportRunDetail {
  return {
    id: "7ec7cf56-661e-4e8e-8fa4-90257c525e6a",
    definition: "sales-pipeline",
    cadence: "daily",
    status: "completed",
    period_start: "2026-08-16T00:00:00Z",
    period_end: "2026-08-16T23:59:59Z",
    generated_at: "2026-08-17T00:01:00Z",
    duration_ms: 2200,
    download_available: false,
    snapshot: {
      summary: { new_leads: newLeads, lead_conversion_rate: 25, converted_leads: 2, won_value: 120000, won_deals: 1 },
      pipeline: { active_count: 8, active_value: 430000, by_status: [{ status: "negotiation", count: 3, value: 250000 }, { status: "offer", count: 5, value: 180000 }] },
      agent_performance: [{ agent_id: 1, agent_name: "Mona Hassan", won_deals: 1, leads_assigned: 4, won_value: 120000, opened_value: 200000 }],
      inventory: [{ status: "available", purpose: "sale", type: "apartment", count: 4 }],
    },
  }
}

function renderPage() {
  return render(<TooltipProvider><MemoryRouter initialEntries={["/reports/7ec7cf56-661e-4e8e-8fa4-90257c525e6a"]}><Routes><Route path="/reports/:reportRunId" element={<ReportDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

describe("ReportDetailsPage reload", () => {
  beforeEach(() => {
    radialRenders.mockClear()
    agentCardRenders.mockClear()
    apiJsonMock.mockReset()
  })

  it("replaces the loaded report with the structural skeleton before remounting refreshed charts", async () => {
    const refreshed = deferred<{ report: ReportRunDetail }>()
    apiJsonMock.mockResolvedValueOnce({ report: report(7) }).mockImplementationOnce(() => refreshed.promise)
    const user = userEvent.setup()

    renderPage()

    expect(screen.getByLabelText("Loading report")).toBeInTheDocument()
    expect(screen.getByTestId("radial-chart")).toHaveAttribute("data-loading", "true")
    expect(await screen.findByRole("button", { name: "Reload" })).toBeInTheDocument()
    expect(screen.getByTestId("radial-chart")).toHaveAttribute("data-loading", "false")
    expect(screen.getByTestId("agent-performance-chart")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Reload" }))

    expect(screen.getByLabelText("Loading report")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument()
    expect(screen.getByTestId("radial-chart")).toHaveAttribute("data-loading", "true")
    expect(screen.queryByTestId("agent-performance-chart")).not.toBeInTheDocument()
    await waitFor(() => expect(apiJsonMock).toHaveBeenCalledTimes(2))

    refreshed.resolve({ report: report(19) })

    expect(await screen.findByRole("button", { name: "Reload" })).toBeInTheDocument()
    expect(screen.getByText("19")).toBeInTheDocument()
    expect(screen.getByTestId("radial-chart")).toHaveAttribute("data-loading", "false")
    expect(screen.getByTestId("agent-performance-chart")).toBeInTheDocument()
    expect(radialRenders.mock.calls.map(([isLoading]) => isLoading)).toEqual([true, false, true, false])
    expect(agentCardRenders).toHaveBeenCalledTimes(2)
  })
})
