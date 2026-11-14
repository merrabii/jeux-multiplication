import { prisma } from "@/lib/database/client";
import { Prisma, PrismaClient } from "@/lib/database/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedAvatars } from "@/features/avatars/seed";
import { runPrismaMigrations } from "./environment";
import { buildExternalDatabaseUrl } from "./db-config";
import { EXTERNAL_DB_SCHEMA, APP_CONFIG_SCHEMA } from "./schemas";
import type { ExternalDbInput } from "./schemas";
import { INSTALLATION_ROW_ID } from "./status";
import { APP_VERSION } from "@/lib/version";

/**
 * Étape 4 de l'assistant — initialisation RÉELLE, opération par
 * opération. Aucune progression simulée : chaque étape est exécutée
 * ici et son résultat est renvoyé tel quel au navigateur.
 *
 * Les migrations ne suppriment jamais de données (migrate deploy).
 * Les avatars sont insérés par upsert idempotent.
 */

export type InitStepId =
  | "connection"
  | "schema"
  | "migrations"
  | "tables"
  | "seed"
  | "config";

export type InitStepResult = {
  id: InitStepId;
  label: string;
  ok: boolean;
  detail: string;
  /** Ligne de journal technique (diagnostic, sans secret). */
  logs?: string[];
};

export type InitReport = {
  ok: boolean;
  steps: InitStepResult[];
};

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "child_profiles",
  "avatars",
  "learning_sessions",
  "installation",
  "app_config",
] as const;

async function missingTables(
  db: PrismaClient,
  tables: readonly string[],
): Promise<string[]> {
  const rows = await db.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (${Prisma.join([...tables])})`;
  const present = new Set(rows.map((r) => r.table_name));
  return tables.filter((t) => !present.has(t));
}

/**
 * Sauvegarde la configuration générale (étape 2) dans app_config.
 * Les clés sont préfixées `app.` ; jamais de secret ici.
 */
export async function saveAppConfig(
  db: PrismaClient,
  raw: unknown,
): Promise<{ ok: boolean; errors?: Record<string, string> }> {
  const parsed = APP_CONFIG_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] = issue.message;
    }
    return { ok: false, errors };
  }
  const entries: Array<[string, string]> = [
    ["app.name", parsed.data.appName],
    ["app.url", parsed.data.appUrl],
    ["app.language", parsed.data.defaultLanguage],
    ["app.timezone", parsed.data.timezone],
    ["app.organization", parsed.data.organization ?? ""],
  ];
  for (const [key, value] of entries) {
    await db.appConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  return { ok: true };
}

/** Lit la configuration générale stockée (valeurs par défaut sinon). */
export async function readAppConfig(
  db: PrismaClient,
): Promise<{
  appName: string;
  appUrl: string;
  defaultLanguage: string;
  timezone: string;
  organization: string;
}> {
  const rows = await db.appConfig.findMany({ where: { key: { startsWith: "app." } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    appName: map.get("app.name") ?? "",
    appUrl: map.get("app.url") ?? "",
    defaultLanguage: map.get("app.language") ?? "fr",
    timezone: map.get("app.timezone") ?? "Europe/Paris",
    organization: map.get("app.organization") ?? "",
  };
}

/**
 * Test de la connexion d'une base externe à partir d'un payload brut.
 * Retourne un diagnostic sans jamais révéler le mot de passe.
 */
export async function testExternalDb(raw: unknown): Promise<{
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
}> {
  const parsed = EXTERNAL_DB_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] = issue.message;
    }
    return { ok: false, message: "Formulaire incomplet ou invalide.", errors };
  }
  const { testExternalConnection } = await import("./db-config");
  const result = await testExternalConnection(parsed.data);
  return { ok: result.ok, message: result.message };
}

/**
 * Initialisation complète (étape 4) :
 * 1. connexion, 2. schéma/migrations, 3. tables, 4. seed avatars,
 * 5. configuration. En cas d'échec, l'erreur est explicite et la
 * configuration reste corrigeable sans perte de données.
 */
export async function initializeDatabase(options: {
  /** Base externe saisie à l'étape 3B (sinon DATABASE_URL de l'environnement). */
  externalDb?: ExternalDbInput;
  /** Appliquer les migrations via le CLI Prisma (recommandé Docker/VPS). */
  runMigrations?: boolean;
}): Promise<InitReport> {
  const steps: InitStepResult[] = [];
  const targetUrl = options.externalDb
    ? buildExternalDatabaseUrl(options.externalDb)
    : process.env.DATABASE_URL ?? "";

  // 1. Connexion
  if (targetUrl) {
    const probe = new PrismaClient({
      adapter: new PrismaPg({ connectionString: targetUrl, max: 1 }),
    });
    try {
      await probe.$queryRaw`SELECT 1`;
      steps.push({
        id: "connection",
        label: "Vérification de la connexion",
        ok: true,
        detail: "PostgreSQL répond (SELECT 1).",
      });
    } catch (error) {
      steps.push({
        id: "connection",
        label: "Vérification de la connexion",
        ok: false,
        detail:
          "Connexion impossible. Corrigez la configuration à l'étape " +
          "précédente puis relancez (aucune donnée n'a été modifiée).",
        logs: [(error as { message?: string }).message ?? "erreur inconnue"],
      });
      return { ok: false, steps };
    } finally {
      await probe.$disconnect();
    }
  } else {
    steps.push({
      id: "connection",
      label: "Vérification de la connexion",
      ok: false,
      detail: "DATABASE_URL absente de l'environnement.",
    });
    return { ok: false, steps };
  }

  // 2. Migrations (optionnel mais recommandé)
  if (options.runMigrations !== false) {
    const result = await runPrismaMigrations(targetUrl);
    steps.push({
      id: "migrations",
      label: "Application des migrations Prisma",
      ok: result.ok,
      detail: result.ok
        ? "Migrations appliquées (migrate deploy, idempotent)."
        : (result.error ?? "Migrations non appliquées."),
      logs: result.logs,
    });
    if (!result.ok) {
      steps.push({
        id: "tables",
        label: "Vérification des tables",
        ok: false,
        detail: "Non vérifiées (migrations non appliquées).",
      });
      steps.push({
        id: "seed",
        label: "Données indispensables",
        ok: false,
        detail: "Non exécutées (migrations non appliquées).",
      });
      steps.push({
        id: "config",
        label: "Vérification de la configuration",
        ok: false,
        detail: "Non vérifiée.",
      });
      return { ok: false, steps };
    }
  }

  // 3. Tables (client sur la base cible si externe)
  const db = options.externalDb ? createTargetClient(targetUrl) : prisma;
  try {
    const missing = await missingTables(db, REQUIRED_TABLES);
    if (missing.length > 0) {
      steps.push({
        id: "tables",
        label: "Vérification des tables",
        ok: false,
        detail: `Tables absentes : ${missing.join(", ")}.`,
      });
      return { ok: false, steps };
    }
    steps.push({
      id: "tables",
      label: "Vérification des tables",
      ok: true,
      detail: "Toutes les tables requises sont présentes.",
    });

    // 4. Données indispensables (avatars, upsert idempotent)
    const count = await seedAvatars(db);
    steps.push({
      id: "seed",
      label: "Données indispensables",
      ok: true,
      detail: `${count} avatars disponibles (upsert idempotent).`,
    });

    // 5. Ligne d'installation (sans terminer : le verrou est posé à l'étape admin)
    await db.installation.upsert({
      where: { id: INSTALLATION_ROW_ID },
      update: { appVersion: APP_VERSION, attemptsCount: 0 },
      create: { id: INSTALLATION_ROW_ID, appVersion: APP_VERSION },
    });
    steps.push({
      id: "config",
      label: "Vérification de la configuration",
      ok: true,
      detail: "Installation enregistrée, prête pour le compte administrateur.",
    });
    return { ok: true, steps };
  } catch (error) {
    steps.push({
      id: "tables",
      label: "Vérification des tables",
      ok: false,
      detail: "Erreur pendant l'initialisation.",
      logs: [(error as { message?: string }).message ?? "erreur inconnue"],
    });
    return { ok: false, steps };
  } finally {
    if (options.externalDb) {
      await db.$disconnect();
    }
  }
}

function createTargetClient(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });
}
