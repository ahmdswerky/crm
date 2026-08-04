import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarDays, Clock3, X } from "lucide-react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function parseDate(value?: string) {
  if (!value) return undefined
  const [year, month, day] = value.slice(0, 10).split("-").map(Number)
  if (!year || !month || !day) return undefined
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined
}

function formatDateValue(date?: Date) {
  if (!date) return ""
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateLabel(value?: string) {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date) : ""
}

function rangeFromValues(from?: string, to?: string): DateRange | undefined {
  return from || to ? { from: parseDate(from), to: parseDate(to) } : undefined
}

function DatePicker({ value, onChange, placeholder = "Pick a date", className, disabled, clearable = false }: { value?: string; onChange: (value: string) => void; placeholder?: string; className?: string; disabled?: boolean; clearable?: boolean }) {
  const [open, setOpen] = useState(false)
  const date = useMemo(() => parseDate(value), [value])
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" disabled={disabled} className={cn("h-8 w-full min-w-0 justify-start rounded-lg border-input bg-transparent px-2.5 py-1 text-start text-sm font-normal shadow-none transition-none active:translate-y-0 dark:bg-input/30", !date && "text-muted-foreground", className)}>
        <CalendarDays className="me-2 size-4" aria-hidden="true" />{date ? formatDateLabel(value) : placeholder}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={date} onSelect={(selected) => { const next = formatDateValue(selected); if (next !== value) onChange(next); if (selected) setOpen(false) }} />
      {clearable && value && <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { onChange(""); setOpen(false) }}><X className="me-2 size-3.5" />Clear date</Button></div>}
    </PopoverContent>
  </Popover>
}

function DateRangePicker({ from, to, onChange, placeholder = "Pick a date range", className }: { from?: string; to?: string; onChange: (range: { from: string; to: string }) => void; placeholder?: string; className?: string }) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => rangeFromValues(from, to))

  useEffect(() => {
    setDateRange((current) => {
      const currentFrom = formatDateValue(current?.from)
      const currentTo = formatDateValue(current?.to)
      if (currentFrom === (from ?? "") && currentTo === (to ?? "")) return current
      return rangeFromValues(from, to)
    })
  }, [from, to])

  const selectRange = (nextRange: DateRange | undefined) => {
    setDateRange(nextRange)
    if (!nextRange?.from || !nextRange.to) return

    const next = {
      from: formatDateValue(nextRange.from),
      to: formatDateValue(nextRange.to),
    }
    if (next.from !== (from ?? "") || next.to !== (to ?? "")) onChange(next)
  }

  const clearRange = () => {
    setDateRange(undefined)
    onChange({ from: "", to: "" })
  }

  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" data-empty={!dateRange?.from} className={cn("h-8 w-full min-w-0 justify-start rounded-lg border-input bg-transparent px-2.5 py-1 text-start text-sm font-normal shadow-none transition-none active:translate-y-0 data-[empty=true]:text-muted-foreground dark:bg-input/30", !dateRange?.from && "text-muted-foreground", className)}>
        <CalendarDays className="me-2 size-4" aria-hidden="true" />
        {dateRange?.from ? dateRange.to ? <>{format(dateRange.from, "LLL dd, y")} – {format(dateRange.to, "LLL dd, y")}</> : format(dateRange.from, "LLL dd, y") : <span>{placeholder}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar autoFocus mode="range" resetOnSelect defaultMonth={dateRange?.from} selected={dateRange} onSelect={selectRange} numberOfMonths={2} />
      {dateRange?.from && <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={clearRange}><X className="me-2 size-3.5" />Clear range</Button></div>}
    </PopoverContent>
  </Popover>
}

function DateTimePicker({ value, onChange, placeholder = "Pick date and time", className }: { value?: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const date = useMemo(() => parseDate(value), [value])
  const time = value?.slice(11, 16) || "09:00"
  const label = date ? `${formatDateLabel(value)} · ${time}` : placeholder
  const update = (nextDate: Date | undefined, nextTime = time) => onChange(nextDate ? `${formatDateValue(nextDate)}T${nextTime}` : "")
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className={cn("h-8 w-full min-w-0 justify-start rounded-lg border-input bg-transparent px-2.5 py-1 text-start text-sm font-normal shadow-none transition-none active:translate-y-0 dark:bg-input/30", !date && "text-muted-foreground", className)}>
        <CalendarDays className="me-2 size-4" aria-hidden="true" />{label}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={date} onSelect={(selected) => update(selected)} />
      <div className="flex items-center gap-2 border-t border-border p-3"><Clock3 className="size-4 text-muted-foreground" aria-hidden="true" /><label htmlFor="date-time-picker-time" className="text-xs font-medium text-muted-foreground">Time</label><Input id="date-time-picker-time" type="time" value={time} disabled={!date} onChange={(event) => update(date, event.target.value)} className="w-32" /></div>
      {value && <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { onChange(""); setOpen(false) }}><X className="me-2 size-3.5" />Clear date</Button></div>}
    </PopoverContent>
  </Popover>
}

export { DatePicker, DateRangePicker, DateTimePicker }
