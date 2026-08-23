import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { API_BASE_URL, ApiError, apiJson } from "@/api/client"
import { uploadMediaFiles } from "@/components/shared/media-collection"
import { SingleMediaField } from "@/components/shared/single-media-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AccountEditor, accountSchema, emptyValues, toPayload, type Account, type AccountEnvelope, type AccountFormValues, unwrapAccount, valuesFromAccount } from "@/pages/accounts/shared"

type AccountDialogProps = {
  open: boolean
  account?: Account | null
  onOpenChange: (open: boolean) => void
  onSaved: (account: Account) => void
}

export function AccountDialog({ open, account, onOpenChange, onSaved }: AccountDialogProps) {
  const [error, setError] = useState("")
  const [stagedFiles, setStagedFiles] = useState<File[]>([])
  const [activeAccount, setActiveAccount] = useState<Account | null>(account ?? null)
  const mediaInitialized = useRef(false)
  const form = useForm<AccountFormValues>({ resolver: zodResolver(accountSchema), defaultValues: emptyValues })
  const editing = Boolean(activeAccount)

  useEffect(() => {
    if (!open) return
    setError("")
    setStagedFiles([])
    mediaInitialized.current = false
    setActiveAccount(account ?? null)
    form.reset(account ? valuesFromAccount(account) : emptyValues)
  }, [account, form, open])

  const submit = form.handleSubmit(async (values) => {
    setError("")
    try {
      const result = activeAccount
        ? await apiJson<AccountEnvelope>(`${API_BASE_URL}/v1/accounts/${activeAccount.id}`, { method: "POST", body: JSON.stringify({ ...toPayload(values), _method: "PUT" }) })
        : await apiJson<AccountEnvelope>(`${API_BASE_URL}/v1/accounts`, { method: "POST", body: JSON.stringify(toPayload(values)) })
      const saved = unwrapAccount(result)
      if (!saved?.id) throw new Error("The account response did not include a usable account record.")

      const media = !activeAccount && stagedFiles.length
        ? await uploadMediaFiles({ ownerType: "account", ownerId: saved.id, collection: "main", files: stagedFiles })
        : []
      const nextAccount = media.length ? { ...saved, image: media[0] } : saved
      onSaved(nextAccount)
      onOpenChange(false)
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof AccountFormValues, { message: messages[0] }))
      setError(caught instanceof Error ? caught.message : `Unable to ${editing ? "save" : "create"} this account.`)
    }
  })

  const mediaField = activeAccount?.id
    ? <SingleMediaField ownerType="account" ownerId={activeAccount.id} collection="main" label="Account logo" disabled={form.formState.isSubmitting} onChange={(media) => {
      const nextAccount = { ...activeAccount, image: media[0] ?? null }
      setActiveAccount(nextAccount)
      if (mediaInitialized.current) onSaved(nextAccount)
      mediaInitialized.current = true
    }} />
    : <SingleMediaField label="Account logo" disabled={form.formState.isSubmitting} onFilesChange={setStagedFiles} />

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!form.formState.isSubmitting) onOpenChange(nextOpen) }}>
    <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md" showCloseButton={!form.formState.isSubmitting}>
      <DialogHeader><DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle></DialogHeader>
      {error && <div role="alert" className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      <AccountEditor create={!editing} form={form} formId="account-dialog-form" hideToolbar saving={form.formState.isSubmitting} onCancel={() => onOpenChange(false)} onSubmit={submit} media={mediaField} />
      <DialogFooter><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" form="account-dialog-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? (editing ? "Saving…" : "Creating…") : editing ? "Save changes" : "Create"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
