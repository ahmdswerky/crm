import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AccountsPage } from "./index"
import { AccountDetailsPage } from "./details"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can }) }))

const account = {
  id: 4,
  name: "Northstar Developments",
  industry: "Development",
  phone: "+2025550100",
  address: "New Cairo",
  image: { url: "/storage/accounts/4/northstar.svg", thumbnail_url: "/storage/accounts/4/northstar.svg" },
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
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/accounts/:accountId" element={<AccountDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderIndex(entry = "/accounts?page=2&q=Northstar") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/accounts" element={<AccountsPage />} /><Route path="/accounts/:accountId" element={<AccountDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

describe("AccountsPage", () => {
  beforeEach(() => {
    permissions = new Set(["account.view", "account.create", "account.edit", "account.delete"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  })

  it("uses explicit actions without opening a row preview", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/v1/accounts?")) return new Response(JSON.stringify({ data: [account], meta: { current_page: 2, last_page: 3, total: 13 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/media?")) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)

    renderIndex()
    await screen.findByText(account.name)
    expect(screen.getByTestId("accounts-table-surface").className).not.toContain("grid")
    expect(screen.getByRole("columnheader", { name: "Leads" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Image" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument()
    expect(within(screen.getByRole("row", { name: /Northstar Developments/ })).getByText("6")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Northstar Developments logo" })).toHaveAttribute("src", "/storage/accounts/4/northstar.svg")
    expect(screen.getByRole("img", { name: "Northstar Developments logo" })).toHaveClass("bg-white", "dark:bg-white")

    const row = screen.getByRole("row", { name: /Northstar Developments/ })
    expect(row).not.toHaveClass("cursor-pointer")
    expect(within(row).getByRole("link", { name: `View ${account.name}` })).toHaveAttribute("href", "/accounts/4?return=page%3D2%26q%3DNorthstar")
    expect(within(row).getByRole("button", { name: `Delete ${account.name}` })).toBeDisabled()
    await user.hover(within(row).getByRole("button", { name: `Delete ${account.name}` }).parentElement!)
    expect(await screen.findByText("Accounts with contacts cannot be deleted.")).toBeInTheDocument()
    await user.click(within(row).getByRole("button", { name: `Edit ${account.name}` }))
    expect(await screen.findByRole("heading", { name: "Edit account" })).toBeInTheDocument()
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/v1/media?"))).toBe(true))
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).includes("/v1/accounts?"))).toHaveLength(1)
  })

  it("creates accounts in a dialog and uploads an optional logo", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/v1/media") && init?.method === "POST") return new Response(JSON.stringify({ data: [{ id: 91, uuid: "af3b47bc-2853-4fb1-a2d3-304bc08a6c61", name: "northstar.png", mime_type: "image/png", size: 100, url: "/storage/accounts/4/northstar.png", thumbnail_url: "/storage/accounts/4/northstar.png", order: 1, created_at: "2026-08-10T12:00:00Z" }] }), { status: 201, headers: { "Content-Type": "application/json" } })
      if (init?.method === "POST") return new Response(JSON.stringify({ account }), { status: 201, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/accounts?")) return new Response(JSON.stringify({ data: [account], meta: { current_page: 1, last_page: 1, total: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ account }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)

    renderIndex()
    await user.click(await screen.findByRole("button", { name: "New account" }))
    expect(await screen.findByRole("heading", { name: "New account" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Upload Account logo" })).toBeInTheDocument()
    const fields = screen.getAllByRole("textbox")
    await user.type(fields[0], account.name)
    await user.type(fields[1], account.industry)
    await user.type(fields[2], account.phone)
    await user.type(fields[3], account.address)
    const logoInput = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(logoInput).not.toBeNull()
    await user.upload(logoInput!, new File(["logo"], "northstar.png", { type: "image/png" }))
    expect(await screen.findByRole("button", { name: "Replace Account logo" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Create" }))
    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(true))
    await waitFor(() => expect(fetchSpy.mock.calls.some(([input, init]) => String(input).includes("/v1/media") && (init as RequestInit | undefined)?.method === "POST")).toBe(true))
    expect(screen.queryByRole("heading", { name: "New account" })).not.toBeInTheDocument()

  })

  it("uses the Deals-style collapsible filter panel without unmounting the table", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [account], meta: { current_page: 2, last_page: 3, total: 13 } }), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex()

    const filterButton = await screen.findByRole("button", { name: "Filter" })
    expect(filterButton).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByLabelText("Search")).toBeInTheDocument()
    expect(screen.queryByLabelText("Industry")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Phone")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Address")).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Created" })).not.toBeInTheDocument()
    await user.click(filterButton)
    expect(filterButton).toHaveAttribute("aria-expanded", "false")
    expect(document.getElementById("accounts-filter-panel")).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("columnheader", { name: "Account" })).toBeInTheDocument()

    await user.click(filterButton)
    expect(filterButton).toHaveAttribute("aria-expanded", "true")
    expect(document.getElementById("accounts-filter-panel")).toHaveAttribute("aria-hidden", "false")
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
    expect(new URL(String(contactsRequest?.[0])).searchParams.get("per_page")).toBe("16")
    expect(screen.getByText(contactsResponse.data[0].email)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
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
    expect(await screen.findByRole("heading", { name: "Edit account" })).toBeInTheDocument()

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
      return new Response(JSON.stringify({ account: { ...account, contacts_count: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } })
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
