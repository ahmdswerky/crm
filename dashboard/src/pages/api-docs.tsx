import { useEffect, useRef } from "react"
import { createApiReference } from "@scalar/api-reference"
import { t } from "@/lib/i18n"
import "@scalar/api-reference/style.css"

export function ApiDocsPage() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const reference = createApiReference(mountRef.current, {
      url: "/openapi.json",
      title: t("CRM API Documentation"),
      layout: "modern",
      theme: "default",
      persistAuth: true,
      telemetry: false,
    })

    return () => reference.destroy()
  }, [])

  return <div ref={mountRef} className="h-svh w-full bg-background" />
}
