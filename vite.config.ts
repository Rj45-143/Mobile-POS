/// <reference types="vitest" />
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config/

export default defineConfig(({ mode }) => ({
  plugins: [react(), legacy()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    // node_modules_bak is a stray full copy of node_modules left in the repo
    // root — without this it gets crawled for test files too.
    exclude: ["**/node_modules/**", "**/node_modules_bak/**", "**/dist/**", "**/cypress/**"],
  },
  resolve: {
    alias: {
      "@theme": path.resolve(__dirname, "src/theme"),
    },
  },
  build: {
    minify: "terser",
    // Drop console.log/debug from production bundles; keep warn/error so
    // crash reports from the field are still visible in device logs.
    terserOptions: mode === "production" ? {
      compress: {
        pure_funcs: ["console.log", "console.debug"],
      },
    } : undefined,
  },
}));
