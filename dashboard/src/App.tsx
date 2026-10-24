import { lazy, Suspense, type ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom"
import { AuthProvider, useAuth } from "@/auth/auth-provider"
import { LoginPage } from "@/pages/auth/login"
import { ErrorState } from "@/components/shared/error-state"
import { t } from "@/lib/i18n"

const AppShell = lazy(() => import("@/components/shared/app-shell").then(({ AppShell }) => ({ default: AppShell })))
const OverviewPage = lazy(() => import("@/pages/overview").then(({ OverviewPage }) => ({ default: OverviewPage })))
const ActivitiesPage = lazy(() => import("@/pages/activities").then(({ ActivitiesPage }) => ({ default: ActivitiesPage })))
const ContactsPage = lazy(() => import("@/pages/contacts").then(({ ContactsPage }) => ({ default: ContactsPage })))
const ContactDetailsPage = lazy(() => import("@/pages/contacts").then(({ ContactDetailsPage }) => ({ default: ContactDetailsPage })))
const ReportsPage = lazy(() => import("@/pages/reports").then(({ ReportsPage }) => ({ default: ReportsPage })))
const InvoicesPage = lazy(() => import("@/pages/invoices").then(({ InvoicesPage }) => ({ default: InvoicesPage })))
const ApiDocsPage = lazy(() => import("@/pages/api-docs").then(({ ApiDocsPage }) => ({ default: ApiDocsPage })))
const DocsPage = lazy(() => import("@/pages/docs").then(({ DocsPage }) => ({ default: DocsPage })))
const ReportDetailsPage = lazy(() => import("@/pages/reports/details").then(({ ReportDetailsPage }) => ({ default: ReportDetailsPage })))
const LeadsKanbanPage = lazy(() => import("@/pages/leads").then(({ LeadsKanbanPage }) => ({ default: LeadsKanbanPage })))
const LeadDetailsPage = lazy(() => import("@/pages/leads/details").then(({ LeadDetailsPage }) => ({ default: LeadDetailsPage })))
const DealsPage = lazy(() => import("@/pages/deals").then(({ DealsPage }) => ({ default: DealsPage })))
const DealCreatePage = lazy(() => import("@/pages/deals/create").then(({ DealCreatePage }) => ({ default: DealCreatePage })))
const DealDetailsPage = lazy(() => import("@/pages/deals/details").then(({ DealDetailsPage }) => ({ default: DealDetailsPage })))
const PropertiesPage = lazy(() => import("@/pages/properties").then(({ PropertiesPage }) => ({ default: PropertiesPage })))
const PropertyCreatePage = lazy(() => import("@/pages/properties/create").then(({ PropertyCreatePage }) => ({ default: PropertyCreatePage })))
const PropertyEditPage = lazy(() => import("@/pages/properties/create").then(({ PropertyEditPage }) => ({ default: PropertyEditPage })))
const PropertyDetailsPage = lazy(() => import("@/pages/properties/details").then(({ PropertyDetailsPage }) => ({ default: PropertyDetailsPage })))
const AccountsPage = lazy(() => import("@/pages/accounts").then(({ AccountsPage }) => ({ default: AccountsPage })))
const AccountDetailsPage = lazy(() => import("@/pages/accounts/details").then(({ AccountDetailsPage }) => ({ default: AccountDetailsPage })))
const AgentsPage = lazy(() => import("@/pages/agents").then(({ AgentsPage }) => ({ default: AgentsPage })))
const AgentShowPage = lazy(() => import("@/pages/agents/details").then(({ AgentShowPage }) => ({ default: AgentShowPage })))
const ProfilePage = lazy(() => import("@/pages/auth/profile").then(({ ProfilePage }) => ({ default: ProfilePage })))
const RolesPage = lazy(() => import("@/pages/settings/roles").then(({ RolesPage }) => ({ default: RolesPage })))
const ResourceDetailsPage = lazy(() => import("@/pages/resource-page").then(({ ResourceDetailsPage }) => ({ default: ResourceDetailsPage })))

function WorkspaceLoading() {
  return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground" role="status">{t("Loading workspace…")}</div>
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<WorkspaceLoading />}>{children}</Suspense>
}

function DealMemberPage() {
  const [searchParams] = useSearchParams()
  return searchParams.get("mode") === "edit" ? <DealCreatePage /> : <DealDetailsPage />
}

function Protected() {
  const { user, loading, error, refresh } = useAuth()
  const location = useLocation()
  if (loading) return <WorkspaceLoading />
  if (error && !user) return <div className="min-h-svh"><ErrorState kind="unauthorized" title={t("Unable to verify your session")} description={error} actionLabel={t("Retry")} onAction={() => void refresh()} /></div>
  return user ? <LazyRoute><AppShell /></LazyRoute> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
}

function SuperOnly({ children }: { children: ReactNode }) {
  const { isSuper } = useAuth()
  return isSuper ? children : <RolesPage />
}

function LegacyLeadsIndexRedirect() {
  const location = useLocation()
  return <Navigate to={{ pathname: "/pipeline", search: location.search, hash: location.hash }} replace />
}

function AuthenticatedApp() {
  return <AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected />}>
      <Route index element={<LazyRoute><OverviewPage /></LazyRoute>} />
      <Route path="activities" element={<LazyRoute><ActivitiesPage /></LazyRoute>} />
      <Route path="contacts" element={<LazyRoute><ContactsPage /></LazyRoute>} />
      <Route path="contacts/:contactId" element={<LazyRoute><ContactDetailsPage /></LazyRoute>} />
      <Route path="reports" element={<LazyRoute><ReportsPage /></LazyRoute>} />
      <Route path="invoices" element={<LazyRoute><InvoicesPage /></LazyRoute>} />
      <Route path="reports/:reportRunId" element={<LazyRoute><ReportDetailsPage /></LazyRoute>} />
      <Route path="pipeline" element={<LazyRoute><LeadsKanbanPage /></LazyRoute>} />
      <Route path="leads" element={<LegacyLeadsIndexRedirect />} />
      <Route path="leads/create" element={<LazyRoute><LeadDetailsPage create /></LazyRoute>} />
      <Route path="leads/:leadId" element={<LazyRoute><LeadDetailsPage /></LazyRoute>} />
      <Route path="deals" element={<LazyRoute><DealsPage /></LazyRoute>} />
      <Route path="deals/create" element={<LazyRoute><DealCreatePage /></LazyRoute>} />
      <Route path="deals/:dealId/edit" element={<LazyRoute><DealCreatePage /></LazyRoute>} />
      <Route path="deals/:dealId" element={<LazyRoute><DealMemberPage /></LazyRoute>} />
      <Route path="properties" element={<LazyRoute><PropertiesPage /></LazyRoute>} />
      <Route path="properties/create" element={<LazyRoute><PropertyCreatePage /></LazyRoute>} />
      <Route path="properties/:propertyId/edit" element={<LazyRoute><PropertyEditPage /></LazyRoute>} />
      <Route path="properties/:propertyId" element={<LazyRoute><PropertyDetailsPage /></LazyRoute>} />
      <Route path="accounts" element={<LazyRoute><AccountsPage /></LazyRoute>} />
      <Route path="accounts/create" element={<Navigate to="/accounts" replace />} />
      <Route path="accounts/:accountId" element={<LazyRoute><AccountDetailsPage /></LazyRoute>} />
      <Route path="agents" element={<LazyRoute><AgentsPage /></LazyRoute>} />
      <Route path="agents/:agentId" element={<LazyRoute><AgentShowPage /></LazyRoute>} />
      <Route path="profile" element={<LazyRoute><ProfilePage /></LazyRoute>} />
      <Route path="settings" element={<Navigate to="/settings/roles" replace />} />
      <Route path="settings/roles" element={<LazyRoute><SuperOnly><RolesPage /></SuperOnly></LazyRoute>} />
      <Route path="settings/roles/:resourceId" element={<LazyRoute><SuperOnly><ResourceDetailsPage title={t("Role details")} eyebrow={t("CRM / Access")} description={t("The role and its permissions.")} endpoint="/v1/roles" envelopeKey="role" backPath="/settings/roles" fields={[{ key: "name", label: t("Name") }, { key: "guard_name", label: t("Guard") }, { key: "permissions", label: t("Permissions") }]} /></SuperOnly></LazyRoute>} />
    </Route>
    <Route path="*" element={<ErrorState kind="not-found" title={t("Page not found")} description={t("The page you are looking for does not exist or may have moved.")} actionLabel={t("Return to overview")} actionTo="/" />} />
  </Routes></AuthProvider>
}

function AppRoutes() {
  const location = useLocation()

  if (location.pathname === "/api-docs") return <LazyRoute><ApiDocsPage /></LazyRoute>
  if (location.pathname === "/docs") return <LazyRoute><DocsPage /></LazyRoute>
  return <AuthenticatedApp />
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}
