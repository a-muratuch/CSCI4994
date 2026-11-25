import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 180000,
  expect: { timeout: 20000 },
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    // A production build of the isolated copy can take over four minutes.
    timeout: 420000,
  },
});
