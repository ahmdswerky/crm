import { useEffect, useRef } from "react"
import { createApiReference } from "@scalar/api-reference"
import "@scalar/api-reference/style.css"

export function ApiDocsPage() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const reference = createApiReference(mountRef.current, {
      url: "/openapi.json",
      title: "CRM API Documentation",
      layout: "modern",
      theme: "default",
      persistAuth: true,
      telemetry: false,
    })

    return () => reference.destroy()
  }, [])

  return <div ref={mountRef} className="h-svh w-full bg-background" />
}
