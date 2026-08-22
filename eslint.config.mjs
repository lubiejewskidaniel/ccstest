import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js 16 removed `next lint` in favor of the plain ESLint CLI, and
// `eslint-config-next` now ships native flat-config presets at these two
// subpaths (see https://nextjs.org/docs/app/api-reference/config/eslint).
// This imports them directly rather than bridging the old `"next/core-web-
// vitals"` string-extends syntax through `FlatCompat` (`@eslint/eslintrc`)
// — that bridge is what was crashing with "Converting circular structure
// to JSON": it tries to JSON.stringify a plugin's flat config object while
// reporting a validation error, and modern flat-config-native plugins
// (eslint-plugin-react, eslint-plugin-react-hooks 6+) intentionally embed
// a self-reference in that object, which isn't JSON-serializable. Using
// the flat-native subpath exports below avoids that legacy code path
// entirely — see https://github.com/vercel/next.js/issues/85244.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**", "supabase/**"]),
]);

export default eslintConfig;
