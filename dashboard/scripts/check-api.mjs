import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

const root = resolve(import.meta.dirname, "..")
const temp = await mkdtemp(resolve(tmpdir(), "crm-api-"))
const source = resolve(root, "../docs/openapi")
const generated = resolve(root, "src/api/generated")
const files = (await readdir(source)).filter((file) => file.endsWith(".openapi.json"))
for (const file of files) await new Promise((done, fail) => {
  const out = resolve(temp, file.replace(/\.openapi\.json$/, ".ts"))
  const child = spawn(resolve(root, "node_modules/.bin/openapi-typescript"), [resolve(source, file), "-o", out], { stdio: "ignore" })
  child.on("error", fail); child.on("exit", (code) => code === 0 ? done() : fail(new Error(`generation failed for ${file}`)))
})
const mismatches = []
for (const file of files) {
  const name = file.replace(/\.openapi\.json$/, ".ts")
  const [expected, actual] = await Promise.all([readFile(resolve(temp, name), "utf8"), readFile(resolve(generated, name), "utf8").catch(() => "")])
  if (expected !== actual) mismatches.push(name)
}
await rm(temp, { recursive: true, force: true })
if (mismatches.length) { console.error(`Generated API drift: ${mismatches.join(", ")}`); process.exitCode = 1 } else console.log("Generated API types are up to date.")
