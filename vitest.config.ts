import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "app/**/*.test.{ts,tsx}",
      "game/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/**", "game/**", "components/**"],
      exclude: ["**/__tests__/**", "**/*.test.*"],
    },
  },
});
