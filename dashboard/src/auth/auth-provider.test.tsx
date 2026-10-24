import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import { AuthProvider, useAuth } from "./auth-provider"
import { apiJson } from "@/api/client"

vi.mock("@/api/client", () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), API_BASE_URL: "/api" }))
vi.mock("@/api/token-store", () => ({ tokenStore: { get: () => "fixture-token", clear: vi.fn() } }))
afterEach(cleanup)

function Permissions() {
  const { loading, can } = useAuth()
  if (loading) return <p>Loading</p>
  return <p>{String(can("activity-log.view"))}/{String(can("activity-log.revert"))}/{String(can("lead.edit"))}</p>
}

describe("developer log permissions", () => {
  it("requires explicit effective log permissions even for a superuser", async () => {
    vi.mocked(apiJson).mockResolvedValue({ user: { is_super: true, permissions: [] } })
    render(<AuthProvider><Permissions /></AuthProvider>)
    expect(await screen.findByText("false/false/true")).toBeInTheDocument()
  })

  it("uses the developer permissions returned by the server", async () => {
    vi.mocked(apiJson).mockResolvedValue({ user: { is_super: true, permissions: [{ name: "activity-log.view" }, { name: "activity-log.revert" }] } })
    render(<AuthProvider><Permissions /></AuthProvider>)
    expect(await screen.findByText("true/true/true")).toBeInTheDocument()
  })
})
