import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EChartsRadialChart } from "./echarts-radial-chart"

const { chart, init, motion } = vi.hoisted(() => {
  const chart = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
  return { chart, init: vi.fn(() => chart), motion: { reduced: false } }
})

vi.mock("echarts/core", () => ({ init, use: vi.fn() }))
vi.mock("motion/react", () => ({ useReducedMotion: () => motion.reduced }))

const data = [{ name: "negotiation", value: 3, maxValue: 8 }]
const config = { negotiation: { colors: { light: ["#112233"] } } }

describe("EChartsRadialChart", () => {
  beforeEach(() => {
    motion.reduced = false
    init.mockClear()
    chart.setOption.mockClear()
    chart.resize.mockClear()
    chart.dispose.mockClear()
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
      set fillStyle(_value: string) {},
    } as unknown as CanvasRenderingContext2D)
  })

  it("keeps ECharts unmounted while loading, then reveals the fetched value", async () => {
    const { container, rerender } = render(<EChartsRadialChart data={data} config={config} isLoading />)

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(init).not.toHaveBeenCalled()

    rerender(<EChartsRadialChart data={data} config={config} />)

    await waitFor(() => expect(init).toHaveBeenCalledTimes(1))
    expect(chart.setOption).toHaveBeenCalledWith(expect.objectContaining({ animation: true, animationDuration: 850, animationEasing: "cubicOut" }))
    expect(chart.setOption.mock.calls[0][0].series?.[0]?.data?.[0]).toMatchObject({ name: "negotiation", value: 3 })
  })

  it("disables the radial entrance for reduced-motion users", async () => {
    motion.reduced = true
    render(<EChartsRadialChart data={data} config={config} />)

    await waitFor(() => expect(init).toHaveBeenCalledTimes(1))
    expect(chart.setOption).toHaveBeenCalledWith(expect.objectContaining({ animation: false, animationDuration: 0 }))
  })
})
