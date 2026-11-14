import type { PrismaClient } from "@/lib/database/generated/client";
import { hashPassword } from "@/lib/auth/password";
import { ADMIN_SCHEMA } from "./schemas";
import type { AdminInput } from "./schemas";
import { INSTALLATION_ROW_ID } from "./status";

/**
 * Étape 5 — création du premier administrateur.
 *
 * Sécurité :
 * - vérification côté serveur qu'aucun administrateur n'existe déjà
 *   (rôle admin sur `users`) ;
 * - atomicité : transaction + `SELECT ... FOR UPDATE` sur la ligne
 *   singleton `installation` — deux requêtes simultanées ne peuvent
 *   jamais créer deux administrateurs initiaux ;
 * - mot de passe haché bcrypt (coût de la configuration AUTH), jamais
 *   stocké ni journalisé en clair ;
 * - limitation anti-abus : tentatives comptées en base, blocage
 *   temporaire après 5 échecs (15 minutes) ;
 * - après la création, `completedAt` est posé : l'installateur est
 *   verrouillé définitivement (aucune recréation par URL possible).
 */

const MAX_ATTEMPTS = 5;
const BLOCK_MINUTES = 15;

export type CreateAdminResult =
  | { status: "created" }
  | { status: "invalid_input"; errors: Record<string, string> }
  | { status: "already_installed" }
  | { status: "admin_exists" }
  | { status: "blocked"; retryAfterMinutes: number };

type InstallationRow = {
  status: string;
  completedAt: Date | null;
  attemptsCount: number;
  blockedUntil: Date | null;
};

export async function createFirstAdmin(
  db: PrismaClient,
  raw: unknown,
): Promise<CreateAdminResult> {
  const parsed = ADMIN_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] = issue.message;
    }
    // Anti-abus : les échecs (formulaire invalide) sont comptés en base.
    await recordFailedAttempt(db);
    return { status: "invalid_input", errors };
  }
  return createFirstAdminTyped(db, parsed.data);
}

async function createFirstAdminTyped(
  db: PrismaClient,
  input: AdminInput,
): Promise<CreateAdminResult> {
  // La ligne singleton doit exister avant le verrou de transaction.
  // INSERT ... ON CONFLICT DO NOTHING : deux appels simultanés (installations
  // concurrentes) ne provoquent jamais de violation de clé primaire.
  await db.$executeRaw`
    INSERT INTO installation (id, "updatedAt")
    VALUES (${INSTALLATION_ROW_ID}, NOW())
    ON CONFLICT (id) DO NOTHING`;

  return db.$transaction(async (tx) => {
    // Verrou de concurrence : sérialise deux soumissions simultanées.
    const locked = await tx.$queryRaw<InstallationRow[]>`
      SELECT status, "completedAt", "attemptsCount", "blockedUntil"
      FROM installation
      WHERE id = ${INSTALLATION_ROW_ID}
      FOR UPDATE`;
    const row = locked[0];
    if (!row) {
      return { status: "already_installed" } as const;
    }

    if (row.status === "completed" && row.completedAt !== null) {
      return { status: "already_installed" } as const;
    }

    const now = new Date();
    if (row.blockedUntil && row.blockedUntil > now) {
      const retryAfterMinutes = Math.max(
        1,
        Math.ceil((row.blockedUntil.getTime() - now.getTime()) / 60_000),
      );
      return { status: "blocked", retryAfterMinutes } as const;
    }

    // Vérification serveur : aucun administrateur existant.
    const admins = await tx.user.count({ where: { role: "admin" } });
    if (admins > 0) {
      return { status: "admin_exists" } as const;
    }

    const passwordHash = await hashPassword(input.password);
    const admin = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        role: "admin",
      },
      select: { id: true },
    });

    // Verrou définitif de l'installateur.
    await tx.installation.update({
      where: { id: INSTALLATION_ROW_ID },
      data: {
        status: "completed",
        completedAt: now,
        adminUserId: admin.id,
        attemptsCount: 0,
        blockedUntil: null,
      },
    });

    return { status: "created" } as const;
  });
}

/** Enregistre un échec (formulaire invalide / admin existant) : anti-abus. */
export async function recordFailedAttempt(db: PrismaClient): Promise<void> {
  // Atomicité : incrément + blocage en une seule requête (pas de
  // lecture-modification-écriture interrompue par une requête concurrente).
  await db.$executeRaw`
    INSERT INTO installation (id, "attemptsCount", "updatedAt")
    VALUES (${INSTALLATION_ROW_ID}, 1, NOW())
    ON CONFLICT (id) DO UPDATE SET
      "attemptsCount" = installation."attemptsCount" + 1,
      "blockedUntil" =
        CASE
          WHEN installation."attemptsCount" + 1 >= ${MAX_ATTEMPTS}
          THEN NOW() + (${BLOCK_MINUTES} || ' minutes')::interval
          ELSE installation."blockedUntil"
        END`;
}
