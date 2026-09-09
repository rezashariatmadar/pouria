/**
 * YadakPro E2E — Playwright config.
 *
 * Runs against the live local stack:
 *   - Frontend (production build): http://localhost:3000
 *   - Backend (Django + seeded SQLite): http://localhost:8000
 *
 * workers: 1 — the smoke SQLite DB is shared state; tests must run sequentially.
 */
const { defineConfig } = require("@playwright/test");

const CHROMIUM = "/home/dante/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";

module.exports = defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  outputDir: require("path").join(__dirname, ".artifacts"),

  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: "off",
    video: "off",
    trace: "off",
  },

  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        executablePath: CHROMIUM,
        launchOptions: { args: ["--no-sandbox"] },
      },
    },
  ],
});
