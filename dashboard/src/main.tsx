import { StrictMode } from "react"
import { Direction } from "radix-ui"
import { direction } from "@/lib/i18n"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import App from "@/App"
import "@/styles/globals.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Direction.Provider dir={direction}><TooltipProvider><ThemeProvider><App /><Toaster /></ThemeProvider></TooltipProvider></Direction.Provider>
  </StrictMode>,
)
