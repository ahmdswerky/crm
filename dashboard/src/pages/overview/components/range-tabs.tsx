import type { OverviewRange } from "../data"

const ranges: Array<{ value: OverviewRange; label: string }> = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
]

export function RangeTabs({ value, onChange, label }: { value: OverviewRange; onChange: (value: OverviewRange) => void; label: string }) {
  return <div aria-label={label} className="flex items-center gap-0.5 rounded-xl bg-muted/70 p-1">
    {ranges.map((range) => <button key={range.value} type="button" aria-pressed={value === range.value} onClick={() => onChange(range.value)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none ${value === range.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/60 hover:text-foreground"}`}>
      {range.label}
    </button>)}
  </div>
}
