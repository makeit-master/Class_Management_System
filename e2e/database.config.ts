import { defineConfig } from "@playwright/test";
import base from "../playwright.config";

// Dedicated ports and no server reuse prevent writes to an existing dev API.
const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (
  process.env.E2E_DB_ISOLATED !== "YES" ||
  process.env.E2E_ALLOW_DB_WRITES !== "YES" ||
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  !database.pathname.endsWith("_test")
) {
  throw new Error(
    "Database E2E requires explicit write opt-in and a local database ending in _test.",
  );
}
process.env.E2E_API_URL = "http://127.0.0.1:3001/api";

export default defineConfig({
  ...base,
  testDir: ".",
  use: { ...base.use, baseURL: "http://127.0.0.1:5185" },
  webServer: [
    {
      command: "npm run dev --workspace=@cms/api",
      url: "http://127.0.0.1:3001/api/health",
      env: { PORT: "3001", DIRECT_URL: process.env.DATABASE_URL! },
      reuseExistingServer: false,
    },
    {
      command:
        "npm run dev --workspace=@cms/web -- --host 127.0.0.1 --port 5185 --strictPort",
      url: "http://127.0.0.1:5185",
      env: { CLASSFLOW_API_PROXY_TARGET: "http://127.0.0.1:3001" },
      reuseExistingServer: false,
    },
  ],
});
