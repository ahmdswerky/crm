import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { ProfilePage } from "./profile"

let isSuper = false

const profile = {
  id: 9,
  name: "Eman Mahmoud",
  username: "eman",
  email: "eman@example.com",
  phone: "+201000000000",
  permissions: [],
  is_super: false,
}

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({
    can: () => true,
    isSuper,
    refresh: vi.fn(async () => profile),
  }),
}))

vi.mock("@/components/shared/single-media-field", () => ({
  SingleMediaField: () => null,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}))

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("ProfilePage", () => {
  beforeEach(() => {
    isSuper = false
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/secure-token")) return json({ token: "$2y$generated-secure-token" })
      return json({ user: { ...profile, is_super: isSuper } })
    }))
  })

  it("does not show secure token controls to a regular user", async () => {
    render(<ProfilePage />)

    await screen.findByRole("heading", { name: "Profile" })
    expect(screen.queryByRole("heading", { name: "Generate Secure Token" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Generate token" })).not.toBeInTheDocument()
  })

  it("generates and exposes a copyable token for a super admin", async () => {
    const user = userEvent.setup()
    isSuper = true
    render(<ProfilePage />)

    await screen.findByRole("heading", { name: "Generate Secure Token" })
    const token = screen.getByLabelText("Secure token")
    const cardBody = screen.getByTestId("secure-token-card-body")

    expect(token).toHaveValue("")
    expect(token).toHaveAttribute("placeholder", "**********")
    expect(cardBody).toHaveClass("blur-[1.5px]")
    await user.click(screen.getByRole("button", { name: "Reveal" }))

    await waitFor(() => expect(token).toHaveValue("$2y$generated-secure-token"))
    expect(token).toHaveAttribute("type", "text")
    expect(token).toHaveAttribute("readonly")
    expect(cardBody).not.toHaveClass("blur-[1.5px]")
    expect(screen.getByRole("button", { name: "Copy secure token" })).toBeInTheDocument()

    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    await user.click(token)
    expect(writeText).toHaveBeenCalledWith("$2y$generated-secure-token")
    expect(toast.success).toHaveBeenCalledWith("Secure token copied to clipboard.")
  })
})
