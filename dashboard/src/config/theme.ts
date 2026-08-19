export const themeConfig = {
  defaultMode: "light" as const,
  storageKey: "crm-dashboard-theme",
  preset: "paper" as const,
  density: "comfortable" as const,
}

export type ThemeMode = "light" | "dark" | "system"
