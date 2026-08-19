import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { createPortal } from "react-dom"
import { createContext, useContext, useMemo, useState, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type KanbanContextValue = {
  activeId: string | null
  activeWidth: number | null
  sourceContainer: string | null
  sourceIndex: number | null
  overContainer: string | null
  overIndex: number | null
  getItemValue: (item: unknown) => string
  columns: Record<string, unknown[]>
}

const KanbanContext = createContext<KanbanContextValue>({
  activeId: null,
  activeWidth: null,
  sourceContainer: null,
  sourceIndex: null,
  overContainer: null,
  overIndex: null,
  getItemValue: () => "",
  columns: {},
})
const OverlayContext = createContext(false)

export type KanbanMoveEvent = {
  event: DragEndEvent
  activeContainer: string
  activeIndex: number
  overContainer: string
  overIndex: number
}

export function Kanban<T>({
  value,
  onValueChange: _onValueChange,
  getItemValue,
  onMove,
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "onDragEnd"> & {
  value: Record<string, T[]>
  onValueChange: (value: Record<string, T[]>) => void
  getItemValue: (item: T) => string
  onMove?: (event: KanbanMoveEvent) => void
  children: ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeWidth, setActiveWidth] = useState<number | null>(null)
  const [sourceContainer, setSourceContainer] = useState<string | null>(null)
  const [sourceIndex, setSourceIndex] = useState<number | null>(null)
  const [overContainer, setOverContainer] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const contextValue = useMemo<KanbanContextValue>(() => ({
    activeId,
    activeWidth,
    sourceContainer,
    sourceIndex,
    overContainer,
    overIndex,
    columns: value as Record<string, unknown[]>,
    getItemValue: (item) => getItemValue(item as T),
  }), [activeId, activeWidth, getItemValue, overContainer, overIndex, sourceContainer, sourceIndex, value])

  function handleDragStart(event: DragStartEvent) {
    const itemId = String(event.active.id)
    const source = Object.keys(value).find((column) => value[column].some((item) => getItemValue(item) === itemId)) ?? null
    const index = source ? value[source].findIndex((item) => getItemValue(item) === itemId) : -1
    setActiveId(itemId)
    setActiveWidth(event.active.rect.current.initial?.width ?? null)
    setSourceContainer(source)
    setSourceIndex(index >= 0 ? index : null)
    setOverContainer(source)
    setOverIndex(index >= 0 ? index : null)
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null
    if (!overId) {
      setOverContainer(sourceContainer)
      setOverIndex(sourceIndex)
      return
    }
    const overColumn = Object.prototype.hasOwnProperty.call(value, overId) ? overId : Object.keys(value).find((column) => value[column].some((item) => getItemValue(item) === overId)) ?? sourceContainer
    const index = overColumn ? (Object.prototype.hasOwnProperty.call(value, overId) ? value[overColumn].length : value[overColumn].findIndex((item) => getItemValue(item) === overId)) : sourceIndex
    setOverContainer(overColumn)
    setOverIndex(index !== null && index >= 0 ? index : sourceIndex)
  }

  function handleDragEnd(event: DragEndEvent) {
    if (onMove) {
      const itemId = String(event.active.id)
      const sourceColumn = Object.keys(value).find((column) => value[column].some((item) => getItemValue(item) === itemId))
      const overId = event.over ? String(event.over.id) : null
      const targetColumn = overId ? (Object.prototype.hasOwnProperty.call(value, overId) ? overId : Object.keys(value).find((column) => value[column].some((item) => getItemValue(item) === overId))) : overContainer
      if (sourceColumn && sourceIndex !== null && targetColumn && sourceColumn !== targetColumn) {
        onMove({ event, activeContainer: sourceColumn, activeIndex: sourceIndex, overContainer: targetColumn, overIndex: overIndex ?? value[targetColumn].length })
      }
    }
    setActiveId(null)
    setActiveWidth(null)
    setSourceContainer(null)
    setSourceIndex(null)
    setOverContainer(null)
    setOverIndex(null)
  }

  return <KanbanContext.Provider value={contextValue}><DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={() => { setActiveId(null); setActiveWidth(null); setSourceContainer(null); setSourceIndex(null); setOverContainer(null); setOverIndex(null) }}><div data-slot="kanban" className={cn(activeId && "cursor-grabbing", className)} {...props}>{children}</div></DndContext></KanbanContext.Provider>
}

export function KanbanBoard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="kanban-board" className={cn("grid gap-5 lg:grid-cols-4", className)} {...props} />
}

export function KanbanColumn({ value, children, className, ...props }: HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: value })
  return <section ref={setNodeRef} data-slot="kanban-column" data-value={value} data-over={isOver || undefined} className={cn("relative min-w-0 rounded-xl bg-muted/55 shadow-sm transition-colors data-[over=true]:bg-primary/10", className)} {...props}>{children}</section>
}

export function KanbanColumnContent({ className, ...props }: HTMLAttributes<HTMLDivElement> & { value: string }) {
  return <div data-slot="kanban-column-content" className={cn("flex min-h-32 flex-col gap-4 p-3", className)} {...props} />
}

export function KanbanItem({ value, children, className, disabled = false, placeholder, style, ...props }: HTMLAttributes<HTMLDivElement> & { value: string; disabled?: boolean; placeholder?: ReactNode }) {
  const isOverlay = useContext(OverlayContext)
  const { attributes, listeners, setNodeRef: setDraggableRef, transform, isDragging } = useDraggable({ id: value, disabled: disabled || isOverlay })
  const { setNodeRef: setDroppableRef } = useDroppable({ id: value, disabled: disabled || isOverlay })
  const setNodeRef = (node: HTMLElement | null) => { setDraggableRef(node); setDroppableRef(node) }
  return <div ref={setNodeRef} data-slot="kanban-item" data-value={value} data-dragging={isDragging || undefined} style={{ transform: isDragging ? undefined : CSS.Translate.toString(transform), ...style }} className={cn(className)} {...attributes} {...listeners} {...props}>{isDragging && !isOverlay && placeholder ? placeholder : children}</div>
}

export function KanbanItemHandle({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("cursor-grab active:cursor-grabbing", className)} {...props}>{children}</div>
}

export function KanbanOverlay({ children, className, ...props }: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { children: (params: { value: string; width: number | null }) => ReactNode }) {
  const { activeId, activeWidth } = useContext(KanbanContext)
  if (!activeId || typeof document === "undefined") return null
  return createPortal(<DragOverlay adjustScale={false} className={cn("z-50", className)} {...props}><OverlayContext.Provider value>{children({ value: activeId, width: activeWidth })}</OverlayContext.Provider></DragOverlay>, document.body)
}

export function KanbanDropPlaceholder({ value, index, children }: { value: string; index: number; children: ReactNode }) {
  const { activeId, overContainer, sourceContainer, overIndex } = useContext(KanbanContext)
  if (!activeId || overContainer !== value || sourceContainer === value || overIndex !== index) return null
  return <div data-slot="kanban-drop-placeholder">{children}</div>
}
