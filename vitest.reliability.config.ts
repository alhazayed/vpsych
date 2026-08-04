import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Calibration harness only. Kept out of `vitest.config.ts` because these evals
 * call a real provider, take minutes, and cost money — `npm test` must stay
 * fast and offline.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.eval.ts"],
    // Provider calls dominate; running cases in parallel muddies rate limits.
    fileParallelism: false,
    testTimeout: 1000 * 60 * 10,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
