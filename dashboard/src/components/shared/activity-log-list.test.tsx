import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ActivityLogList } from "./activity-log-list"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can }) }))

const activity = {
  id: 91,
  event: "updated" as const,
  description: "Property updated",
  subject: { type: "property" as const, id: 22, label: "Palm Hills Villa" },
  causer: { id: 7, name: "Mona Hassan" },
  changes: { before: { status: "pending" }, after: { status: "showing" } },
  metadata: { reverted_activity_id: null, reason: null, restored_attributes: null },
  revert: { allowed: true },
  created_at: "2026-07-01T12:00:00Z",
}

function listResponse(data = [activity], currentPage = 1, lastPage = 1) {
  return {
    data,
    links: { first: "http://example.com?page=1", last: `http://example.com?page=${lastPage}`, prev: null, next: currentPage < lastPage ? `http://example.com?page=${currentPage + 1}` : null },
    meta: { current_page: currentPage, from: 1, last_page: lastPage, links: [], path: "http://example.com", per_page: 10, to: data.length, total: data.length },
  }
}

describe("ActivityLogList", () => {
  beforeEach(() => {
    permissions = new Set(["activity-log.view", "activity-log.revert"])
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listResponse()), { status: 200, headers: { "Content-Type": "application/json" } })))
  })

  it("loads the documented activity endpoint for its supplied record and supports a reasoned revert", async () => {
    const user = userEvent.setup()
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    render(<ActivityLogList model="property" id={22} />)

    expect(await screen.findByText("Property updated")).toBeInTheDocument()
    const request = new URL(String(fetchSpy.mock.calls[0][0]))
    expect(request.pathname).toBe("/api/v1/activity-logs")
    expect(request.searchParams.getAll("subjects[]")).toEqual(["property:22"])
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("pending")).toBeInTheDocument()
    expect(screen.getByText("showing")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Revert" }))
    await user.type(screen.getByRole("textbox", { name: "Reason for reverting activity" }), "The listing status was changed by mistake.")
    await user.click(screen.getByRole("button", { name: "Revert activity" }))

    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(true))
    const update = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(String(update?.[0])).toContain("/api/v1/activity-logs/91/revert")
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toEqual({ reason: "The listing status was changed by mistake." })
  })

  it("presents the event, causer, and a relative activity time in the timeline", async () => {
    const recentActivity = { ...activity, created_at: new Date(Date.now() - 3 * 60 * 60 * 1_000).toISOString() }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listResponse([recentActivity])), { status: 200, headers: { "Content-Type": "application/json" } })))
    render(<ActivityLogList model="property" id={22} />)

    expect(await screen.findByText("Updated")).toBeInTheDocument()
    expect(screen.getByText("Mona Hassan")).toBeInTheDocument()
    expect(screen.getByText("3 hours ago")).toBeInTheDocument()
  })

  it("loads subsequent activity only after the user presses Load more", async () => {
    const nextActivity = { ...activity, id: 92, description: "Property created" }
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(listResponse([activity], 1, 2)), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(listResponse([nextActivity], 2, 2)), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchSpy)
    const user = userEvent.setup()
    render(<ActivityLogList model="property" id={22} />)

    expect(await screen.findByText("Property updated")).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole("button", { name: "Load more activity" }))
    expect(await screen.findByText("Property created")).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(new URL(String(fetchSpy.mock.calls[1][0])).searchParams.get("page")).toBe("2")
  })

  it("does not render or request activity without the explicit view permission", () => {
    permissions = new Set(["activity-log.revert"])
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    render(<ActivityLogList model="property" id={22} />)

    expect(screen.queryByRole("heading", { name: "Activity" })).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("offers a local retry after a failed timeline request", async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(listResponse()), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchSpy)
    const user = userEvent.setup()
    render(<ActivityLogList model="property" id={22} />)

    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Property updated")).toBeInTheDocument()
  })
})
