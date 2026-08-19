import * as React from "react"

import { cn } from "@/lib/utils"

type ButtonGroupProps = React.ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical"
}

function ButtonGroup({ className, orientation = "horizontal", ...props }: ButtonGroupProps) {
  return <div role="group" data-slot="button-group" data-orientation={orientation} className={cn("flex w-fit items-stretch [&>*]:focus-visible:z-10", orientation === "horizontal" ? "flex-row [&>*:first-child]:rounded-s-md [&>*:last-child]:rounded-e-md [&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none [&>*:not(:first-child)]:border-s-0" : "flex-col [&>*:first-child]:rounded-t-md [&>*:last-child]:rounded-b-md [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none [&>*:not(:first-child)]:border-t-0", className)} {...props} />
}

export { ButtonGroup }
