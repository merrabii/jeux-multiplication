/**
 * Sauvegarde PostgreSQL (logique, via pg_dump du conteneur de dev).
 *
 * Usage :
 *   npm run db:backup              # → backups/backup-<date>.sql.gz
 *   DB_CONTAINER=autre npm run db:backup
 *
 * Ne supprime JAMAIS de données : la commande crée uniquement un fichier.
 * La restauration se fait avec `npm run db:restore -- <fichier>` (voir
 * scripts/db-restore.ts) — procédure complète dans docs/INSTALLATION.md.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value !== "" ? value : fallback;
}

const container = envValue("DB_CONTAINER", "jeux-multiplications-db-1");
const dbUser = envValue("POSTGRES_USER", "jeux_user");
const dbName = envValue("POSTGRES_DB", "jeux_multiplication");
const outDir = envValue("BACKUP_DIR", "backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outFile = join(outDir, `backup-${stamp}.sql`);

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

console.log(`➜ Sauvegarde de la base « ${dbName} » (conteneur ${container})…`);

const dump = spawnSync(
  "docker",
  [
    "exec",
    container,
    "pg_dump",
    "-U",
    dbUser,
    "-d",
    dbName,
    "--no-owner",
    "--no-acl",
    // --clean/--if-exists : la restauration est rejouable sur la même base
    // (les tables du dump sont supprimées puis recréées — opération
    // explicite et confirmée par l'exploitant).
    "--clean",
    "--if-exists",
  ],
  { maxBuffer: 1024 * 1024 * 512 },
);

if (dump.status !== 0) {
  console.error("❌ Échec de pg_dump :", dump.stderr.toString().trim());
  console.error(
    "Vérifiez que le conteneur PostgreSQL tourne (docker compose ps) ou " +
      "adaptez DB_CONTAINER/POSTGRES_USER/POSTGRES_DB.",
  );
  process.exit(1);
}

const { writeFileSync } = await import("node:fs");
writeFileSync(outFile, dump.stdout);
const size = (readFileSync(outFile).length / 1024).toFixed(1);
console.log(`✅ Sauvegarde écrite : ${outFile} (${size} Ko)`);
console.log(
  `   Restauration : npm run db:restore -- ${outFile}`,
);
