import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const dir = resolve(root, "../docs/openapi")
const files = (await readdir(dir)).filter((file) => file.endsWith(".openapi.json")).sort()
const errors = []
for (const file of files) {
  const document = JSON.parse(await readFile(resolve(dir, file), "utf8"))
  const schemas = document.components?.schemas ?? {}
  const walk = (value, path = "#") => {
    if (!value || typeof value !== "object") return
    if (value.$ref && !value.$ref.startsWith("#/")) errors.push(`${file} ${path}: external refs are unsupported`)
    for (const [key, child] of Object.entries(value)) walk(child, `${path}/${key}`)
  }
  walk(document)
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (path.includes("{id}") && (item.put || item.patch)) errors.push(`${file} ${path}: use POST with _method=PUT for updates`)
  }
  for (const [name, schema] of Object.entries(schemas)) {
    for (const required of schema.required ?? []) if (schema.properties?.[required]?.readOnly) console.warn(`${file} ${name}: ${required} is required and readOnly; generated input types will omit it`)
  }
  const text = JSON.stringify(document).toLowerCase()
  if (text.includes("route [") || text.includes("exception")) console.warn(`${file}: exported examples contain a server exception; examples are ignored by the client`)
}
if (errors.length) { console.error(errors.map((error) => `- ${error}`).join("\n")); process.exitCode = 1 } else console.log(`Validated ${files.length} OpenAPI exports.`)
