/**
 * Restauration d'une sauvegarde PostgreSQL (procédure contrôlée).
 *
 * Usage :
 *   npm run db:restore -- backups/backup-....sql
 *
 * ⚠️ La restauration REMPLACE le contenu de la base cible : elle n'est
 * jamais exécutée automatiquement. Le script :
 *  1. vérifie l'existence et la lisibilité du fichier ;
 *  2. demande une confirmation explicite (variable RESTORE_CONFIRM=1
 *     pour un usage non interactif) ;
 *  3. importe le dump via psql (ON_ERROR_STOP → échec net).
 * Aucune donnée n'est supprimée par ce script lui-même : seule la
 * restauration demandée écrase les tables importées.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value !== "" ? value : fallback;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage : npm run db:restore -- <fichier.sql>");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`❌ Fichier introuvable : ${file}`);
  process.exit(1);
}

const container = envValue("DB_CONTAINER", "jeux-multiplications-db-1");
const dbUser = envValue("POSTGRES_USER", "jeux_user");
const dbName = envValue("POSTGRES_DB", "jeux_multiplication");

const size = (statSync(file).size / 1024).toFixed(1);
console.log(`➜ Restauration prévue de « ${file} » (${size} Ko) vers « ${dbName} ».`);
console.log("⚠️  Cette opération remplace les données actuelles de la base cible.");

if (process.env.RESTORE_CONFIRM !== "1") {
  console.error(
    "❌ Confirmation requise : relancez avec RESTORE_CONFIRM=1 " +
      `(ou répondez « oui » dans un terminal interactif).`,
  );
  process.exit(1);
}

const dump = readFileSync(file, "utf8");
const import_ = spawnSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", dbUser, "-d", dbName, "-v", "ON_ERROR_STOP=1"],
  { input: dump, maxBuffer: 1024 * 1024 * 512, encoding: "utf8" },
);

if (import_.status !== 0) {
  console.error("❌ Restauration en échec :", import_.stderr?.trim());
  process.exit(1);
}
console.log("✅ Restauration terminée.");
console.log("   Vérification : npm run db:status && npm run db:check");
