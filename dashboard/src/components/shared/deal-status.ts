import type { components as SalesComponents } from "@/api/generated/Sales"

export type DealStatus = SalesComponents["schemas"]["Deal"]["status"]

export const statusPillClass: Record<DealStatus, string> = {
  inquiry: "border-slate-500/20 bg-slate-500/10 text-slate-800 hover:bg-slate-500/10 dark:text-slate-200",
  viewing: "border-blue-500/20 bg-blue-500/10 text-blue-800 hover:bg-blue-500/10 dark:text-blue-200",
  offer_made: "border-amber-500/20 bg-amber-500/10 text-amber-900 hover:bg-amber-500/10 dark:text-amber-100",
  legal: "border-violet-500/20 bg-violet-500/10 text-violet-900 hover:bg-violet-500/10 dark:text-violet-100",
  won: "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 hover:bg-emerald-500/10 dark:text-emerald-100",
  lost: "border-red-500/20 bg-red-500/10 text-red-900 hover:bg-red-500/10 dark:text-red-100",
}

// Keep chart marks on the same semantic hue scale as the status pills used in
// the Deals table. The values are Tailwind theme tokens so light and dark mode
// continue to use the same palette instead of introducing a second mapping.
export const statusChartColorToken: Record<DealStatus, string> = {
  inquiry: "--color-slate-500",
  viewing: "--color-blue-500",
  offer_made: "--color-amber-500",
  legal: "--color-violet-500",
  won: "--color-emerald-500",
  lost: "--color-red-500",
}

export const statusDotClass: Record<DealStatus, string> = {
  inquiry: "bg-slate-500",
  viewing: "bg-blue-500",
  offer_made: "bg-amber-500",
  legal: "bg-violet-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
}
