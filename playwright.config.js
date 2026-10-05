import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  fullyParallel: false,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
    launchOptions: existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
      : {},
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
