import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiJson } from "@/api/client"
import { InvoicesPage } from "./index"

vi.mock("@/api/client", () => ({
  API_BASE_URL: "http://api.test/api",
  apiJson: vi.fn(),
}))

const apiJsonMock = vi.mocked(apiJson)

describe("InvoicesPage", () => {
  beforeEach(() => {
    apiJsonMock.mockResolvedValue({})
  })

  it("requests invoices and renders the empty page", async () => {
    render(<MemoryRouter><InvoicesPage /></MemoryRouter>)

    expect(screen.getByRole("heading", { name: "Invoices" })).toBeInTheDocument()
    expect(screen.getByText("No invoices yet")).toBeInTheDocument()
    await waitFor(() => expect(apiJsonMock).toHaveBeenCalledWith(
      "http://api.test/api/v1/invoices",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ))
  })

  it("aborts the request when the page unmounts", async () => {
    let requestSignal: AbortSignal | null | undefined
    apiJsonMock.mockImplementation((_input, init) => {
      requestSignal = init?.signal
      return new Promise(() => undefined)
    })

    const { unmount } = render(<MemoryRouter><InvoicesPage /></MemoryRouter>)
    await waitFor(() => expect(requestSignal).toBeInstanceOf(AbortSignal))
    unmount()

    expect(requestSignal?.aborted).toBe(true)
  })
})
