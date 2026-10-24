import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { addDays, format, parseISO } from "date-fns"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ActivityDialog } from "./activity-form"
import { InteractionTimeline } from "."
import type { Activity } from "./api"

let allowed = true
vi.mock("@/auth/auth-provider", () => ({ useAuth: () => ({ user: { id: 7 }, can: () => allowed }) }))
const links = [{ subject: "deal:2", label: "Deal #2" }, { subject: "contact:3", label: "Amal" }, { subject: "property:4", label: "Villa" }]
const options = { agents: [{ id: 7, name: "Agent" }], suggestions: links, records: [], timezone: "Africa/Cairo" }
const avatar = { id: 31, uuid: "550e8400-e29b-41d4-a716-446655440000", name: "Agent portrait", mime_type: "image/png", size: 1200, url: "https://images.example.test/agent.png", thumbnail_url: "https://images.example.test/agent-thumbnail.png", order: 1, created_at: "2026-10-20T10:20:15Z" }
const activity: Activity = { id: 1, kind: "call", subject: "Original call", details: null, status: "completed", creator_id: 7, assignee_id: 7, assignee_name: "Agent", outcome: "reached", summary: "Original result", version: 3, due_date: null, starts_at: null, ends_at: null, occurred_at: "2026-10-20T10:20:15Z", links, creator: options.agents[0], assignee: options.agents[0], created_at: "2026-10-20T10:20:15Z", updated_at: "2026-10-20T10:20:15Z", can_edit: true, can_reassign: true }
const emptyPage = { data: [], current_page: 1, last_page: 1, total: 0, per_page: 10, next_page_url: null, prev_page_url: null }
function dialog(existing?: Activity) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ActivityDialog subject="deal:2" activity={existing} onClose={vi.fn()} /></QueryClientProvider>)
}
beforeEach(() => {
  allowed = true
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false })
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => undefined })
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined })
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") return Response.json({ data: activity }, { status: 201 })
    return Response.json(String(input).includes("options") ? options : emptyPage)
  }))
})
afterEach(() => vi.unstubAllGlobals())

it("shows agent photos in choices, the selected value and assignment when switching agents", async () => {
  const agents = [{ id: 7, name: "Agent", avatar: null }, { id: 8, name: "Other agent", avatar }]
  vi.mocked(fetch).mockImplementation(async () => Response.json({ ...options, agents }))
  const user = userEvent.setup(); dialog()
  expect(await screen.findByText("Assigned to Agent")).toBeInTheDocument()
  expect(screen.getByLabelText("Agent avatar")).toHaveTextContent("AG")
  await user.click(screen.getByRole("button", { name: "More details" }))
  await user.click(screen.getByRole("combobox", { name: "Responsible agent" }))
  const option = screen.getByRole("option", { name: "Other agent" })
  expect(option.querySelector("img")).toHaveAttribute("src", avatar.thumbnail_url)
  await user.click(option)
  expect(screen.getByText("Assigned to Other agent")).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "Responsible agent" }).querySelector("img")).toHaveAttribute("src", avatar.thumbnail_url)
  for (const person of screen.getAllByLabelText("Other agent avatar")) expect(person.querySelector("img")).toHaveAttribute("src", avatar.thumbnail_url)
})

it("pre-selects the default assignee for new activities", async () => {
  vi.mocked(fetch).mockImplementation(async () => Response.json({ ...options, agents: [{ id: 7, name: "Agent" }, { id: 8, name: "Deal agent" }] }))
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ActivityDialog subject="deal:2" defaultAssigneeId={8} onClose={vi.fn()} /></QueryClientProvider>)
  expect(await screen.findByText("Assigned to Deal agent")).toBeInTheDocument()
})

it("keeps the stored assignee photo when that agent is absent from new assignment choices", async () => {
  dialog({ ...activity, assignee_id: 8, assignee: { id: 8, name: "Previous agent", avatar } })
  expect(await screen.findByText("Assigned to Previous agent")).toBeInTheDocument()
  expect(screen.getByLabelText("Previous agent avatar").querySelector("img")).toHaveAttribute("src", avatar.thumbnail_url)
})

it("uses only independent interaction history and makes no request without permission", async () => {
  const view = render(<InteractionTimeline subject="lead:8" />)
  expect(await screen.findByText("No interactions recorded yet.")).toBeInTheDocument()
  const requests = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => String(url))
  expect(requests.some((url) => url.includes("activity-history") && url.includes("subject=lead%3A8"))).toBe(true)
  expect(requests.some((url) => url.includes("activity-logs"))).toBe(false)
  view.unmount(); (fetch as ReturnType<typeof vi.fn>).mockClear(); allowed = false
  render(<InteractionTimeline subject="lead:8" />)
  expect(fetch).not.toHaveBeenCalled()
})

it("requires an outcome and summary before logging a call", async () => {
  const user = userEvent.setup(); dialog()
  await user.type(await screen.findByRole("textbox", { name: "Subject" }), "Follow up")
  await user.click(screen.getByRole("button", { name: "Save activity" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose an outcome.")
  expect(screen.getByRole("alert")).toHaveTextContent("Add a short result summary.")
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)
})

it("confirms deal suggestions and submits one shared interaction", async () => {
  const user = userEvent.setup(); dialog()
  await user.type(await screen.findByRole("textbox", { name: "Subject" }), "Follow up")
  await user.click(screen.getByRole("button", { name: "Edit links" }))
  await user.click(screen.getByRole("button", { name: "Remove Villa" }))
  await user.click(screen.getByRole("radio", { name: "reached" }))
  await user.type(screen.getByLabelText("Result summary (required)"), "Agreed next steps")
  await user.click(screen.getByRole("button", { name: "Save activity" }))
  await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "POST")).toBe(true))
  const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === "POST")!
  expect(String(url)).toMatch(/\/v1\/activities$/)
  expect(JSON.parse(String(init.body))).toMatchObject({ kind: "call", links: ["deal:2", "contact:3"], assignee_id: 7, summary: "Agreed next steps" })
})

it("corrects using one method-spoofed request and retains timestamp precision", async () => {
  const user = userEvent.setup(); dialog(activity)
  const summary = await screen.findByLabelText("Result summary (required)")
  await user.clear(summary); await user.type(summary, "Corrected result")
  await user.click(screen.getByRole("button", { name: "Save activity" }))
  await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1))
  const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === "POST")!
  const body = JSON.parse(String(init.body))
  expect(body).toMatchObject({ _method: "PUT", version: 3, summary: "Corrected result", occurred_at: activity.occurred_at })
  expect(body).not.toHaveProperty("links"); expect(body).not.toHaveProperty("kind")
})

it("keeps the form open and explains a version conflict", async () => {
  const user = userEvent.setup()
  ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(async (_input, init) => init?.method === "POST" ? Response.json({ message: "Conflict" }, { status: 409 }) : Response.json(options))
  dialog(activity)
  await screen.findByRole("textbox", { name: "Subject" })
  await user.click(screen.getByRole("button", { name: "Save activity" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Close this form and reload")
  expect(screen.getByRole("textbox", { name: "Subject" })).toHaveValue("Original call")
})


it("keeps optional fields and record search out of the initial form", async () => {
  const user = userEvent.setup(); dialog()
  await screen.findByRole("textbox", { name: "Subject" })
  expect(screen.queryByLabelText("Responsible agent")).not.toBeInTheDocument()
  expect(screen.queryByLabelText("Interaction time")).not.toBeInTheDocument()
  expect(screen.queryByLabelText("Find record")).not.toBeInTheDocument()
  expect(screen.getByText("Assigned to Agent")).toBeInTheDocument()
  expect(screen.getByText("Happened now")).toBeInTheDocument()
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  await user.click(screen.getByRole("button", { name: "More details" }))
  expect(screen.getByRole("combobox", { name: "Responsible agent" })).toBeInTheDocument()
  await user.type(screen.getByLabelText("Details (optional)"), "Additional context")
  await user.click(screen.getByRole("button", { name: "More details" }))
  await user.click(screen.getByRole("button", { name: "More details" }))
  expect(screen.getByLabelText("Details (optional)")).toHaveValue("Additional context")
  await user.click(screen.getByRole("button", { name: "Edit links" }))
  expect(screen.getByLabelText("Find record")).toBeInTheDocument()
  await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2))
})

it("switches task deadlines without submitting a conflicting start or end time", async () => {
  const user = userEvent.setup(); dialog()
  await user.type(await screen.findByRole("textbox", { name: "Subject" }), "Follow up")
  await user.click(screen.getByRole("radio", { name: "Task" }))
  await user.click(screen.getByRole("radio", { name: "Schedule follow-up" }))
  await user.click(screen.getByRole("button", { name: "Due date" }))
  await user.click(screen.getByRole("button", { name: "Tomorrow" }))
  await user.click(screen.getByRole("button", { name: "Set a specific time instead" }))
  expect(screen.queryByLabelText("Due date")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Start time" }))
  await user.click(screen.getByRole("button", { name: "Today" }))
  fireEvent.change(screen.getByLabelText("Start time clock"), { target: { value: "10:00" } })
  await user.click(screen.getByLabelText("End time (optional)"))
  await user.click(screen.getByRole("button", { name: "Today" }))
  fireEvent.change(screen.getByLabelText("End time (optional) clock"), { target: { value: "11:00" } })
  await user.click(screen.getByRole("button", { name: "Use a date-only deadline" }))
  expect(screen.queryByLabelText("Start time", { exact: true })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Due date" }))
  await user.click(screen.getByRole("button", { name: "In a week" }))
  await user.click(screen.getByRole("button", { name: "Save activity" }))
  await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "POST")).toBe(true))
  const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => init?.method === "POST")!
  const cairoToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  expect(JSON.parse(String(init.body))).toMatchObject({ kind: "task", status: "scheduled", due_date: format(addDays(parseISO(cairoToday), 7), "yyyy-MM-dd"), starts_at: null, ends_at: null })
})


it("reveals the agent field when a missing default blocks saving", async () => {
  const user = userEvent.setup()
  ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => Response.json({ ...options, agents: [] }))
  dialog()
  await user.type(await screen.findByRole("textbox", { name: "Subject" }), "Note without a default agent")
  await user.click(screen.getByRole("radio", { name: "Note" }))
  await user.click(screen.getByRole("button", { name: "Save activity" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a responsible agent.")
  expect(screen.getByRole("combobox", { name: "Responsible agent" })).toBeInTheDocument()
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)
})

it("fills editable writing starters on click and adapts them to the chosen outcome", async () => {
  const user = userEvent.setup(); dialog()
  const subject = await screen.findByRole("textbox", { name: "Subject" })
  expect(subject).toHaveValue("")
  expect(screen.getByLabelText("Result summary (required)")).toHaveValue("")
  await user.click(screen.getByRole("button", { name: "Property requirements" }))
  expect(subject).toHaveValue("Property requirements")
  await user.click(screen.getByRole("radio", { name: "unanswered" }))
  await user.click(screen.getByRole("button", { name: "Try again later" }))
  const summary = screen.getByLabelText("Result summary (required)")
  expect(summary).toHaveValue("No answer; try again later.")
  await user.clear(summary); await user.type(summary, "No answer; call after 5 pm.")
  await user.click(screen.getByRole("radio", { name: "reached" }))
  expect(summary).toHaveValue("No answer; call after 5 pm.")
  expect(screen.queryByRole("button", { name: "Try again later" })).not.toBeInTheDocument()
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)
})

it("rejects an end time before the start and retains the selected dates", async () => {
  const user = userEvent.setup(); dialog()
  await user.type(await screen.findByRole("textbox", { name: "Subject" }), "Viewing")
  await user.click(screen.getByRole("radio", { name: "Viewing" }))
  await user.click(screen.getByRole("radio", { name: "Schedule follow-up" }))
  await user.click(screen.getByRole("button", { name: "Start time" }))
  await user.click(screen.getByRole("button", { name: "Tomorrow" }))
  await user.click(screen.getByLabelText("End time (optional)"))
  await user.click(screen.getByRole("button", { name: "Today" }))
  await user.click(screen.getByRole("button", { name: "Save activity" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("End must follow start.")
  expect(screen.getByLabelText("Start time clock")).toHaveValue("09:00")
  expect(screen.getByLabelText("End time (optional) clock")).toHaveValue("09:00")
  expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false)
})
