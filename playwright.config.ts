import { defineConfig } from "@playwright/test";

/**
 * Tests E2E Playwright — parcours réels via navigateur Chromium.
 *
 * Le serveur doit être lancé MANUELLEMENT (voir scripts/e2e-server.ps1)
 * sur le port 3100 contre la base PostgreSQL de TEST isolée :
 *   DATABASE_URL=$TEST_DATABASE_URL npm run dev -- --port 3100
 *
 * Aucune donnée de production n'est touchée : tous les comptes E2E
 * portent le domaine @auth-test.example.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1280, height: 800 },
    locale: "fr-FR",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
