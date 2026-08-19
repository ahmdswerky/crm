import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { themeConfig, type ThemeMode } from "@/config/theme"

type ThemeProviderState = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode !== "system") return mode
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem(themeConfig.storageKey)
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : themeConfig.defaultMode
  })

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = themeConfig.preset
    root.classList.remove("light", "dark")
    root.classList.add(resolveMode(mode))
    root.style.colorScheme = resolveMode(mode)
  }, [mode])

  useEffect(() => {
    if (mode !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => {
      document.documentElement.classList.toggle("dark", media.matches)
      document.documentElement.classList.toggle("light", !media.matches)
    }
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [mode])

  const value = useMemo<ThemeProviderState>(
    () => ({
      mode,
      setMode: (nextMode) => {
        window.localStorage.setItem(themeConfig.storageKey, nextMode)
        setMode(nextMode)
      },
    }),
    [mode],
  )

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)
  if (!context) throw new Error("useTheme must be used within ThemeProvider")
  return context
}
