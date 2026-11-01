import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/system",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.CFH_CHROMIUM_PATH ? { executablePath: process.env.CFH_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "system-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "system-mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    { command: "npm run system:backend", url: "http://127.0.0.1:54329/__test/health", timeout: 120000, reuseExistingServer: process.env.CFH_SYSTEM_REUSE === "true" },
    { command: "npm run system:app", url: "http://127.0.0.1:3101/login", timeout: 120000, reuseExistingServer: process.env.CFH_SYSTEM_REUSE === "true" },
  ],
});
