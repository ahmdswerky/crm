import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 fill-emerald-500 text-emerald-700 dark:fill-emerald-400 dark:text-emerald-950" />
        ),
        info: (
          <InfoIcon className="size-4 fill-sky-500 text-sky-700 dark:fill-sky-400 dark:text-sky-950" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 fill-amber-400 text-amber-700 dark:fill-amber-300 dark:text-amber-950" />
        ),
        error: (
          <OctagonXIcon className="size-4 fill-red-500 text-red-700 dark:fill-red-400 dark:text-red-950" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin text-primary" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
