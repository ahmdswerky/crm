import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { PropertiesPage, PropertyDetailsPage } from "./properties-page"
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
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/properties/create" element={<PropertyDetailsPage create />} /><Route path="/properties/:propertyId" element={<PropertyDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function renderIndex(entry = "/properties") {
  return render(<TooltipProvider><MemoryRouter initialEntries={[entry]}><Routes><Route path="/properties" element={<PropertiesPage />} /><Route path="/properties/create" element={<PropertyDetailsPage create />} /><Route path="/properties/:propertyId" element={<PropertyDetailsPage />} /></Routes></MemoryRouter></TooltipProvider>)
}

function listBody() {
  return {
    data: [property],
    links: { first: "", last: null, prev: null, next: "" },
    meta: { current_page: 2, from: 1, last_page: 2, links: [], path: "/v1/properties", per_page: 12, to: 1, total: 1 },
    filter: { min_price: 5000, max_price: 1000000 },
  }
}

describe("PropertyDetailsPage", () => {
  beforeEach(() => {
    tokenStore.clear()
    permissions = new Set(["property.view", "property.edit", "user.view"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL) => {
      return new Response(JSON.stringify({ property }), { status: 200, headers: { "Content-Type": "application/json" } })
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
    expect(JSON.parse(String((createRequest?.[1] as RequestInit).body))).toMatchObject({ title: "27 Garden Street", city: "Cairo", price: 725000, type: "villa", status: "pending" })
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

  it("keeps owner contact actions visible and opens editing on the current route", async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole("heading", { name: "27 Garden Street" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "mona@example.com" })).toHaveAttribute("href", "mailto:mona@example.com")
    expect(screen.getByRole("link", { name: "+201000000000" })).toHaveAttribute("href", "tel:+201000000000")
    expect(screen.getAllByRole("link", { name: "Mona Hassan" })[0]).toHaveAttribute("href", "/agents/12")

    await user.click(screen.getByRole("button", { name: "Edit property" }))

    expect(await screen.findByRole("heading", { name: "Listing information" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
  })

  it("preserves the index context and withholds the owner route without permission", async () => {
    permissions = new Set(["property.view"])
    renderPage("/properties/7?return=page%3D2%26q%3DGarden")

    expect(await screen.findByRole("heading", { name: "27 Garden Street" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Properties" })).toHaveAttribute("href", "/properties?page=2&q=Garden")
    expect(screen.getAllByText("Mona Hassan").every((node) => node.closest("a") === null)).toBe(true)
    expect(screen.queryByRole("button", { name: "Edit property" })).not.toBeInTheDocument()
  })

  it("offers retry for a failed member request without presenting a false not-found state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Service unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } })))
    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to open property")
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("submits the documented full update from the same route", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ property: { ...property, title: "28 Garden Street" } }), { status: 200, headers: { "Content-Type": "application/json" } })
      return new Response(JSON.stringify({ property }), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderPage()

    await screen.findByRole("heading", { name: "27 Garden Street" })
    await user.click(screen.getByRole("button", { name: "Edit property" }))
    const titleInput = screen.getByRole("textbox", { name: /^title/i })
    await user.clear(titleInput)
    await user.type(titleInput, "28 Garden Street")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    expect(await screen.findByRole("heading", { name: "28 Garden Street" })).toBeInTheDocument()
    const update = fetchSpy.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((update?.[1] as RequestInit).body))).toMatchObject({ title: "28 Garden Street", created_at: property.created_at, _method: "PUT" })
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

describe("PropertiesPage preview migration", () => {
  beforeEach(() => {
    permissions = new Set(["property.view", "property.create", "property.edit", "property.delete"])
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  })

  it("opens a member-backed preview drawer without shrinking the card grid", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return new Response(JSON.stringify(url.endsWith("/v1/properties/7") ? { property } : listBody()), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderIndex("/properties?page=2&q=Garden")

    expect(await screen.findByRole("heading", { name: "Properties" })).toBeInTheDocument()
    expect(screen.getByTestId("properties-grid")).toHaveClass("lg:grid-cols-4")
    await user.click(screen.getByRole("button", { name: "Inspect 27 Garden Street" }))

    expect(await screen.findByText("Property record")).toBeInTheDocument()
    expect(screen.getByText("Listing value")).toBeInTheDocument()
    expect(screen.getByTestId("properties-grid")).toHaveClass("lg:grid-cols-4")
    expect(screen.getByRole("link", { name: "Edit property" })).toHaveAttribute("href", "/properties/7?mode=edit&return=page%3D2%26q%3DGarden")

    await user.click(screen.getByRole("button", { name: "Close preview" }))
    await waitFor(() => expect(screen.queryByText("Property record")).not.toBeInTheDocument())
  })

  it("links new properties to the dedicated create page with return context", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex("/properties?page=2&q=Garden")

    expect(await screen.findByRole("heading", { name: "Properties" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /New property/ })).toHaveAttribute("href", "/properties/create?return=page%3D2%26q%3DGarden")
  })

  it("redirects stale index create URLs to the dedicated create page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(listBody()), { status: 200, headers: { "Content-Type": "application/json" } })))
    renderIndex("/properties?page=2&q=Garden&mode=create")

    expect(await screen.findByRole("heading", { name: "New property" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to properties" })).toHaveAttribute("href", "/properties?page=2&q=Garden")
  })

  it("opens a direct record URL and confirms deletion in a popup", async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      return new Response(JSON.stringify(url.endsWith("/v1/properties/7") ? { property } : listBody()), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    vi.stubGlobal("fetch", fetchSpy)
    renderIndex("/properties?page=2&q=Garden&record=7")

    expect(await screen.findByText("Property record")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Delete property" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("27 Garden Street")
    expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(false)

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: "Delete property" }))
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete property" }))
    await waitFor(() => expect(fetchSpy.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")).toBe(true))
  })
})
