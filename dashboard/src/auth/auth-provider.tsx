import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { apiJson, apiFetch, API_BASE_URL } from "@/api/client"
import type { User } from "@/api/contracts"
import { tokenStore } from "@/api/token-store"

type AuthContextValue = {
  user: User | null
  loading: boolean
  error: string | null
  isSuper: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<User | null>
  can: (permission: string) => boolean
}

const Context = createContext<AuthContextValue | null>(null)

function unwrapUser(body: { user?: User } | User): User {
  return "user" in body && body.user ? body.user : body as User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.get()))
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const token = tokenStore.get()
    if (!token) {
      setUser(null)
      setLoading(false)
      return null
    }

    setLoading(true)
    setError(null)
    try {
      const body = await apiJson<{ user: User }>(`${API_BASE_URL}/user`)
      const nextUser = unwrapUser(body)
      setUser(nextUser)
      return nextUser
    } catch (caught) {
      if (caught instanceof Error && "status" in caught && (caught as { status?: number }).status === 401) {
        tokenStore.clear()
        setUser(null)
      } else {
        setError(caught instanceof Error ? caught.message : "Unable to verify the session.")
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    isSuper: user?.is_super === true,
    async login(username, password) {
      const body = new FormData()
      body.set("username", username)
      body.set("password", password)
      const result = await apiJson<{ user: User; token: string }>(`${API_BASE_URL}/login`, {
        method: "POST",
        body,
      })
      tokenStore.set(result.token)
      setUser(result.user)
      setError(null)
      setLoading(false)
    },
    async logout() {
      try {
        await apiFetch(`${API_BASE_URL}/logout`, { method: "DELETE" })
      } finally {
        tokenStore.clear()
        setUser(null)
      }
    },
    refresh,
    can(permission) {
      if (user?.is_super === true) return true
      return Boolean(user?.permissions?.some((item) => item.name === permission))
    },
  }), [error, loading, refresh, user])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useAuth() {
  const context = useContext(Context)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
