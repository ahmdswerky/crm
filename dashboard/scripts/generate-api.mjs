import { mkdir, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

const root = resolve(import.meta.dirname, "..")
const inputDir = resolve(root, "../docs/openapi")
const outputDir = resolve(root, "src/api/generated")
await mkdir(outputDir, { recursive: true })
const files = (await readdir(inputDir)).filter((file) => file.endsWith(".openapi.json")).sort()
if (!files.length) throw new Error(`No OpenAPI exports found in ${inputDir}`)

for (const file of files) {
  const input = resolve(inputDir, file)
  const output = resolve(outputDir, file.replace(/\.openapi\.json$/, ".ts"))
  await new Promise((done, fail) => {
    const child = spawn(resolve(root, "node_modules/.bin/openapi-typescript"), [input, "-o", output], { stdio: "inherit" })
    child.on("error", fail)
    child.on("exit", (code) => code === 0 ? done() : fail(new Error(`openapi-typescript exited with ${code}`)))
  })
}
