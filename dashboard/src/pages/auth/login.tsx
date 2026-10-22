import { FormEvent, useEffect, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { BriefcaseBusiness, Info, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DocLinks } from "@/components/shared/doc-links"
import { version } from "../../../package.json"
import { useAuth } from "@/auth/auth-provider"
import { apiJson, API_BASE_URL } from "@/api/client"
import type { LoginUser } from "@/api/contracts"

function roleLabel(account: LoginUser) {
  if (account.is_super) return "Super admin"
  if (!account.role) return "Standard"
  return account.role.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function RoleIcon({ account }: { account: LoginUser }) {
  if (account.is_super) return <ShieldCheck className="size-3.5" aria-hidden="true" />
  if (account.role === "manager") return <BriefcaseBusiness className="size-3.5" aria-hidden="true" />
  return <UserRound className="size-3.5" aria-hidden="true" />
}

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [loginUsers, setLoginUsers] = useState<LoginUser[]>([])
  const [loginUsersLoading, setLoginUsersLoading] = useState(true)
  const [loginUsersError, setLoginUsersError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    void apiJson<LoginUser[]>(`${API_BASE_URL}/v1/login-users`, { signal: controller.signal })
      .then(setLoginUsers)
      .catch((caught) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) setLoginUsersError("Unable to load pre-configured accounts.")
      })
      .finally(() => setLoginUsersLoading(false))
    return () => controller.abort()
  }, [])

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/"} replace />

  async function signIn(nextUsername: string, nextPassword: string) {
    setBusy(true)
    setError("")
    try {
      await login(nextUsername, nextPassword)
      navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.")
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    await signIn(username, password)
  }

  async function selectLoginUser(account: LoginUser) {
    setUsername(account.username)
    setPassword("password")
    await signIn(account.username, "password")
  }

  return (
    <main className="relative grid min-h-svh grid-rows-[minmax(4.5rem,1fr)_auto_minmax(4.5rem,1fr)] justify-items-center bg-muted px-6 md:px-10">
      <DocLinks className="absolute end-6 top-6" />
      <div className="relative row-start-2 w-full max-w-sm">
        <img
          src="/logo.png"
          alt="CRM"
          className="absolute -top-9 left-1/2 size-16 -translate-x-1/2 rounded-2xl border border-border bg-card object-cover p-1.5 shadow-sm"
        />
        <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <section className="px-6 pb-6 pt-12 md:px-8 md:pb-8">
            <form onSubmit={submit} className="flex flex-col gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              </div>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" autoComplete="username" placeholder="Your username" value={username} onChange={(event) => setUsername(event.target.value)} required />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Forgot your password?" className="ms-auto text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                        <Info className="size-4" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-56 text-center">
                      Forgot your password? A manager or super admin can set a new one for your account.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <Button className="w-full" disabled={busy}>{busy ? "Logging in…" : "Login"}</Button>
            </div>
            <section className="space-y-2" aria-label="Pre-configured accounts">
              {loginUsersLoading ? (
                <div className="flex flex-wrap gap-2" aria-label="Loading accounts">
                  <div className="h-7 w-20 animate-pulse rounded-full bg-muted-foreground/15" />
                  <div className="h-7 w-24 animate-pulse rounded-full bg-muted-foreground/15" />
                </div>
              ) : loginUsersError ? (
                <p className="text-sm text-destructive" role="alert">{loginUsersError}</p>
              ) : loginUsers.length ? (
                <div className="flex flex-wrap gap-2">
                  {loginUsers.map((account) => (
                    <Tooltip key={account.username}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`${account.username}, ${roleLabel(account)}`}
                          disabled={busy}
                          onClick={() => void selectLoginUser(account)}
                        >
                          <RoleIcon account={account} />
                          <span className="truncate">{account.username}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">{roleLabel(account)}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pre-configured accounts available.</p>
              )}
            </section>
          </form>
          </section>
        </div>
      </div>
      <div className="pointer-events-none row-start-3 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">v{version}</span>
      </div>
    </main>
  )
}
