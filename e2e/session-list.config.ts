import { defineConfig, devices } from "@playwright/test";

// Isolated UI contract tests: API responses are intercepted in the browser.
// The real database is not used by either spec.
export default defineConfig({
  testDir: ".",
  testMatch: ["session-list.spec.ts", "attendance-workflow.spec.ts"],
  use: { baseURL: "http://127.0.0.1:5184", ...devices["Desktop Chrome"] },
  webServer: {
    command:
      "node ../node_modules/vite/bin/vite.js ../apps/web --host 127.0.0.1 --port 5184 --strictPort",
    url: "http://127.0.0.1:5184",
    reuseExistingServer: !process.env.CI,
  },
});
