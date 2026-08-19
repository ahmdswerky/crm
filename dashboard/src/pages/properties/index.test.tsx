import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { PropertiesPage } from "./index"
import { PropertyCreatePage, PropertyEditPage } from "./create"
import { PropertyDetailsPage } from "./details"
import { tokenStore } from "@/api/token-store"
import { TooltipProvider } from "@/components/ui/tooltip"

let permissions = new Set<string>()
const can = (permission: string) => permissions.has(permission)

vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ can }) }))

const property = {
  id: 7,
  images: [],
  title: "27 Garden Street",
  description: "A bright villa close to the park.",
  city: "Cairo",
  address: "27 Garden Street",
  price: 725000,
  type: "villa" as const,
  status: "showing" as const,
  created_at: "2026-07-01T12:00:00Z",
  owner: {
    id: 12,
    name: "Mona Hassan",
    username: "mona.hassan",
    email: "mona@example.com",
    phone: "+201000000000",
  },
}

function renderPage(entry = "/properties/7") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/properties/create" element={<PropertyCreatePage />} /><Route path="/properties/edit/:propertyId" element={<PropertyEditPage />} /><Route path="/properties/:propertyId" element={<PropertyDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderIndex(entry = "/properties") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/properties" element={<PropertiesPage />} /><Route path="/properties/create" element={<PropertyCreatePage />} /><Route path="/properties/edit/:propertyId" element={<PropertyEditPage />} /><Route path="/properties/:propertyId" element={<PropertyDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function listBody() {
  return {
    data: [property],
    links: { first: "", last: null, prev: null, next: "" },
    meta: { current_page: 2, from: 1, last_page: 2, links: [], path: "/v1/properties", per_page: 12, to: 1, total: 1 },
    filter: { min_price: 5000, max_price: 1000000 },
  }
}

const relatedDeal = {
  id: 71,
  value: 710000,
  deal_value: 720000,
  contact: { id: 23, name: "Layla Nasser", phone: "+201200000000" },
  property,
  agent_id: 12,
  agent: { id: 12, name: "Mona Hassan", username: "mona.hassan", email: "mona@example.com", phone: "+201000000000" },
  status: "viewing" as const,
  commission_rate: 2,
  commission: { status: "estimate" as const, version: 1, agent_amount: 14400, manager_amount: 7200, company_amount: 7200, total_amount: 28800, calculated_at: null, finalized_at: null },
  closed_at: null,
  created_at: "2026-07-02T12:00:00Z",
}

function dealsBody(data: unknown[] = [relatedDeal], page = 1, lastPage = 1) {
  return {
    data,
    links: { first: "", last: null, prev: null, next: "" },
    meta: { current_page: page, from: data.length ? 1 : null, last_page: lastPage, links: [], path: "/v1/deals", per_page: 6, to: data.length, total: lastPage === 1 ? data.length : 2 },
    filter: { min_value: null, max_value: null, min_deal_value: null, max_deal_value: null },
  }
}

describe("PropertyDetailsPage", () => {
  beforeEach(() => {
    tokenStore.clear()
    permissions = new Set(["property.view", "property.edit", "deal.view", "deal.create"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes("/v1/deals") ? dealsBody() : { property }
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    }))
  })

  it("reuses the details editor on the dedicated create route", async () => {
    permissions = new Set(["property.create"])
    renderPage("/properties/create?return=page%3D2%26q%3DGarden")

    expect(await screen.findByRole("heading", { name: "New property" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Listing information" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument()
    expect(screen.getAllByRole("group").filter((group) => group.getAttribute("data-slot") === "input-group")).toHaveLength(7)
    expect(screen.getByRole("button", { name: "Property images" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to properties" })).toHaveAttribute("href", "/properties?page=2&q=Garden")
  })

  it("submits creation through the documented property store endpoint", async () => {
    permissions = new Set(["property.create", "property.view"])
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ property }), { status: 201, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ property }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage("/properties/create?return=page%3D2%26q%3DGarden")

    await screen.findByRole("heading", { name: "New property" })
    await user.type(screen.getByRole("textbox", { name: /^title/i }), "27 Garden Street")
    await user.type(screen.getByRole("textbox", { name: /^city/i }), "Cairo")
    await user.type(screen.getByRole("textbox", { name: /^address/i }), "27 Garden Street")
    await user.type(screen.getByRole("spinbutton", { name: /^price/i }), "725000")
    await user.type(screen.getByRole("textbox", { name: /^description/i }), "A bright villa close to the park.")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toBe(true))
    const createRequest = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    const createPayload = JSON.parse(String((createRequest?.[1] as RequestInit).body))
    expect(createPayload).toMatchObject({ title: "27 Garden Street", city: "Cairo", price: 725000, type: "villa" })
    expect(createPayload).not.toHaveProperty("status")
    expect(await screen.findByRole("heading", { name: "27 Garden Street" })).toBeInTheDocument()
  })

  it("uploads staged images only after the property has been created", async () => {
    permissions = new Set(["property.create", "property.view"])
    tokenStore.set("media-upload-token")
    const user = userEvent.setup()
    let resolveProperty: ((response: Response) => void) | undefined
    const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/v1/properties") && init?.method === "POST") return new Promise<Response>((resolve) => { resolveProperty = resolve })
      if (url.endsWith("/v1/media") && init?.method === "POST") return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 201, headers: { "Content-Type": "application/json" } }))
      return Promise.resolve(new Response(JSON.stringify({ property }), { status: 200, headers: { "Content-Type": "application/json" } }))
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage("/properties/create")

    await user.type(await screen.findByRole("textbox", { name: /^title/i }), "27 Garden Street")
    await user.type(screen.getByRole("textbox", { name: /^city/i }), "Cairo")
    await user.type(screen.getByRole("textbox", { name: /^address/i }), "27 Garden Street")
    await user.type(screen.getByRole("spinbutton", { name: /^price/i }), "725000")
    await user.type(screen.getByRole("textbox", { name: /^description/i }), "A bright villa close to the park.")
    const file = new File(["image"], "front.jpg", { type: "image/jpeg" })
    const imageInput = document.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(imageInput, file)
    expect(await screen.findByText("front.jpg")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Create" }))
    await waitFor(() => expect(resolveProperty).toBeDefined())
    expect(fetchSpy.mock.calls.filter(([input, init]) => String(input).endsWith("/v1/media") && (init as RequestInit | undefined)?.method === "POST")).toHaveLength(0)

    resolveProperty?.(new Response(JSON.stringify({ property }), { status: 201, headers: { "Content-Type": "application/json" } }))

    await waitFor(() => expect(fetchSpy.mock.calls.filter(([input, init]) => String(input).endsWith("/v1/media") && (init as RequestInit | undefined)?.method === "POST")).toHaveLength(1))
    const mediaRequest = fetchSpy.mock.calls.find(([input, init]) => String(input).endsWith("/v1/media") && (init as RequestInit | undefined)?.method === "POST")
    const mediaBody = (mediaRequest?.[1] as RequestInit).body as FormData
    expect(new Headers((mediaRequest?.[1] as RequestInit).headers).get("Authorization")).toBe("Bearer media-upload-token")
    expect(mediaBody.get("owner_type")).toBe("property")
    expect(mediaBody.get("owner_id")).toBe("7")
    expect(mediaBody.get("collection")).toBe("gallery")
    expect(mediaBody.getAll("files[]")).toEqual([file])
  })

  it("keeps a created property available for image-upload retry", async () => {
    permissions = new Set(["property.create", "property.view"])
    const user = userEvent.setup()
    let mediaAttempts = 0
    const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/v1/properties") && init?.method === "POST") return Promise.resolve(new Response(JSON.stringify({ property }), { status: 201, headers: { "Content-Type": "application/json" } }))
      if (url.endsWith("/v1/media") && init?.method === "POST") {
        mediaAttempts += 1
        return Promise.resolve(mediaAttempts === 1
          ? new Response(JSON.stringify({ message: "Media service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } })
          : new Response(JSON.stringify({ data: [] }), { status: 201, headers: { "Content-Type": "application/json" } }))
      }
      return Promise.resolve(new Response(JSON.stringify({ property }), { status: 200, headers: { "Content-Type": "application/json" } }))
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage("/properties/create")

    await user.type(await screen.findByRole("textbox", { name: /^title/i }), "27 Garden Street")
    await user.type(screen.getByRole("textbox", { name: /^city/i }), "Cairo")
    await user.type(screen.getByRole("textbox", { name: /^address/i }), "27 Garden Street")
    await user.type(screen.getByRole("spinbutton", { name: /^price/i }), "725000")
    await user.type(screen.getByRole("textbox", { name: /^description/i }), "A bright villa close to the park.")
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, new File(["image"], "front.jpg", { type: "image/jpeg" }))
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText(/Property was created, but its images could not be uploaded/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open property" })).toHaveAttribute("href", "/properties/7")
    await user.click(screen.getByRole("button", { name: "Retry images" }))

    await waitFor(() => expect(mediaAttempts).toBe(2))
    expect(fetchSpy.mock.calls.filter(([input, init]) => String(input).endsWith("/v1/properties") && (init as RequestInit | undefined)?.method === "POST")).toHaveLength(1)
  })

  it("loads property deals separately, supports Load more, and opens the dedicated edit route", async () => {
    const user = userEvent.setup()
    const secondDeal = { ...relatedDeal, id: 72, contact: { ...relatedDeal.contact, name: "Omar Khalil" }, status: "offer_made" as const }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes("/v1/deals")
        ? url.includes("page=2") ? dealsBody([secondDeal], 2, 2) : dealsBody([relatedDeal], 1, 2)
        : { property }
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage()

    expect(await screen.findByRole("heading", { name: "27 Garden Street" })).toBeInTheDocument()
    expect(await screen.findByRole("heading", { name: "Deals" })).toBeInTheDocument()
    expect(screen.getByLabelText("Property status")).not.toHaveClass("bg-muted/40")
    expect(screen.getByRole("link", { name: "Make deal" })).toHaveAttribute("href", "/deals/create?property=7")
    expect(screen.getByRole("link", { name: /Layla Nasser/ })).toHaveAttribute("href", "/deals/71")
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/v1/deals?property=7&page=1&per_page=6"))).toBe(true)
    await user.click(screen.getByRole("button", { name: "Load more" }))
    expect(await screen.findByRole("link", { name: /Omar Khalil/ })).toHaveAttribute("href", "/deals/72")
    expect(screen.queryByText("Mona Hassan")).not.toBeInTheDocument()

    await user.click(screen.getByRole("link", { name: "Edit property" }))

    expect(await screen.findByRole("heading", { name: "Edit property" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
  })

  it("uses the Deal-style header gallery with thumbnail-first image loading", async () => {
    permissions = new Set(["property.view", "property.edit"])
    const user = userEvent.setup()
    const images = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      uuid: `00000000-0000-4000-8000-00000000000${index + 1}`,
      name: `image-${index + 1}.jpg`,
      mime_type: "image/jpeg",
      size: 1200,
      url: `https://example.com/image-${index + 1}.jpg`,
      thumbnail_url: `https://example.com/image-${index + 1}-thumb.jpg`,
      order: index + 1,
      created_at: "2026-07-01T12:00:00Z",
    }))
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ property: { ...property, images } }), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderPage()

    const galleryPreview = await screen.findByRole("button", { name: "Open property gallery for 27 Garden Street" })
    expect(galleryPreview).toHaveClass("aspect-[2/1]", "max-h-96")
    expect(galleryPreview.querySelector('[data-gallery-layout="five-plus"]')).toBeInTheDocument()
    expect(galleryPreview.querySelectorAll("[data-gallery-full-image]")).toHaveLength(5)
    expect(galleryPreview.querySelector('[src="https://example.com/image-1-thumb.jpg"]')).toHaveClass("blur-sm")
    expect(galleryPreview).toHaveTextContent("+1")

    await user.click(galleryPreview)
    expect(screen.getByRole("img", { name: "27 Garden Street, image 1 of 6" })).toBeInTheDocument()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("img", { name: "27 Garden Street, image 2 of 6" })).toBeInTheDocument()
  })

  it("preserves the index context and hides related deals without permission", async () => {
    permissions = new Set(["property.view"])
    renderPage("/properties/7?return=page%3D2%26q%3DGarden")

    expect(await screen.findByRole("heading", { name: "27 Garden Street" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Properties" })).toHaveAttribute("href", "/properties?page=2&q=Garden")
    expect(screen.queryByRole("heading", { name: "Deals" })).not.toBeInTheDocument()
    expect(screen.queryByText("Mona Hassan")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit property" })).not.toBeInTheDocument()
  })

  it("offers retry for a failed member request without presenting a false not-found state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } })))
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to open property")
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("loads the dedicated edit route and submits the documented full update", async () => {
    permissions = new Set(["property.view", "property.edit"])
    const user = userEvent.setup()
    let savedProperty = property
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/v1/media?")) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (init?.method === "POST") {
        savedProperty = { ...property, title: "28 Garden Street" }
        return new Response(JSON.stringify({ property: savedProperty }), { status: 200, headers: { "Content-Type": "application/json" } })
      }
      return new Response(JSON.stringify({ property: savedProperty }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage("/properties/7/edit")

    await screen.findByRole("heading", { name: "Edit property" })
    expect(screen.getByRole("heading", { name: "Property images" })).toBeInTheDocument()
    const titleInput = screen.getByRole("textbox", { name: /^title/i })
    await user.clear(titleInput)
    await user.type(titleInput, "28 Garden Street")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(await screen.findByRole("heading", { name: "28 Garden Street" })).toBeInTheDocument()
    const update = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    const updatePayload = JSON.parse(String((update?.[1] as RequestInit).body))
    expect(updatePayload).toMatchObject({ title: "28 Garden Street", created_at: property.created_at, _method: "PUT" })
    expect(updatePayload).not.toHaveProperty("status")
  })

  it("uploads edit-page images immediately without an upload confirmation button", async () => {
    permissions = new Set(["property.view", "property.edit"])
    tokenStore.set("media-upload-token")
    const user = userEvent.setup()
    const uploadedMedia = { id: 91, uuid: "af3b47bc-2853-4fb1-a2d3-304bc08a6c61", name: "front.jpg", mime_type: "image/jpeg", size: 100, url: "/storage/properties/7/front.jpg", thumbnail_url: "/storage/properties/7/front.jpg", order: 1, created_at: "2026-08-11T12:00:00Z" }
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes("/v1/media?") && !init?.method) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "Content-Type": "application/json" } })
      if (url.endsWith("/v1/media") && init?.method === "POST") return new Response(JSON.stringify({ data: [uploadedMedia] }), { status: 201, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ property }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage("/properties/7/edit")

    await screen.findByRole("heading", { name: "Edit property" })
    const file = new File(["image"], "front.jpg", { type: "image/jpeg" })
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file)

    await waitFor(() => expect(fetchSpy.mock.calls.filter(([input, init]) => String(input).endsWith("/v1/media") && (init as RequestInit | undefined)?.method === "POST")).toHaveLength(1))
    expect(screen.queryByRole("button", { name: /Upload 1 image/i })).not.toBeInTheDocument()
  })

  it("renders a forbidden state for a server-side access denial", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } })))
    renderPage()

    expect(await screen.findByRole("heading", { name: "This property is restricted" })).toBeInTheDocument()
  })

  it("uses a popup before deleting from the show page", async () => {
    permissions = new Set(["property.view", "property.delete"])
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ property }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage()

    await screen.findByRole("heading", { name: "27 Garden Street" })
    await user.click(screen.getByRole("button", { name: "Delete property" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("This permanently removes 27 Garden Street")
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)
  })
})

describe("PropertiesPage", () => {
  beforeEach(() => {
    permissions = new Set(["property.view", "property.create", "property.edit", "property.delete", "deal.create"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  })

  it("keeps property inspection on the dedicated details route", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex("/properties?page=2&q=Garden")

    expect(await screen.findByRole("heading", { name: "Properties" })).toBeInTheDocument()
    expect(screen.getByTestId("properties-grid")).toHaveClass("lg:grid-cols-4")
    expect(screen.queryByText("Property record")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Inspect 27 Garden Street" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open details for 27 Garden Street" })).toHaveAttribute("href", "/properties/7?page=2&q=Garden")
    expect(screen.getByRole("link", { name: "Edit 27 Garden Street" })).toHaveAttribute("href", "/properties/edit/7?page=2&q=Garden")
  })

  it("links new properties to the dedicated create page with return context", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex("/properties?page=2&q=Garden")

    expect(await screen.findByRole("heading", { name: "Properties" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Add new property" })).toHaveAttribute("href", "/properties/create?return=page%3D2%26q%3DGarden")
  })

  it("replaces the property date with a Make deal link for the selected property", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex("/properties?page=2&q=Garden")

    expect(await screen.findByRole("link", { name: "Make deal" })).toHaveAttribute("href", "/deals/create?property=7")
    expect(screen.queryByText(/Added/)).not.toBeInTheDocument()
  })

  it("disables property deletion when the property has deals", async () => {
    const user = userEvent.setup()
    const propertyWithDeals = { ...property, deals_count: 1 }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...listBody(), data: [propertyWithDeals] }), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex()

    const deleteButton = await screen.findByRole("button", { name: "Delete 27 Garden Street" })
    expect(deleteButton).toBeDisabled()
    await user.hover(deleteButton.parentElement!)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Cannot delete a property with deals")
  })

  it("hides Make deal when deal creation is not permitted", async () => {
    permissions = new Set(["property.view"])
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex()

    await screen.findByRole("heading", { name: "Properties" })
    expect(screen.queryByRole("link", { name: "Make deal" })).not.toBeInTheDocument()
  })

  it("hides Make deal for sold properties", async () => {
    const soldProperty = { ...property, status: "sold" as const }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...listBody(), data: [soldProperty] }), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex()

    await screen.findByRole("heading", { name: "Properties" })
    expect(screen.queryByRole("link", { name: "Make deal" })).not.toBeInTheDocument()
  })

  it("redirects stale index create URLs to the dedicated create page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex("/properties?page=2&q=Garden&mode=create")

    expect(await screen.findByRole("heading", { name: "New property" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to properties" })).toHaveAttribute("href", "/properties?page=2&q=Garden")
  })

  it("does not open a preview for a stale record URL", async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchSpy)
    renderIndex("/properties?page=2&q=Garden&record=7")

    expect(await screen.findByRole("heading", { name: "Properties" })).toBeInTheDocument()
    expect(screen.queryByText("Property record")).not.toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([input]) => String(input).includes("/v1/properties/7"))).toBe(false)
  })
})
