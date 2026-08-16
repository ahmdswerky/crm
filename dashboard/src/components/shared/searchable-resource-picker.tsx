import { useEffect, useRef, useState, type ReactNode } from "react"
import { ChevronDown, Loader2 } from "lucide-react"

import { FieldError } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type SearchableResourceOption = {
  id: number
  label: string
  description?: string
  data?: unknown
}

export type SearchableResourcePage = {
  options: SearchableResourceOption[]
  currentPage: number
  lastPage: number
}

type SearchableResourceValue = number | string

type SearchableResourcePickerProps<Value extends SearchableResourceValue> = {
  id: string
  label: string
  labelStyle?: "block-start" | "plain" | "inline" | "icon-only"
  required?: boolean
  icon?: ReactNode
  value: Value
  valueMode?: "id" | "label"
  onChange: (value: Value, option?: SearchableResourceOption) => void
  error?: string
  loadOptions: (query: string, page: number, signal: AbortSignal) => Promise<SearchableResourcePage>
  placeholder: string
  searchPlaceholder: string
  loadingLabel: string
  emptyLabel: string
  noResultsLabel: string
  description?: string
  selectedOption?: SearchableResourceOption
  renderOption?: (option: SearchableResourceOption) => ReactNode
  renderSelectedOption?: (option: SearchableResourceOption) => ReactNode
  className?: string
}

export function SearchableResourcePicker<Value extends SearchableResourceValue>({
  id,
  label,
  labelStyle = "block-start",
  required = false,
  icon,
  value,
  onChange,
  error,
  loadOptions,
  placeholder,
  searchPlaceholder,
  loadingLabel,
  emptyLabel,
  noResultsLabel,
  description,
  selectedOption: selectedOptionProp,
  renderOption,
  renderSelectedOption,
  className,
  valueMode = "id",
}: SearchableResourcePickerProps<Value>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<SearchableResourceOption[]>([])
  const [selectedOption, setSelectedOption] = useState<SearchableResourceOption | null>(selectedOptionProp ?? null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loadError, setLoadError] = useState("")
  const requestController = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!value) {
      setSelectedOption((current) => current === null ? current : null)
      return
    }
    const matchesValue = valueMode === "label" ? selectedOptionProp?.label === value : selectedOptionProp?.id === value
    if (matchesValue && selectedOptionProp) setSelectedOption((current) => current?.id === selectedOptionProp.id ? current : selectedOptionProp)
    else if (valueMode === "label") setSelectedOption((current) => current && current.label !== value ? null : current)
  }, [selectedOptionProp, value, valueMode])

  useEffect(() => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setLoadingMore(false)
      setLoadError("")
      setOptions([])
      setPage(1)
      setLastPage(1)
      void loadOptions(query, 1, controller.signal)
        .then((result) => { setOptions(result.options); setPage(result.currentPage); setLastPage(result.lastPage) })
        .catch((caught) => {
          if (!(caught instanceof DOMException && caught.name === "AbortError")) setLoadError(caught instanceof Error ? caught.message : "Unable to load options.")
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, query.trim() ? 500 : 0)

    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [loadOptions, query])

  async function loadMore() {
    if (loading || loadingMore || page >= lastPage) return
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setLoadingMore(true)
    setLoadError("")
    try {
      const result = await loadOptions(query, page + 1, controller.signal)
      setOptions((current) => [...current, ...result.options])
      setPage(result.currentPage)
      setLastPage(result.lastPage)
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setLoadError(caught instanceof Error ? caught.message : "Unable to load more options.")
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false)
    }
  }

  const labelId = `${id}-label`
  const selectedLabel = valueMode === "label"
    ? typeof value === "string" && value.trim() ? value : undefined
    : selectedOption?.id === value ? selectedOption.label : undefined
  const editable = valueMode === "label"
  const inputValue = typeof value === "string" ? value : ""

  function openEditablePicker() {
    setQuery(inputValue)
    setOpen(true)
  }

  function changeEditableValue(nextValue: string) {
    setQuery(nextValue)
    onChange(nextValue as Value)
    setOpen(true)
  }

  return <div className={className}>
    {labelStyle === "plain" && <label id={labelId} htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}{required && <span className="font-normal text-muted-foreground"> (required)</span>}</label>}
    <InputGroup className={`${labelStyle === "plain" ? "mt-1 " : ""}h-auto! overflow-hidden`}>
      {labelStyle === "block-start" && <InputGroupAddon align="block-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{icon}{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon>}
      {labelStyle === "inline" && <InputGroupAddon align="inline-start" className="bg-muted dark:bg-muted"><InputGroupText id={labelId}><span className="inline-flex items-center gap-1.5">{icon}{label}{required && <span className="font-normal text-muted-foreground">(required)</span>}</span></InputGroupText></InputGroupAddon>}
      {labelStyle === "icon-only" && icon && <InputGroupAddon className="bg-transparent">{icon}</InputGroupAddon>}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        {editable ? <PopoverAnchor asChild>
          <InputGroupInput id={id} role="combobox" aria-label={labelStyle === "icon-only" ? label : undefined} aria-labelledby={labelStyle === "icon-only" ? undefined : labelId} aria-autocomplete="list" aria-expanded={open} aria-invalid={Boolean(error)} placeholder={placeholder} value={inputValue} onFocus={openEditablePicker} onClick={openEditablePicker} onChange={(event) => changeEditableValue(event.target.value)} />
        </PopoverAnchor> : <PopoverTrigger asChild>
          <Button id={id} type="button" variant="ghost" role="combobox" aria-label={labelStyle === "icon-only" ? label : undefined} aria-labelledby={labelStyle === "icon-only" ? undefined : labelId} aria-expanded={open} aria-invalid={Boolean(error)} className="h-8 w-full justify-between rounded-none border-0 px-2.5 font-normal focus-visible:ring-0">
            {selectedOption && selectedLabel && renderSelectedOption ? renderSelectedOption(selectedOption) : <span className={selectedLabel ? "truncate text-foreground" : "truncate text-muted-foreground"}>{selectedLabel ?? placeholder}</span>}
            <ChevronDown className="ms-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Button>
        </PopoverTrigger>}
        <PopoverContent align="start" collisionPadding={{ top: 16, bottom: 16, left: 16, right: 16 }} onOpenAutoFocus={(event) => { if (editable) event.preventDefault() }} className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            {!editable && <CommandInput inputGroupClassName="!border-0 focus-within:!border-0 focus-within:ring-0" className="focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0" placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />}
            <CommandList onWheel={(event) => event.stopPropagation()}>
              {loading && <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{loadingLabel}</div>}
              {!loading && loadError && <div role="alert" className="px-3 py-3 text-sm text-destructive">{loadError}</div>}
              {!loading && !loadError && options.length === 0 && <CommandEmpty>{query.trim() ? noResultsLabel : emptyLabel}</CommandEmpty>}
              {!loading && options.length > 0 && <CommandGroup>{options.map((option) => <CommandItem key={option.id} value={String(option.id)} aria-label={option.label} data-checked={valueMode === "label" ? value === option.label : value === option.id} onSelect={() => { setSelectedOption(option); onChange((valueMode === "label" ? option.label : option.id) as Value, option); setOpen(false) }}>{renderOption ? renderOption(option) : <div className="min-w-0 flex-1"><p className="truncate font-medium">{option.label}</p>{option.description && <p className="truncate text-xs text-muted-foreground">{option.description}</p>}</div>}</CommandItem>)}</CommandGroup>}
            </CommandList>
            {loadError && options.length > 0 && <p role="alert" className="px-3 py-2 text-xs text-destructive">{loadError}</p>}
            {page < lastPage && <div className="border-t border-border p-1"><Button type="button" variant="ghost" size="sm" className="w-full justify-center" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}{loadingMore ? "Loading…" : "Load more"}</Button></div>}
          </Command>
        </PopoverContent>
      </Popover>
      {description && <InputGroupAddon align="block-end" className="border-t border-border/70 bg-muted/30 dark:bg-transparent"><InputGroupText className="px-0 text-xs font-normal">{description}</InputGroupText></InputGroupAddon>}
    </InputGroup>
    <FieldError errors={[error ? { message: error } : undefined]} />
    {loadError && options.length === 0 && <p className="text-xs text-destructive">{label} picker unavailable: {loadError}</p>}
  </div>
}
