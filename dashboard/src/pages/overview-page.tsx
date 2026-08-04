import { Link } from "react-router-dom"
import { ArrowRight, Building2, Contact, FolderKanban, UsersRound } from "lucide-react"
import { useAuth } from "@/auth/auth-provider"
import { Button } from "@/components/ui/button"

const workspaces = [
  { label: "Leads", description: "Capture and qualify conversations.", to: "/leads", permission: "lead.view", icon: UsersRound },
  { label: "Deals", description: "Follow opportunities to close.", to: "/deals", permission: "deal.view", icon: FolderKanban },
  { label: "Properties", description: "Keep inventory ready for sale.", to: "/properties", permission: "property.view", icon: Building2 },
  { label: "Contacts", description: "Maintain people and account context.", to: "/contacts", permission: "contact.view", icon: Contact },
]

export function OverviewPage() {
  const { user, can } = useAuth()
  const visible = workspaces.filter((workspace) => can(workspace.permission))
  const primaryWorkspace = visible[0]

  return <div className="space-y-8 p-6 lg:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
      <div><p className="text-xs font-medium text-muted-foreground">Overview</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Welcome back, {user?.name ?? "there"}.</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Choose a permitted workspace to continue operational work.</p></div>
      {primaryWorkspace && <Button variant="outline" asChild><Link to={primaryWorkspace.to}>Open workspace <ArrowRight className="ms-2 size-3.5" /></Link></Button>}
    </div>
    <section className="border border-border bg-card">
      <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Available workspaces</h2><p className="mt-1 text-sm text-muted-foreground">Navigation reflects your current CRM access.</p></div>
      <div className="divide-y divide-border">{visible.map(({ label, description, to, icon: Icon }) => <Link key={to} to={to} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40"><span className="flex items-center gap-3"><Icon className="size-4 text-muted-foreground" /><span><span className="block font-medium">{label}</span><span className="block text-sm text-muted-foreground">{description}</span></span></span><ArrowRight className="size-4 text-muted-foreground" /></Link>)}{!visible.length && <p className="px-5 py-10 text-center text-sm text-muted-foreground">No operational workspaces are currently available.</p>}</div>
    </section>
  </div>
}
