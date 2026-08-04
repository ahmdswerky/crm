import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AccountDetailsPage, AccountsPage } from "./accounts-page"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can }) }))

const account = {
  id: 4,
  name: "Northstar Developments",
  industry: "Development",
  phone: "+2025550100",
  address: "New Cairo",
  contacts_count: 6,
  created_at: "2026-07-01T12:00:00Z",
}

const activityResponse = {
  data: [{
    id: 40,
    event: "updated" as const,
    description: "Account updated",
    subject: { type: "account" as const, id: 4, label: account.name },
    causer: { id: 12, name: "Mona Hassan" },
    changes: { before: { industry: "Construction" }, after: { industry: "Development" } },
    metadata: { reverted_activity_id: null, reason: null, restored_attributes: null },
    revert: { allowed: false },
    created_at: "2026-07-01T12:00:00Z",
  }],
  links: { first: "", last: "", prev: null, next: "" },
  meta: { current_page: 1, from: 1, last_page: 1, links: [], path: "", per_page: 5, to: 1, total: 1 },
}

const contactsResponse = {
  data: [{
    id: 7,
    name: "Mariam Adel",
    title: "Operations Director",
    email: "mariam@example.com",
    phone: "+201001234567",
  }],
}

function renderPage(entry = "/accounts/4") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/accounts/create" element={<AccountDetailsPage create />} /><Route path="/accounts/:accountId" element={<AccountDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderIndex(entry = "/accounts?page=2&q=Northstar") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/accounts" element={<AccountsPage />} /><Route path="/accounts/create" element={<AccountDetailsPage create />} /><Route path="/accounts/:accountId" element={<AccountDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

describe("AccountsPage", () => {
  beforeEach(() => {
    permissions = new Set(["account.view", "account.create", "account.edit", "account.delete"])
  })

  it("opens a URL-addressable read-only drawer without shrinking the table", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/v1/accounts?")) return new Response(JSON.stringify({ data: [account], meta: { current_page: 2, last_page: 3, total: 13 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    renderIndex()
    await screen.findByText(account.name)
    expect(screen.getByTestId("accounts-table-surface").className).not.toContain("grid")

    await user.click(screen.getByText(account.name))
    expect(await screen.findByRole("heading", { name: "Account preview" })).toBeInTheDocument()
    expect(screen.getByText("Organization")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Edit account" }).find((link) => link.getAttribute("href")?.includes("mode=edit"))).toHaveAttribute("href", "/accounts/4?mode=edit&return=page%3D2%26q%3DNorthstar")

    await user.click(screen.getByRole("button", { name: "Close preview" }))
    expect(screen.queryByRole("heading", { name: "Account preview" })).not.toBeInTheDocument()
  })

  it("opens the drawer from a direct record URL and confirms deletion in a popup", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      if (String(input).includes("/v1/accounts?")) return new Response(JSON.stringify({ data: [account], meta: { current_page: 1, last_page: 1, total: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)

    renderIndex("/accounts?record=4")
    expect(await screen.findByRole("heading", { name: "Account preview" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Delete account" }))
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: `Delete ${account.name}?` })).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)

    await user.click(screen.getByRole("button", { name: "Delete account" }))
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(true)
  })

  it("links new accounts to the dedicated create page with return context", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [account], meta: { current_page: 2, last_page: 3, total: 13 } }), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex()

    expect(await screen.findByRole("heading", { name: "Accounts" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /New account/ })).toHaveAttribute("href", "/accounts/create?return=page%3D2%26q%3DNorthstar")
  })

  it("redirects stale index create URLs to the dedicated create page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [], meta: { current_page: 2, last_page: 3, total: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex("/accounts?page=2&q=Northstar&mode=create")

    expect(await screen.findByRole("heading", { name: "New account" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to accounts" })).toHaveAttribute("href", "/accounts?page=2&q=Northstar")
  })
})

describe("AccountDetailsPage", () => {
  beforeEach(() => {
    permissions = new Set(["account.view", "account.edit", "account.delete", "contact.view", "activity-log.view"])
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/activity-logs")) return new Response(JSON.stringify(activityResponse), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/contacts?")) return new Response(JSON.stringify(contactsResponse), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))
  })

  it("reuses the details editor on the dedicated create route", async () => {
    permissions = new Set(["account.create"])
    renderPage("/accounts/create?return=page%3D2%26q%3DNorthstar")

    expect(await screen.findByRole("heading", { name: "New account" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Organization information" })).not.toBeInTheDocument()
    expect(screen.queryByText("Add the organization details staff will use across contacts and deals.")).not.toBeInTheDocument()
    expect(screen.queryByText("Account identity")).not.toBeInTheDocument()
    expect(screen.queryByText("Contact and location")).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveAttribute("autocomplete", "organization")
    expect(screen.getByRole("textbox", { name: /Phone/ })).toHaveAttribute("autocomplete", "tel")
    expect(screen.getByRole("textbox", { name: /Address/ })).toHaveAttribute("autocomplete", "street-address")
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("form", "account-create-form")
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to accounts" })).toHaveAttribute("href", "/accounts?page=2&q=Northstar")
  })

  it("submits creation through the documented account store endpoint", async () => {
    permissions = new Set(["account.create", "account.view"])
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ account }), { status: 201, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage("/accounts/create?return=page%3D2%26q%3DNorthstar")

    await screen.findByRole("heading", { name: "New account" })
    const fields = screen.getAllByRole("textbox")
    await user.type(fields[0], account.name)
    await user.type(fields[1], account.industry)
    await user.type(fields[2], account.phone)
    await user.type(fields[3], account.address)
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(true))
    const createRequest = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((createRequest?.[1] as RequestInit).body))).toMatchObject({ name: account.name, industry: account.industry, phone: account.phone, address: account.address })
    expect(await screen.findByRole("heading", { name: account.name })).toBeInTheDocument()
  })

  it("keeps the organization's call affordance and audit history on the dedicated route", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: account.name })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: account.phone })[0]).toHaveAttribute("href", `tel:${account.phone}`)
    expect(await screen.findByRole("heading", { name: "Contacts" })).toBeInTheDocument()
    expect(screen.getByLabelText("6 contacts")).toHaveTextContent("6")
    expect(screen.getByRole("link", { name: "Open Mariam Adel" })).toHaveAttribute("href", "/contacts/7")
    expect(screen.queryByRole("link", { name: contactsResponse.data[0].phone })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: contactsResponse.data[0].email })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View all contacts" })).toHaveAttribute("href", "/contacts?account=4")
    const contactsRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([input]) => String(input).includes("/contacts?"))
    expect(new URL(String(contactsRequest?.[0])).searchParams.get("per_page")).toBe("4")
    expect(await screen.findByRole("heading", { name: "Account activity" })).toBeInTheDocument()
    expect(screen.getByText("Account updated")).toBeInTheDocument()
  })

  it("edits on the current route with the required method spoofing", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/activity-logs")) return new Response(JSON.stringify(activityResponse), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/contacts?")) return new Response(JSON.stringify(contactsResponse), { status: 200, headers: { "Content-Type": "application/json" } })
      if (init?.method === "POST") return new Response(JSON.stringify({ account: { ...account, industry: "Mixed-use Development" } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage()

    await screen.findByRole("heading", { name: account.name })
    await user.click(screen.getByRole("button", { name: "Edit account" }))
    expect(await screen.findByRole("heading", { name: "Organization information" })).toBeInTheDocument()

    const industry = screen.getAllByRole("textbox")[1]
    await user.clear(industry)
    await user.type(industry, "Mixed-use Development")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(await screen.findByText("Mixed-use Development")).toBeInTheDocument()
    const update = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toMatchObject({ name: account.name, industry: "Mixed-use Development", _method: "PUT" })
  })

  it("uses a popup before deleting from the dedicated route", async () => {
    const user = userEvent.setup()
    permissions = new Set(["account.view", "account.delete"])
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage()

    await screen.findByRole("heading", { name: account.name })
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)

    await user.click(screen.getByRole("button", { name: "Delete account" }))
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(true)
  })

  it("does not request or show activity without its explicit permission", async () => {
    permissions = new Set(["account.view"])
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    renderPage()

    await screen.findByRole("heading", { name: account.name })
    expect(screen.queryByRole("heading", { name: "Account activity" })).not.toBeInTheDocument()
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).includes("/activity-logs"))).toHaveLength(0)
  })

  it("does not request or show contacts without their explicit view permission", async () => {
    permissions = new Set(["account.view"])
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    renderPage()

    await screen.findByRole("heading", { name: account.name })
    expect(screen.queryByRole("heading", { name: "Contacts" })).not.toBeInTheDocument()
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).includes("/contacts?"))).toHaveLength(0)
  })

  it("offers retry for a failed member request without presenting a false not-found state", async () => {
    permissions = new Set(["account.view"])
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } })))
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to open account")
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })
})
