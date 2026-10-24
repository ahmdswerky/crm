import { afterEach, describe, expect, it, vi } from "vitest"

async function loadAs(language: "en" | "ar") {
  window.localStorage.setItem("crm-dashboard-language", language)
  vi.resetModules()
  return import("@/lib/i18n")
}

afterEach(() => window.localStorage.clear())

describe("t", () => {
  it("returns English keys, fills placeholders and strips context in English", async () => {
    const { t, direction } = await loadAs("en")
    expect(direction).toBe("ltr")
    expect(t("Go to page {page}", { page: 3 })).toBe("Go to page 3")
    expect(t("Title|job")).toBe("Title")
  })

  it("translates to Arabic, sets RTL and falls back to English for unknown keys", async () => {
    const { t, direction } = await loadAs("ar")
    expect(direction).toBe("rtl")
    expect(document.documentElement.dir).toBe("rtl")
    expect(t("Go to page {page}", { page: 3 })).toBe("الانتقال إلى الصفحة 3")
    expect(t("Title|job")).toBe("المسمى الوظيفي")
    expect(t("Not in the dictionary")).toBe("Not in the dictionary")
  })
})
