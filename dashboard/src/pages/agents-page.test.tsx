import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AgentDetailsPage, AgentsPage } from "./agents-page"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)
const currentUser = { id: 99, name: "Supervisor", username: "supervisor", email: "supervisor@example.com", phone: "+201000000000", permissions: [], is_super: false }
const agent = { id: 12, name: "Mona Hassan", username: "mona", email: "mona@example.com", phone: "+201009999999", roles: [{ id: 4, name: "sales" }], permissions: [{ id: 20, name: "lead.view" }], is_super: false, created_at: "2026-07-01T12:00:00Z" }
const pagination = { links: { first: "", last: "", prev: null, next: null }, meta: { current_page: 2, from: 1, last_page: 2, links: [], path: "", per_page: 15, to: 1, total: 16 } }

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ user: currentUser, isSuper: false, can, refresh: vi.fn(async () => currentUser) }) }))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function renderIndex(entry = "/agents?page=2&q=Mona") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/agents" element={<AgentsPage />} /><Route path="/agents/create" element={<AgentDetailsPage create />} /><Route path="/agents/:agentId" element={<AgentDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderDetails(entry = "/agents/12") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/agents" element={<LocationProbe />} /><Route path="/agents/create" element={<AgentDetailsPage create />} /><Route path="/agents/:agentId" element={<AgentDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function LocationProbe() {
  const location = useLocation()
  return <><output data-testid="location-path">{location.pathname}</output><output data-testid="location-search">{location.search}</output></>
}

describe("AgentsPage", () => {
  beforeEach(() => {
    permissions = new Set(["user.view", "user.create", "user.edit", "user.delete"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      if (url.includes("/v1/users/12")) return json({ user: agent })
      return json({ data: [agent], ...pagination })
    }))
  })

  it("opens a URL-addressable preview without shrinking the table and keeps return context on edit", async () => {
    const user = userEvent.setup()
    renderIndex()

    await screen.findByText(agent.name)
    expect(screen.getByTestId("agents-table-surface").className).not.toContain("grid")
    await user.click(screen.getByText(agent.name))

    expect(await screen.findByRole("heading", { name: "Agent preview" })).toBeInTheDocument()
    expect(screen.getByText("Lead", { exact: true })).toBeInTheDocument()
    expect(screen.getByLabelText("lead.view")).toHaveTextContent("View")
    expect(screen.getByRole("link", { name: "Edit agent" })).toHaveAttribute("href", "/agents/12?mode=edit&return=page%3D2%26q%3DMona")
    await user.click(screen.getByRole("button", { name: "Close preview" }))
    expect(screen.queryByRole("heading", { name: "Agent preview" })).not.toBeInTheDocument()
  })

  it("uses a popup before deleting from the index", async () => {
    const user = userEvent.setup()
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    renderIndex("/agents")

    await user.click(await screen.findByRole("button", { name: `Delete ${agent.name}` }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("revokes its CRM access")
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("opens the drawer from a direct record URL", async () => {
    renderIndex("/agents?page=2&record=12")
    expect(await screen.findByRole("heading", { name: "Agent preview" })).toBeInTheDocument()
    expect(screen.getAllByText(agent.email).length).toBeGreaterThanOrEqual(2)
  })

  it("routes New agent to the dedicated create page with the encoded return context", async () => {
    renderIndex()

    expect(await screen.findByRole("link", { name: "New agent" })).toHaveAttribute("href", "/agents/create?return=page%3D2%26q%3DMona")
  })

  it("redirects stale create mode to the dedicated agent create page", async () => {
    renderIndex("/agents?page=2&q=Mona&mode=create")

    expect(await screen.findByRole("heading", { name: "New agent" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to agents" })).toHaveAttribute("href", "/agents?page=2&q=Mona")
  })
})

describe("AgentDetailsPage", () => {
  it("reuses the dedicated agent editor for creation and sends the wrapped documented payload", async () => {
    const user = userEvent.setup()
    const createdAgent = { ...agent, id: 13, name: "New Agent", username: "new-agent", email: "new-agent@example.com" }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return json({ user: createdAgent }, 201)
      if (String(input).includes("/v1/users/13")) return json({ user: createdAgent })
      return json({ user: agent })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderDetails("/agents/create?return=page%3D2")

    expect(await screen.findByRole("heading", { name: "New agent" })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="input-group-addon"][data-align="block-start"]')).toHaveLength(5)
    expect(document.querySelector('[data-slot="input-group-addon"][data-align="block-end"]')).toHaveTextContent("Use at least 6 characters.")
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("form", "agent-create-form")
    const inputs = screen.getAllByRole("textbox")
    await user.type(inputs[0], "New Agent")
    await user.type(inputs[1], "new-agent")
    await user.type(inputs[2], "+201001111111")
    await user.type(inputs[3], "new-agent@example.com")
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
    await user.type(passwordInput, "secret123")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "New Agent" })).toBeInTheDocument())
    const create = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((create?.[1] as RequestInit).body))).toEqual({ user: { name: "New Agent", username: "new-agent", email: "new-agent@example.com", phone: "+201001111111", password: "secret123" } })
    expect(screen.getByRole("link", { name: "Back to agents" })).toHaveAttribute("href", "/agents?page=2")
  })

  it("edits on the dedicated route with the documented method spoofing", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return json({ user: { ...agent, name: "Mona Hassan Updated" } })
      return json({ user: agent })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderDetails("/agents/12?mode=edit&return=page%3D2%26q%3DMona")

    expect(await screen.findByRole("heading", { name: `Edit ${agent.name}` })).toBeInTheDocument()
    const nameInput = screen.getAllByRole("textbox")[0]
    await user.clear(nameInput)
    await user.type(nameInput, "Mona Hassan Updated")
    await user.click(screen.getByRole("button", { name: "Save agent" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mona Hassan Updated" })).toBeInTheDocument())
    const update = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toMatchObject({ _method: "PUT", name: "Mona Hassan Updated", username: agent.username, email: agent.email, phone: agent.phone })
  })

  it("uses a popup before deleting from the dedicated route", async () => {
    const user = userEvent.setup()
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    renderDetails()

    await screen.findByRole("heading", { name: agent.name })
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)
  })
})
