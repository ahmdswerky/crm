import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LoginPage } from "./login"

const login = vi.fn()

vi.mock("@/auth/auth-provider", () => ({
  useAuth: () => ({ user: null, login }),
}))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

describe("LoginPage", () => {
  beforeEach(() => {
    login.mockReset()
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal("fetch", vi.fn(async () => json([
      { username: "agent", role: "agent", is_super: false },
      { username: "owner", role: null, is_super: true },
      { username: "supervisor", role: "manager", is_super: false },
    ])))
  })

  it("logs in immediately when a pre-configured account is selected", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><MemoryRouter><LoginPage /></MemoryRouter></TooltipProvider>)

    expect(screen.getByRole("img", { name: /real-estate buildings/i })).toBeInTheDocument()
    const account = await screen.findByRole("button", { name: /owner,\s*super admin/i })
    expect(screen.getByText("supervisor")).toBeInTheDocument()
    await user.click(account)

    expect(screen.getByLabelText("Username")).toHaveValue("owner")
    expect(screen.getByLabelText("Password")).toHaveValue("password")
    expect(login).toHaveBeenCalledWith("owner", "password")
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/login-users"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })
})
