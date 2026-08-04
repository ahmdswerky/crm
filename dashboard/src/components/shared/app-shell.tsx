import { useEffect, useMemo, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3,
  Building2,
  ChevronRight,
  Contact,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings2,
  Sun,
  UserRound,
  UsersRound,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { useAuth } from "@/auth/auth-provider"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { useTheme } from "@/components/theme-provider"

type DashboardLanguage = "en" | "ar"

const languageStorageKey = "crm-dashboard-language"

type NavigationItem = {
  label: string
  to: string
  icon: typeof LayoutDashboard
  permission?: string
  superOnly?: boolean
}

const navigation: NavigationItem[] = [
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Leads", to: "/leads", icon: BarChart3, permission: "lead.view" },
  { label: "Deals", to: "/deals", icon: FolderKanban, permission: "deal.view" },
  { label: "Properties", to: "/properties", icon: Building2, permission: "property.view" },
  { label: "Accounts", to: "/accounts", icon: UsersRound, permission: "account.view" },
  { label: "Contacts", to: "/contacts", icon: Contact, permission: "contact.view" },
  { label: "Agents", to: "/agents", icon: UsersRound, permission: "user.view" },
]

export function AppShell() {
  const { can, isSuper } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(() => location.pathname.startsWith("/settings"))
  const visibleNavigation = useMemo(
    () => navigation.filter((item) => (item.superOnly ? isSuper : !item.permission || can(item.permission))),
    [can, isSuper],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const pageLabel = location.pathname === "/profile"
    ? "Profile"
    : visibleNavigation.find((item) => item.to === location.pathname)?.label ?? "Operations workspace"

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex h-12 items-center gap-2 px-2">
            <div className="grid size-7 place-items-center bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">C</div>
            <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">CRM / Ledger</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNavigation.map(({ label, to, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild tooltip={label}>
                      <NavLink to={to} end={to === "/"} className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : undefined}>
                        <Icon />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {isSuper && (
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      tooltip="Settings"
                      aria-expanded={settingsOpen}
                      onClick={() => setSettingsOpen((open) => !open)}
                    >
                      <Settings2 />
                      <span>Settings</span>
                      <ChevronRight className={`ms-auto size-4 transition-transform ${settingsOpen ? "rotate-90" : ""}`} />
                    </SidebarMenuButton>
                    {settingsOpen && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.pathname.startsWith("/settings/roles")}>
                            <NavLink to="/settings/roles">
                              <Settings2 />
                              <span>Access</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter>
          <AccountMenu />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-2 h-full" />
          <span className="text-sm text-muted-foreground">{pageLabel}</span>
        </header>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </SidebarInset>
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to a workspace…" />
        <CommandList>
          <CommandEmpty>No permitted workspace.</CommandEmpty>
          {visibleNavigation.map(({ label, to, icon: Icon }) => (
            <CommandItem key={to} value={label} onSelect={() => { navigate(to); setPaletteOpen(false) }}>
              <Icon /><span>{label}</span>
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  )
}

function AccountMenu() {
  const { user, logout } = useAuth()
  const { mode, setMode } = useTheme()
  const { state } = useSidebar()
  const [language, setLanguage] = useState<DashboardLanguage>(() => window.localStorage.getItem(languageStorageKey) === "ar" ? "ar" : "en")
  const collapsed = state === "collapsed"

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr"
  }, [language])

  const changeLanguage = (nextLanguage: DashboardLanguage) => {
    window.localStorage.setItem(languageStorageKey, nextLanguage)
    setLanguage(nextLanguage)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip="Account">
              <PersonAvatar name={user?.name ?? "Account"} size="sm" className="size-5 [&>span]:text-[9px]" />
              <span className="truncate">{user?.name ?? "Account"}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={collapsed ? "right" : "top"} align="end" sideOffset={8} className={collapsed ? "w-56 rounded-md p-2" : "w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 rounded-md p-2"}>
            <DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium text-foreground">Account</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <NavLink to="/profile">
                <UserRound />
                Profile
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="space-y-2 px-1 py-1.5">
              <div className="grid grid-cols-2 gap-1" role="group" aria-label="Color mode">
                <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")} className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={mode === "light"}>
                  <Sun className="size-3.5" aria-hidden="true" />
                  Light
                </button>
                <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")} className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={mode === "dark"}>
                  <Moon className="size-3.5" aria-hidden="true" />
                  Dark
                </button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <div className="space-y-2 px-1 py-1.5">
              <div className="grid grid-cols-2 gap-1" role="group" aria-label="Language">
                <button type="button" aria-pressed={language === "en"} onClick={() => changeLanguage("en")} className="h-7 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={language === "en"}>EN</button>
                <button type="button" aria-pressed={language === "ar"} onClick={() => changeLanguage("ar")} className="h-7 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={language === "ar"}>AR</button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
