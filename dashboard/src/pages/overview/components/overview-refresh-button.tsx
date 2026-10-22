import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type OverviewRefreshButtonProps = {
  label: string
  isLoading: boolean
  onRefresh: () => void
}

export function OverviewRefreshButton({ label, isLoading, onRefresh }: OverviewRefreshButtonProps) {
  return <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onRefresh} disabled={isLoading}>
    <RefreshCw className={isLoading ? "animate-spin" : undefined} aria-hidden="true" />
  </Button>
}
