import { ar } from "@/lib/i18n-ar"

export type Language = "en" | "ar"

const storageKey = "crm-dashboard-language"

export const language: Language = window.localStorage.getItem(storageKey) === "ar" ? "ar" : "en"
export const direction = language === "ar" ? "rtl" : "ltr"
// Latin digits keep prices, phones and IDs consistent across both languages.
export const locale = language === "ar" ? "ar-u-nu-latn" : "en-US"

document.documentElement.lang = language
document.documentElement.dir = direction

// ponytail: reload on switch so module-level labels, Intl formatters and Radix direction all re-read the language; move to context state if switching mid-form ever matters.
export function setLanguage(next: Language) {
  if (next === language) return
  window.localStorage.setItem(storageKey, next)
  window.location.reload()
}

/** English text is the key; missing Arabic falls back to English. `{name}` placeholders are filled from `values`.
 * A `|context` suffix disambiguates identical English words (`t("Title|job")` renders "Title" in English). */
export function t(text: string, values?: Record<string, string | number | null | undefined>) {
  const template = (language === "ar" && ar[text]) || text.split("|")[0]
  return values ? template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match)) : template
}
