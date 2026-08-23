import { mkdtemp, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { tmpdir } from "node:os"

const dashboardRoot = path.resolve(import.meta.dirname, "..")
const repositoryRoot = path.resolve(dashboardRoot, "..")
const expected = path.resolve(dashboardRoot, "public/openapi.json")
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "crm-openapi-"))
const generated = path.join(temporaryDirectory, "openapi.json")

try {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(dashboardRoot, "scripts/generate-openapi.mjs")], {
      cwd: repositoryRoot,
      env: { ...process.env, OPENAPI_OUTPUT_PATH: generated },
      stdio: "inherit",
    })
    child.on("error", reject)
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`OpenAPI generation exited with ${code}`)))
  })

  const [expectedContent, generatedContent] = await Promise.all([
    readFile(expected, "utf8"),
    readFile(generated, "utf8"),
  ])

  if (expectedContent !== generatedContent) {
    console.error("Generated dashboard OpenAPI documentation is out of date. Run npm run api:docs and stage the result.")
    process.exitCode = 1
  } else {
    console.log("Dashboard OpenAPI documentation is up to date.")
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
