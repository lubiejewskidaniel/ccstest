import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Minimal Vitest setup — no React component rendering is under test here
 * (see docs/LEAD_MANAGEMENT.md / docs/ANALYTICS.md for what these tests
 * cover and deliberately don't), so no `@vitejs/plugin-react` dependency
 * is needed. `jsdom` gives the `window`/`localStorage`/`CustomEvent` APIs
 * that the consent and attribution modules use.
 *
 * The `@/*` alias mirrors `tsconfig.json`'s `paths` mapping — Vitest
 * doesn't read `tsconfig.json` paths on its own without an extra plugin,
 * so it's duplicated here deliberately rather than adding a dependency.
 *
 * The `server-only` alias points `import "server-only"` at a local
 * do-nothing shim (`test/shims/server-only.ts`) purely so Vitest can
 * resolve that Next.js build-time marker package at all — Vite has no
 * module resolution rule for it the way Next's webpack/Turbopack build
 * does. This is test-infrastructure only: it's registered nowhere but
 * here, so the real `server-only` package (and the server-only import
 * boundary it enforces in application code) is completely untouched in
 * `next build`/`next dev`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./test/shims/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
