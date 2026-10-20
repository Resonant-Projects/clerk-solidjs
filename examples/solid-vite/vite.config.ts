import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// No server rendering: the app is static files, and Clerk runs only in the browser.
export default defineConfig({
  plugins: [solid()],
  server: { host: process.env.HOST ?? "localhost" },
  preview: { host: process.env.HOST ?? "localhost" },
});
