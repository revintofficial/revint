import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration test runner. Separate from the default vitest config so:
 *   - the environment is `node` (we talk to Postgres directly via Prisma)
 *   - `.env.test` is loaded via the integration setup file
 *   - only files under `src/__tests__/**&#47;*.integration.test.ts` are
 *     collected; unit and worker-mock tests never accidentally run here.
 *
 * Invoked by `npm run test:integration`. When `.env.test` is absent the
 * setup file logs a warning and the suite exits with a skipped status
 * instead of failing.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/integration/setup.ts"],
    include: ["src/__tests__/**/*.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
