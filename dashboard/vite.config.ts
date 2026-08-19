import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
