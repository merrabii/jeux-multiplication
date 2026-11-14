import type { PrismaClient } from "@/lib/database/generated/client";

/**
 * Statut d'installation, lu depuis la table `installation` (singleton).
 *
 * - "unreachable" : la base est joignable mais le schéma n'est pas
 *   appliqué (tables absentes) → l'installateur peut tenter les
 *   migrations.
 * - "pending"     : tables présentes, installation non terminée.
 * - "completed"   : verrou posé, installateur définitivement fermé.
 *
 * Compatibilité avec les installations existantes (mode hérité) : si
 * aucune ligne `installation` n'existe ou n'est terminée, mais que des
 * comptes utilisateurs ou des profils enfants existent déjà (bases de
 * développement et de test), l'installation est considérée comme
 * effectuée — l'assistant ne redirige jamais vers lui-même dans ce cas.
 */

export type InstallationStatus =
  | "unreachable"
  | "pending"
  | "completed";

export type InstallationState = {
  status: InstallationStatus;
  /** Mode hérité : comptes existants alors que le verrou n'est pas posé. */
  legacy: boolean;
  appVersion: string | null;
  completedAt: Date | null;
  blockedUntil: Date | null;
};

const INSTALLATION_ID = "installation";

export async function getInstallationState(
  db: PrismaClient,
): Promise<InstallationState> {
  const defaults: InstallationState = {
    status: "pending",
    legacy: false,
    appVersion: null,
    completedAt: null,
    blockedUntil: null,
  };

  // La table `installation` est-elle présente (schéma appliqué) ?
  const tablePresent = await db.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'installation'
    ) AS present`;
  if (!tablePresent[0]?.present) {
    return { ...defaults, status: "unreachable" };
  }

  const rows = await db.$queryRaw<
    {
      status: string;
      "completedAt": Date | null;
      "appVersion": string | null;
      "blockedUntil": Date | null;
    }[]
  >`
    SELECT status, "completedAt", "appVersion", "blockedUntil"
    FROM installation WHERE id = ${INSTALLATION_ID} LIMIT 1`;
  const row = rows[0];
  if (!row) {
    // Aucune ligne : installation neuve... sauf si des comptes existent
    // déjà (bases dev/test créées avant l'assistant) → mode hérité.
    const users = await db.user.count();
    const children = await db.childProfile.count();
    return { ...defaults, legacy: users > 0 || children > 0 };
  }

  const completed = row.status === "completed" && row.completedAt !== null;
  if (!completed) {
    // Mode hérité : des comptes existent déjà ? (bases dev/test, mises à
    // jour depuis une version sans assistant d'installation.)
    const users = await db.user.count();
    const children = await db.childProfile.count();
    return {
      ...defaults,
      legacy: users > 0 || children > 0,
      blockedUntil: row.blockedUntil,
    };
  }

  return {
    status: "completed",
    legacy: false,
    appVersion: row.appVersion,
    completedAt: row.completedAt,
    blockedUntil: null,
  };
}

/** L'assistant d'installation doit-il être proposé ? */
export async function isInstallationRequired(
  db: PrismaClient,
): Promise<boolean> {
  const state = await getInstallationState(db);
  return state.status !== "completed" && !state.legacy;
}

/** Identifiant du singleton en base. */
export const INSTALLATION_ROW_ID = INSTALLATION_ID;
