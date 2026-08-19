import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { API_BASE_URL, apiJson, ApiError } from "@/api/client"
import type { Paginated } from "@/api/contracts"
import { useAuth } from "@/auth/auth-provider"
import { ErrorState } from "@/components/shared/error-state"
import { Button } from "@/components/ui/button"
import {
  applyPropertyToDealForm,
  authenticatedCommissionRate,
  DealEnvelope,
  DealForm,
  DealRelationOptions,
  DealRelationOptionsContext,
  dealSchema,
  emptyValues,
  loadDealPropertyOptions,
  normalizeDealProperty,
  prioritizeDealProperty,
  toPayload,
  valuesFromDeal,
  type Deal,
  type DealFormValues,
  type DealPropertyOption,
  type User,
} from "./shared"

export function DealCreatePage() {
  return <DealEditorPage />
}

function DealEditorPage() {
  const { can, isSuper, user } = useAuth()
  const navigate = useNavigate()
  const { dealId } = useParams()
  const [searchParams] = useSearchParams()
  const id = Number(dealId)
  const editing = dealId !== undefined
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loadingDeal, setLoadingDeal] = useState(editing)
  const [dealError, setDealError] = useState<ApiError | null>(null)
  const [relationOptions, setRelationOptions] = useState<DealRelationOptions>({ contacts: [], properties: [], propertiesLoading: false, propertiesLoadingMore: false, propertiesHasMore: false, agents: [], agentsLoading: false })
  const [propertySearch, setPropertySearch] = useState("")
  const [propertyPage, setPropertyPage] = useState(1)
  const [propertyLastPage, setPropertyLastPage] = useState(1)
  const [editorError, setEditorError] = useState("")
  const form = useForm<DealFormValues>({ resolver: zodResolver(dealSchema), defaultValues: emptyValues })
  const returnQuery = searchParams.get("return")
  const propertyQuery = editing ? null : searchParams.get("property")
  const backToIndex = returnQuery ? `/deals?${returnQuery}` : "/deals"
  const commissionRate = authenticatedCommissionRate(user)
  const agentUserId = user?.roles?.some((role) => role.name === "agent") ? user.id : undefined

  const loadEditDeal = useCallback(async (signal?: AbortSignal) => {
    if (!editing || !Number.isInteger(id) || id < 1) return
    setLoadingDeal(true)
    setDealError(null)
    try {
      const body = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals/${id}`, { signal })
      setDeal(body.deal)
      form.reset(valuesFromDeal(body.deal))
      setRelationOptions({
        contacts: [body.deal.contact],
        properties: [body.deal.property],
        propertiesLoading: false,
        propertiesLoadingMore: false,
        propertiesHasMore: false,
        agents: body.deal.agent?.id === undefined ? [] : [{ id: body.deal.agent.id, name: body.deal.agent.name, username: body.deal.agent.username }],
        agentsLoading: false,
      })
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === "AbortError")) setDealError(caught instanceof ApiError ? caught : new ApiError(caught instanceof Error ? caught.message : "Unable to load this deal.", 0))
    } finally {
      if (!signal?.aborted) setLoadingDeal(false)
    }
  }, [editing, form, id])

  useEffect(() => {
    if (!editing || !can("deal.view")) {
      if (!editing) setLoadingDeal(false)
      return
    }
    const controller = new AbortController()
    void loadEditDeal(controller.signal)
    return () => controller.abort()
  }, [can, editing, loadEditDeal])

  const searchProperties = useCallback((query: string) => { setPropertySearch(query); setPropertyPage(1); setPropertyLastPage(1) }, [])
  const loadMoreProperties = useCallback(() => { setPropertyPage((current) => current < propertyLastPage ? current + 1 : current) }, [propertyLastPage])

  useEffect(() => {
    if (editing || !can("deal.view")) return
    const controller = new AbortController()
    if (propertyPage === 1) setEditorError("")
    setRelationOptions((current) => ({ ...current, agentsLoading: propertyPage === 1 && can("user.view"), propertiesLoading: propertyPage === 1, propertiesLoadingMore: propertyPage > 1 }))
    const usersRequest = propertyPage === 1 && can("user.view") ? apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users`, { signal: controller.signal }) : Promise.resolve(null)
    const propertiesRequest = loadDealPropertyOptions(propertySearch, propertyPage, controller.signal)
    void Promise.all([usersRequest, propertiesRequest])
      .then(([users, propertyPageBody]) => {
        const userAgents = users?.data.filter((item): item is User & { id: number } => item.id !== undefined).map((item) => ({ id: item.id, name: item.name, username: item.username })) ?? []
        const relationProperties = propertyPageBody.options.map((option) => normalizeDealProperty(option.data)).filter((property): property is DealPropertyOption => property !== undefined)
        const urlPropertyId = Number(propertyQuery) || undefined
        const selectedProperty = !editing && relationProperties.find((property) => property.id === urlPropertyId)
        if (selectedProperty && form.getValues("property_id") !== String(selectedProperty.id)) applyPropertyToDealForm(form, selectedProperty)
        setPropertyLastPage(propertyPageBody.lastPage)
        setRelationOptions((current) => {
          const pageProperties = propertyPageBody.currentPage === 1
            ? relationProperties
            : Array.from(new Map([...current.properties, ...relationProperties].map((property) => [property.id, property])).values())
          const selectedFromCurrent = urlPropertyId === undefined ? undefined : current.properties.find((property) => property.id === urlPropertyId)
          const propertiesWithUrlSelection = selectedFromCurrent && !pageProperties.some((property) => property.id === urlPropertyId) ? [selectedFromCurrent, ...pageProperties] : pageProperties
          return { ...current, contacts: [], properties: prioritizeDealProperty(propertiesWithUrlSelection, urlPropertyId), propertiesLoading: false, propertiesLoadingMore: false, propertiesHasMore: propertyPageBody.currentPage < propertyPageBody.lastPage, agents: users ? userAgents : current.agents, agentsLoading: false }
        })
      })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setEditorError(caught instanceof Error ? caught.message : "Unable to load deal options.") })
      .finally(() => { if (!controller.signal.aborted) setRelationOptions((current) => ({ ...current, agentsLoading: false, propertiesLoading: false, propertiesLoadingMore: false })) })
    return () => controller.abort()
  }, [can, editing, form, propertyPage, propertyQuery, propertySearch])

  useEffect(() => {
    if (!editing || !can("user.view")) return
    const controller = new AbortController()
    setRelationOptions((current) => ({ ...current, agentsLoading: true }))
    void apiJson<Paginated<User>>(`${API_BASE_URL}/v1/users`, { signal: controller.signal })
      .then((users) => {
        const userAgents = users.data.filter((item): item is User & { id: number } => item.id !== undefined).map((item) => ({ id: item.id, name: item.name, username: item.username }))
        setRelationOptions((current) => ({ ...current, agents: Array.from(new Map([...current.agents, ...userAgents].map((agent) => [agent.id, agent])).values()), agentsLoading: false }))
      })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setEditorError(caught instanceof Error ? caught.message : "Unable to load deal options.") })
      .finally(() => { if (!controller.signal.aborted) setRelationOptions((current) => ({ ...current, agentsLoading: false })) })
    return () => controller.abort()
  }, [can, editing])

  useEffect(() => {
    if (editing || !propertyQuery) return
    const propertyId = Number(propertyQuery)
    if (!Number.isInteger(propertyId) || propertyId < 1) return
    const controller = new AbortController()
    void apiJson<{ property: unknown }>(`${API_BASE_URL}/v1/properties/${propertyId}`, { signal: controller.signal })
      .then((body) => {
        const loadedProperty = normalizeDealProperty(body.property)
        if (!loadedProperty) return
        setRelationOptions((current) => ({ ...current, properties: prioritizeDealProperty(Array.from(new Map([...current.properties, loadedProperty].map((item) => [item.id, item])).values()), propertyId) }))
        applyPropertyToDealForm(form, loadedProperty)
      })
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setEditorError(caught instanceof Error ? caught.message : "Unable to load the selected property.") })
    return () => controller.abort()
  }, [editing, form, propertyQuery])

  const submitCreate = form.handleSubmit(async (values) => {
    setEditorError("")
    try {
      const result = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals`, { method: "POST", body: JSON.stringify(toPayload(values, false)) })
      if (!result.deal.id) { navigate(backToIndex, { replace: true }); return }
      const detailsParams = returnQuery ? new URLSearchParams({ return: returnQuery }) : undefined
      navigate(`/deals/${result.deal.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof DealFormValues, { message: messages[0] }))
      setEditorError(caught instanceof Error ? caught.message : "Unable to create this deal.")
    }
  })

  const submitEdit = form.handleSubmit(async (values) => {
    if (!deal?.id) return
    setEditorError("")
    try {
      const result = await apiJson<DealEnvelope>(`${API_BASE_URL}/v1/deals/${deal.id}`, { method: "POST", body: JSON.stringify({ ...toPayload(values, true), _method: "PUT" }) })
      const detailsParams = returnQuery ? new URLSearchParams({ return: returnQuery }) : undefined
      navigate(`/deals/${result.deal.id ?? deal.id}${detailsParams ? `?${detailsParams}` : ""}`, { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) Object.entries(caught.fields).forEach(([field, messages]) => form.setError(field as keyof DealFormValues, { message: messages[0] }))
      setEditorError(caught instanceof Error ? caught.message : "Unable to save this deal.")
    }
  })

  if (!can("deal.view")) return <ErrorState kind="forbidden" title="Deals are restricted" description="You do not have permission to view deals." actionLabel="Return to overview" actionTo="/" />
  if (!editing && !can("deal.create")) return <ErrorState kind="forbidden" title="Deal creation is restricted" description="You do not have permission to create deals." actionLabel="Return to deals" actionTo="/deals" />
  if (editing && (!Number.isInteger(id) || id < 1)) return <ErrorState kind="not-found" title="Deal not found" description="The deal identifier is invalid." actionLabel="Return to deals" actionTo="/deals" />
  if (editing && loadingDeal) return <div className="grid min-h-96 place-items-center p-6 text-sm text-muted-foreground" role="status">Loading deal…</div>
  if (editing && (dealError || !deal)) return <ErrorState kind={dealError?.status === 403 ? "forbidden" : "not-found"} title={dealError?.status === 403 ? "Deal editing is restricted" : dealError?.status === 404 ? "Deal not found" : "Unable to open deal"} description={dealError?.message || "This deal is no longer available."} actionLabel="Return to deals" actionTo={backToIndex} />

  const canEdit = Boolean(deal && (isSuper || can("deal.update") || user?.id === deal.agent_id))
  if (editing && !canEdit) return <ErrorState kind="forbidden" title="Deal editing is restricted" description="You do not have permission to edit this deal." actionLabel="Return to deals" actionTo={backToIndex} />

  const formId = editing ? "deal-edit-form" : "deal-create-form"
  const saving = form.formState.isSubmitting
  return <DealRelationOptionsContext.Provider value={{ ...relationOptions, onPropertySearch: editing ? undefined : searchProperties, onLoadMoreProperties: editing ? undefined : loadMoreProperties }}><div className="space-y-6 p-6 pb-24 lg:p-8"><header className="border-b border-border pb-6"><Button asChild variant="ghost" size="sm" className="-ms-2"><Link to={backToIndex}><ArrowLeft className="me-2 size-3.5" />Back to deals</Link></Button><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="mt-2 text-2xl font-semibold tracking-tight">{editing ? "Edit deal" : "New deal"}</h1></div><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => navigate(backToIndex)}>Cancel</Button><Button type="submit" form={formId} size="sm" disabled={saving}>{saving ? editing ? "Saving…" : "Creating…" : editing ? "Save changes" : "Create"}</Button></div></div></header>{editorError && <div role="alert" className="border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{editorError}</div>}<section className="w-full"><DealForm editing={editing} formId={formId} form={form} commissionRate={commissionRate} agentUserId={agentUserId} urlPropertyId={editing ? deal?.property.id : Number(propertyQuery) || undefined} onSubmit={editing ? submitEdit : submitCreate} /></section></div></DealRelationOptionsContext.Provider>
}
