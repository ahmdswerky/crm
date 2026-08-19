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

    expect(await screen.findByText("2 New Lead")).toBeInTheDocument()
    expect(screen.getByText("1 Rejected")).toHaveClass("absolute", "end-0", "whitespace-nowrap")
    expect(screen.getByRole("img", { name: "Lead status distribution" })).toHaveStyle({ gridTemplateColumns: "2fr 0fr 1fr 0fr" })
    expect(screen.queryByText("0 Contacted")).not.toBeInTheDocument()
    expect(screen.queryByText("0 Converted")).not.toBeInTheDocument()
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

    render(<TooltipProvider><MemoryRouter initialEntries={["/leads?record=18"]}><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    expect(await screen.findByRole("dialog")).toHaveTextContent(lead.name)
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/v1/leads/18"))).toBe(true)
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
    render(<TooltipProvider><MemoryRouter initialEntries={["/leads?record=19"]}><LeadsKanbanPage /></MemoryRouter></TooltipProvider>)

    expect(await screen.findByRole("img", { name: "Northstar Developments logo" })).toHaveAttribute("src", "/storage/accounts/9/northstar.svg")
    await user.click(screen.getByRole("combobox", { name: "Account" }))
    expect((await screen.findAllByRole("img", { name: "Northstar Developments logo" })).length).toBeGreaterThan(1)
  })
})
