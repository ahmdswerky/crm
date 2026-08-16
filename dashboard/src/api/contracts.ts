import type { components as AuthComponents } from "@/api/generated/Auth"
import type { components as AnalyticsComponents } from "@/api/generated/Analytics"

export type User = AuthComponents["schemas"]["User"]
export type LoginUser = AuthComponents["schemas"]["LoginUser"]
export type Role = AuthComponents["schemas"]["Role"]
export type Permission = AuthComponents["schemas"]["Permission"]
export type PaginationMeta = AuthComponents["schemas"]["PaginationMeta"]
export type PaginationLinks = AuthComponents["schemas"]["PaginationLinks"]

export type Paginated<T> = {
  data: T[]
  links: PaginationLinks
  meta: PaginationMeta
}

export type UserEnvelope = { user: User }
export type RoleEnvelope = { role: Role }

export type UserStorePayload = {
  user: {
    name: string
    username: string
    email: string
    phone: string
    password: string
    roles?: string[]
  }
}

export type UserUpdatePayload = {
  user: {
    _method: "PUT"
    name: string
    username: string
    email: string
    phone: string
    roles?: string[]
  }
}

export type AnalyticsOverview = AnalyticsComponents["schemas"]["AnalyticsOverview"]
export type OverviewMetrics = AnalyticsComponents["schemas"]["OverviewMetrics"]
export type OverviewLeaderboard = AnalyticsComponents["schemas"]["OverviewLeaderboard"]
export type OverviewRevenue = AnalyticsComponents["schemas"]["OverviewRevenue"]
export type OverviewCustomer = AnalyticsComponents["schemas"]["OverviewCustomer"]
export type OverviewDeal = AnalyticsComponents["schemas"]["OverviewDeal"]
export type OverviewAccount = AnalyticsComponents["schemas"]["OverviewAccount"]
export type OverviewProperty = AnalyticsComponents["schemas"]["OverviewProperty"]
export type ReportRun = AnalyticsComponents["schemas"]["ReportRun"]
export type ReportRunDetail = AnalyticsComponents["schemas"]["ReportRunDetail"]
