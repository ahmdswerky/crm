export function listUrl(endpoint: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).length > 0) query.set(key, String(value))
  })

  const queryString = query.toString()
  return queryString ? `${endpoint}?${queryString}` : endpoint
}
