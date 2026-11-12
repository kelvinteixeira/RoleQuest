import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests in local mode (no keys, demo data in the browser).
 * `npm run e2e` starts its own dev server on port 3100; with E2E_BASE_URL set
 * (e.g. a server already running, or a preview deploy) it tests that instead.
 */
const external = process.env.E2E_BASE_URL;
const port = 3100;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    locale: "pt-BR",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: external
    ? undefined
    : {
        command: `npx next dev -p ${port}`,
        url: `http://localhost:${port}`,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: { NEXT_PUBLIC_DATA_SOURCE: "mock" },
      },
});
