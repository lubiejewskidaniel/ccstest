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
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
