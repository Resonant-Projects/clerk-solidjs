import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const exampleEnvPath = path.resolve("examples/basic/.env.local");
if (fs.existsSync(exampleEnvPath)) {
  process.loadEnvFile(exampleEnvPath);
}

const port = Number(process.env.PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./e2e/global.setup.ts",
  globalTeardown: "./e2e/global.teardown.ts",
  webServer: {
    command: "pnpm -C examples/basic start",
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY ?? "",
      VITE_CLERK_PUBLISHABLE_KEY:
        process.env.VITE_CLERK_PUBLISHABLE_KEY ??
        process.env.CLERK_PUBLISHABLE_KEY ??
        "",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`,
  },
});
