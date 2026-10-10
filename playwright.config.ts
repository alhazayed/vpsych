import { defineConfig, devices } from "@playwright/test";

// Browser end-to-end tests. scripts/test-e2e.sh starts a throwaway local
// Supabase stack and the built app, creates the test accounts, then runs these.
// Running `npx playwright test` on its own expects that setup to exist.
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    locale: "en-US",
    // The production CSP only allows *.supabase.co and upgrades http requests;
    // the local Supabase stack is plain http on 127.0.0.1.
    bypassCSP: true,
    permissions: ["microphone"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
          // A fake microphone, so the Therapy Room opens without a device.
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
  ],
});
