import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DateRangePicker } from "@/components/ui/date-picker"

function dayButton(label: string) {
  const button = screen.getAllByRole("button").find((candidate) => candidate.textContent === label && !candidate.hasAttribute("disabled"))
  if (!button) throw new Error(`Unable to find selectable day ${label}.`)
  return button
}

describe("DateRangePicker", () => {
  it("keeps the first click local and applies the filter after the end date", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: /pick a date range/i }))
    await user.click(dayButton("10"))

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /clear range/i })).toBeVisible()

    await user.click(dayButton("12"))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: /clear range/i })).toBeVisible()
    expect(onChange).toHaveBeenCalledWith({
      from: expect.stringMatching(/^\d{4}-\d{2}-10$/),
      to: expect.stringMatching(/^\d{4}-\d{2}-12$/),
    })
  })

  it("supports a same-day range without applying on the first click", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: /pick a date range/i }))
    await user.click(dayButton("10"))
    expect(onChange).not.toHaveBeenCalled()

    await user.click(dayButton("10"))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      from: expect.stringMatching(/^\d{4}-\d{2}-10$/),
      to: expect.stringMatching(/^\d{4}-\d{2}-10$/),
    })
  })

  it("starts a fresh two-click selection when replacing an applied range", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker from="2026-07-10" to="2026-07-12" onChange={onChange} />)

    await user.click(screen.getByRole("button", { name: /jul 10, 2026.*jul 12, 2026/i }))
    await user.click(dayButton("15"))
    expect(onChange).not.toHaveBeenCalled()

    await user.click(dayButton("17"))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({
      from: "2026-07-15",
      to: "2026-07-17",
    })
  })
})
