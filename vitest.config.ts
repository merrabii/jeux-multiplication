import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Prépare l'environnement de test (AUTH_SECRET de test si absent).
    setupFiles: ["tests/setup.ts"],
    // Les tests d'intégration utilisent une base PostgreSQL isolée :
    // TEST_DATABASE_URL (provisionnée par npm run db:test:setup).
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
