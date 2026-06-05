import { defineConfig } from "vitest/config"

// Unit tests for the pure domain math in lib/. These functions are plain
// TypeScript (no React/DOM), so the default node environment is correct and
// fast. Scope the glob to lib/ so the standalone tsx scripts in scripts/
// (e.g. scripts/test-resources.ts, not a *.test.ts file) are never picked up.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
})
