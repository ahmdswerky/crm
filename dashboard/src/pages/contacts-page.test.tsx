import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { ContactDetailsPage, ContactsPage } from "./contacts-page"
import { TooltipProvider } from "@/components/ui/tooltip"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can }) }))

const contact = {
  id: 7,
  name: "Mariam Adel",
  title: "Operations Director",
  email: "mariam@example.com",
  phone: "+201001234567",
  created_at: "2026-07-01T12:00:00Z",
  account: {
    id: 4,
    name: "Northstar Developments",
    industry: "Development",
    phone: "+2025550100",
    address: "New Cairo",
  },
  lead: {
    id: 11,
    name: "Mariam's Downtown Inquiry",
    email: "lead@example.com",
    phone: "+201001234567",
    status: "qualified",
    city: "Cairo",
    company_name: "Northstar Developments",
    source: "instagram",
  },
}
const pendingLead = {
  id: 12,
  name: "Mariam's Pending Inquiry",
  email: "pending@example.com",
  phone: "+201001234567",
  status: "pending",
  city: "Cairo",
}
const activityPage = {
  data: [],
  links: { first: "", last: "", prev: null, next: "" },
  meta: { current_page: 1, from: 0, last_page: 1, links: [], path: "", per_page: 5, to: 0, total: 0 },
}

function renderPage(entry = "/contacts/7") {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/contacts" element={<LocationProbe />} /><Route path="/contacts/create" element={<ContactDetailsPage create />} /><Route path="/contacts/:contactId" element={<ContactDetailsPage />} /></Routes></MemoryRouter>)
}

function LocationProbe() {
  const location = useLocation()
  return <><output data-testid="location-path">{location.pathname}</output><output data-testid="location-search">{location.search}</output></>
}

function renderIndex(entry = "/contacts") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/contacts" element={<ContactsPage />} /><Route path="/contacts/create" element={<ContactDetailsPage create />} /><Route path="/contacts/:contactId" element={<><LocationProbe /><div>Contact details route</div></>} /></Routes></MemoryRouter></TooltipProvider>)
}

describe("ContactDetailsPage", () => {
  beforeEach(() => {
    permissions = new Set(["contact.view", "contact.create", "contact.edit", "contact.delete", "account.view", "lead.view"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false })
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => undefined })
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: () => undefined })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined })
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("/v1/leads?")) return new Response(JSON.stringify({ data: [pendingLead], meta: { current_page: 1, last_page: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
    return new Response(JSON.stringify({ contact }), { status: 200, headers: { "Content-Type": "application/json" } })
  }))
  })

  it("keeps critical contact actions and permitted account context available", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "Mariam Adel" })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "+201001234567" })[0]).toHaveAttribute("href", "tel:+201001234567")
    expect(screen.getAllByRole("link", { name: "mariam@example.com" })[0]).toHaveAttribute("href", "mailto:mariam@example.com")
    expect(screen.getAllByRole("link", { name: "Northstar Developments" })[0]).toHaveAttribute("href", "/accounts/4")
    const leadLinks = screen.getAllByRole("link", { name: "Open lead" })
    expect(leadLinks).toHaveLength(2)
    leadLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/leads/11")
      expect(link).toHaveClass("w-full")
    })
    expect(screen.queryByText("Mariam's Downtown Inquiry")).not.toBeInTheDocument()
    expect(screen.queryByText("qualified")).not.toBeInTheDocument()
    expect(screen.queryByText("instagram")).not.toBeInTheDocument()
  })

  it("withholds the account route without account permission while retaining its name", async () => {
    permissions = new Set(["contact.view"])
    renderPage("/contacts/7?return=page%3D2")

    expect(await screen.findByRole("heading", { name: "Mariam Adel" })).toBeInTheDocument()
    expect(screen.getAllByText("Northstar Developments").every((node) => node.closest("a") === null)).toBe(true)
    expect(screen.queryByRole("link", { name: "Open lead" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Contacts" })).toHaveAttribute("href", "/contacts?page=2")
    expect(screen.queryByRole("button", { name: "Edit contact" })).not.toBeInTheDocument()
  })

  it("shows activity filtered to this contact when permitted", async () => {
    permissions = new Set(["contact.view", "activity-log.view"])
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
      String(input).includes("/v1/activity-logs") ? activityPage : { contact },
    ), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderPage()

    expect(await screen.findByRole("heading", { name: "Contact activity" })).toBeInTheDocument()
    await waitFor(() => expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.some(([input]) => new URL(String(input)).searchParams.getAll("subjects[]").includes("contact:7"))).toBe(true))
  })

  it("edits on the current route and sends the required method-spoofed account ID", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ contact: { ...contact, title: "Commercial Director" } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ contact }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage()

    await screen.findByRole("heading", { name: "Mariam Adel" })
    await user.click(screen.getByRole("button", { name: "Edit contact" }))
    expect(await screen.findByRole("heading", { name: "Contact information" })).toBeInTheDocument()
    expect(screen.getByText(/relationship stays read-only/i)).toBeInTheDocument()

    const titleInput = screen.getByRole("textbox", { name: "Title" })
    await user.clear(titleInput)
    await user.type(titleInput, "Commercial Director")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect((await screen.findAllByText("Commercial Director")).length).toBeGreaterThan(0)
    const update = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toMatchObject({ title: "Commercial Director", account_id: 4, _method: "PUT" })
  })

  it("offers retry for a failed member request without presenting a false not-found state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } })))
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to open contact")
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("opens a member-backed drawer from a direct URL and closes without changing the list surface", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      if (url.includes("/v1/contacts?")) return new Response(JSON.stringify({ data: [contact], meta: { current_page: 2, last_page: 3 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    }))
    const user = userEvent.setup()
    renderIndex("/contacts?page=2&q=Mariam&record=7")

    expect(screen.getByTestId("contacts-table-surface")).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Mariam Adel" })).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toHaveTextContent("Reach this person")
    expect(screen.getByRole("link", { name: "Northstar Developments" })).toHaveAttribute("href", "/accounts/4")
    expect(screen.getByRole("link", { name: "Open lead" })).toHaveClass("w-full")

    await user.click(screen.getByRole("button", { name: "Close preview" }))
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Mariam Adel" })).not.toBeInTheDocument())
    expect(screen.getByTestId("contacts-table-surface")).toBeInTheDocument()
  })

  it("routes index edit to the dedicated show page with the encoded return context", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      if (url.includes("/v1/contacts?")) return new Response(JSON.stringify({ data: [contact], meta: { current_page: 2, last_page: 3 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    }))
    const user = userEvent.setup()
    renderIndex("/contacts?page=2&q=Mariam")

    const accountFilter = screen.getByRole("combobox", { name: "Account" })
    expect(accountFilter.closest('[data-slot="input-group"]')?.querySelector('[data-align="block-start"]')).toBeNull()
    await user.click(await screen.findByRole("link", { name: "Edit Mariam Adel" }))
    expect(screen.getByTestId("location-path")).toHaveTextContent("/contacts/7")
    const locationSearch = new URLSearchParams(screen.getByTestId("location-search").textContent ?? "")
    expect(locationSearch.get("mode")).toBe("edit")
    expect(locationSearch.get("return")).toBe("page=2&q=Mariam")
  })

  it("routes New contact to the dedicated create page with the encoded return context", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      if (url.includes("/v1/contacts?")) return new Response(JSON.stringify({ data: [contact], meta: { current_page: 2, last_page: 3 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    }))
    renderIndex("/contacts?page=2&q=Mariam")

    expect(await screen.findByRole("link", { name: "New contact" })).toHaveAttribute("href", "/contacts/create?return=page%3D2%26q%3DMariam")
  })

  it("redirects stale create mode to the dedicated contact create page", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      if (url.includes("/v1/contacts?")) return new Response(JSON.stringify({ data: [], meta: { current_page: 2, last_page: 2 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    }))
    renderIndex("/contacts?page=2&q=Mariam&mode=create")

    expect(await screen.findByRole("heading", { name: "New Contact" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to contacts" })).toHaveAttribute("href", "/contacts?page=2&q=Mariam")
  })

  it("reuses the dedicated contact editor for creation and sends the selected lead ID", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      if (String(input).includes("/v1/leads?")) return new Response(JSON.stringify({ data: [pendingLead], meta: { current_page: 1, last_page: 1 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage("/contacts/create?return=page%3D2")

    expect(await screen.findByRole("heading", { name: "New Contact" })).toBeInTheDocument()
    expect(screen.queryByText("The documented Accounts collection has no typed response, so this relationship stays read-only here.")).not.toBeInTheDocument()
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Existing Contact")
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "existing@example.com")
    await user.type(screen.getByRole("textbox", { name: /Phone/ }), "+201009999999")
    await user.click(screen.getByRole("combobox", { name: /Lead/ }))
    await user.click(await screen.findByRole("option", { name: /Mariam's Pending Inquiry/ }))
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue(pendingLead.name)
    expect(screen.getByRole("textbox", { name: /Email/ })).toHaveValue(pendingLead.email)
    expect(screen.getByRole("textbox", { name: /Phone/ })).toHaveValue(pendingLead.phone)
    await user.click(screen.getByRole("combobox", { name: /Account/ }))
    await user.click(screen.getByRole("option", { name: "Northstar Developments" }))
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(true))
    const create = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((create?.[1] as RequestInit).body))).toEqual({ name: pendingLead.name, title: null, email: pendingLead.email, phone: pendingLead.phone, account_id: 4, lead_id: 12 })
    expect(screen.getByTestId("location-path")).toHaveTextContent("/contacts")
  })

  it("keeps existing values when the selected lead field is null", async () => {
    const user = userEvent.setup()
    const nullableLead = { ...pendingLead, email: null, phone: null }
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      if (String(input).includes("/v1/leads?")) return new Response(JSON.stringify({ data: [nullableLead], meta: { current_page: 1, last_page: 1 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    }))
    renderPage("/contacts/create")

    await user.type(screen.getByRole("textbox", { name: /Email/ }), "keep@example.com")
    await user.type(screen.getByRole("textbox", { name: /Phone/ }), "+201008888888")
    await user.click(await screen.findByRole("combobox", { name: /Lead/ }))
    await user.click(await screen.findByRole("option", { name: /Mariam's Pending Inquiry/ }))

    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue(pendingLead.name)
    expect(screen.getByRole("textbox", { name: /Email/ })).toHaveValue("keep@example.com")
    expect(screen.getByRole("textbox", { name: /Phone/ })).toHaveValue("+201008888888")
  })

  it("debounces pending lead searches before requesting filtered results", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/v1/leads?")) return new Response(JSON.stringify({ data: [pendingLead], meta: { current_page: 1, last_page: 1 } }), { status: 200 })
      if (String(input).includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchSpy)
    const user = userEvent.setup()
    renderPage("/contacts/create")

    await user.click(await screen.findByRole("combobox", { name: /Lead/ }))
    expect(document.querySelector('[data-slot="input-group-addon"][data-align="block-start"]')).toBeInTheDocument()
    const leadSearch = screen.getByPlaceholderText("Search pending leads…")
    await user.type(leadSearch, "cairo")
    await waitFor(() => {
      const leadRequests = fetchSpy.mock.calls.filter(([input]) => String(input).includes("/v1/leads?"))
      expect(leadRequests.some(([input]) => new URL(String(input)).searchParams.get("q") === "cairo")).toBe(true)
    }, { timeout: 1000 })
    const filteredRequest = fetchSpy.mock.calls.find(([input]) => new URL(String(input)).searchParams.get("q") === "cairo")
    expect(new URL(String(filteredRequest?.[0])).searchParams.get("status")).toBe("pending")
  })

  it("debounces account searches before requesting filtered results", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/leads?")) return new Response(JSON.stringify({ data: [pendingLead], meta: { current_page: 1, last_page: 1 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchSpy)
    const user = userEvent.setup()
    renderPage("/contacts/create")

    await user.click(await screen.findByRole("combobox", { name: /Account/ }))
    const accountSearch = screen.getByPlaceholderText("Search accounts…")
    await user.type(accountSearch, "north")
    await waitFor(() => {
      const accountRequests = fetchSpy.mock.calls.filter(([input]) => String(input).includes("/v1/accounts"))
      expect(accountRequests.some(([input]) => new URL(String(input)).searchParams.get("q") === "north")).toBe(true)
    }, { timeout: 1000 })
  })

  it("loads the next account page from the picker when more results are available", async () => {
    const secondAccount = { ...contact.account, id: 5, name: "Luna Holdings" }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith("/v1/accounts")) {
        const page = url.searchParams.get("page")
        return new Response(JSON.stringify({ data: page === "2" ? [secondAccount] : [contact.account], meta: { current_page: Number(page ?? 1), last_page: 2 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      if (url.pathname.includes("/v1/leads")) return new Response(JSON.stringify({ data: [pendingLead], meta: { current_page: 1, last_page: 1 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchSpy)
    const user = userEvent.setup()
    renderPage("/contacts/create")

    await user.click(await screen.findByRole("combobox", { name: /Account/ }))
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByRole("option", { name: "Luna Holdings" })).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input]) => new URL(String(input)).searchParams.get("page") === "2")).toBe(true)
  })

  it("uses a popup confirmation before deleting an index contact", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      if (url.includes("/v1/accounts")) return new Response(JSON.stringify([contact.account]), { status: 200 })
      if (url.includes("/v1/contacts?")) return new Response(JSON.stringify({ data: [contact], meta: { current_page: 1, last_page: 1 } }), { status: 200 })
      return new Response(JSON.stringify({ contact }), { status: 200 })
    })
    vi.stubGlobal("fetch", fetchSpy)
    const user = userEvent.setup()
    renderIndex()

    await user.click(await screen.findByRole("button", { name: "Delete Mariam Adel" }))
    expect(screen.getByRole("alertdialog")).toHaveTextContent("This permanently removes Mariam Adel")
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete Mariam Adel" }))
    await user.click(screen.getByRole("button", { name: "Delete contact" }))
    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(true))
  })
})
