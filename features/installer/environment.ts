import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { Prisma } from "@/lib/database/generated/client";
import type { PrismaClient } from "@/lib/database/generated/client";
import { APP_VERSION } from "@/lib/version";

/**
 * Étape 1 de l'assistant — vérifications réelles de l'environnement.
 * Chaque vérification est exécutée côté serveur. Aucune valeur de
 * secret (mot de passe, DATABASE_URL) n'est renvoyée : uniquement des
 * statuts et des messages d'aide en français.
 */

export type CheckStatus = "ok" | "warn" | "error";

export type EnvironmentCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Solution proposée en cas d'erreur ou d'avertissement. */
  solution?: string;
};

export type EnvironmentReport = {
  checks: EnvironmentCheck[];
  /** Bloquants : au moins une vérification en erreur. */
  compatible: boolean;
  nodeVersion: string;
  appVersion: string;
};

const execFileAsync = promisify(execFile);

async function getNodeVersion(): Promise<string> {
  return process.version.replace(/^v/, "");
}

/** Migrations appliquées ? (lecture de la table _prisma_migrations) */
async function getMigrationsReport(
  db: PrismaClient,
): Promise<{ tableExists: boolean; applied: number; failed: number }> {
  const exists = await db.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    ) AS present`;
  if (!exists[0]?.present) {
    return { tableExists: false, applied: 0, failed: 0 };
  }
  const rows = await db.$queryRaw<{ finished: number; failed: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE "finished_at" IS NOT NULL) AS finished,
      COUNT(*) FILTER (WHERE "rolled_back_at" IS NOT NULL) AS failed
    FROM _prisma_migrations`;
  return {
    tableExists: true,
    applied: rows[0]?.finished ?? 0,
    failed: rows[0]?.failed ?? 0,
  };
}

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "child_profiles",
  "avatars",
  "learning_sessions",
  "installation",
] as const;

async function getMissingTables(db: PrismaClient): Promise<string[]> {
  const rows = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (${Prisma.join(REQUIRED_TABLES)})`;
  const present = new Set(rows.map((r) => r.table_name));
  return REQUIRED_TABLES.filter((t) => !present.has(t));
}

async function countAvatars(db: PrismaClient): Promise<number> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM avatars`;
  return Number(rows[0]?.count ?? 0);
}

/** Droits d'écriture : INSERT sur les tables + CREATE sur la base. */
async function getPermissionsReport(
  db: PrismaClient,
): Promise<{ canWrite: boolean; canCreate: boolean }> {
  const rows = await db.$queryRaw<{ canWrite: boolean; canCreate: boolean }[]>`
    SELECT
      has_database_privilege(current_user, current_database(), 'CREATE') AS "canCreate",
      has_table_privilege(current_user, 'app_config', 'INSERT, UPDATE')
        AND has_table_privilege(current_user, 'installation', 'INSERT, UPDATE')
        AND has_table_privilege(current_user, 'users', 'INSERT') AS "canWrite"`;
  return {
    canWrite: rows[0]?.canWrite ?? false,
    canCreate: rows[0]?.canCreate ?? false,
  };
}

/** Stockage persistant : écriture possible dans le répertoire courant. */
async function checkPersistentStorage(): Promise<boolean> {
  try {
    const fs = await import("node:fs/promises");
    const probe = join(process.cwd(), ".install-storage-probe");
    await fs.writeFile(probe, "ok");
    await fs.rm(probe);
    return true;
  } catch {
    return false;
  }
}

export async function getEnvironmentChecks(
  db: PrismaClient,
): Promise<EnvironmentReport> {
  const checks: EnvironmentCheck[] = [];
  const nodeVersion = await getNodeVersion();

  checks.push({
    id: "app_version",
    label: "Version de l'application",
    status: "ok",
    detail: `v${APP_VERSION}`,
  });

  const nodeMajor = Number(nodeVersion.split(".")[0]);
  if (nodeMajor >= 20) {
    checks.push({
      id: "node",
      label: "Version de Node.js",
      status: "ok",
      detail: `v${nodeVersion} (requis : 20 ou plus)`,
    });
  } else {
    checks.push({
      id: "node",
      label: "Version de Node.js",
      status: "error",
      detail: `v${nodeVersion} — Node.js 20 minimum est requis.`,
      solution: "Utilisez une image Docker Node 22 (fournie) ou mettez à jour Node.",
    });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    checks.push({
      id: "database_url",
      label: "Variable DATABASE_URL",
      status: "error",
      detail: "Absente — l'application ne sait pas où se trouve PostgreSQL.",
      solution:
        "Définissez DATABASE_URL dans l'environnement (Coolify, Compose, .env). " +
        "La valeur n'est jamais affichée ici.",
    });
    checks.push({
      id: "database",
      label: "Connexion PostgreSQL",
      status: "error",
      detail: "Non testée (DATABASE_URL absente).",
      solution: "Configurez DATABASE_URL puis rechargez cette page.",
    });
    checks.push({
      id: "migrations",
      label: "Migrations Prisma",
      status: "error",
      detail: "Non testées (base injoignable).",
    });
    checks.push({
      id: "tables",
      label: "Tables de l'application",
      status: "error",
      detail: "Non testées (base injoignable).",
    });
    checks.push({
      id: "permissions",
      label: "Permissions de la base",
      status: "error",
      detail: "Non testées (base injoignable).",
    });
    checks.push({
      id: "avatars",
      label: "Données de référence (avatars)",
      status: "error",
      detail: "Non testées (base injoignable).",
    });
    return { checks, compatible: false, nodeVersion, appVersion: APP_VERSION };
  }

  checks.push({
    id: "database_url",
    label: "Variable DATABASE_URL",
    status: "ok",
    detail: "Définie (valeur masquée).",
  });

  try {
    await db.$queryRaw`SELECT 1`;
    checks.push({
      id: "database",
      label: "Connexion PostgreSQL",
      status: "ok",
      detail: "Base joignable.",
    });
  } catch {
    checks.push({
      id: "database",
      label: "Connexion PostgreSQL",
      status: "error",
      detail: "Impossible d'exécuter une requête de test (SELECT 1).",
      solution:
        "Vérifiez que PostgreSQL est démarré (docker compose ps) et que " +
        "DATABASE_URL pointe vers le service correct (hôte : nom du service " +
        "compose, pas localhost).",
    });
    checks.push({
      id: "migrations",
      label: "Migrations Prisma",
      status: "warn",
      detail: "Non vérifiées (base injoignable).",
    });
    checks.push({
      id: "tables",
      label: "Tables de l'application",
      status: "warn",
      detail: "Non vérifiées (base injoignable).",
    });
    checks.push({
      id: "permissions",
      label: "Permissions de la base",
      status: "warn",
      detail: "Non vérifiées (base injoignable).",
    });
    checks.push({
      id: "avatars",
      label: "Données de référence (avatars)",
      status: "warn",
      detail: "Non vérifiées (base injoignable).",
    });
    return { checks, compatible: false, nodeVersion, appVersion: APP_VERSION };
  }

  // Migrations
  const migrations = await getMigrationsReport(db);
  if (migrations.failed > 0) {
    checks.push({
      id: "migrations",
      label: "Migrations Prisma",
      status: "error",
      detail: `${migrations.failed} migration(s) annulée(s) après échec.`,
      solution:
        "Inspectez la table _prisma_migrations puis corrigez la cause " +
        "(jamais de reset automatique : voir docs/DATABASE.md).",
    });
  } else if (migrations.applied === 0) {
    checks.push({
      id: "migrations",
      label: "Migrations Prisma",
      status: "warn",
      detail: "Aucune migration appliquée — l'assistant peut les appliquer.",
      solution:
        "L'assistant tentera « prisma migrate deploy » (idempotent, sans " +
        "effacement de données).",
    });
  } else {
    checks.push({
      id: "migrations",
      label: "Migrations Prisma",
      status: "ok",
      detail: `${migrations.applied} migration(s) appliquée(s).`,
    });
  }

  // Tables
  const missing = await getMissingTables(db);
  if (missing.length === 0) {
    checks.push({
      id: "tables",
      label: "Tables de l'application",
      status: "ok",
      detail: "Toutes les tables requises sont présentes.",
    });
  } else {
    checks.push({
      id: "tables",
      label: "Tables de l'application",
      status: "warn",
      detail: `Absentes : ${missing.join(", ")}.`,
      solution:
        "Appliquez les migrations (l'assistant le propose à l'étape " +
        "d'initialisation) — opération non destructive.",
    });
  }

  // Permissions
  const perms = await getPermissionsReport(db);
  checks.push({
    id: "permissions",
    label: "Permissions de la base",
    status: perms.canWrite ? "ok" : "error",
    detail: perms.canWrite
      ? `Lecture/écriture vérifiées${perms.canCreate ? " + droit de créer des tables." : "."}`
      : "L'utilisateur PostgreSQL ne peut pas écrire dans les tables requises.",
    solution: perms.canWrite
      ? undefined
      : "Utilisez un utilisateur applicatif disposant des droits " +
        "INSERT/UPDATE (voir docs/DATABASE.md) — pas le super-utilisateur.",
  });

  // Avatars
  const avatars = await countAvatars(db);
  checks.push({
    id: "avatars",
    label: "Données de référence (avatars)",
    status: avatars >= 8 ? "ok" : "warn",
    detail:
      avatars >= 8
        ? `${avatars} avatars disponibles.`
        : `${avatars} avatar(s) — la vérification sera complétée à l'initialisation.`,
    solution: avatars >= 8 ? undefined : "L'assistant insérera les avatars (upsert idempotent).",
  });

  // Stockage
  const storageOk = await checkPersistentStorage();
  checks.push({
    id: "storage",
    label: "Stockage persistant",
    status: storageOk ? "ok" : "error",
    detail: storageOk
      ? "Répertoire de travail accessible en écriture."
      : "Répertoire de travail en lecture seule.",
    solution: storageOk
      ? undefined
      : "Montez un volume persistant (Compose/Coolify) pour les fichiers " +
        "nécessaires ; les données métier restent dans PostgreSQL.",
  });

  const compatible = checks.every((c) => c.status !== "error");
  return { checks, compatible, nodeVersion, appVersion: APP_VERSION };
}

/**
 * Localisation du CLI Prisma complet.
 * En développement : <projet>/node_modules/prisma (+ prisma.config.ts et
 * prisma/schema.prisma à la racine du projet).
 * En conteneur : /app/prisma-cli (arbre autonome construit par l'étape
 * « migrator » du Dockerfile).
 * Le dossier choisi sert de `cwd` au CLI : c'est là que prisma.config.ts
 * et le schéma sont résolus.
 */
function findMigratorRoot(): string | null {
  const candidates = [
    join(process.cwd(), "prisma-cli"),
    "/app/prisma-cli",
    process.cwd(),
  ];
  for (const root of candidates) {
    try {
      const cli = join(root, "node_modules", "prisma", "build", "index.js");
      const schema = join(root, "prisma", "schema.prisma");
      if (existsSync(cli) && existsSync(schema)) return root;
    } catch {
      // racine inaccessible : on essaie la suivante
    }
  }
  return null;
}

/**
 * Application des migrations via le CLI Prisma (étape d'initialisation).
 * Idempotent et non destructif : `prisma migrate deploy` n'applique que
 * les migrations versionnées non encore appliquées.
 * Retourne les lignes de sortie (sans aucune valeur de secret).
 */
export async function runPrismaMigrations(databaseUrl: string): Promise<{
  ok: boolean;
  logs: string[];
  error?: string;
}> {
  const logs: string[] = [];
  const root = findMigratorRoot();
  if (!root) {
    return {
      ok: false,
      logs,
      error:
        "CLI Prisma introuvable. Appliquez les migrations en étape de " +
        "déploiement : `npx prisma migrate deploy` (jamais de reset).",
    };
  }
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [join(root, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      },
    );
    if (stdout) logs.push(...stdout.trim().split("\n"));
    if (stderr) logs.push(...stderr.trim().split("\n"));
    return { ok: true, logs };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message: string };
    if (err.stdout) logs.push(...err.stdout.trim().split("\n"));
    if (err.stderr) logs.push(...err.stderr.trim().split("\n"));
    logs.push(
      "Si l'environnement n'embarque pas le CLI Prisma (serverless), " +
        "appliquez les migrations en étape de déploiement : " +
        "`npx prisma migrate deploy` (jamais de reset).",
    );
    return { ok: false, logs, error: "Exécution des migrations impossible." };
  }
}

/** Liste des dossiers de migrations versionnées (info diagnostic). */
export async function listLocalMigrations(): Promise<string[]> {
  try {
    const dir = join(process.cwd(), "prisma", "migrations");
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}
