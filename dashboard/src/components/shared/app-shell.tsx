import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  BarChart3,
  FileChartColumn,
  FileText,
  Building2,
  ChevronRight,
  FolderKanban,
  House,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings2,
  Sun,
  CreditCard,
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
import { DocLinks } from "@/components/shared/doc-links"
import { version } from "../../../package.json"
import { useTheme } from "@/components/theme-provider"
import { language, setLanguage, t } from "@/lib/i18n"

type NavigationItem = {
  label: string
  to: string
  icon: typeof LayoutDashboard
  permission?: string
  superOnly?: boolean
}

const workspaceNavigation: NavigationItem[] = [
  { label: "Activities", to: "/activities", icon: FileText, permission: "activity.view" },
  { label: "Overview", to: "/", icon: LayoutDashboard },
  { label: "Reports", to: "/reports", icon: FileChartColumn, permission: "report.view" },
  { label: "Agents", to: "/agents", icon: UsersRound, permission: "user.view" },
]

const realEstateNavigation: NavigationItem[] = [
  { label: "Pipeline", to: "/pipeline", icon: BarChart3, permission: "lead.view" },
  { label: "Deals", to: "/deals", icon: FolderKanban, permission: "deal.view" },
  { label: "Properties", to: "/properties", icon: House, permission: "property.view" },
  { label: "Accounts", to: "/accounts", icon: UsersRound, permission: "account.view" },
]

const paymentsNavigation: NavigationItem[] = [
  { label: "Invoices", to: "/invoices", icon: FileText },
]

const navigation = [...workspaceNavigation, ...realEstateNavigation, ...paymentsNavigation]

export function AppShell() {
  const { can, isSuper } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [realEstateOpen, setRealEstateOpen] = useState(true)
  const [paymentsOpen, setPaymentsOpen] = useState(() => location.pathname.startsWith("/invoices"))
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
    ? t("Profile")
    : t(visibleNavigation.find((item) => item.to === location.pathname)?.label ?? "Operations workspace")

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex h-12 items-center gap-2 px-2">
            <img src="/logo.png" alt="" className="size-7 rounded-md object-cover" />
            <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">CRM</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("Workspace")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNavigation.filter((item) => workspaceNavigation.includes(item)).map(({ label, to, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild tooltip={t(label)} isActive={location.pathname === to}>
                      <NavLink to={to} end={to === "/"}>
                        <Icon />
                        <span>{t(label)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>{t("Payments")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    tooltip={t("Payments")}
                    aria-expanded={paymentsOpen}
                    onClick={() => setPaymentsOpen((open) => !open)}
                  >
                    <CreditCard />
                    <span>{t("Payments")}</span>
                    <ChevronRight className={`ms-auto size-4 transition-transform ${paymentsOpen ? "rotate-90" : "rtl:-scale-x-100"}`} />
                  </SidebarMenuButton>
                  {paymentsOpen && (
                    <SidebarMenuSub>
                      {visibleNavigation.filter((item) => paymentsNavigation.includes(item)).map(({ label, to, icon: Icon }) => (
                        <SidebarMenuSubItem key={to}>
                          <SidebarMenuSubButton asChild isActive={location.pathname === to}>
                            <NavLink to={to}>
                              <Icon />
                              <span>{t(label)}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>{t("Real estate")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    tooltip={t("Real estate")}
                    aria-expanded={realEstateOpen}
                    onClick={() => setRealEstateOpen((open) => !open)}
                  >
                    <Building2 />
                    <span>{t("Real estate")}</span>
                    <ChevronRight className={`ms-auto size-4 transition-transform ${realEstateOpen ? "rotate-90" : "rtl:-scale-x-100"}`} />
                  </SidebarMenuButton>
                  {realEstateOpen && (
                    <SidebarMenuSub>
                      {visibleNavigation.filter((item) => realEstateNavigation.includes(item)).map(({ label, to, icon: Icon }) => (
                        <SidebarMenuSubItem key={to}>
                          <SidebarMenuSubButton asChild isActive={location.pathname === to}>
                            <NavLink to={to}>
                              <Icon />
                              <span>{t(label)}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {isSuper && (
            <SidebarGroup>
              <SidebarGroupLabel>{t("Settings")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      type="button"
                      tooltip={t("Settings")}
                      aria-expanded={settingsOpen}
                      onClick={() => setSettingsOpen((open) => !open)}
                    >
                      <Settings2 />
                      <span>{t("Settings")}</span>
                      <ChevronRight className={`ms-auto size-4 transition-transform ${settingsOpen ? "rotate-90" : "rtl:-scale-x-100"}`} />
                    </SidebarMenuButton>
                    {settingsOpen && (
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild isActive={location.pathname.startsWith("/settings/roles")}>
                            <NavLink to="/settings/roles">
                              <Settings2 />
                              <span>{t("Access")}</span>
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
          <VersionIndicator />
          <DocLinks />
        </header>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </SidebarInset>
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder={t("Jump to a workspace…")} />
        <CommandList>
          <CommandEmpty>{t("No permitted workspace.")}</CommandEmpty>
          {visibleNavigation.map(({ label, to, icon: Icon }) => (
            <CommandItem key={to} value={t(label)} onSelect={() => { navigate(to); setPaletteOpen(false) }}>
              <Icon /><span>{t(label)}</span>
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  )
}

function VersionIndicator() {
  const ref = useRef<HTMLSpanElement>(null)
  const [pinned, setPinned] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <>
      <span ref={ref} className="ms-auto text-xs text-muted-foreground">v{version}</span>
      {pinned && (
        <span className="fixed bottom-0 end-0 z-50 rounded-ss-md border-s border-t border-border bg-background px-2 py-1 text-xs text-muted-foreground">
          v{version}
        </span>
      )}
    </>
  )
}

function AccountMenu() {
  const { user, logout } = useAuth()
  const { mode, setMode } = useTheme()
  const { state } = useSidebar()
  const collapsed = state === "collapsed"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={t("Account")}>
              <PersonAvatar name={user?.name ?? t("Account")} avatar={user?.avatar} size="sm" className="size-5 [&>span]:text-[9px]" />
              <span className="truncate">{user?.name ?? t("Account")}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={collapsed ? (language === "ar" ? "left" : "right") : "top"} align="end" sideOffset={8} className={collapsed ? "w-56 rounded-md p-2" : "w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 rounded-md p-2"}>
            <DropdownMenuLabel className="px-2 py-1.5 text-sm font-medium text-foreground">{t("Account")}</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <NavLink to="/profile">
                <UserRound />
                {t("Profile")}
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="space-y-2 px-1 py-1.5">
              <div className="grid grid-cols-2 gap-1" role="group" aria-label={t("Color mode")}>
                <button type="button" aria-pressed={mode === "light"} onClick={() => setMode("light")} className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={mode === "light"}>
                  <Sun className="size-3.5" aria-hidden="true" />
                  {t("Light")}
                </button>
                <button type="button" aria-pressed={mode === "dark"} onClick={() => setMode("dark")} className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={mode === "dark"}>
                  <Moon className="size-3.5" aria-hidden="true" />
                  {t("Dark")}
                </button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <div className="space-y-2 px-1 py-1.5">
              <div className="grid grid-cols-2 gap-1" role="group" aria-label={t("Language")}>
                <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")} className="h-7 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={language === "en"}>EN</button>
                <button type="button" aria-pressed={language === "ar"} onClick={() => setLanguage("ar")} className="h-7 rounded-md border border-border text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary/30 data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={language === "ar"}>AR</button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut className="rtl:-scale-x-100" />
              {t("Sign out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
