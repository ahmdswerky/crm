/* global document, window */

import { mkdir, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { chromium } from "@playwright/test"

const root = resolve(import.meta.dirname, "..")
const appSourcePath = resolve(root, "src/App.tsx")
const outputRoot = resolve(root, process.env.SCREENSHOT_OUTPUT_DIR ?? "screenshots")
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:5173"
const waitMs = Number(process.env.SCREENSHOT_WAIT_MS ?? 1000)
const timeoutMs = Number(process.env.SCREENSHOT_TIMEOUT_MS ?? 30000)
const viewport = { width: 1920, height: 1080 }
const wonDealsPath = "/deals?status=won&page=1"

const parameterValues = {
  reportRunId: process.env.SCREENSHOT_REPORT_ID ?? process.env.SCREENSHOT_RECORD_ID ?? "1",
  leadId: process.env.SCREENSHOT_LEAD_ID ?? process.env.SCREENSHOT_RECORD_ID ?? "1",
  dealId: process.env.SCREENSHOT_DEAL_ID ?? process.env.SCREENSHOT_RECORD_ID ?? "1",
  propertyId: process.env.SCREENSHOT_PROPERTY_ID ?? process.env.SCREENSHOT_RECORD_ID ?? "1",
  accountId: process.env.SCREENSHOT_ACCOUNT_ID ?? process.env.SCREENSHOT_RECORD_ID ?? "1",
  agentId: process.env.SCREENSHOT_AGENT_ID ?? process.env.SCREENSHOT_RECORD_ID ?? "1",
  resourceId: process.env.SCREENSHOT_ROLE_ID ?? process.env.SCREENSHOT_RECORD_ID ?? "1",
}

function routePathForScreenshot(path) {
  if (path === "*") return "/__route-not-found__"
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return normalizedPath.replace(/:([A-Za-z0-9_]+)/g, (_, parameter) => parameterValues[parameter] ?? "1")
}

function fileNameForRoute(path) {
  if (path === "/") return "overview"
  if (path === "*") return "not-found"
  return path.replace(/^\/+/, "").replace(/[:/]+/g, "-").replace(/[^A-Za-z0-9_-]/g, "") || "route"
}

async function routesFromApp() {
  const source = await readFile(appSourcePath, "utf8")
  const routes = []
  const routeTag = /<Route\b([^>]*)>/g

  for (const match of source.matchAll(routeTag)) {
    const attributes = match[1]
    const pathMatch = attributes.match(/\bpath=(?:"([^"]+)"|'([^']+)')/)
    const path = /\bindex(?:\s|=|$)/.test(attributes) ? "/" : pathMatch?.[1] ?? pathMatch?.[2]
    if (!path || routes.some((route) => route.path === path)) continue
    routes.push({ path, urlPath: routePathForScreenshot(path), fileName: fileNameForRoute(path) })
  }

  if (!routes.length) throw new Error(`No routes found in ${appSourcePath}`)
  return routes
}

function isPropertyShowRoute(route) {
  return route.path.replace(/^\/+/, "") === "properties/:propertyId"
}

function dialogCapturesForRoute(route) {
  const path = route.path.replace(/^\/+/, "")
  if (path === "accounts") {
    return [
      { trigger: (page) => page.getByRole("button", { name: "New account", exact: true }), heading: "New account", fileName: "accounts-create-dialog" },
      { trigger: (page) => page.locator('button[aria-label^="Edit "]').first(), heading: /^Edit /, fileName: "accounts-edit-dialog" },
    ]
  }
  if (path === "agents") {
    return [
      { trigger: (page) => page.getByRole("button", { name: "New agent", exact: true }), heading: "Create agent", fileName: "agents-create-dialog" },
      { trigger: (page) => page.locator('button[aria-label^="Edit "]').first(), heading: /^Edit /, fileName: "agents-edit-dialog" },
    ]
  }
  return []
}

async function setTheme(page, mode, token) {
  await page.addInitScript(({ mode: nextMode, token: nextToken }) => {
    window.localStorage.setItem("crm-dashboard-theme", nextMode)
    if (nextToken) window.localStorage.setItem("crm-dashboard-token", nextToken)
  }, { mode, token })
}

async function waitForSettledPage(page, mode) {
  await page.waitForLoadState("domcontentloaded").catch(() => {})
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => {})
  await page.waitForFunction((expectedMode) => document.documentElement.classList.contains(expectedMode), mode, { timeout: 5000 }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(waitMs)
}

async function authenticate(page) {
  const token = process.env.SCREENSHOT_TOKEN
  if (token) return token

  const username = process.env.SCREENSHOT_USERNAME
  const password = process.env.SCREENSHOT_PASSWORD
  if (!username || !password) return null

  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: timeoutMs })
  await page.getByLabel("Username").fill(username)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /^Login$/ }).click()
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: timeoutMs })
  return await page.evaluate(() => window.localStorage.getItem("crm-dashboard-token"))
}

async function findWonDealProperty(page, mode) {
  await page.goto(new URL(wonDealsPath, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: timeoutMs })
  await waitForSettledPage(page, mode)

  if (new URL(page.url()).pathname === "/login") {
    throw new Error("Deals route redirected to /login; set SCREENSHOT_TOKEN or SCREENSHOT_USERNAME and SCREENSHOT_PASSWORD")
  }

  const propertyLink = page.locator('a[href^="/properties/"]').first()
  await propertyLink.waitFor({ state: "visible", timeout: timeoutMs })
  const propertyHref = await propertyLink.getAttribute("href")
  if (!propertyHref) throw new Error("The first won deal has no property link")

  const propertyLabel = (await propertyLink.getAttribute("aria-label")) || (await propertyLink.innerText()).trim() || propertyHref
  await propertyLink.click()
  await page.waitForURL((url) => url.pathname.startsWith("/properties/"), { timeout: timeoutMs })
  await waitForSettledPage(page, mode)

  const dealsPanel = page.locator('[aria-labelledby="property-deals-title"]')
  await dealsPanel.waitFor({ state: "visible", timeout: timeoutMs })
  try {
    await dealsPanel.locator('a[href^="/deals/"]').first().waitFor({ state: "visible", timeout: timeoutMs })
  } catch {
    throw new Error(`Property ${propertyHref} was reached, but its Deals panel is empty`)
  }

  return { propertyHref, propertyLabel }
}

async function openAndCapture(page, route, mode, urlPath = route.urlPath) {
  const targetUrl = new URL(urlPath, baseUrl).toString()
  const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs })
  await waitForSettledPage(page, mode)

  const finalUrl = new URL(page.url())
  if (response && response.status() >= 400) {
    throw new Error(`HTTP ${response.status()} while opening ${route.path}`)
  }
  if (route.path !== "/login" && finalUrl.pathname === "/login") {
    throw new Error(`Redirected to /login while opening ${route.path}`)
  }

  const outputPath = resolve(outputRoot, mode, `${route.fileName}.png`)
  await mkdir(resolve(outputRoot, mode), { recursive: true })
  await page.screenshot({ path: outputPath, fullPage: false, animations: "disabled", scale: "css" })
  return { outputPath, finalUrl: `${finalUrl.pathname}${finalUrl.search}` }
}

async function captureDialog(page, mode, config) {
  const trigger = config.trigger(page)
  if (!(await trigger.count())) return null

  await trigger.click()
  const dialog = page.getByRole("dialog").last()
  await dialog.getByRole("heading", { name: config.heading }).waitFor({ state: "visible", timeout: timeoutMs })

  const outputPath = resolve(outputRoot, mode, `${config.fileName}.png`)
  await mkdir(resolve(outputRoot, mode), { recursive: true })
  await page.screenshot({ path: outputPath, fullPage: false, animations: "disabled", scale: "css" })

  await dialog.getByRole("button", { name: "Close" }).click()
  await dialog.waitFor({ state: "hidden", timeout: timeoutMs })
  return outputPath
}

async function captureDialogsForRoute(page, route, mode) {
  const captures = []
  for (const config of dialogCapturesForRoute(route)) {
    const outputPath = await captureDialog(page, mode, config)
    if (outputPath) captures.push(outputPath)
  }
  return captures
}

async function capturePublicLogin(browser, mode, route) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: mode })
  const page = await context.newPage()
  await setTheme(page, mode, null)
  try {
    return await openAndCapture(page, route, mode)
  } finally {
    await context.close()
  }
}

async function captureProtectedRoutes(browser, routes, mode) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: mode })
  const page = await context.newPage()
  await setTheme(page, mode, process.env.SCREENSHOT_TOKEN ?? null)

  try {
    const token = await authenticate(page)
    if (!token) {
      throw new Error("Authentication is required; set SCREENSHOT_TOKEN or SCREENSHOT_USERNAME and SCREENSHOT_PASSWORD")
    }

    const results = []
    let wonDealProperty = null
    for (const route of routes.filter((item) => item.path !== "/login")) {
      let urlPath = route.urlPath
      if (isPropertyShowRoute(route)) {
        wonDealProperty ??= await findWonDealProperty(page, mode)
        urlPath = wonDealProperty.propertyHref
      }
      const result = await openAndCapture(page, route, mode, urlPath)
      const dialogs = await captureDialogsForRoute(page, route, mode)
      results.push({ route, result, dialogs })
    }
    return { results, wonDealProperty }
  } finally {
    await context.close()
  }
}

const routes = await routesFromApp()
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
})

try {
  console.log(`Capturing ${routes.length} App.tsx routes at ${viewport.width}x${viewport.height}`)
  for (const mode of ["light", "dark"]) {
    const loginRoute = routes.find((route) => route.path === "/login")
    if (loginRoute) {
      const login = await capturePublicLogin(browser, mode, loginRoute)
      console.log(`[${mode}] /login -> ${login.outputPath}`)
    }

    const capture = await captureProtectedRoutes(browser, routes, mode)
    for (const { route, result, dialogs } of capture.results) {
      const redirect = result.finalUrl === route.urlPath ? "" : ` (final: ${result.finalUrl})`
      console.log(`[${mode}] ${route.path} -> ${result.outputPath}${redirect}`)
      for (const dialog of dialogs) console.log(`[${mode}] dialog -> ${dialog}`)
    }
    if (capture.wonDealProperty) {
      console.log(`[${mode}] property show selected from won deals: ${capture.wonDealProperty.propertyLabel} (${capture.wonDealProperty.propertyHref})`)
    }
  }
} finally {
  await browser.close()
}
