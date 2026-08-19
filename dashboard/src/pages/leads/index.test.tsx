import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LeadsKanbanPage } from "./index"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ can, isSuper: false, user: undefined }),
}))

describe("LeadsKanbanPage", () => {
  beforeEach(() => {
    permissions = new Set(["lead.view", "lead.create"])
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined })
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      disconnect() {}
    })
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
  })

  it("hides zero-valued statuses from the progress labels", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [], meta: { current_page: 1, last_page: 1, total: 3 }, stats: { pending_count: 2, contacted_count: 0, unqualified_count: 1, qualified_count: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })))

    render(<TooltipProvider><MemoryRouter><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    expect(screen.getByRole("heading", { name: "Pipeline" })).toBeInTheDocument()
    expect(await screen.findByText("2 New Lead")).toBeInTheDocument()
    expect(screen.getByText("1 Rejected")).toHaveClass("absolute", "end-0", "whitespace-nowrap")
    expect(screen.getByRole("img", { name: "Lead status distribution" })).toHaveStyle({ gridTemplateColumns: "2fr 0fr 1fr 0fr" })
    expect(screen.queryByText("0 Contacted")).not.toBeInTheDocument()
    expect(screen.queryByText("0 Converted")).not.toBeInTheDocument()
  })

  it("renders the assigned agent avatar returned with a lead", async () => {
    const avatar = { id: 7, uuid: "5f1c9f58-41af-4f6a-9a72-0f3c56d7d6b2", name: "omar.jpg", mime_type: "image/jpeg", size: 1024, url: "/storage/users/4/omar.jpg", thumbnail_url: "/storage/users/4/omar.jpg", order: 1, created_at: "2026-08-19T09:00:00Z" }
    const NativeImage = window.Image
    vi.stubGlobal("Image", class extends NativeImage {
      constructor() {
        super()
        Object.defineProperty(this, "complete", { configurable: true, value: true })
        Object.defineProperty(this, "naturalWidth", { configurable: true, value: 1 })
      }
    })
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 4, name: "Nadia Saleh", email: "nadia@example.com", phone: "+201001234568", status: "pending", city: "Cairo", address: null, company_name: null, source: null, assigned_agent_id: 4, assigned_agent: { id: 4, name: "Omar Saad", username: "omar", email: "omar@example.com", avatar } }], meta: { current_page: 1, last_page: 1, total: 1 }, stats: { pending_count: 1, contacted_count: 0, unqualified_count: 0, qualified_count: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })))

    render(<TooltipProvider><MemoryRouter><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    const agentAvatars = await screen.findAllByLabelText("Omar Saad avatar")
    expect(agentAvatars[0].querySelector("img")).toHaveAttribute("src", avatar.thumbnail_url)
  })

  it("opens the lead create modal and submits a pending lead", async () => {
    const user = userEvent.setup()
    const createdLead = { id: 21, name: "Nadia Saleh", email: "nadia@example.com", phone: "+201001234568", status: "pending", city: "Cairo", address: null, company_name: null, source: null }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ lead: createdLead }), { status: 201, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ data: [], meta: { current_page: 1, last_page: 1, total: 0 }, stats: {} }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)

    render(<TooltipProvider><MemoryRouter><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    await user.click(await screen.findByRole("button", { name: "Add new lead" }))
    expect(screen.getByRole("dialog", { name: "Create lead" })).toBeInTheDocument()

    expect(screen.getByPlaceholderText("Lead name")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Phone number")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("City")).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText("Lead name"), createdLead.name)
    await user.type(screen.getByPlaceholderText("Email address"), createdLead.email)
    await user.type(screen.getByPlaceholderText("Phone number"), createdLead.phone)
    await user.type(screen.getByPlaceholderText("City"), createdLead.city)
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true))
    const createRequest = fetchSpy.mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(String(createRequest?.[1]?.body))).toEqual({ name: createdLead.name, email: createdLead.email, phone: createdLead.phone, status: "pending", city: createdLead.city, address: null, company_name: null, source: null })
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create lead" })).not.toBeInTheDocument())
    expect(fetchSpy.mock.calls.filter(([, init]) => !init?.method || init.method === "GET").length).toBeGreaterThanOrEqual(8)
  })

  it("stores directly typed company text while searching accounts", async () => {
    const user = userEvent.setup()
    permissions = new Set(["lead.view", "lead.create", "account.create"])
    const createdLead = { id: 22, name: "Nadia Saleh", email: "nadia@example.com", phone: "+201001234568", status: "pending", city: "Cairo", address: null, company_name: "Example Holdings", source: null }
    const account = { id: 31, name: "Example Holdings", industry: "Development", phone: "+201001234569", address: "Cairo", image: { id: 92, uuid: "cbf6ec2d-b3ed-4abc-a95f-7cbf608d496c", name: "example-holdings", mime_type: "image/svg+xml", size: 742, url: "/storage/accounts/31/example-holdings.svg", thumbnail_url: "/storage/accounts/31/example-holdings.svg", order: 1, created_at: "2026-08-10T12:00:00Z" } }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/v1/accounts")) return new Response(JSON.stringify({ data: [account], meta: { current_page: 1, last_page: 1, total: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (init?.method === "POST") return new Response(JSON.stringify({ lead: createdLead }), { status: 201, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ data: [], meta: { current_page: 1, last_page: 1, total: 0 }, stats: {} }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)

    render(<TooltipProvider><MemoryRouter><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    await user.click(await screen.findByRole("button", { name: "Add new lead" }))
    const companyInput = screen.getByRole("combobox", { name: "Company" })
    await user.type(companyInput, account.name)
    expect(companyInput).toHaveValue(account.name)
    expect(await screen.findByRole("img", { name: "Example Holdings logo" })).toHaveAttribute("src", "/storage/accounts/31/example-holdings.svg")
    expect(screen.queryByText("Development")).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText("Lead name"), createdLead.name)
    await user.type(screen.getByPlaceholderText("Email address"), createdLead.email)
    await user.type(screen.getByPlaceholderText("Phone number"), createdLead.phone)
    await user.type(screen.getByPlaceholderText("City"), createdLead.city)
    await user.click(screen.getByRole("button", { name: "Create" }))
    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "POST" && String(init.body).includes('"company_name":"Example Holdings"'))).toBe(true))
  })

  it("opens the requested lead dialog from the record query parameter", async () => {
    const lead = { id: 18, name: "Layla Nasser", email: "layla@example.com", phone: "+201001234567", status: "qualified", city: "Cairo", address: null, company_name: "Nasser Holdings", source: null }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/v1/leads/18")) return new Response(JSON.stringify({ lead }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ data: [], meta: { current_page: 1, last_page: 1, total: 0 }, stats: {} }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)

    render(<TooltipProvider><MemoryRouter initialEntries={["/pipeline?record=18"]}><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    expect(await screen.findByRole("dialog")).toHaveTextContent(lead.name)
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/v1/leads/18"))).toBe(true)
  })

  it("renders the assigned agent avatar in the lead dialog picker", async () => {
    permissions = new Set(["lead.view", "lead.edit"])
    const avatar = { id: 8, uuid: "c3f2f9fd-bda4-4a69-8b91-40d0a34e9bcb", name: "omar.jpg", mime_type: "image/jpeg", size: 1024, url: "/storage/users/4/omar.jpg", thumbnail_url: "/storage/users/4/omar.jpg", order: 1, created_at: "2026-08-19T09:00:00Z" }
    const assignedAgent = { id: 4, name: "Omar Saad", username: "omar", email: "omar@example.com", avatar }
    const NativeImage = window.Image
    vi.stubGlobal("Image", class extends NativeImage {
      constructor() {
        super()
        Object.defineProperty(this, "complete", { configurable: true, value: true })
        Object.defineProperty(this, "naturalWidth", { configurable: true, value: 1 })
      }
    })
    const lead = { id: 20, name: "Nadia Saleh", email: "nadia@example.com", phone: "+201001234568", status: "pending", city: "Cairo", address: null, company_name: null, source: null, assigned_agent_id: assignedAgent.id, assigned_agent: assignedAgent }
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/leads/20")) return new Response(JSON.stringify({ lead }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/users")) return new Response(JSON.stringify({ data: [assignedAgent], meta: { current_page: 1, last_page: 1, total: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ data: [], meta: { current_page: 1, last_page: 1, total: 0 }, stats: {} }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    const user = userEvent.setup()
    render(<TooltipProvider><MemoryRouter initialEntries={["/pipeline?record=20"]}><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    expect((await screen.findAllByLabelText("Omar Saad avatar")).some((element) => element.querySelector(`img[src="${avatar.thumbnail_url}"]`))).toBe(true)
    await user.click(await screen.findByRole("combobox", { name: "Agent" }))
    expect((await screen.findAllByLabelText("Omar Saad avatar")).some((element) => element.querySelector(`img[src="${avatar.thumbnail_url}"]`))).toBe(true)
  })

  it("uses the linked account image in the lead dialog and account picker", async () => {
    permissions = new Set(["lead.view", "contact.edit"])
    const account = { id: 9, name: "Northstar Developments", industry: "Development", phone: "+201001234500", address: "Cairo", image: { id: 91, uuid: "f5be07d0-a720-4f1e-913e-59a4c6bb6a72", name: "northstar", mime_type: "image/svg+xml", size: 742, url: "/storage/accounts/9/northstar.svg", thumbnail_url: "/storage/accounts/9/northstar.svg", order: 1, created_at: "2026-08-10T12:00:00Z" } }
    const lead = { id: 19, name: "Layla Nasser", email: "layla@example.com", phone: "+201001234567", status: "qualified", city: "Cairo", address: null, company_name: "Northstar Developments", source: null, contact: { id: 7, name: "Layla Nasser", title: "Director", email: "layla@example.com", phone: "+201001234567", account } }
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/leads/19")) return new Response(JSON.stringify({ lead }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/accounts")) return new Response(JSON.stringify({ data: [account], meta: { current_page: 1, last_page: 1, total: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ data: [], meta: { current_page: 1, last_page: 1, total: 0 }, stats: {} }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    const user = userEvent.setup()
    render(<TooltipProvider><MemoryRouter initialEntries={["/pipeline?record=19"]}><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    expect(await screen.findByRole("img", { name: "Northstar Developments logo" })).toHaveAttribute("src", "/storage/accounts/9/northstar.svg")
    await user.click(screen.getByRole("combobox", { name: "Account" }))
    expect((await screen.findAllByRole("img", { name: "Northstar Developments logo" })).length).toBeGreaterThan(1)
  })
})
