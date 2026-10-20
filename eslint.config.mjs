import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-qa/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Working files (gitignored) and test output.
    "refs/**",
    ".redesign/**",
    ".claude/**",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    ".lighthouseci/**",
  ]),
]);

export default eslintConfig;
