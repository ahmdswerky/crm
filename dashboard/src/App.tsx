import { type ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { AuthProvider, useAuth } from "@/auth/auth-provider"
import { AppShell } from "@/components/shared/app-shell"
import { AgentDetailsPage, AgentsPage } from "@/pages/agents-page"
import { LeadDetailsPage, LeadsPage } from "@/pages/leads-page"
import { DealDetailsPage, DealsPage } from "@/pages/deals-page"
import { LoginPage } from "@/pages/login-page"
import { OverviewPage } from "@/pages/overview-page"
import { PropertiesPage, PropertyDetailsPage } from "@/pages/properties-page"
import { ProfilePage } from "@/pages/profile-page"
import { AccountDetailsPage, AccountsPage } from "@/pages/accounts-page"
import { ResourceDetailsPage } from "@/pages/resource-page"
import { RolesPage } from "@/pages/roles-page"
import { ContactDetailsPage, ContactsPage } from "@/pages/contacts-page"
import { ErrorState } from "@/components/shared/error-state"

function Protected() {
  const { user, loading, error, refresh } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading workspace…</div>
  if (error && !user) return <div className="min-h-svh"><ErrorState kind="unauthorized" title="Unable to verify your session" description={error} actionLabel="Retry" onAction={() => void refresh()} /></div>
  return user ? <AppShell /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
}

function SuperOnly({ children }: { children: ReactNode }) {
  const { isSuper } = useAuth()
  return isSuper ? children : <RolesPage />
}

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<Protected />}>
      <Route index element={<OverviewPage />} />
      <Route path="leads" element={<LeadsPage />} />
      <Route path="leads/create" element={<LeadDetailsPage create />} />
      <Route path="leads/:leadId" element={<LeadDetailsPage />} />
      <Route path="deals" element={<DealsPage />} />
      <Route path="deals/create" element={<DealDetailsPage create />} />
      <Route path="deals/:dealId" element={<DealDetailsPage />} />
      <Route path="properties" element={<PropertiesPage />} />
      <Route path="properties/create" element={<PropertyDetailsPage create />} />
      <Route path="properties/:propertyId" element={<PropertyDetailsPage />} />
      <Route path="accounts" element={<AccountsPage />} />
      <Route path="accounts/create" element={<AccountDetailsPage create />} />
      <Route path="accounts/:accountId" element={<AccountDetailsPage />} />
      <Route path="contacts" element={<ContactsPage />} />
      <Route path="contacts/create" element={<ContactDetailsPage create />} />
      <Route path="contacts/:contactId" element={<ContactDetailsPage />} />
      <Route path="agents" element={<AgentsPage />} />
      <Route path="agents/create" element={<AgentDetailsPage create />} />
      <Route path="agents/:agentId" element={<AgentDetailsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<Navigate to="/settings/roles" replace />} />
      <Route path="settings/roles" element={<SuperOnly><RolesPage /></SuperOnly>} />
      <Route path="settings/roles/:resourceId" element={<SuperOnly><ResourceDetailsPage title="Role details" eyebrow="CRM / Access" description="The role and its permissions." endpoint="/v1/roles" envelopeKey="role" backPath="/settings/roles" fields={[{ key: "name", label: "Name" }, { key: "guard_name", label: "Guard" }, { key: "permissions", label: "Permissions" }]} /></SuperOnly>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter>
}
