/**
 * Provisionnement de la base PostgreSQL de TEST (isolée).
 *
 * - Crée la base jeux_multiplication_test si elle n'existe pas.
 * - Applique les migrations versionnées (prisma migrate deploy) —
 *   jamais de reset destructif.
 * - Les tests d'intégration nettoient ensuite leurs propres données
 *   (e-mails * @auth-test.example).
 *
 * Usage : npm run db:test:setup
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `❌ La variable ${name} est absente. Copier .env.example en .env et la définir.`,
    );
    process.exit(1);
  }
  return value;
}

async function main() {
  const testUrl = requireEnv("TEST_DATABASE_URL");

  // Connexion à la base "postgres" du même serveur pour créer la base de test.
  const adminUrl = new URL(testUrl);
  const dbName = adminUrl.pathname.replace(/^\//, "");
  adminUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✔ Base de test créée : ${dbName}`);
    } else {
      console.log(`✔ Base de test déjà présente : ${dbName}`);
    }
  } finally {
    await client.end();
  }

  // Migrations versionnées (identiques à celles de développement).
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });

  console.log("\n✅ Base de test prête (migrations appliquées).");
}

main().catch((error) => {
  console.error("❌ Échec du provisionnement de la base de test :", error);
  process.exit(1);
});
