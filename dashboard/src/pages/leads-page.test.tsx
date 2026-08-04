import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LeadDetailsPage, LeadsPage } from "./leads-page"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can }) }))

const agent = { id: 12, name: "Mona Hassan", username: "mona", email: "mona@example.com", phone: "+201009999999", permissions: [], is_super: false }
const lead = { id: 8, name: "Khaled Mansour", email: "khaled@example.com", phone: "+201001234567", status: "qualified" as const, city: "Cairo", address: null, company_name: "Mansour Group", source: null, assigned_agent_id: agent.id, assigned_agent: agent }
const contact = { id: 42, name: "Nadia Saleh", title: "Managing Director", email: "nadia@example.com", phone: "+201001234568" }
const pagination = { links: { first: "", last: "", prev: null, next: null }, meta: { current_page: 1, from: 1, last_page: 1, links: [], path: "", per_page: 15, to: 1, total: 1 } }
const activityPage = { data: [], links: { first: "", last: "", prev: null, next: null }, meta: { current_page: 1, from: null, last_page: 1, links: [], path: "", per_page: 5, to: null, total: 0 } }

function renderPage(entry = "/leads") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/leads" element={<LeadsPage />} /><Route path="/leads/create" element={<LeadDetailsPage create />} /><Route path="/contacts/:contactId" element={<div data-testid="contact-show-page">Contact show page</div>} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderDetails(entry = "/leads/8") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/leads/:leadId" element={<LeadDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderCreate(entry = "/leads/create") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/leads/create" element={<LeadDetailsPage create />} /></Routes></MemoryRouter></TooltipProvider>)
}

describe("LeadsPage", () => {
  beforeEach(() => {
    permissions = new Set(["lead.view", "user.view"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/v1/activity-logs")) return new Response(JSON.stringify(activityPage), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/users")) return new Response(JSON.stringify({ data: [agent], ...pagination }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/leads/8") && init?.method === "DELETE") return new Response(null, { status: 204 })
      if (String(input).includes("/v1/leads/8")) return new Response(JSON.stringify({ lead: { ...lead, contact } }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).endsWith("/v1/leads") && init?.method === "POST") return new Response(JSON.stringify({ lead }), { status: 201, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ data: [lead], ...pagination }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))
  })

  it("shows each assigned agent without their email and uses the URL filter", async () => {
    renderPage("/leads?assigned_agent=12")

    expect(await screen.findByRole("link", { name: /Mona Hassan.*@mona/i })).toHaveAttribute("href", "/agents/12")
    expect(screen.queryByText(agent.email)).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Assigned agent" })).toBeInTheDocument()

    await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([input]) => new URL(String(input)).searchParams.get("assigned_agent") === "12")).toBe(true))
  })

  it("opens the convert-to-contact dialog and submits the contact conversion", async () => {
    const user = userEvent.setup()
    const convertibleLead = { ...lead, status: "pending" as const, has_contact: false }
    permissions = new Set(["lead.view", "contact.create", "user.view"])
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/v1/users")) return new Response(JSON.stringify({ data: [agent], ...pagination }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/accounts")) return new Response(JSON.stringify({ data: [{ id: 4, name: "Northstar Developments", industry: "Development" }], meta: { current_page: 1, last_page: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).endsWith("/v1/contacts") && init?.method === "POST") return new Response(JSON.stringify({ contact }), { status: 201, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ data: [convertibleLead], ...pagination }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage()

    await user.click(await screen.findByRole("button", { name: "Convert to contact" }))
    expect(screen.getByRole("dialog", { name: "Convert Khaled Mansour to contact" })).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveTextContent(convertibleLead.name)
    expect(screen.queryByRole("textbox", { name: "Phone" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: /Account/ }))
    await user.click(await screen.findByRole("option", { name: "Northstar Developments" }))

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Convert" }))
    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true))
    const request = fetchSpy.mock.calls.find(([input, init]) => String(input).endsWith("/v1/contacts") && init?.method === "POST")
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ account_id: 4, lead_id: convertibleLead.id })
    expect(await screen.findByTestId("contact-show-page")).toBeInTheDocument()
  })

  it("shows the connected contact with documented reachability actions", async () => {
    permissions = new Set(["lead.view", "contact.view"])
    renderDetails()

    expect(await screen.findByText(contact.name)).toBeInTheDocument()
    expect(screen.getByText(contact.title)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open contact" })).toHaveAttribute("href", "/contacts/42")
    expect(screen.getByRole("link", { name: contact.phone })).toHaveAttribute("href", `tel:${contact.phone}`)
    expect(screen.getByRole("link", { name: contact.email })).toHaveAttribute("href", `mailto:${contact.email}`)
  })

  it("shows activity for the current lead", async () => {
    permissions = new Set(["lead.view", "activity-log.view"])
    renderDetails()

    expect(await screen.findByRole("heading", { name: "Lead activity" })).toBeInTheDocument()
    await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([input]) => {
      const url = new URL(String(input))
      return url.pathname.endsWith("/v1/activity-logs") && url.searchParams.getAll("subjects[]").includes("lead:8")
    })).toBe(true))
  })

  it("edits on the dedicated route and restores the indexed return context on cancel", async () => {
    const user = userEvent.setup()
    permissions = new Set(["lead.view", "lead.edit"])
    renderDetails("/leads/8?mode=edit&return=page%3D2%26q%3DKhaled")

    expect(await screen.findByRole("heading", { name: "Edit Khaled Mansour" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /name/i })).toHaveValue("Khaled Mansour")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(await screen.findByRole("heading", { name: "Khaled Mansour" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to leads" })).toHaveAttribute("href", "/leads?page=2&q=Khaled")
  })

  it("opens a URL-addressable preview without changing the table into a split layout", async () => {
    permissions = new Set(["lead.view", "lead.edit", "lead.delete", "user.view"])
    renderPage("/leads?page=3&q=Khaled&record=8")

    expect(await screen.findByRole("dialog", { name: "Lead preview" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Edit lead" })).toHaveAttribute("href", "/leads/8?mode=edit&return=page%3D3%26q%3DKhaled")
    expect(screen.getByRole("button", { name: "Close preview" }).closest("header")).not.toBeNull()
    expect(screen.getByTestId("leads-table-surface").parentElement).not.toHaveClass("lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]")
  })

  it("links New lead to the existing dedicated lead surface with return context", async () => {
    permissions = new Set(["lead.view", "lead.create", "user.view"])
    renderPage("/leads?page=3&q=Khaled")

    expect(await screen.findByRole("link", { name: "New lead" })).toHaveAttribute("href", "/leads/create?return=page%3D3%26q%3DKhaled")
  })

  it("uses the existing lead details surface for creation", async () => {
    permissions = new Set(["lead.create"])
    renderCreate("/leads/create?return=page%3D3%26q%3DKhaled")

    expect(await screen.findByRole("heading", { name: "New Lead" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Create lead" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to leads" })).toHaveAttribute("href", "/leads?page=3&q=Khaled")
    expect(screen.queryByRole("combobox", { name: /Status/ })).not.toBeInTheDocument()
    const sourceSelect = screen.getByRole("combobox", { name: /Source/ })
    expect(sourceSelect.closest('[data-slot="input-group"]')?.querySelector('[data-align="block-start"]')).not.toBeNull()
  })

  it("submits the redesigned create form using the documented payload", async () => {
    const user = userEvent.setup()
    permissions = new Set(["lead.create"])
    renderCreate()

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Nadia Saleh")
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "nadia@example.com")
    await user.type(screen.getByRole("textbox", { name: /Phone/ }), "+201001234568")
    await user.type(screen.getByRole("textbox", { name: /City/ }), "Cairo")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "POST")).toBe(true))
    const request = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === "POST")
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ name: "Nadia Saleh", email: "nadia@example.com", phone: "+201001234568", status: "pending", city: "Cairo", address: null, company_name: null, source: null })
  })

  it("redirects the old index create state to the existing lead details surface", async () => {
    permissions = new Set(["lead.view", "lead.create", "user.view"])
    renderPage("/leads?mode=create&page=2&q=Khaled")

    expect(await screen.findByRole("heading", { name: "New Lead" })).toBeInTheDocument()
  })

  it("uses a popup confirmation before deleting a lead", async () => {
    const user = userEvent.setup()
    permissions = new Set(["lead.view", "lead.delete", "user.view"])
    renderPage()

    const deleteButton = await screen.findByRole("button", { name: "Delete Khaled Mansour" })
    await user.click(deleteButton)
    expect(screen.getByRole("alertdialog", { name: "Delete Khaled Mansour?" })).toBeInTheDocument()
    expect(document.activeElement).toBe(deleteButton)
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false)

    await user.click(screen.getByRole("button", { name: "Delete lead" }))
    await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true))
  })

  it("sends all lead filters to the API request", async () => {
    renderPage("/leads?q=Khaled&status=qualified&source=facebook&city=Cairo&company=Mansour")

    expect(await screen.findByText(lead.name)).toBeInTheDocument()
    const leadRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith("/v1/leads"))
    expect(leadRequest).toBeDefined()
    const query = new URL(String(leadRequest?.[0])).searchParams
    expect(query.get("q")).toBe("Khaled")
    expect(query.get("status")).toBe("qualified")
    expect(query.get("source")).toBe("facebook")
    expect(query.get("city")).toBe("Cairo")
    expect(query.get("company")).toBe("Mansour")
  })

})
