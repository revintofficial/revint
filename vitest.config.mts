import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Node is the default: 146 of the 154 unit test files are pure
    // service / pure-function tests that never touch a DOM, and
    // booting jsdom for all of them cost ~36s of setup per run.
    // The handful of component tests opt in with a
    // `// @vitest-environment happy-dom` docblock.
    //
    // happy-dom rather than jsdom: jsdom 29 pulls
    // html-encoding-sniffer@5 (CJS), which `require()`s
    // @exodus/bytes@1.15 (ESM-only). That combination throws
    // ERR_REQUIRE_ESM on Node 20 and silently killed every
    // component test file — including the control review UI test.
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      ".claude/**",
      ".codex/**",
      "src/__tests__/**/*.integration.test.ts",
    ],

  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
