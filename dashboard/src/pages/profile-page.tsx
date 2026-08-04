import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AtSign, Mail, Phone, Save, UserRound } from "lucide-react"
import { z } from "zod"
import type { User } from "@/api/contracts"
import { API_BASE_URL, ApiError, apiJson } from "@/api/client"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { PersonAvatar } from "@/components/shared/person-avatar"
import { SingleMediaField } from "@/components/shared/single-media-field"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"

type ProfileFormValues = {
  name: string
  username: string
  email: string
  phone: string
}

type UserEnvelope = { user: User }

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
  const { refresh, can } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", username: "", email: "", phone: "" },
  })
  const { register, formState: { errors, isDirty, dirtyFields } } = form

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
        <FieldGroup className="grid gap-4 p-5 sm:grid-cols-2">
          <ProfileField label="Name" error={errors.name?.message} className="sm:col-span-2">
            <InputGroup><InputGroupAddon><UserRound aria-hidden="true" /></InputGroupAddon><InputGroupInput autoComplete="name" {...register("name")} /></InputGroup>
          </ProfileField>
          <ProfileField label="Username" error={errors.username?.message}>
            <InputGroup><InputGroupAddon><AtSign aria-hidden="true" /></InputGroupAddon><InputGroupInput autoComplete="username" {...register("username")} /></InputGroup>
          </ProfileField>
          <ProfileField label="Phone" error={errors.phone?.message}>
            <InputGroup><InputGroupAddon><Phone aria-hidden="true" /></InputGroupAddon><InputGroupInput type="tel" autoComplete="tel" {...register("phone")} /></InputGroup>
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

      {profile.id !== undefined && <SingleMediaField ownerType="user" ownerId={profile.id} collection="main" label="Profile image" description="Upload or replace the image used for this staff record." disabled={!can("user.edit")} />}
    </div>
  )
}

function ProfileField({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return <Field className={className}><FieldLabel>{label}</FieldLabel>{children}<FieldError>{error}</FieldError></Field>
}

function ProfileSkeleton() {
  return <div className="mx-auto w-full max-w-3xl space-y-6 p-6 lg:p-8"><div className="flex items-center gap-3 border-b border-border pb-6"><Skeleton className="size-10 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-7 w-28" /></div></div><section className="border border-border bg-card"><div className="space-y-2 border-b border-border p-5"><Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-80" /></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Skeleton className="h-16 sm:col-span-2" /><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16 sm:col-span-2" /></div></section></div>
}
