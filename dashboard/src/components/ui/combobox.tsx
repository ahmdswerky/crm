import * as React from "react"
import { XIcon } from "lucide-react"
import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type ComboboxContextValue = {
  items: unknown[]
  multiple: boolean
  selected: unknown[]
  query: string
  open: boolean
  setQuery: (query: string) => void
  setOpen: (open: boolean) => void
  itemToStringValue: (item: unknown) => string
  isSelected: (item: unknown) => boolean
  selectItem: (item: unknown) => void
  removeItem: (item: unknown) => void
}

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null)

function useComboboxContext() {
  const context = React.useContext(ComboboxContext)
  if (!context) throw new Error("Combobox components must be used inside Combobox.")
  return context
}

function Combobox<T>({
  items,
  multiple = false,
  value = [],
  onValueChange,
  itemToStringValue = (item) => String(item),
  children,
}: {
  items: T[]
  multiple?: boolean
  value?: T[]
  onValueChange?: (value: T[]) => void
  itemToStringValue?: (item: T) => string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const selected = value as unknown[]
  const getValue = (item: unknown) => itemToStringValue(item as T)
  const isSelected = (item: unknown) => selected.some((selectedItem) => getValue(selectedItem) === getValue(item))
  const selectItem = (item: unknown) => {
    const next = isSelected(item)
      ? selected.filter((selectedItem) => getValue(selectedItem) !== getValue(item))
      : [...selected, item]
    onValueChange?.(next as T[])
    setQuery("")
  }
  const removeItem = (item: unknown) => onValueChange?.(selected.filter((selectedItem) => getValue(selectedItem) !== getValue(item)) as T[])

  return <ComboboxContext.Provider value={{ items, multiple, selected, query, open, setQuery, setOpen, itemToStringValue: getValue, isSelected, selectItem, removeItem }}><Popover open={open} onOpenChange={setOpen}>{children}</Popover></ComboboxContext.Provider>
}

function ComboboxChips({ className, ...props }: React.ComponentProps<"div">) {
  const { open, setOpen } = useComboboxContext()
  return <PopoverTrigger asChild><div data-slot="combobox-chips" role="combobox" aria-expanded={open} tabIndex={0} onFocus={() => setOpen(true)} className={cn("flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none dark:bg-input/30", className)} {...props} /></PopoverTrigger>
}

function ComboboxValue({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="combobox-value" className={cn("flex flex-wrap items-center gap-1", className)} {...props} />
}

function ComboboxChip({ value, className, children, ...props }: React.ComponentProps<"span"> & { value?: unknown }) {
  const { removeItem } = useComboboxContext()
  return <span data-slot="combobox-chip" className={cn("inline-flex h-6 items-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium", className)} {...props}>{children}<button type="button" aria-label={`Remove ${String(children)}`} className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={(event) => { event.stopPropagation(); removeItem(value ?? children) }}><XIcon className="size-3" /></button></span>
}

function ComboboxChipsInput({ className, onChange, onFocus, ...props }: React.ComponentProps<"input">) {
  const { query, setQuery, setOpen } = useComboboxContext()
  return <input data-slot="combobox-chips-input" value={query} onChange={(event) => { setQuery(event.target.value); onChange?.(event) }} onFocus={(event) => { setOpen(true); onFocus?.(event) }} className={cn("min-w-24 flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground", className)} {...props} />
}

function ComboboxContent({ className, ...props }: React.ComponentProps<typeof PopoverContent>) {
  const { children, ...contentProps } = props
  return <PopoverContent align="start" className={cn("w-[var(--radix-popover-trigger-width)] p-1", className)} {...contentProps}><Command>{children}</Command></PopoverContent>
}

function ComboboxEmpty({ className, ...props }: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty className={className} {...props} />
}

function ComboboxList({ children, ...props }: Omit<React.ComponentProps<typeof CommandList>, "children"> & { children: (item: unknown) => React.ReactNode }) {
  const { items, query, itemToStringValue } = useComboboxContext()
  const filteredItems = items.filter((item) => itemToStringValue(item).toLowerCase().includes(query.trim().toLowerCase()))
  return <CommandList {...props}>{filteredItems.map((item, index) => <React.Fragment key={`${itemToStringValue(item)}-${index}`}>{children(item)}</React.Fragment>)}</CommandList>
}

function ComboboxItem({ value, children, className, ...props }: React.ComponentProps<typeof CommandItem> & { value: unknown }) {
  const { isSelected, selectItem, itemToStringValue } = useComboboxContext()
  const selected = isSelected(value)
  return <CommandItem value={itemToStringValue(value)} data-checked={selected || undefined} aria-selected={selected} onSelect={() => selectItem(value)} className={cn("justify-between", className)} {...props}>{children}</CommandItem>
}

export { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxValue }
