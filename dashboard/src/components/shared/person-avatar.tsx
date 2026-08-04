import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

export function PersonAvatar({ name, size = "sm", className }: { name: string; size?: "default" | "sm" | "lg"; className?: string }) {
  return <Avatar size={size} className={cn("bg-primary/10", className)} aria-label={`${name} avatar`}><AvatarFallback className="bg-primary/10 text-primary">{initialsFor(name)}</AvatarFallback></Avatar>
}
