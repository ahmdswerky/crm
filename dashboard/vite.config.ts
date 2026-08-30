import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"

const root = path.dirname(fileURLToPath(import.meta.url))

// Generated static doc apps live under public/docs/<app>/ — the Liam ERDs
// (/docs/db/<name>/) and the archify architecture views (/docs/architecture/,
// with flat pages like /docs/architecture/sequence). `vite build` copies them
// as-is; in dev the SPA history fallback would otherwise answer /docs/… with
// the dashboard's own index.html. This middleware resolves, for an
// extension-less /docs/ path:
//   1. <path>.html         → a flat page (…/architecture/sequence)
//   2. <path>/index.html   → a sub-app (…/db/payments) — 301 to add the slash
//      first so its relative asset URLs resolve
// Real files (…/x.html, …/assets/…) fall through to Vite; anything else 404s
// rather than serving the dashboard SPA, matching nginx.
function serveStaticDocApps(): PluginOption {
  const docsDir = path.resolve(root, "public/docs")
  const sendHtml = (res: import("node:http").ServerResponse, file: string) => {
    res.setHeader("Content-Type", "text/html")
    fs.createReadStream(file).pipe(res)
  }
  return {
    name: "serve-static-doc-apps",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ""
        const pathname = url.split("?")[0]
        if (!pathname.startsWith("/docs/") || path.extname(pathname)) return next()

        const slashless = !pathname.endsWith("/")
        const rel = decodeURIComponent(pathname.slice("/docs/".length)).replace(/\/$/, "")
        const base = path.join(docsDir, rel)
        if (base.startsWith(docsDir + path.sep)) {
          if (slashless && fs.existsSync(`${base}.html`)) return sendHtml(res, `${base}.html`)
          if (fs.existsSync(path.join(base, "index.html"))) {
            if (slashless) {
              res.statusCode = 301
              res.setHeader("Location", `${pathname}/${url.slice(pathname.length)}`)
              return res.end()
            }
            return sendHtml(res, path.join(base, "index.html"))
          }
        }
        res.statusCode = 404
        res.end("Not found")
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveStaticDocApps()],
  resolve: {
    alias: { "@": path.resolve(root, "./src") },
  },
  server: { port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](?:react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 20,
              minSize: 20 * 1024,
            },
            {
              name: "ui",
              test: /node_modules[\\/](?:radix-ui|lucide-react|cmdk)[\\/]/,
              priority: 10,
              minSize: 20 * 1024,
              maxSize: 250 * 1024,
              entriesAware: true,
              entriesAwareMergeThreshold: 8 * 1024,
            },
          ],
        },
      },
    },
  },
})
