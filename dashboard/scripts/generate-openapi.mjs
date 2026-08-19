import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const dashboardRoot = path.resolve(import.meta.dirname, "..")
const repositoryRoot = path.resolve(dashboardRoot, "..")
const sourceRoot = path.resolve(repositoryRoot, "docs/openapi")
const outputPath = path.resolve(dashboardRoot, "public/openapi.json")
const productionServer = "https://api-crm.swerky.dev/api"

const sources = [
  { slug: "activity-logs", title: "Activity Logs", file: "ActivityLog.openapi.json", prefix: "/v1/activity-logs" },
  { slug: "analytics", title: "Analytics", file: "Analytics.openapi.json", prefix: "/v1/analytics" },
  { slug: "auth", title: "Authentication", file: "Auth.openapi.json", prefix: "" },
  { slug: "contacts", title: "Contacts", file: "Contact.openapi.json", prefix: "/v1" },
  { slug: "listings", title: "Listings", file: "Listing.openapi.json", prefix: "/v1/properties" },
  { slug: "marketing", title: "Marketing", file: "Marketing.openapi.json", prefix: "/v1/leads" },
  { slug: "media", title: "Media", file: "Media.openapi.json", prefix: "/v1/media" },
  { slug: "sales", title: "Sales", file: "Sales.openapi.json", prefix: "/v1/deals" },
  { slug: "shared", title: "Shared", file: "Shared.openapi.json", prefix: "" },
]

const methods = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"])

function rewriteReferences(value, componentNames) {
  if (typeof value === "string") {
    return value.replace(/#\/components\/([^/]+)\/([^/]+)/g, (reference, section, name) => {
      const renamed = componentNames.get(`${section}/${name}`)
      return renamed ? `#/components/${section}/${renamed}` : reference
    })
  }

  if (Array.isArray(value)) return value.map((item) => rewriteReferences(item, componentNames))
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, rewriteReferences(child, componentNames)]),
  )
}

function namespacedComponents(document, namespace) {
  const componentNames = new Map()
  const components = document.components ?? {}

  for (const [section, entries] of Object.entries(components)) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue
    for (const name of Object.keys(entries)) componentNames.set(`${section}/${name}`, `${namespace}_${name}`)
  }

  const output = {}
  for (const [section, entries] of Object.entries(components)) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) continue
    output[section] = Object.fromEntries(
      Object.entries(entries).map(([name, value]) => [
        `${namespace}_${name}`,
        rewriteReferences(value, componentNames),
      ]),
    )
  }

  return { components: output, componentNames }
}

function combinedPath(prefix, sourcePath) {
  if (!prefix) return sourcePath
  if (sourcePath === "/") return prefix
  return `${prefix}${sourcePath.startsWith("/") ? sourcePath : `/${sourcePath}`}`
}

function addSourceTag(pathItem, slug) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method) || !operation || typeof operation !== "object" || Array.isArray(operation)) continue
    operation.tags = [...new Set([slug, ...(operation.tags ?? [])])]
  }
}

const combined = {
  openapi: "3.0.1",
  info: {
    title: "CRM API",
    version: "1.0.0",
    description: "Combined API reference for the CRM platform.",
  },
  servers: [{ url: productionServer, description: "Production" }],
  tags: sources.map(({ slug, title }) => ({ name: slug, description: title })),
  paths: {},
  components: {},
}

for (const source of sources) {
  const filePath = path.resolve(sourceRoot, source.file)
  const document = JSON.parse(await readFile(filePath, "utf8"))

  if (!document.openapi?.startsWith("3.0.")) {
    throw new Error(`${source.file} must use OpenAPI 3.0.x`)
  }

  const namespace = source.slug.replace(/[^a-zA-Z0-9]/g, "_")
  const { components, componentNames } = namespacedComponents(document, namespace)
  const paths = rewriteReferences(document.paths ?? {}, componentNames)

  for (const [sourcePath, pathItem] of Object.entries(paths)) {
    const targetPath = combinedPath(source.prefix, sourcePath)
    if (combined.paths[targetPath]) throw new Error(`Path collision while combining ${source.file}: ${targetPath}`)
    addSourceTag(pathItem, source.slug)
    combined.paths[targetPath] = pathItem
  }

  for (const [section, entries] of Object.entries(components)) {
    combined.components[section] ??= {}
    Object.assign(combined.components[section], entries)
  }
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(combined, null, 2)}\n`)
console.log(`Generated ${Object.keys(combined.paths).length} paths from ${sources.length} OpenAPI exports.`)
console.log(`Wrote ${path.relative(repositoryRoot, outputPath)} with server ${productionServer}`)
