import { useId, useState } from "react"
import { addDays, format, isValid, parseISO } from "date-fns"
import { CalendarDays, ChevronDown, Clock3, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar, dateLocale } from "@/components/ui/calendar"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { t } from "@/lib/i18n"

export function ActivityDateField({ label, value, onChange, dateOnly = false, required = false, invalid = false, description }: {
  label: string; value: string; onChange: (value: string) => void; dateOnly?: boolean; required?: boolean; invalid?: boolean; description?: string
}) {
  const [open, setOpen] = useState(false)
  const direction = document.documentElement.dir === "rtl" ? "rtl" : "ltr"
  const id = `activity-date-${useId()}`
  const parsed = value ? parseISO(value.slice(0, 10)) : undefined
  const date = parsed && isValid(parsed) ? parsed : undefined
  const time = value.slice(11, 16)
  const today = dateOnly ? parseISO(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())) : new Date()
  function select(next: Date | undefined) {
    onChange(next ? `${format(next, "yyyy-MM-dd")}${dateOnly ? "" : `T${time || "09:00"}`}` : "")
    setOpen(false)
  }
  return <Field data-invalid={invalid} className="min-w-0 gap-2">
    <FieldLabel htmlFor={id}>{label}{required && <span aria-hidden="true" className="text-destructive">*</span>}</FieldLabel>
    <div className={`grid min-w-0 gap-2 ${dateOnly ? "" : "grid-cols-1 min-[400px]:grid-cols-[minmax(0,1fr)_7rem]"}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button id={id} type="button" variant="outline" data-date-picker="true" data-required={required} aria-invalid={invalid} aria-describedby={description ? `${id}-help` : undefined} className={`h-10 w-full min-w-0 justify-start px-3 text-start font-normal focus-visible:bg-accent ${date ? "" : "text-muted-foreground"}`}>
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" /><span className="truncate">{date ? format(date, "MMM d, yyyy", { locale: dateLocale }) : t("Choose date")}</span><ChevronDown aria-hidden="true" className="ms-auto size-3.5 shrink-0" />
        </Button></PopoverTrigger>
        <PopoverContent dir={direction} aria-label={t("{label} calendar", { label })} className="max-h-[min(30rem,var(--radix-popover-content-available-height))] w-auto max-w-[calc(100vw-1.5rem)] gap-0 overflow-y-auto p-0" align="start" collisionPadding={12}>
          <div className="flex gap-1 border-b border-border p-2 [@media(max-height:450px)]:p-1">{[0, 1, 7].map((days) => <Button key={days} type="button" size="sm" variant="ghost" className="min-h-9 flex-1 text-xs [@media(max-height:450px)]:min-h-7" onClick={() => select(addDays(today, days))}>{t(days === 0 ? "Today" : days === 1 ? "Tomorrow" : "In a week")}</Button>)}</div>
          <Calendar dir={direction} autoFocus mode="single" required selected={date} defaultMonth={date} onSelect={select} className="relative [@media(max-height:450px)]:p-2" classNames={{ month: "space-y-3 [@media(max-height:450px)]:space-y-1", week: "mt-1 flex w-full", button_previous: "absolute start-3 top-3 flex size-9 items-center justify-center rounded-md hover:bg-accent [@media(max-height:450px)]:top-2 [@media(max-height:450px)]:h-7", button_next: "absolute end-3 top-3 flex size-9 items-center justify-center rounded-md hover:bg-accent [@media(max-height:450px)]:top-2 [@media(max-height:450px)]:h-7", day_button: "size-9 rounded-md p-0 font-normal hover:bg-accent focus-visible:bg-accent [@media(max-height:450px)]:h-7", weekday: "w-9 text-xs font-normal text-muted-foreground", month_caption: "flex h-9 items-center justify-center px-10 [@media(max-height:450px)]:h-7" }} />
          {value && !required && <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => select(undefined)}><X aria-hidden="true" className="size-3.5" />{t("Clear date")}</Button></div>}
        </PopoverContent>
      </Popover>
      {!dateOnly && <InputGroup className="h-10 min-w-0"><InputGroupAddon><Clock3 aria-hidden="true" className="size-4" /></InputGroupAddon><InputGroupInput dir="ltr" aria-label={t("{label} clock", { label })} type="time" value={time} required={Boolean(date)} disabled={!date} onChange={(event) => onChange(`${value.slice(0, 10)}T${event.target.value}`)} className="min-w-0 px-1 text-xs tabular-nums [&::-webkit-calendar-picker-indicator]:hidden" /></InputGroup>}
    </div>
    {description && <FieldDescription id={`${id}-help`}>{description}</FieldDescription>}
  </Field>
}
