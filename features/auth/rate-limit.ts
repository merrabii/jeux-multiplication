import type { PrismaClient } from "@/lib/database/generated/client";
import {
  ATTEMPT_RETENTION_HOURS,
  ATTEMPT_WINDOW_MINUTES,
  BLOCK_MINUTES,
  MAX_LOGIN_ATTEMPTS,
} from "@/lib/auth/config";

/**
 * Limitation des tentatives de connexion — 100 % persistée en PostgreSQL
 * (aucun compteur en mémoire : la limitation survit aux redémarrages et
 * fonctionne avec plusieurs processus).
 *
 * Règles (documentées dans docs/SECURITY.md) :
 * - Les échecs sont comptés par adresse e-mail NORMALISÉE (minuscules,
 *   espaces retirés) sur une fenêtre glissante de 15 minutes.
 * - Au 5e échec de la fenêtre, blocage pendant 15 minutes à partir du
 *   5e échec. Tout nouvel échec pendant le blocage prolonge le blocage.
 * - Le blocage expire naturellement : après l'échéance, la connexion
 *   redevient possible sans intervention.
 * - Les tentatives de plus de 24 h sont purgées à chaque contrôle.
 */

export type RateLimitResult =
  | { blocked: false }
  | { blocked: true; retryAfterMinutes: number };

/** Normalisation partagée : anti-contournement par changement de casse. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Purge des tentatives anciennes (données techniques, minimisation). */
export async function cleanupOldAttempts(db: PrismaClient): Promise<void> {
  await db.loginAttempt.deleteMany({
    where: {
      attemptedAt: {
        lt: new Date(Date.now() - ATTEMPT_RETENTION_HOURS * 60 * 60 * 1000),
      },
    },
  });
}

/** Détermine si la connexion est autorisée pour cet e-mail. */
export async function checkLoginAllowed(
  db: PrismaClient,
  email: string,
): Promise<RateLimitResult> {
  await cleanupOldAttempts(db);

  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);
  const failures = await db.loginAttempt.findMany({
    where: {
      email: normalizeEmail(email),
      success: false,
      attemptedAt: { gte: windowStart },
    },
    orderBy: { attemptedAt: "asc" },
    select: { attemptedAt: true },
  });

  if (failures.length >= MAX_LOGIN_ATTEMPTS) {
    const nthFailure = failures[MAX_LOGIN_ATTEMPTS - 1].attemptedAt;
    const blockedUntil = new Date(
      nthFailure.getTime() + BLOCK_MINUTES * 60 * 1000,
    );
    const now = new Date();
    if (blockedUntil > now) {
      const retryAfterMinutes = Math.max(
        1,
        Math.ceil((blockedUntil.getTime() - now.getTime()) / 60_000),
      );
      return { blocked: true, retryAfterMinutes };
    }
  }

  return { blocked: false };
}

/** Enregistre une tentative (succès ou échec). */
export async function recordLoginAttempt(
  db: PrismaClient,
  attempt: {
    email: string;
    success: boolean;
    ipAddress?: string | null;
    userId?: string | null;
  },
): Promise<void> {
  await db.loginAttempt.create({
    data: {
      email: normalizeEmail(attempt.email),
      success: attempt.success,
      ipAddress: attempt.ipAddress ?? null,
      userId: attempt.userId ?? null,
    },
  });
}

/** Réinitialise les échecs d'un e-mail après une connexion réussie. */
export async function resetLoginAttempts(
  db: PrismaClient,
  email: string,
): Promise<void> {
  await db.loginAttempt.deleteMany({
    where: { email: normalizeEmail(email), success: false },
  });
}
