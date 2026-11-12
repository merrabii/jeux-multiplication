import { cookies } from "next/headers";
import type { PrismaClient } from "./generated/client";
import {
  SESSION_HOURS,
} from "@/lib/auth/config";
import {
  getSessionCookieName,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/session-token";

/**
 * Gestion des sessions côté serveur : création, résolution, révocation.
 * PostgreSQL (table `sessions`) est la source de vérité de la révocation.
 */

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
};

export type ResolvedSession = {
  user: AuthenticatedUser;
  session: {
    id: string;
    expiresAt: Date;
    createdAt: Date;
  };
};

/**
 * Crée une session : ligne en PostgreSQL + JWT signé.
 * Retourne le jeton à poser en cookie httpOnly.
 */
export async function createSessionForUser(
  db: PrismaClient,
  userId: string,
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const session = await db.session.create({
    data: { userId, expiresAt },
    select: { id: true, expiresAt: true },
  });
  const token = await signSessionToken(
    { userId, sessionId: session.id },
    session.expiresAt,
  );
  return { token, expiresAt: session.expiresAt, sessionId: session.id };
}

/**
 * Résout un jeton de session : signature + expiration JWT, PUIS
 * vérification en base (session existante, non révoquée, non expirée,
 * appartenant bien à l'utilisateur du jeton).
 * Retourne null dans tous les cas invalides — aucun détail exposé.
 */
export async function resolveSession(
  db: PrismaClient,
  token: string | undefined | null,
): Promise<ResolvedSession | null> {
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const session = await db.session.findUnique({
    where: { id: payload.sessionId },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
      user: { select: { id: true, email: true, displayName: true, role: true } },
    },
  });

  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.userId !== payload.userId) return null;
  if (!session.user) return null;

  return {
    user: session.user,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    },
  };
}

/** Révoque une session en base (déconnexion). Le jeton devient inutilisable. */
export async function revokeSessionById(
  db: PrismaClient,
  sessionId: string,
): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/* ------------------------------------------------------------------ */
/* Helpers Next.js (cookies httpOnly) — utilisés par les Server Actions */
/* ------------------------------------------------------------------ */

/** Pose le cookie de session sécurisé. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const store = await cookies();
  store.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Supprime le cookie de session. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(getSessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Lit le jeton de session depuis les cookies. */
export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(getSessionCookieName())?.value ?? null;
}
