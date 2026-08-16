import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type NumericRange = [number, number]

type NumericRangeFilterProps = {
  id: string
  label: string
  min: number | string | null | undefined
  max: number | string | null | undefined
  value: NumericRange
  onChange: (value: NumericRange) => void
  format: (value: number) => string
  step?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function NumericRangeFilter({
  id,
  label,
  min,
  max,
  value,
  onChange,
  format,
  step = 50_000,
}: NumericRangeFilterProps) {
  const parsedMin = min === null || min === undefined ? Number.NaN : Number(min)
  const parsedMax = max === null || max === undefined ? Number.NaN : Number(max)
  const hasRange = Number.isFinite(parsedMin) && Number.isFinite(parsedMax)
  const lowerBound = hasRange ? parsedMin : 0
  const upperBound = hasRange ? parsedMax : 0
  const lowerValue = hasRange ? clamp(value[0], lowerBound, upperBound) : 0
  const upperValue = hasRange ? clamp(value[1], lowerBound, upperBound) : 0
  const [draft, setDraft] = useState<NumericRange>([lowerValue, upperValue])
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [adjusting, setAdjusting] = useState(false)

  useEffect(() => {
    setDraft((current) => current[0] === lowerValue && current[1] === upperValue ? current : [lowerValue, upperValue])
  }, [lowerValue, upperValue])

  useEffect(() => {
    if (!hasRange || draft[0] === lowerValue && draft[1] === upperValue) return

    const timeout = window.setTimeout(() => onChange(draft), 500)
    return () => window.clearTimeout(timeout)
  }, [draft, hasRange, lowerValue, onChange, upperValue])

  if (!hasRange) return null

  const disabled = lowerBound === upperBound

  return (
    <div className="min-w-56 flex-1 sm:flex-none">
      <Tooltip open={tooltipOpen || adjusting} onOpenChange={setTooltipOpen}>
        <TooltipTrigger asChild>
          <div onPointerDownCapture={() => setAdjusting(true)} onPointerUpCapture={() => setAdjusting(false)} onPointerCancelCapture={() => setAdjusting(false)}>
            <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
            <div className="mt-3">
              <Slider
                id={id}
                aria-label={label}
                min={lowerBound}
                max={upperBound}
                step={step}
                value={draft}
                disabled={disabled}
                onValueChange={(next) => {
                  if (next.length !== 2) return
                  const [first, second] = next[0] <= next[1] ? next : [next[1], next[0]]
                  setDraft([first, second])
                }}
              />
            </div>
            <span aria-hidden="true" className="mt-2 flex w-full items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{format(lowerBound)}</span>
              <span>{format(upperBound)}</span>
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="font-mono tabular-nums">{format(draft[0])} – {format(draft[1])}</TooltipContent>
      </Tooltip>
    </div>
  )
}
