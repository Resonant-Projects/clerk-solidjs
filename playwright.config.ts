import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const exampleEnvPath = path.resolve("examples/basic/.env.local");
if (fs.existsSync(exampleEnvPath)) {
  process.loadEnvFile(exampleEnvPath);
}

const publishableKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY ?? process.env.CLERK_PUBLISHABLE_KEY ?? "";
const serverEnv = {
  ...process.env,
  HOST: "127.0.0.1",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY ?? "",
  VITE_CLERK_PUBLISHABLE_KEY: publishableKey,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "",
};

// Each app is built first (`pnpm run build`) and served as it would be
// deployed. The same specs run against both; the SolidStart app also has a
// server, so specs check its middleware, auth() and API routes as well.
const apps = {
  basic: {
    port: Number(process.env.PORT ?? 4173),
    command: () => "pnpm -C examples/basic start",
  },
  "solid-vite": {
    port: 4174,
    command: (port: number) =>
      `pnpm -C examples/solid-vite exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
  },
};
type App = keyof typeof apps;
// E2E_APPS=basic runs only the SolidStart app, as the version matrix does.
const selected = (process.env.E2E_APPS ?? "basic,solid-vite")
  .split(",")
  .filter((name): name is App => name in apps);

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
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./e2e/global.setup.ts",
  globalTeardown: "./e2e/global.teardown.ts",
  projects: selected.map((name) => ({
    name,
    use: { baseURL: `http://127.0.0.1:${apps[name].port}` },
  })),
  webServer: selected.map((name) => ({
    command: apps[name].command(apps[name].port),
    env: { ...serverEnv, PORT: String(apps[name].port) },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://127.0.0.1:${apps[name].port}`,
  })),
});
