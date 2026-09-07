/**
 * Vitest-only shim for the `server-only` package.
 *
 * `server-only` is a Next.js build-time marker: importing it is a no-op at
 * runtime everywhere except that Next's webpack/Turbopack build throws if
 * the importing module ends up in a client bundle. Vite/Vitest has no
 * such check and no reason to special-case this package, so it just tries
 * to resolve `"server-only"` as a real module and fails outside of a
 * Next.js build (see the `server-only` alias in `vitest.config.ts`).
 *
 * This file intentionally does nothing — it exists only so Vitest's
 * module resolver has something to resolve `import "server-only"` to. It
 * is never bundled by Next.js itself (webpack/Turbopack use the real
 * `server-only` package from `node_modules`; this alias is registered
 * only in `vitest.config.ts`), so it has zero effect on production
 * behavior or the server-only import boundary in application code.
 */
export {};
