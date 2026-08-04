import type { components as AuthComponents } from "@/api/generated/Auth"

export type User = AuthComponents["schemas"]["User"]
export type Role = AuthComponents["schemas"]["Role"]
export type Permission = AuthComponents["schemas"]["Permission"]
export type PaginationMeta = AuthComponents["schemas"]["PaginationMeta"]
export type PaginationLinks = AuthComponents["schemas"]["PaginationLinks"]

export type Paginated<T> = {
  data: T[]
  links: PaginationLinks
  meta: PaginationMeta
}

export type UserEnvelope = { user: User }
export type RoleEnvelope = { role: Role }

export type UserStorePayload = {
  user: {
    name: string
    username: string
    email: string
    phone: string
    password: string
    roles?: string[]
  }
}

export type UserUpdatePayload = {
  user: {
    _method: "PUT"
    name: string
    username: string
    email: string
    phone: string
    roles?: string[]
  }
}
