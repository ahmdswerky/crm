import { useEffect } from "react"
import { FileText } from "lucide-react"
import { API_BASE_URL, apiJson } from "@/api/client"

export function InvoicesPage() {
  useEffect(() => {
    const controller = new AbortController()
    void apiJson<unknown>(`${API_BASE_URL}/v1/invoices`, { signal: controller.signal }).catch(() => undefined)
    return () => controller.abort()
  }, [])

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
        <p className="mt-2 text-sm text-muted-foreground">Invoice records will appear here.</p>
      </header>
      <section className="rounded-xl border border-border bg-card px-5 py-16 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <FileText className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-4 font-medium">No invoices yet</p>
      </section>
    </div>
  )
}
