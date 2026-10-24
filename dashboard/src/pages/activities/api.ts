import { apiJson, API_BASE_URL } from "@/api/client"
import type { components } from "@/api/generated/Activity"
import { locale, t } from "@/lib/i18n"

export type Activity = components["schemas"]["Activity"]
export type ActivityLink = components["schemas"]["ActivityLink"]
export type ActivityOptions = components["schemas"]["ActivityOptions"]
export type ActivityPage = components["schemas"]["ActivityPage"]
export type HistoryPage = components["schemas"]["InteractionHistoryPage"]
export type ActivityKind = Activity["kind"]
export const kinds: ActivityKind[] = ["call", "email", "message", "meeting", "viewing", "note", "task"]
export const outcomes: Partial<Record<ActivityKind, string[]>> = {
  call: ["reached", "unanswered", "busy", "voicemail", "wrong_number"],
  meeting: ["attended", "no_show"], viewing: ["attended", "no_show"],
}
export const activityUrl = (path: string, params?: URLSearchParams) => `${API_BASE_URL}/v1/${path}${params?.size ? `?${params}` : ""}`
export const getActivity = (id: number) => apiJson<components["schemas"]["ActivityEnvelope"]>(activityUrl(`activities/${id}`))
export function displayTime(value: string | null, dateOnly = false) {
  if (!value) return t("No time recorded")
  return new Intl.DateTimeFormat(locale, dateOnly ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" }).format(new Date(dateOnly ? `${value}T12:00:00Z` : value))
}
export function dueLabel(activity: Activity) {
  if (activity.status !== "scheduled") return activity.status
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  if (activity.due_date) return activity.due_date < today ? "overdue" : activity.due_date === today ? "due today" : "upcoming"
  return activity.starts_at && new Date(activity.starts_at) < new Date() ? "overdue" : "scheduled"
}
