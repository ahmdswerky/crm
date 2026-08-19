export type OverviewRange = "year" | "month" | "week"

export type TrendPoint = {
  label: string
  value: number
}

export type Metric = {
  label: "New Leads" | "Conversion Rate" | "Revenue" | "Properties"
  value: string
  change: number
  trend: TrendPoint[]
}

export type LeaderboardEntry = {
  name: string
  value: number
}

export type Customer = {
  id: number
  name: string
  company: string
  accountLogo: string | null
  position: string
}

export type OverviewDeal = {
  id: number
  name: string
  customer: string
  dealValue: number
  status: string | null
}

export type OverviewAccount = {
  id: number
  name: string
  logo: string | null
  industry: string
  leadsCount: number
}

export type OverviewProperty = {
  id: number
  name: string
  status: string | null
  price: number
}
