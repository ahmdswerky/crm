import createClient from "openapi-fetch"
import { tokenStore } from "./token-store"

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api"

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = tokenStore.get()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  headers.set("Accept", "application/json")
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(input, { ...init, headers })
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function readApiError(response: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await response.clone().json()
  } catch {
    body = undefined
  }

  if (typeof body === "object" && body !== null) {
    const record = body as { message?: unknown; errors?: unknown }
    const fields = typeof record.errors === "object" && record.errors !== null
      ? Object.fromEntries(Object.entries(record.errors).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.map(String) : [String(value)],
      ]))
      : {}
    return new ApiError(
      typeof record.message === "string" ? record.message : `Request failed (${response.status})`,
      response.status,
      fields,
    )
  }

  return new ApiError(`Request failed (${response.status})`, response.status)
}

export async function apiJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(input, init)
  if (!response.ok) throw await readApiError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const apiClient = createClient({ baseUrl: API_BASE_URL, fetch: apiFetch })
