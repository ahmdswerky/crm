import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import forbiddenIllustration from "@/assets/illustrations/errors/forbidden.svg"
import notFoundIllustration from "@/assets/illustrations/errors/not-found.svg"
import unauthorizedIllustration from "@/assets/illustrations/errors/unauthorized.svg"

type ErrorStateKind = "unauthorized" | "forbidden" | "not-found"

const illustrations: Record<ErrorStateKind, string> = {
  unauthorized: unauthorizedIllustration,
  forbidden: forbiddenIllustration,
  "not-found": notFoundIllustration,
}

type ErrorStateProps = {
  kind: ErrorStateKind
  title: string
  description: string
  actionLabel: string
  actionTo?: string
  onAction?: () => void
}

export function ErrorState({ kind, title, description, actionLabel, actionTo, onAction }: ErrorStateProps) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center overflow-hidden p-8 text-center">
      <img
        src={illustrations[kind]}
        alt=""
        aria-hidden="true"
        className="pointer-events-none h-[min(62vh,36rem)] w-[min(92vw,40rem)] shrink-0 object-contain opacity-[0.18] mix-blend-multiply dark:opacity-[0.22] dark:mix-blend-screen"
      />
      <div className="relative z-10 -mt-2 max-w-lg px-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {onAction ? <Button variant="outline" className="mt-5" onClick={onAction}>{actionLabel}</Button> : <Button asChild variant="outline" className="mt-5"><Link to={actionTo ?? "/"}>{actionLabel}</Link></Button>}
      </div>
    </main>
  )
}
