import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { DealDetailsPage } from "./details"
import { DealCreatePage } from "./create"
import { DealsPage } from "./index"
import { TooltipProvider } from "@/components/ui/tooltip"

let permissions = new Set<string>()
let isSuper = false
const currentUser = { id: 9, commission_rate: 2.5, roles: [] as { name: string }[] }
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can, isSuper, user: currentUser }) }))

const deal = {
  id: 27,
  value: 760000,
  deal_value: 735000,
  contact: { id: 3, name: "Layla Nasser", title: "Buyer", email: "layla@example.com", phone: "+201001234567", account: { id: 4, name: "Nasser Holdings" }, lead_id: 18 },
  property: { id: 8, images: [], title: "Palm Hills Villa", description: "A bright villa with a private garden and generous entertaining space.", city: "Cairo", address: "Palm Hills", price: 780000, type: "villa" as const, status: "showing" as const, owner: { id: 12, name: "Mona Hassan", username: "mona", email: "mona@example.com", phone: "+201009999999" } },
  agent_id: 9,
  agent: { id: 9, name: "Amina Saleh", username: "amina" },
  status: "inquiry" as const,
  commission_rate: 2.5,
  commission: { total_amount: 18375 },
  closed_at: null,
  created_at: "2026-07-01T12:00:00Z",
}
const userList = { data: [{ ...deal.agent, email: "amina@example.com", phone: "+201001234567", permissions: [], is_super: false }], links: { first: "", last: "", prev: null, next: null }, meta: { current_page: 1, from: 1, last_page: 1, links: [], path: "", per_page: 15, to: 1, total: 1 } }

function renderPage(entry = "/deals/27") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals/create" element={<DealCreatePage />} /><Route path="/deals/:dealId/edit" element={<DealCreatePage />} /><Route path="/deals/:dealId" element={<DealDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderCreate(entry = "/deals/create") {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals/create" element={<DealCreatePage />} /></Routes></MemoryRouter>)
}

function renderEdit(entry = "/deals/27/edit") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals/:dealId/edit" element={<DealCreatePage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderLegacyEdit(entry = "/deals/27?mode=edit") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals/:dealId" element={<DealCreatePage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderIndex(entry = "/deals?page=2&q=palm") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/deals" element={<DealsPage />} /><Route path="/deals/create" element={<DealCreatePage />} /><Route path="/deals/:dealId" element={<LocationProbe />} /></Routes></MemoryRouter></TooltipProvider>)
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
    currentUser.roles = []
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
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

    const heading = await screen.findByRole("heading", { name: /Layla Nasser.*Palm Hills Villa/i })
    expect(within(heading).queryByRole("link")).not.toBeInTheDocument()
    expect(document.querySelector('[aria-label="Layla Nasser avatar"]')).toBeInTheDocument()
    expect(screen.getByText("Property address")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "+201001234567" })).toHaveAttribute("href", "tel:+201001234567")
    expect(screen.getByRole("link", { name: "layla@example.com" })).toHaveAttribute("href", "mailto:layla@example.com")
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/deals/27/edit")

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
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to deals" })).toHaveAttribute("href", "/deals?page=2")
  })

  it("uses the existing deal details surface for creation", async () => {
    permissions = new Set(["deal.view", "deal.create", "property.view"])
    const user = userEvent.setup()
    renderCreate("/deals/create?return=page%3D2%26q%3Dpalm")

    expect(await screen.findByRole("heading", { name: "New deal" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
    expect(await screen.findByRole("textbox", { name: "Search properties" })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Select Palm Hills Villa" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous property" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next property" })).toBeInTheDocument()
    expect(document.querySelector('label[for="deal-property-search"]')).toBeNull()
    expect(document.querySelector('label[for="deal-contact"]')).toHaveTextContent("Contact (required)")
    expect(document.querySelector('label[for="deal-value"]')).toHaveTextContent("Value")
    expect(document.querySelectorAll('[data-align="block-start"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-align="block-end"]')).toHaveLength(0)
    expect(screen.getByRole("link", { name: "Back to deals" })).toHaveAttribute("href", "/deals?page=2&q=palm")

    await user.click(screen.getByRole("combobox", { name: "Contact" }))
    await user.click(await screen.findByRole("option", { name: "Layla Nasser" }))
    expect(document.querySelector('[aria-label="Layla Nasser avatar"]')).toBeInTheDocument()
  })

  it("uses the create form for editing and submits the documented update payload", async () => {
    permissions = new Set(["deal.view", "deal.update", "property.view"])
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    renderEdit("/deals/27/edit?return=page%3D2")

    expect(await screen.findByRole("heading", { name: "Edit deal" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
    expect(screen.queryByText("Deal editor")).not.toBeInTheDocument()
    expect(screen.queryByText(/stay read-only/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Search properties" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Select Palm Hills Villa" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Contact" })).not.toBeInTheDocument()
    expect(screen.queryByText("Commission")).not.toBeInTheDocument()
    expect(screen.getByText("Palm Hills Villa")).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/v1/properties"))).toBe(false)
    expect(screen.getByRole("spinbutton", { name: "Deal value(required)" })).toHaveValue(735000)

    await userEvent.setup().click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST" && String((init as RequestInit).body).includes('"_method":"PUT"'))).toBe(true))
  })

  it("renders the create form for the legacy edit URL", async () => {
    permissions = new Set(["deal.view", "deal.update", "property.view"])
    const fetchSpy = globalThis.fetch as ReturnType<typeof vi.fn>
    renderLegacyEdit()

    expect(await screen.findByRole("heading", { name: "Edit deal" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Search properties" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Contact" })).not.toBeInTheDocument()
    expect(screen.queryByText("Commission")).not.toBeInTheDocument()
    expect(screen.getByText("Palm Hills Villa")).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/v1/properties"))).toBe(false)
  })

  it("uses the first returned property image and selects the property from the URL", async () => {
    permissions = new Set(["deal.view", "deal.create", "property.view"])
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/contacts")) return new Response(JSON.stringify({ data: [deal.contact] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/properties")) return new Response(JSON.stringify({ data: [{ ...deal.property, images: [{ url: "https://example.com/first.jpg", thumbnail_url: "https://example.com/first-thumb.jpg" }, { url: "https://example.com/second.jpg", thumbnail_url: "https://example.com/second-thumb.jpg" }] }] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/users")) return new Response(JSON.stringify(userList), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ deal }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    renderCreate("/deals/create?property=8")
    const propertyCard = await screen.findByRole("button", { name: "Select Palm Hills Villa" })
    expect(propertyCard.querySelector("img")).toHaveAttribute("src", "https://example.com/first-thumb.jpg")
    expect(screen.getByRole("link", { name: "Open details for Palm Hills Villa" })).toHaveAttribute("href", "/properties/8")
    expect(screen.getByRole("link", { name: "Open details for Palm Hills Villa" })).toHaveAttribute("target", "_blank")
    expect(propertyCard).not.toHaveTextContent("+1")
    expect(propertyCard).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("spinbutton", { name: "Value" })).toHaveValue(780000)
    expect(screen.getByRole("spinbutton", { name: "Deal value(required)" })).toHaveValue(780000)
    expect(screen.queryByRole("spinbutton", { name: /Commission rate/ })).not.toBeInTheDocument()
    const commissionAddon = screen.getByText("Commission").closest('[data-align="inline-end"]')
    expect(commissionAddon).toHaveTextContent("$19,500.00")

    await user.click(propertyCard)
    expect(propertyCard).toHaveAttribute("aria-pressed", "true")
  })

  it("debounces carousel filtering and reveals dimmed properties while hovering", async () => {
    permissions = new Set(["deal.view", "deal.create", "property.view"])
    const user = userEvent.setup()
    const otherProperty = { ...deal.property, id: 9, title: "Garden Apartment", city: "Giza", price: 640000 }
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/v1/contacts")) return new Response(JSON.stringify({ data: [deal.contact] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/properties")) return new Response(JSON.stringify({ data: [deal.property, otherProperty] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.includes("/v1/users")) return new Response(JSON.stringify(userList), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ deal }), { status: 200, headers: { "Content-Type": "application/json" } })
    }))

    renderCreate()
    const palmCard = await screen.findByRole("button", { name: "Select Palm Hills Villa" })
    const gardenCard = await screen.findByRole("button", { name: "Select Garden Apartment" })
    await user.click(palmCard)
    await user.unhover(palmCard)
    expect(gardenCard).toHaveClass("opacity-40")

    await user.hover(gardenCard)
    expect(gardenCard).toHaveClass("opacity-100")
    await user.unhover(gardenCard)
    expect(gardenCard).toHaveClass("opacity-40")

    await user.click(gardenCard)
    expect(screen.getByRole("spinbutton", { name: "Deal value(required)" })).toHaveValue(640000)

    const search = screen.getByRole("textbox", { name: "Search properties" })
    await user.type(search, "garden")
    await waitFor(() => expect(screen.queryByRole("button", { name: "Select Palm Hills Villa" })).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Select Garden Apartment" })).toBeInTheDocument()
  })

  it("hides agent assignment for agent users and uses the signed-in agent", async () => {
    permissions = new Set(["deal.view", "deal.create", "property.view"])
    currentUser.roles = [{ name: "agent" }]
    renderCreate()

    await screen.findByRole("button", { name: "Select Palm Hills Villa" })
    await waitFor(() => expect(document.querySelector('input[name="agent_id"]')).toHaveValue("9"))
    expect(screen.queryByRole("combobox", { name: "Agent" })).not.toBeInTheDocument()
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
    expect(galleryPreview).toHaveAttribute("class", expect.stringContaining("aspect-[2/1]"))
    expect(galleryPreview.querySelectorAll("[data-gallery-full-image]")).toHaveLength(5)
    expect(galleryPreview.querySelector('[data-gallery-full-image]')).toHaveAttribute("src", "https://example.com/front.jpg")
    expect(galleryPreview.querySelector('[data-gallery-layout="five-plus"]')).toBeInTheDocument()
    expect(galleryPreview).not.toHaveTextContent("+1")

    await user.click(galleryPreview)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Palm Hills Villa, image 1 of 5" })).toBeInTheDocument()

    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("img", { name: "Palm Hills Villa, image 2 of 5" })).toBeInTheDocument()

    await user.keyboard("{ArrowLeft}")
    expect(screen.getByRole("img", { name: "Palm Hills Villa, image 1 of 5" })).toBeInTheDocument()
  })

  it("adapts the header gallery to the available image count", async () => {
    const images = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, uuid: `00000000-0000-4000-8000-00000000000${index + 1}`, name: `image-${index + 1}.jpg`, mime_type: "image/jpeg", size: 1200, url: `https://example.com/image-${index + 1}.jpg`, thumbnail_url: `https://example.com/image-${index + 1}-thumb.jpg`, order: index + 1, created_at: "2026-07-01T12:00:00Z" }))
    const responseFor = (imageCount: number) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ deal: { ...deal, property: { ...deal.property, images: images.slice(0, imageCount) } } }), { status: 200, headers: { "Content-Type": "application/json" } })))

    responseFor(4)
    const fourImages = renderPage()
    expect((await screen.findByRole("button", { name: "Open property gallery for Palm Hills Villa" })).querySelector('[data-gallery-layout="four"]')).toBeInTheDocument()
    fourImages.unmount()

    responseFor(3)
    const threeImages = renderPage()
    expect((await screen.findByRole("button", { name: "Open property gallery for Palm Hills Villa" })).querySelector('[data-gallery-layout="three"]')).toBeInTheDocument()
    threeImages.unmount()

    responseFor(1)
    renderPage()
    expect((await screen.findByRole("button", { name: "Open property gallery for Palm Hills Villa" })).querySelector('[data-gallery-layout="one"]')).toBeInTheDocument()
  })
})

describe("DealsPage table interactions", () => {
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

  it("does not navigate or open an overlay when a row is clicked", async () => {
    const user = userEvent.setup()
    renderIndex()

    const row = await screen.findByRole("row", { name: /Layla Nasser/ })
    expect(row).not.toHaveClass("cursor-pointer")
    expect(screen.queryByRole("dialog", { name: "Deal preview" })).not.toBeInTheDocument()

    await user.click(row)
    expect(screen.getByRole("row", { name: /Layla Nasser/ })).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Deal preview" })).not.toBeInTheDocument()
  })

  it("links Add new deal to the existing dedicated deal surface with return context", async () => {
    permissions = new Set(["deal.view", "deal.create", "contact.view", "property.view"])
    renderIndex("/deals?page=2&q=palm")

    expect(await screen.findByRole("link", { name: "Add new deal" })).toHaveAttribute("href", "/deals/create?return=page%3D2%26q%3Dpalm")
    expect(screen.getByText("1 Deals")).toHaveClass("font-mono", "tabular-nums", "text-muted-foreground")
  })

  it("shows the selected range when hovering a value slider", async () => {
    const user = userEvent.setup()
    renderIndex("/deals?page=2")

    await screen.findByText("Listed value")
    const sliderArea = screen.getByText("Listed value").closest('[data-slot="tooltip-trigger"]')
    expect(sliderArea).not.toBeNull()
    await user.hover(sliderArea!)

    expect(await screen.findByRole("tooltip")).toHaveAttribute("data-side", "bottom")
    expect(screen.getByRole("tooltip")).toHaveTextContent("$0 – $1,000,000")
  })

  it("slides the external filter control while keeping the table mounted", async () => {
    const user = userEvent.setup()
    renderIndex("/deals?page=2")

    const filterButton = await screen.findByRole("button", { name: "Filter" })
    expect(filterButton).toHaveAttribute("aria-expanded", "true")
    await user.click(filterButton)
    expect(filterButton).toHaveAttribute("aria-expanded", "false")
    expect(document.getElementById("deals-filter-panel")).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByRole("columnheader", { name: "Contact" })).toBeInTheDocument()

    await user.click(filterButton)
    expect(filterButton).toHaveAttribute("aria-expanded", "true")
    expect(document.getElementById("deals-filter-panel")).toHaveAttribute("aria-hidden", "false")
  })

  it("opens a contact's originating lead in the Leads dialog", async () => {
    permissions = new Set(["deal.view", "lead.view", "property.view"])
    renderIndex("/deals?page=2")

    const row = await screen.findByRole("row", { name: /Layla Nasser/ })
    const contactLink = within(row).getByRole("link", { name: "Layla Nasser" })
    expect(contactLink).toHaveAttribute("href", "/pipeline?record=18")
    expect(contactLink).toHaveClass("text-foreground", "hover:text-primary")
    expect(within(row).getByRole("link", { name: "Palm Hills Villa" })).toHaveClass("text-foreground", "hover:text-primary")
    expect(within(row).getByRole("link", { name: "Open Palm Hills Villa" })).toHaveAttribute("href", "/properties/8")
    expect(within(row).getByRole("link", { name: "Amina Saleh" })).toHaveClass("text-foreground", "hover:text-primary")
    expect(within(row).getByRole("link", { name: "Amina Saleh avatar" })).toHaveAttribute("href", "/agents/9")
    expect(within(row).getByRole("link", { name: "Edit deal 27" })).toHaveAttribute("href", "/deals/27/edit?return=page%3D2")
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
