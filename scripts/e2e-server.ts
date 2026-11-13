/**
 * Serveur E2E : build de PRODUCTION Next.js sur le port 3100, contre la
 * base PostgreSQL de TEST isolée (seed avatars inclus).
 *
 * Pourquoi un build et pas `next dev` : l'environnement dev (HMR/Fast
 * Refresh) annule aléatoirement des navigations et fait échouer des tests
 * stables. Un serveur standalone est déterministe et reflète la prod.
 *
 * Usage : npx tsx scripts/e2e-server.ts   (Ctrl+C pour arrêter)
 */
import "dotenv/config";
import { execSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync } from "node:fs";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error("❌ TEST_DATABASE_URL manquant.");
  process.exit(1);
}

const PORT = "3100";
const env = { ...process.env, DATABASE_URL: testUrl };

// 1. Seed idempotent des avatars sur la base de test.
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });

// 2. Build de production.
console.log("🏗️  Build de production (next build)...");
execSync("npx next build", { stdio: "inherit", env });

// 3. Assets requis par la sortie standalone.
if (!existsSync(".next/standalone")) {
  console.error("❌ .next/standalone absent — build échoué ?");
  process.exit(1);
}
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (existsSync("public")) {
  cpSync("public", ".next/standalone/public", { recursive: true });
}
mkdirSync(".next/standalone", { recursive: true });

// 4. Démarrage du serveur standalone.
console.log(`🚀 Serveur E2E (production) : http://localhost:${PORT} (base de TEST)`);
const child = spawn("node", [".next/standalone/server.js"], {
  stdio: "inherit",
  env: { ...env, PORT, HOSTNAME: "0.0.0.0" },
});
child.on("exit", (code) => process.exit(code ?? 0));
