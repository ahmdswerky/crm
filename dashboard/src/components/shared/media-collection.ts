import { useCallback, useEffect, useRef, useState } from "react"
import type { components as MediaComponents } from "@/api/generated/Media"
import { API_BASE_URL, apiFetch, apiJson, readApiError } from "@/api/client"

export type ManagedMedia = MediaComponents["schemas"]["Media"]
export type MediaOwnerType = MediaComponents["schemas"]["OwnerType"]

type MediaCollectionResponse = { data: ManagedMedia[] }

type MediaUploadOptions = {
  ownerType: MediaOwnerType
  ownerId: number
  collection: string
  files: File[]
}

type MediaCollectionOptions = {
  ownerType: MediaOwnerType
  ownerId: number
  collection: string
  onChange?: (media: ManagedMedia[]) => void
}

const mediaEndpoint = `${API_BASE_URL}/v1/media`

const ordered = (media: ManagedMedia[]) => [...media].sort((left, right) => left.order - right.order)

export async function uploadMediaFiles({ ownerType, ownerId, collection, files }: MediaUploadOptions) {
  if (!files.length) return []
  if (files.length > 10) throw new Error("You can upload up to 10 images at a time.")

  const body = new FormData()
  body.set("owner_type", ownerType)
  body.set("owner_id", String(ownerId))
  body.set("collection", collection)
  files.forEach((file) => body.append("files[]", file))

  const response = await apiJson<MediaCollectionResponse>(mediaEndpoint, {
    method: "POST",
    body,
    headers: {
      Authorization: String(localStorage.getItem('crm-dashboard-token'))
    }
  })

  return ordered(response.data)
}

export function useMediaCollection({ ownerType, ownerId, collection, onChange }: MediaCollectionOptions) {
  const [media, setMedia] = useState<ManagedMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const replaceMedia = useCallback((next: ManagedMedia[]) => {
    const nextMedia = ordered(next)
    setMedia(nextMedia)
    onChangeRef.current?.(nextMedia)
  }, [])

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        owner_type: ownerType,
        owner_id: String(ownerId),
        collection,
      })
      const response = await apiJson<MediaCollectionResponse>(`${mediaEndpoint}?${params}`, { signal })
      const nextMedia = ordered(response.data)
      replaceMedia(nextMedia)
      return nextMedia
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) {
        setError(caught instanceof Error ? caught.message : "Unable to load media.")
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [collection, ownerId, ownerType, replaceMedia])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const upload = useCallback(async (files: File[]) => {
    if (!files.length) return

    setBusy(true)
    setError("")
    try {
      await uploadMediaFiles({ ownerType, ownerId, collection, files })
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload media.")
      throw caught
    } finally {
      setBusy(false)
    }
  }, [collection, ownerId, ownerType, refresh])

  const remove = useCallback(async (id: number) => {
    setBusy(true)
    setError("")
    try {
      const response = await apiFetch(`${mediaEndpoint}/${id}`, { method: "DELETE" })
      if (!response.ok) throw await readApiError(response)
      replaceMedia(media.filter((item) => item.id !== id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete media.")
      throw caught
    } finally {
      setBusy(false)
    }
  }, [media, replaceMedia])

  const reorder = useCallback(async (ids: number[]) => {
    setBusy(true)
    setError("")
    try {
      const response = await apiJson<MediaCollectionResponse>(`${mediaEndpoint}/reorder`, {
        method: "POST",
        body: JSON.stringify({
          owner_type: ownerType,
          owner_id: ownerId,
          collection,
          media_ids: ids,
        }),
      })
      replaceMedia(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reorder media.")
      throw caught
    } finally {
      setBusy(false)
    }
  }, [collection, ownerId, ownerType, replaceMedia])

  return { media, loading, busy, error, refresh, upload, remove, reorder }
}
