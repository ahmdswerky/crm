import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { statusPillClass } from "@/components/shared/deal-status"
import type { Customer, OverviewAccount, OverviewDeal, OverviewProperty } from "../data"

type DataCardProps<T> = { data: T[]; isLoading: boolean }

export function CustomerCard({ data, isLoading }: DataCardProps<Customer>) {
  if (isLoading) return <DataCardSkeleton />
  return <section className="min-w-0 overflow-hidden rounded-3xl bg-card"><CardHeader title="Customers" to="/pipeline" /><Table><TableHeader className="bg-muted/45"><TableRow><TableHead className="px-5">Name</TableHead><TableHead>Company</TableHead><TableHead className="pe-5">Position</TableHead></TableRow></TableHeader><TableBody>{data.map((customer) => <TableRow key={customer.id} className="hover:bg-muted/40"><TableCell className="px-5 py-3.5 font-medium whitespace-normal">{customer.name}</TableCell><TableCell className="py-3.5 whitespace-normal"><span className="flex items-center gap-2">{customer.accountLogo ? <img src={customer.accountLogo} alt="" className="size-6 rounded-md bg-background object-contain p-1" /> : <span aria-hidden="true" className="grid size-6 place-items-center rounded-md bg-muted text-[0.625rem] text-muted-foreground">—</span>}{customer.company}</span></TableCell><TableCell className="pe-5 py-3.5 whitespace-normal text-muted-foreground">{customer.position}</TableCell></TableRow>)}</TableBody></Table></section>
}

export function DealCard({ data, isLoading }: DataCardProps<OverviewDeal>) {
  if (isLoading) return <DataCardSkeleton />
  return <section className="min-w-0 overflow-hidden rounded-3xl bg-card"><CardHeader title="Deals" to="/deals" /><Table><TableHeader className="bg-muted/45"><TableRow><TableHead className="px-5">Deal</TableHead><TableHead>Status</TableHead><TableHead className="pe-5 text-end">Value</TableHead></TableRow></TableHeader><TableBody>{data.map((deal) => <TableRow key={deal.id} className="hover:bg-muted/40"><TableCell className="px-5 py-3.5 whitespace-normal"><p className="flex flex-wrap items-center gap-2 font-medium"><span>{deal.name}</span><span aria-hidden="true" className="text-[0.55rem] text-muted-foreground">●</span><span className="text-muted-foreground">{deal.customer}</span></p></TableCell><TableCell className="py-3.5">{deal.status && <Badge className={`whitespace-nowrap capitalize ${statusPillClass[deal.status as keyof typeof statusPillClass] ?? "border-muted bg-muted text-muted-foreground hover:bg-muted"}`}>{labelFor(deal.status)}</Badge>}</TableCell><TableCell className="pe-5 py-3.5 text-end font-mono text-xs font-medium tabular-nums">{formatCurrency(deal.dealValue)}</TableCell></TableRow>)}</TableBody></Table></section>
}

export function AccountCard({ data, isLoading }: DataCardProps<OverviewAccount>) {
  if (isLoading) return <DataCardSkeleton />
  return <section className="min-w-0 overflow-hidden rounded-3xl bg-card"><CardHeader title="Accounts" to="/accounts" /><Table><TableHeader className="bg-muted/45"><TableRow><TableHead className="px-5">Name</TableHead><TableHead>Industry</TableHead><TableHead className="pe-5 text-end">Leads</TableHead></TableRow></TableHeader><TableBody>{data.map((account) => <TableRow key={account.id} className="hover:bg-muted/40"><TableCell className="px-5 py-3.5 whitespace-normal"><span className="flex items-center gap-2">{account.logo ? <img src={account.logo} alt="" className="size-7 rounded-md bg-background object-contain p-1" /> : <span aria-hidden="true" className="grid size-7 place-items-center rounded-md bg-muted text-xs text-muted-foreground">—</span>}<span className="font-medium">{account.name}</span></span></TableCell><TableCell className="py-3.5 text-muted-foreground whitespace-normal">{account.industry}</TableCell><TableCell className="pe-5 py-3.5 text-end font-mono text-xs font-medium tabular-nums">{account.leadsCount}</TableCell></TableRow>)}</TableBody></Table></section>
}

export function PropertyCard({ data, isLoading }: DataCardProps<OverviewProperty>) {
  if (isLoading) return <DataCardSkeleton />
  return <section className="min-w-0 overflow-hidden rounded-3xl bg-card"><CardHeader title="Properties" to="/properties" /><Table><TableHeader className="bg-muted/45"><TableRow><TableHead className="px-5">Name</TableHead><TableHead>Status</TableHead><TableHead className="pe-5 text-end">Price</TableHead></TableRow></TableHeader><TableBody>{data.map((property) => <TableRow key={property.id} className="hover:bg-muted/40"><TableCell className="px-5 py-3.5 font-medium whitespace-normal">{property.name}</TableCell><TableCell className="py-3.5">{property.status && <Badge className={`whitespace-nowrap capitalize ${propertyStatusPillClass[property.status] ?? "border-muted bg-muted text-muted-foreground hover:bg-muted"}`}>{property.status}</Badge>}</TableCell><TableCell className="pe-5 py-3.5 text-end font-mono text-xs font-medium tabular-nums">{formatCurrency(property.price)}</TableCell></TableRow>)}</TableBody></Table></section>
}

function CardHeader({ title, to }: { title: string; to: string }) {
  return <header className="flex items-center justify-between gap-3 px-5 py-3"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><Button asChild variant="outline"><Link to={to}>View all</Link></Button></header>
}

function formatCurrency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) }
function labelFor(value: string) { return value.replaceAll("_", " ") }

function DataCardSkeleton() {
  return <section aria-busy="true" className="min-w-0 overflow-hidden rounded-3xl bg-card"><header className="flex items-center justify-between gap-3 px-5 py-3"><Skeleton className="h-6 w-24" /><Skeleton className="h-9 w-20" /></header><div className="bg-muted/45 px-5 py-3"><div className="grid grid-cols-3 gap-4"><Skeleton className="h-3.5 w-16" /><Skeleton className="h-3.5 w-16" /><Skeleton className="h-3.5 w-16" /></div></div><div className="space-y-5 px-5 py-4">{Array.from({ length: 5 }, (_, index) => <div key={index} className="grid grid-cols-3 items-center gap-4"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-2/3" /></div>)}</div></section>
}

const propertyStatusPillClass: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/20 text-amber-950 hover:bg-amber-500/20 dark:text-amber-100",
  showing: "border-blue-500/30 bg-blue-500/20 text-blue-950 hover:bg-blue-500/20 dark:text-blue-100",
  sold: "border-emerald-500/30 bg-emerald-500/20 text-emerald-950 hover:bg-emerald-500/20 dark:text-emerald-100",
}
