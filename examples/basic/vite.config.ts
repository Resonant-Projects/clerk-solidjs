import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [solidStart({ middleware: "./src/middleware.ts" }), nitro(), tailwindcss()],
  server: { host: process.env.HOST ?? "localhost" },
  optimizeDeps: {
    // SolidStart's dev error overlay reaches a UMD-only module through this; unbundled, it fails to import.
    include: ["@solidjs/start > @jridgewell/trace-mapping"],
  },
});
