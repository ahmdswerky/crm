import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

type PageItem = number | "start-ellipsis" | "end-ellipsis"

export type ResourcePaginationProps = {
  page: number
  lastPage: number
  onPageChange: (page: number) => void
  disabled?: boolean
  className?: string
}

function pageItems(currentPage: number, lastPage: number): PageItem[] {
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, index) => index + 1)
  if (currentPage <= 4) return [1, 2, 3, 4, 5, "end-ellipsis", lastPage]
  if (currentPage >= lastPage - 3) return [1, "start-ellipsis", lastPage - 4, lastPage - 3, lastPage - 2, lastPage - 1, lastPage]
  return [1, "start-ellipsis", currentPage - 1, currentPage, currentPage + 1, "end-ellipsis", lastPage]
}

function NavigationButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={label} disabled={disabled} onClick={onClick}>{children}</Button>
}

export function ResourcePagination({ page, lastPage, onPageChange, disabled = false, className }: ResourcePaginationProps) {
  if (lastPage < 1) return null

  const currentPage = Math.min(Math.max(1, page), lastPage)
  const goTo = (nextPage: number) => {
    if (disabled || nextPage < 1 || nextPage > lastPage || nextPage === currentPage) return
    onPageChange(nextPage)
  }

  return <Pagination className={cn("border-t border-border p-3", className)}>
    <PaginationContent className="gap-0.5">
      <PaginationItem>
        <NavigationButton label="Go to first page" disabled={disabled || currentPage === 1} onClick={() => goTo(1)}><ChevronsLeft className="size-4" /></NavigationButton>
      </PaginationItem>
      <PaginationItem>
        <NavigationButton label="Go to previous page" disabled={disabled || currentPage === 1} onClick={() => goTo(currentPage - 1)}><ChevronLeft className="size-4 rtl:rotate-180" /></NavigationButton>
      </PaginationItem>
      <PaginationItem className="flex items-center gap-0.5">
        {pageItems(currentPage, lastPage).map((item) => typeof item === "number" ? <Button key={item} type="button" variant={item === currentPage ? "outline" : "ghost"} size="icon" aria-label={`Go to page ${item}`} aria-current={item === currentPage ? "page" : undefined} disabled={disabled} onClick={() => goTo(item)}>{item}</Button> : <PaginationEllipsis key={item} />)}
      </PaginationItem>
      <PaginationItem>
        <NavigationButton label="Go to next page" disabled={disabled || currentPage === lastPage} onClick={() => goTo(currentPage + 1)}><ChevronRight className="size-4 rtl:rotate-180" /></NavigationButton>
      </PaginationItem>
      <PaginationItem>
        <NavigationButton label="Go to last page" disabled={disabled || currentPage === lastPage} onClick={() => goTo(lastPage)}><ChevronsRight className="size-4" /></NavigationButton>
      </PaginationItem>
    </PaginationContent>
  </Pagination>
}
