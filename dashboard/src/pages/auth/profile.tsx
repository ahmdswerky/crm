import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AtSign, Check, Copy, Eye, ExternalLink, KeyRound, LoaderCircle, Mail, Save, UserRound } from "lucide-react"
import { z } from "zod"
import { toast } from "sonner"
import type { User } from "@/api/contracts"
import type { paths as AuthPaths } from "@/api/generated/Auth"
import { API_BASE_URL, ApiError, apiJson } from "@/api/client"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { PhoneField } from "@/components/shared/phone-field"
import { SingleMediaField } from "@/components/shared/single-media-field"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

type ProfileFormValues = {
  name: string
  username: string
  email: string
  phone: string
}

type UserEnvelope = { user: User }
type SecureTokenEnvelope = AuthPaths["/secure-token"]["get"]["responses"][200]["content"]["application/json"]
type SecureTokenLinks = Pick<SecureTokenEnvelope, "horizon" | "telescope">

const profileSchema = z.object({
  name: z.string().trim().min(4, "Use at least 4 characters."),
  username: z.string().trim().min(4, "Use at least 4 characters."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().min(1, "Enter a phone number."),
})

function valuesFromUser(user: User): ProfileFormValues {
  return {
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
  }
}

export function ProfilePage() {
  const { refresh, can, isSuper } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [secureToken, setSecureToken] = useState("")
  const [tokenLinks, setTokenLinks] = useState<SecureTokenLinks | null>(null)
  const [secureTokenError, setSecureTokenError] = useState("")
  const [generatingToken, setGeneratingToken] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", username: "", email: "", phone: "" },
  })
  const { register, setValue, watch, formState: { errors, isDirty, dirtyFields } } = form

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const body = await apiJson<UserEnvelope>(`${API_BASE_URL}/user`, { signal })
      setProfile(body.user)
      form.reset(valuesFromUser(body.user))
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(caught instanceof Error ? caught.message : "Unable to load your profile.")
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [form])

  useEffect(() => {
    const controller = new AbortController()
    void loadProfile(controller.signal)
    return () => controller.abort()
  }, [loadProfile])

  const submit = form.handleSubmit(async (values) => {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const dirtyValues = Object.fromEntries(
        (Object.keys(values) as Array<keyof ProfileFormValues>)
          .filter((field) => dirtyFields[field])
          .map((field) => [field, values[field]]),
      ) as Partial<ProfileFormValues>
      const body = await apiJson<UserEnvelope>(`${API_BASE_URL}/user`, {
        method: "PUT",
        body: JSON.stringify(dirtyValues),
      })
      setProfile(body.user)
      form.reset(valuesFromUser(body.user))
      setSaved(true)
      await refresh()
    } catch (caught) {
      if (caught instanceof ApiError) {
        Object.entries(caught.fields).forEach(([field, messages]) => {
          form.setError(field as keyof ProfileFormValues, { message: messages[0] })
        })
      }
      setError(caught instanceof Error ? caught.message : "Unable to save your profile.")
    } finally {
      setSaving(false)
    }
  })

  async function generateSecureToken() {
    setGeneratingToken(true)
    setSecureTokenError("")
    setCopiedToken(false)
    setRevealed(false)
    try {
      const body = await apiJson<SecureTokenEnvelope>(`${API_BASE_URL}/secure-token`, {
        cache: "no-store",
      })
      setSecureToken(body.token)
      setTokenLinks(body)
      setRevealed(true)
    } catch (caught) {
      setSecureTokenError(caught instanceof Error ? caught.message : "Unable to generate a secure token.")
    } finally {
      setGeneratingToken(false)
    }
  }

  async function copySecureToken() {
    if (!secureToken) return

    try {
      await navigator.clipboard.writeText(secureToken)
      setCopiedToken(true)
      toast.success("Secure token copied to clipboard.")
    } catch {
      setSecureTokenError("Unable to copy the secure token.")
    }
  }

  if (loading) return <ProfileSkeleton />
  if (error && !profile) return <ErrorState kind="unauthorized" title="Unable to load your profile" description={error} actionLabel="Retry" onAction={() => void loadProfile()} />
  if (!profile) return <ErrorState kind="not-found" title="Profile unavailable" description="Your account details could not be found." actionLabel="Return to overview" actionTo="/" />

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 lg:p-8">
      <header className="border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <PersonAvatar name={profile.name} size="lg" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Account</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">Update the details used to identify and contact you.</p>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {saved && <p role="status" className="border border-primary/20 bg-primary/5 p-3 text-sm text-primary">Profile saved.</p>}

      <form onSubmit={submit} className="border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Identity and contact</h2>
          <p className="mt-1 text-sm text-muted-foreground">These details are visible to people working with you in the CRM.</p>
        </div>
        {profile.id !== undefined && <div className="border-b border-border px-5 py-4"><SingleMediaField ownerType="user" ownerId={profile.id} collection="main" label="Profile image" description="Upload or replace the image used for this staff record." disabled={!can("user.edit")} /></div>}
        <FieldGroup className="grid gap-4 p-5 sm:grid-cols-2">
          <ProfileField label="Name" error={errors.name?.message} className="sm:col-span-2">
            <InputGroup><InputGroupAddon><UserRound aria-hidden="true" /></InputGroupAddon><InputGroupInput autoComplete="name" {...register("name")} /></InputGroup>
          </ProfileField>
          <ProfileField label="Username" error={errors.username?.message}>
            <InputGroup><InputGroupAddon><AtSign aria-hidden="true" /></InputGroupAddon><InputGroupInput autoComplete="username" {...register("username")} /></InputGroup>
          </ProfileField>
          <ProfileField label="Phone" error={errors.phone?.message}>
            <PhoneField aria-label="Phone" aria-invalid={Boolean(errors.phone)} autoComplete="tel" value={watch("phone")} onValueChange={(value) => setValue("phone", value, { shouldDirty: true, shouldValidate: true })} />
          </ProfileField>
          <ProfileField label="Email" error={errors.email?.message} className="sm:col-span-2">
            <InputGroup><InputGroupAddon><Mail aria-hidden="true" /></InputGroupAddon><InputGroupInput type="email" autoComplete="email" {...register("email")} /></InputGroup>
          </ProfileField>
        </FieldGroup>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <p className="text-xs text-muted-foreground">Password changes are managed separately.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={saving || !isDirty} onClick={() => form.reset(valuesFromUser(profile))}>Reset</Button>
            <Button type="submit" disabled={saving || !isDirty}>{saving ? "Saving…" : <><Save className="me-2 size-3.5" />Save profile</>}</Button>
          </div>
        </div>
      </form>

      {isSuper && profile.can_generate_secure_token === true && (
        <section className="border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />Generate Secure Token</h2>
          </div>
          <div className="relative">
            <div
              data-testid="secure-token-card-body"
              className={`p-5 transition-[filter] duration-500 ease-out motion-reduce:transition-none${revealed ? "" : " blur-[1.5px]"}`}
              role={!secureToken ? "button" : undefined}
              tabIndex={!secureToken ? 0 : undefined}
              aria-label={!secureToken ? "Generate secure token" : undefined}
              aria-busy={generatingToken}
              onClick={() => {
                if (!secureToken && !generatingToken) void generateSecureToken()
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !secureToken && !generatingToken) {
                  event.preventDefault()
                  void generateSecureToken()
                }
              }}
            >
              <ProfileField inputId="secure-token" label="Secure token" hideLabel error={secureTokenError}>
                <InputGroup>
                  <InputGroupInput
                    id="secure-token"
                    type="text"
                    autoComplete="off"
                    aria-label="Secure token"
                    onClick={() => {
                      if (secureToken && revealed) void copySecureToken()
                    }}
                    placeholder="**********"
                    readOnly
                    value={secureToken}
                  />
                  {secureToken && !generatingToken && (
                    <InputGroupButton type="button" variant="ghost" size="icon-sm" aria-label={copiedToken ? "Secure token copied" : "Copy secure token"} onClick={() => void copySecureToken()}>
                      {copiedToken ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    </InputGroupButton>
                  )}
                </InputGroup>
              </ProfileField>
              <p role="status" className="sr-only">{secureToken ? "Secure token generated." : ""}</p>
              {secureToken && tokenLinks && (
                <div className="grid w-full gap-3 mt-5 sm:grid-cols-2">
                  <SecureToolLink href={tokenLinks.horizon} label="Horizon" />
                  <SecureToolLink href={tokenLinks.telescope} label="Telescope" />
                </div>
              )}
            </div>
            {!revealed && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="pointer-events-auto bg-white text-foreground shadow-sm hover:bg-white/90 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
                  disabled={generatingToken}
                  onClick={() => void generateSecureToken()}
                >
                  {generatingToken ? <><LoaderCircle className="me-2 size-3.5 animate-spin" aria-hidden="true" />Loading…</> : <><Eye className="me-2 size-3.5" aria-hidden="true" />Reveal</>}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function SecureToolLink({ href, label }: { href: string; label: string }) {
  return <Item variant="outline" size="sm" asChild>
    <a href={href} target="_blank" rel="noreferrer">
      <ItemMedia><ExternalLink className="size-5" aria-hidden="true" /></ItemMedia>
      <ItemContent><ItemTitle>{label}</ItemTitle></ItemContent>
      <ItemActions><ExternalLink className="size-4" aria-hidden="true" /></ItemActions>
    </a>
  </Item>
}

function ProfileField({ label, error, inputId, hideLabel = false, className, children }: { label: string; error?: string; inputId?: string; hideLabel?: boolean; className?: string; children: React.ReactNode }) {
  return <Field className={className}>{!hideLabel && <FieldLabel htmlFor={inputId}>{label}</FieldLabel>}{children}<FieldError>{error}</FieldError></Field>
}

function ProfileSkeleton() {
  return <div className="mx-auto w-full max-w-3xl space-y-6 p-6 lg:p-8"><div className="flex items-center gap-3 border-b border-border pb-6"><Skeleton className="size-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-7 w-28" /></div></div><section className="border border-border bg-card"><div className="space-y-2 border-b border-border p-5"><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-80" /></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Skeleton className="h-16 sm:col-span-2" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16 sm:col-span-2" /></div></section></div>
}
