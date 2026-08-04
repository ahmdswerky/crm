import { FormEvent, useState } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/auth/auth-provider"

export function LoginPage() {
  const { user, login } = useAuth(); const navigate = useNavigate(); const location = useLocation()
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? "/"} replace />
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { await login(username, password); navigate((location.state as { from?: string } | null)?.from ?? "/", { replace: true }) } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign in.") } finally { setBusy(false) } }
  return <main className="grid min-h-svh place-items-center bg-muted/30 p-6"><form onSubmit={submit} className="w-full max-w-sm border border-border bg-card p-8"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">CRM / Access</p><h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in</h1><p className="mt-2 text-sm text-muted-foreground">Use your CRM staff account to continue.</p><div className="mt-8 space-y-4"><div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>{error && <p className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button></div></form></main>
}
