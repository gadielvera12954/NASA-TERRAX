import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  // The 3D views render with software WebGL in headless mode and are CPU-heavy: more than two
  // spec files at once starves the long candidate loop of integration.spec.ts past its 30 s.
  workers: 2,
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || "msedge",
    headless: true,
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
