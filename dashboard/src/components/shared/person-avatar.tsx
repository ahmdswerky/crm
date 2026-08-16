import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type PersonAvatarMedia = { url?: string | null; thumbnail_url?: string | null }

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

export function PersonAvatar({ name, avatar, size = "sm", className }: { name: string; avatar?: PersonAvatarMedia | null; size?: "default" | "sm" | "lg"; className?: string }) {
  const imageUrl = avatar?.thumbnail_url || avatar?.url

  return <Avatar size={size} className={cn("bg-primary/10", className)} aria-label={`${name} avatar`}>{imageUrl && <AvatarImage src={imageUrl} alt="" />}<AvatarFallback className="bg-primary/10 text-primary">{initialsFor(name)}</AvatarFallback></Avatar>
}
