import { Prisma } from "@/lib/database/generated/client";
import type { PrismaClient } from "@/lib/database/generated/client";
import {
  CURRENT_TERMS_VERSION,
  REGISTER_SCHEMA,
  type RegisterInput,
} from "@/lib/validation/auth";
import {
  dummyVerify,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  checkLoginAllowed,
  normalizeEmail,
  recordLoginAttempt,
  resetLoginAttempts,
} from "./rate-limit";

/**
 * Service métier d'authentification parent.
 * Logique sans dépendance HTTP : le client Prisma est injectable pour
 * les tests d'intégration sur une base PostgreSQL isolée.
 * Aucun mot de passe en clair n'est journalisé ni renvoyé.
 */

export type ParentUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type RegisterResult =
  | { status: "created"; user: ParentUser }
  | { status: "email_taken" }
  | { status: "invalid_input" };

export type AuthenticateResult =
  | { status: "authenticated"; user: ParentUser }
  | { status: "invalid_credentials" }
  | { status: "blocked"; retryAfterMinutes: number };

/**
 * Inscription d'un parent.
 * - Validation Zod (renvoyée sous forme de résultat, jamais d'exception
 *   utilisateur).
 * - E-mail normalisé (minuscules) + unicité garantie par la base
 *   (index unique LOWER(email), anti-contournement par casse).
 * - Mot de passe haché bcrypt.
 */
export async function registerParent(
  input: unknown,
  db: PrismaClient,
): Promise<RegisterResult> {
  const parsed = REGISTER_SCHEMA.safeParse(input);
  if (!parsed.success) {
    return { status: "invalid_input" };
  }
  const data: RegisterInput = parsed.data;
  const email = normalizeEmail(data.email);
  const passwordHash = await hashPassword(data.password);

  try {
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        role: "parent",
        termsAcceptedAt: new Date(),
        termsVersion: CURRENT_TERMS_VERSION,
      },
      select: { id: true, email: true, displayName: true },
    });
    return { status: "created", user };
  } catch (error) {
    // Violation d'unicité (course concurrente incluse) : e-mail déjà pris.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "email_taken" };
    }
    throw error;
  }
}

/**
 * Connexion d'un parent.
 * - Vérifie d'abord la limitation de tentatives (persistée en base).
 * - Mot de passe vérifié par bcrypt ; pour un compte inconnu, une
 *   comparaison factice égalise le temps de réponse (anti-oracle
 *   temporel).
 * - Message d'échec unique : impossible de distinguer « compte
 *   inexistant » de « mot de passe incorrect ».
 */
export async function authenticateParent(
  emailRaw: string,
  passwordRaw: string,
  db: PrismaClient,
  ipAddress?: string | null,
): Promise<AuthenticateResult> {
  const email = normalizeEmail(emailRaw);

  const limit = await checkLoginAllowed(db, email);
  if (limit.blocked) {
    return { status: "blocked", retryAfterMinutes: limit.retryAfterMinutes };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, displayName: true, passwordHash: true },
  });

  const valid = user
    ? await verifyPassword(passwordRaw, user.passwordHash)
    : await dummyVerify(passwordRaw);

  await recordLoginAttempt(db, {
    email,
    success: valid,
    ipAddress: ipAddress ?? null,
    userId: user?.id ?? null,
  });

  if (!valid || !user) {
    return { status: "invalid_credentials" };
  }

  await resetLoginAttempts(db, email);
  return {
    status: "authenticated",
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  };
}
