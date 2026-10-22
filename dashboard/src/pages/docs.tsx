import { ArrowUpRight, Database, Network, ScrollText } from "lucide-react"

type Group = {
  title: string
  description: string
  href: string
  icon: typeof Network
  children: { title: string; href: string }[]
}

const groups: Group[] = [
  {
    title: "Architecture",
    description: "Interactive system diagrams",
    href: "/docs/architecture/",
    icon: Network,
    children: [
      { title: "System architecture", href: "/docs/architecture/#prod/architecture" },
      { title: "Lead → deal → commission workflow", href: "/docs/architecture/#prod/workflow" },
      { title: "Payment round-trip sequence", href: "/docs/architecture/#prod/sequence" },
    ],
  },
  {
    title: "Database",
    description: "Entity-relationship diagrams",
    href: "/docs/db/crm/",
    icon: Database,
    children: [
      { title: "CRM", href: "/docs/db/crm/" },
      { title: "Payments", href: "/docs/db/payments/" },
    ],
  },
]

const single = { title: "API reference", description: "OpenAPI explorer", href: "/api-docs", icon: ScrollText }

export function DocsPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-3">
        <h1 className="text-lg font-semibold tracking-tight">CRM documentation</h1>
        {groups.map(({ title, description, href, icon: Icon, children }) => (
          <section key={title} className="rounded-xl border border-border bg-card">
            <a
              href={href}
              className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-xl"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{description}</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </a>
            <ul className="border-t border-border py-1">
              {children.map((child) => (
                <li key={child.href}>
                  <a
                    href={child.href}
                    className="flex items-center justify-between gap-3 px-4 py-2 ps-12 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 truncate">{child.title}</span>
                    <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <a
          href={single.href}
          className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <single.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{single.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{single.description}</span>
          </span>
          <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
        </a>
      </div>
    </main>
  )
}
