import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { API_BASE_URL, apiFetch } from "@/api/client"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { ResourcePagination } from "@/components/shared/resource-pagination"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Row = Record<string, unknown>
type ResourcePageProps = { title: string; eyebrow: string; description: string; endpoint: string; columns: { key: string; label: string }[] }
type ResourceDetailsPageProps = {
  title: string
  eyebrow: string
  description: string
  endpoint: string
  envelopeKey: string
  backPath: string
  person?: boolean
  fields: { key: string; label: string; relation?: { basePath: string; idKey?: string; labelKey?: string; person?: boolean } }[]
}
const display = (value: unknown) => value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)

function relationValue(value: unknown, relation: ResourceDetailsPageProps["fields"][number]["relation"]) {
  if (!relation || !value || typeof value !== "object") return display(value)
  if (Array.isArray(value)) {
    return <div className="flex flex-wrap gap-x-3 gap-y-1">{value.map((item, index) => <span key={index}>{relationValue(item, relation)}</span>)}</div>
  }
  const record = value as Row
  const id = record[relation.idKey ?? "id"]
  const label = record[relation.labelKey ?? "name"]
  if (id === undefined || id === null) return display(label)
  return <span className="inline-flex items-center gap-2">{relation.person && <PersonAvatar name={String(label)} size="sm" />}<Link className="text-primary hover:text-foreground" to={`${relation.basePath}/${id}`}>{display(label)}</Link></span>
}

export function ResourcePage({ title, eyebrow, description, endpoint, columns }: ResourcePageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastPage, setLastPage] = useState(1)

  async function load(signal?: AbortSignal, requestedPage = page) {
    setLoading(true)
    setError("")
    try {
      const response = await apiFetch(`${API_BASE_URL}${endpoint}?page=${requestedPage}`, { signal })
      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      const body = await response.json() as { data?: unknown; meta?: { current_page?: number; last_page?: number } }
      setRows(Array.isArray(body.data) ? body.data as Row[] : body.data ? [body.data as Row] : [])
      setLastPage(body.meta?.last_page ?? 1)
      if (body.meta?.current_page && body.meta.current_page !== requestedPage) {
        setSearchParams((current) => { const next = new URLSearchParams(current); next.set("page", String(body.meta?.current_page)); return next })
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return
      setError(caught instanceof Error ? caught.message : `Unable to load ${title.toLowerCase()}.`)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal, page)
    return () => controller.abort()
  }, [endpoint, page])

  const goToPage = (nextPage: number) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.set("page", String(nextPage))
    return next
  })

  return <div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><Button variant="outline" size="sm" onClick={() => void load(undefined, page)} disabled={loading}><RefreshCw className="me-2 size-3.5" />Refresh</Button></div>
    <div className="border border-border bg-card">{error ? <div className="p-8 text-sm text-destructive">{error}</div> : <><Table><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{loading ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}>{columns.map((column) => <TableCell key={column.key}><Skeleton className="h-4 w-3/4" /></TableCell>)}</TableRow>) : rows.length ? rows.map((row, index) => <TableRow key={String(row.id ?? index)}>{columns.map((column) => <TableCell key={column.key} className={column.key === "name" || column.key === "title" ? "font-medium" : ""}>{display(row[column.key])}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">No {title.toLowerCase()} found.</TableCell></TableRow>}</TableBody></Table><ResourcePagination page={page} lastPage={lastPage} disabled={loading} onPageChange={goToPage} /></>}</div>
  </div>
}

export function ResourceDetailsPage({ title, eyebrow, description, endpoint, envelopeKey, backPath, person = false, fields }: ResourceDetailsPageProps) {
  const { resourceId } = useParams<{ resourceId: string }>()
  const navigate = useNavigate()
  const [record, setRecord] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!resourceId) return
    const controller = new AbortController()
    setLoading(true)
    setError("")
    void apiFetch(`${API_BASE_URL}${endpoint}/${resourceId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`)
        const body = await response.json() as Row
        const value = body[envelopeKey] ?? body.data ?? body
        setRecord(value && typeof value === "object" ? value as Row : null)
      })
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : `Unable to load ${title.toLowerCase()}.`)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [endpoint, envelopeKey, resourceId, title])

  return <div className="space-y-6 p-6 lg:p-8">
    <div className="border-b border-border pb-6"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={backPath}><ArrowLeft className="me-2 size-3.5" />Back to list</Link></Button><p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p><div className="mt-2 flex items-center gap-3">{person && typeof record?.name === "string" && <PersonAvatar name={record.name} size="lg" />}<h1 className="text-2xl font-semibold tracking-tight">{title}</h1></div><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
    <section className="border border-border bg-card p-5">{loading ? <div className="grid gap-5 sm:grid-cols-2">{fields.map((field) => <div key={field.key}><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-6 w-2/3" /></div>)}</div> : error ? <div className="text-sm text-destructive">{error}</div> : record ? <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">{fields.map((field) => <div key={field.key}><dt className="text-xs font-medium text-muted-foreground">{field.label}</dt><dd className="mt-1 text-sm">{relationValue(record[field.key], field.relation)}</dd></div>)}</dl> : <div className="text-sm text-muted-foreground">This record could not be found.</div>}</section>
    <Button variant="outline" onClick={() => navigate(backPath)}>Return to list</Button>
  </div>
}
