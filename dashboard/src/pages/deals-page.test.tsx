import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { DealDetailsPage, DealsPage } from "./deals-page"
import { TooltipProvider } from "@/components/ui/tooltip"

let permissions = new Set<string>()
let isSuper = false
const currentUser = { id: 9, commission_rate: 2.5 }
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can, isSuper, user: currentUser }) }))

const deal = {
  id: 27,
  value: 760000,
  deal_value: 735000,
  contact: { id: 3, name: "Layla Nasser", title: "Buyer", email: "layla@example.com", phone: "+201001234567", account: { id: 4, name: "Nasser Holdings" } },
  property: { id: 8, images: [], title: "Palm Hills Villa", description: "A bright villa with a private garden and generous entertaining space.", city: "Cairo", address: "Palm Hills", price: 780000, type: "villa" as const, status: "showing" as const, owner: { id: 12, name: "Mona Hassan", username: "mona", email: "mona@example.com", phone: "+201009999999" } },
  agent_id: 9,
  agent: { id: 9, name: "Amina Saleh", username: "amina" },
  status: "inquiry" as const,
  commission_rate: 2.5,
  closed_at: null,
  created_at: "2026-07-01T12:00:00Z",
}
const userList = { data: [{ ...deal.agent, email: "amina@example.com", phone: "+201001234567", permissions: [], is_super: false }], links: { first: "", last: "", prev: null, next: null }, meta: { current_page: 1, from: 1, last_page: 1, links: [], path: "", per_page: 15, to: 1, total: 1 } }

function renderPage(entry = "/deals/27") {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals/create" element={<DealDetailsPage create />} /><Route path="/deals/:dealId" element={<DealDetailsPage />} /></Routes></MemoryRouter>)
}

function renderCreate(entry = "/deals/create") {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals/create" element={<DealDetailsPage create />} /></Routes></MemoryRouter>)
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderIndex(entry = "/deals?page=2&q=palm&record=27") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals" element={<DealsPage />} /><Route path="/deals/create" element={<DealDetailsPage create />} /><Route path="/deals/:dealId" element={<LocationProbe />} /></Routes></MemoryRouter></TooltipProvider>)
}

function listResponse() {
  return {
    data: [deal],
    links: { first: "", last: "", prev: null, next: "" },
    meta: { current_page: 2, from: 1, last_page: 2, links: [], path: "", per_page: 15, to: 1, total: 1 },
    filter: { min_value: 0, max_value: 1000000, min_deal_value: 0, max_deal_value: 1000000 },
  }
}

describe("DealDetailsPage", () => {
  beforeEach(() => {
    permissions = new Set(["deal.view", "contact.view", "property.view", "account.view", "user.view"])
    isSuper = false
    currentUser.id = 9
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ deal: { ...deal, status: "viewing" } }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/users")) return new Response(JSON.stringify(userList), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/contacts")) return new Response(JSON.stringify({ data: [deal.contact] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/properties")) return new Response(JSON.stringify({ data: [deal.property] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (String(input).includes("/v1/deals?per_page=100")) return new Response(JSON.stringify(listResponse()), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ deal }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))
  })

  it("keeps contact actions and record-owner workflow controls available", async () => {
    const user = userEvent.setup()
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    renderPage()

    expect(await screen.findByRole("heading", { name: /Layla Nasser.*Palm Hills Villa/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "+201001234567" })).toHaveAttribute("href", "tel:+201001234567")
    expect(screen.getByRole("link", { name: "layla@example.com" })).toHaveAttribute("href", "mailto:layla@example.com")
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "viewing" }))

    expect(await screen.findByText("Status updated to viewing.")).toBeInTheDocument()
    const update = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toEqual({ status: "viewing", _method: "PUT" })
  })

  it("withholds related routes and mutation controls without their permissions", async () => {
    permissions = new Set(["deal.view"])
    currentUser.id = 99
    renderPage("/deals/27?return=page%3D2")

    expect(await screen.findByRole("heading", { name: /Layla Nasser.*Palm Hills Villa/i })).toBeInTheDocument()
    expect(screen.getAllByText("Layla Nasser").every((node) => node.closest("a") === null)).toBe(true)
    expect(screen.getAllByText("Palm Hills Villa").every((node) => node.closest("a") === null)).toBe(true)
    expect(screen.queryByRole("link", { name: "Open property" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to deals" })).toHaveAttribute("href", "/deals?page=2")
  })

  it("uses the existing deal details surface for creation", async () => {
    permissions = new Set(["deal.view", "deal.create"])
    renderCreate("/deals/create?return=page%3D2%26q%3Dpalm")

    expect(await screen.findByRole("heading", { name: "New deal" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
    expect(await screen.findByText("Choose a contact")).toBeInTheDocument()
    expect(screen.getByText("Choose a property")).toBeInTheDocument()
    const blockStartLabels = [...document.querySelectorAll('[data-align="block-start"]')].map((element) => element.textContent?.replace(/\s+/g, " ").trim())
    expect(blockStartLabels.slice(0, 5)).toEqual(["Property(required)", "Contact(required)", "Value", "Deal value (required)", "Agent (required)"])
    expect(screen.getByRole("link", { name: "Back to deals" })).toHaveAttribute("href", "/deals?page=2&q=palm")
  })

  it("uses the first returned property image in the searchable picker", async () => {
    permissions = new Set(["deal.view", "deal.create"])
    const user = userEvent.setup()
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/contacts")) return new Response(JSON.stringify({ data: [deal.contact] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/properties")) return new Response(JSON.stringify({ data: [{ ...deal.property, images: [{ url: "https://example.com/first.jpg", thumbnail_url: "https://example.com/first-thumb.jpg" }, { url: "https://example.com/second.jpg", thumbnail_url: "https://example.com/second-thumb.jpg" }] }] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/users")) return new Response(JSON.stringify(userList), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ deal }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    renderCreate()
    await user.click(await screen.findByRole("combobox", { name: "Property(required)" }))
    const propertyOption = await screen.findByRole("option", { name: /Palm Hills Villa/ })
    expect(propertyOption.querySelector("img")).toHaveAttribute("src", "https://example.com/first-thumb.jpg")
    await user.click(propertyOption)
    expect(screen.getByRole("spinbutton", { name: "Value" })).toHaveValue(780000)
    expect(screen.getByRole("spinbutton", { name: "Deal value(required)" })).toHaveValue(780000)
    expect(screen.queryByRole("spinbutton", { name: /Commission rate/ })).not.toBeInTheDocument()
    const commissionAddon = screen.getByText("Commission").closest('[data-align="block-end"]')
    expect(commissionAddon).toHaveTextContent("$19,500.00")
  })

  it("makes the embedded listing easy to assess before opening the full property", async () => {
    renderPage()

    expect(await screen.findByText("Listing Showing")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open property" })).toHaveAttribute("href", "/properties/8")
    expect(screen.getByText("Asking price")).toBeInTheDocument()
    expect(screen.getByText("$780,000.00")).toBeInTheDocument()
    expect(screen.getByText("A bright villa with a private garden and generous entertaining space.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Mona Hassan" })).toHaveAttribute("href", "/agents/12")
  })

  it("opens the documented property images in a carousel", async () => {
    const user = userEvent.setup()
    const images = [
      { id: 1, uuid: "98f11f4a-151d-4b92-9736-3d27109bdab7", name: "front.jpg", mime_type: "image/jpeg", size: 1200, url: "https://example.com/front.jpg", thumbnail_url: "https://example.com/front-thumb.jpg", order: 1, created_at: "2026-07-01T12:00:00Z" },
      { id: 2, uuid: "8497c218-15d4-4dc1-86ce-d0c94b28a735", name: "garden.jpg", mime_type: "image/jpeg", size: 1200, url: "https://example.com/garden.jpg", thumbnail_url: "https://example.com/garden-thumb.jpg", order: 2, created_at: "2026-07-01T12:00:00Z" },
      { id: 3, uuid: "a406d07a-2991-4965-9c05-bb703b2f0ad4", name: "living-room.jpg", mime_type: "image/jpeg", size: 1200, url: "https://example.com/living-room.jpg", thumbnail_url: "https://example.com/living-room-thumb.jpg", order: 3, created_at: "2026-07-01T12:00:00Z" },
      { id: 4, uuid: "1d0a00a5-ffb5-41e8-a19e-a20e619999c6", name: "pool.jpg", mime_type: "image/jpeg", size: 1200, url: "https://example.com/pool.jpg", thumbnail_url: "https://example.com/pool-thumb.jpg", order: 4, created_at: "2026-07-01T12:00:00Z" },
      { id: 5, uuid: "09cb6d7f-619b-4399-a7b5-b00f9f5bc2f5", name: "terrace.jpg", mime_type: "image/jpeg", size: 1200, url: "https://example.com/terrace.jpg", thumbnail_url: "https://example.com/terrace-thumb.jpg", order: 5, created_at: "2026-07-01T12:00:00Z" },
    ]
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ deal: { ...deal, property: { ...deal.property, images } } }), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderPage()

    const galleryPreview = await screen.findByRole("button", { name: "Open property gallery for Palm Hills Villa" })
    expect(galleryPreview.querySelectorAll("img")).toHaveLength(4)
    expect(galleryPreview).toHaveTextContent("+1")

    await user.click(galleryPreview)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Palm Hills Villa, image 1 of 5" })).toBeInTheDocument()

    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("img", { name: "Palm Hills Villa, image 2 of 5" })).toBeInTheDocument()

    await user.keyboard("{ArrowLeft}")
    expect(screen.getByRole("img", { name: "Palm Hills Villa, image 1 of 5" })).toBeInTheDocument()
  })
})

describe("DealsPage preview drawer", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    permissions = new Set(["deal.view", "contact.view", "property.view"])
    isSuper = false
    currentUser.id = 9
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/users")) return new Response(JSON.stringify(userList), { status: 200, headers: { "Content-Type": "application/json" } })
      const body = url.includes("/v1/deals/27") ? { deal: { ...deal, property: { ...deal.property, images: [{ id: 1, uuid: "98f11f4a-151d-4b92-9736-3d27109bdab7", name: "front.jpg", mime_type: "image/jpeg", size: 1200, url: "https://example.com/front.jpg", thumbnail_url: "https://example.com/front-thumb.jpg", order: 1, created_at: "2026-07-01T12:00:00Z" }] } } } : listResponse()
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    }))
  })

  it("loads a direct record URL in an overlay without narrowing the table and routes edit to the detail page", async () => {
    const user = userEvent.setup()
    renderIndex()

    await screen.findAllByText("Layla Nasser")
    const preview = screen.getByRole("dialog", { name: "Deal preview" })
    expect(preview).toHaveTextContent("Layla Nasser")
    expect(await screen.findByAltText("Palm Hills Villa listing")).toBeInTheDocument()
    expect(preview).toHaveTextContent("$735,000.00")
    expect(preview).toHaveTextContent("$760,000.00")
    expect(preview).toHaveTextContent("Assigned agent")
    expect(preview).not.toHaveTextContent("Deal economics")
    expect(document.querySelector("table")?.closest("section")?.parentElement).not.toHaveClass("lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]")

    await user.click(screen.getByRole("button", { name: "Edit deal" }))
    expect(await screen.findByTestId("location")).toHaveTextContent("/deals/27?mode=edit&return=page%3D2%26q%3Dpalm")
  })

  it("links New deal to the existing dedicated deal surface with return context", async () => {
    permissions = new Set(["deal.view", "deal.create", "contact.view", "property.view"])
    renderIndex("/deals?page=2&q=palm")

    expect(await screen.findByRole("link", { name: "New deal" })).toHaveAttribute("href", "/deals/create?return=page%3D2%26q%3Dpalm")
  })

  it("redirects the old index create state to the existing deal details surface", async () => {
    permissions = new Set(["deal.view", "deal.create", "contact.view", "property.view"])
    renderIndex("/deals?mode=create&page=2&q=palm")

    expect(await screen.findByRole("heading", { name: "New deal" })).toBeInTheDocument()
  })

  it("uses a confirmation popup before deleting from the index", async () => {
    const user = userEvent.setup()
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    isSuper = true
    renderIndex("/deals?page=2")

    await screen.findByRole("row", { name: /Layla Nasser/ })
    await user.click(screen.getByRole("button", { name: "Delete deal 27" }))
    expect(screen.getByRole("alertdialog", { name: "Delete this deal?" })).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog", { name: "Delete this deal?" })).not.toBeInTheDocument()
  })
})
