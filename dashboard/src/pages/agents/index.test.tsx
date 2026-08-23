import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AgentsPage } from "./index"
import { AgentShowPage } from "./details"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)
const currentUser = { id: 99, name: "Supervisor", username: "supervisor", email: "supervisor@example.com", phone: "+201000000000", permissions: [], roles: [] as { name: string }[], is_super: false }
const agent = { id: 12, name: "Mona Hassan", username: "mona", email: "mona@example.com", phone: "+201009999999", avatar: { id: 31, uuid: "avatar-31", name: "mona", mime_type: "image/jpeg", size: 1234, url: "/avatars/mona.jpg", thumbnail_url: "/avatars/mona-thumb.jpg", order: 1, created_at: "2026-07-01T12:00:00Z" }, manager: { id: 3, name: "Sara Manager", username: "sara", email: "sara@example.com", phone: "+201008888888", avatar: { id: 32, uuid: "avatar-32", name: "sara", mime_type: "image/jpeg", size: 1234, url: "/avatars/sara.jpg", thumbnail_url: "/avatars/sara-thumb.jpg", order: 1, created_at: "2026-07-01T12:00:00Z" }, is_super: false }, roles: [{ id: 4, name: "sales" }], permissions: [{ id: 20, name: "lead.view" }], is_super: false, commission_rate: 2.5, total_potential_commission: 12500, total_actual_commission: 7500, created_at: "2026-07-01T12:00:00Z" }
const pagination = { links: { first: "", last: "", prev: null, next: null }, meta: { current_page: 2, from: 1, last_page: 2, links: [], path: "", per_page: 15, to: 1, total: 16 } }

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ user: currentUser, isSuper: false, can, refresh: vi.fn(async () => currentUser) }) }))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function renderIndex(entry = "/agents?page=2&q=Mona") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/agents" element={<AgentsPage />} /><Route path="/agents/:agentId" element={<AgentShowPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderDetails(entry = "/agents/12") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/agents" element={<LocationProbe />} /><Route path="/agents/:agentId" element={<AgentShowPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function LocationProbe() {
  const location = useLocation()
  return <><output data-testid="location-path">{location.pathname}</output><output data-testid="location-search">{location.search}</output></>
}

describe("AgentsPage", () => {
  beforeEach(() => {
    permissions = new Set(["user.view", "user.create", "user.edit", "user.delete"])
    currentUser.roles = []
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      if (url.includes("/v1/users/12")) return json({ user: agent })
      return json({ data: [agent], ...pagination })
    }))
  })

  it("keeps the listing rows free of a preview drawer and opens dedicated details", async () => {
    const user = userEvent.setup()
    renderIndex()

    await screen.findByText(agent.name)
    expect(screen.getByLabelText(`${agent.name} avatar`).querySelector('[data-slot="avatar-image"]')).toHaveAttribute("src", agent.avatar.thumbnail_url)
    expect(screen.getByRole("columnheader", { name: "Manager" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sara Manager" })).toHaveAttribute("href", "/agents/3")
    expect(screen.getByLabelText("Sara Manager avatar").querySelector('[data-slot="avatar-image"]')).toHaveAttribute("src", agent.manager.avatar.thumbnail_url)
    expect(new URL(String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])).searchParams.get("with")).toBe("manager")
    expect(screen.getByTestId("agents-table-surface").className).not.toContain("grid")
    await user.click(screen.getByText(agent.name))
    expect(await screen.findByRole("heading", { name: "Agent details" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Edit agent" }))
    expect(await screen.findByRole("heading", { name: `Edit ${agent.name}` })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("heading", { name: "Agent preview" })).not.toBeInTheDocument()
  })

  it("shows the combined commission column without the created column for non-agent viewers", async () => {
    const user = userEvent.setup()
    renderIndex("/agents")

    await screen.findByText(agent.name)
    expect(screen.getByRole("columnheader", { name: "Commission" })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Commission rate" })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Commission totals" })).not.toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Access" })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Roles" })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Created" })).not.toBeInTheDocument()
    const row = screen.getByRole("row", { name: /Mona Hassan/ })
    expect(row).toHaveTextContent("Sales")
    expect(row).not.toHaveTextContent("Standard")
    expect(screen.getByText("2.5%")).toBeInTheDocument()
    expect(screen.getByText("$7,500")).toBeInTheDocument()
    await user.hover(screen.getByRole("button", { name: "Potential commission $12,500" }))
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Potential commission: $12,500")
  })

  it("hides commission columns for agent viewers", async () => {
    currentUser.roles = [{ name: "agent" }]
    renderIndex("/agents")

    await screen.findByText(agent.name)
    expect(screen.queryByRole("columnheader", { name: "Commission" })).not.toBeInTheDocument()
  })

  it("uses one muted line for missing super-user commission data", async () => {
    const superAgent = { ...agent, name: "Owner", is_super: true, commission_rate: undefined, total_potential_commission: undefined, total_actual_commission: undefined }
    vi.stubGlobal("fetch", vi.fn(async () => json({ data: [superAgent], ...pagination })))
    renderIndex("/agents")

    const row = await screen.findByRole("row", { name: /Owner/ })
    expect(row.querySelectorAll('[data-testid="empty-commission-line"]')).toHaveLength(1)
    expect(row).not.toHaveTextContent("—")
    expect(row).not.toHaveTextContent("Potential")
    expect(row).not.toHaveTextContent("Actual")
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

  it("does not open a drawer from a legacy record URL", async () => {
    renderIndex("/agents?page=2&record=12")
    await screen.findByText(agent.name)
    expect(screen.queryByRole("heading", { name: "Agent preview" })).not.toBeInTheDocument()
  })

  it("opens the create dialog from the listing page", async () => {
    const user = userEvent.setup()
    renderIndex()

    await user.click(await screen.findByRole("button", { name: "New agent" }))
    expect(await screen.findByRole("heading", { name: "Create agent" })).toBeInTheDocument()
  })

  it("opens the create dialog for a URL-addressable create mode", async () => {
    renderIndex("/agents?page=2&q=Mona&mode=create")

    expect(await screen.findByRole("heading", { name: "Create agent" })).toBeInTheDocument()
  })

  it("generates a strong password and toggles its visibility", async () => {
    const user = userEvent.setup()
    renderIndex("/agents?mode=create")

    await screen.findByRole("heading", { name: "Create agent" })
    const passwordInput = document.getElementById("agent-password") as HTMLInputElement
    expect(passwordInput).toHaveAttribute("type", "password")

    await user.click(screen.getByRole("button", { name: "Generate strong password" }))
    expect(passwordInput.value).toHaveLength(16)
    expect(passwordInput.value).toMatch(/[A-Z]/)
    expect(passwordInput.value).toMatch(/[a-z]/)
    expect(passwordInput.value).toMatch(/[2-9]/)
    expect(passwordInput.value).toMatch(/[!@#$%^&*_+=-]/)

    await user.click(screen.getByRole("button", { name: "Show password" }))
    expect(passwordInput).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument()
  })
})

describe("Agent index and show pages", () => {
  it("creates from the listing dialog and sends the wrapped documented payload", async () => {
    const user = userEvent.setup()
    const createdAgent = { ...agent, id: 13, name: "New Agent", username: "new-agent", email: "new-agent@example.com" }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return json({ user: createdAgent }, 201)
      if (String(input).includes("/v1/users/13")) return json({ user: createdAgent })
      return json({ data: [agent], ...pagination })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderIndex("/agents?page=2&mode=create")

    expect(await screen.findByRole("heading", { name: "Create agent" })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="input-group-addon"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-slot="field-label"]')).toHaveLength(0)
    expect(screen.getByPlaceholderText("Name")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Username")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Phone")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("form", "agent-create-form")
    await user.type(document.getElementById("agent-name")!, "New Agent")
    await user.type(document.getElementById("agent-username")!, "new-agent")
    await user.type(document.getElementById("agent-phone")!, "+201001111111")
    await user.type(document.getElementById("agent-email")!, "new-agent@example.com")
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement
    await user.type(passwordInput, "secret123")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(screen.getByText("New Agent", { exact: true })).toBeInTheDocument())
    const create = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((create?.[1] as RequestInit).body))).toEqual({ user: { name: "New Agent", username: "new-agent", email: "new-agent@example.com", phone: "+201001111111", password: "secret123" } })
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
