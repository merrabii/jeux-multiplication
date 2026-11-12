import { SignJWT, jwtVerify } from "jose";
import { getAuthSecret } from "./config";

/**
 * Jetons de session JWT (HS256).
 *
 * Stratégie de révocation (documentée dans docs/SECURITY.md) :
 * le JWT n'est PAS auto-suffisant. Chaque jeton porte un identifiant de
 * session (`jti`) correspondant à une ligne de la table `sessions`.
 * `resolveSession` vérifie systématiquement en PostgreSQL que la session
 * existe, n'est pas révoquée (revokedAt) et n'est pas expirée.
 * Supprimer le cookie ne suffit donc pas : un jeton volé ou conservé
 * devient inutilisable dès la révocation en base.
 */

export type SessionPayload = {
  /** Identifiant utilisateur (JWT `sub`). */
  userId: string;
  /** Identifiant de session en base (JWT `jti`). */
  sessionId: string;
};

export function getSessionCookieName(): string {
  return "rmm_session";
}

function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret());
}

/** Signe un JWT de session. `expiresAt` contrôle l'expiration réelle. */
export async function signSessionToken(
  payload: SessionPayload,
  expiresAt: Date,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setJti(payload.sessionId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSigningKey());
}

/**
 * Vérifie la signature et l'expiration du JWT.
 * Retourne la charge utile, ou null (jeton invalide, falsifié, expiré).
 * Les erreurs sont volontairement réduites à null : aucun détail
 * cryptographique n'est exposé.
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string" ||
      payload.sub.length === 0 ||
      payload.jti.length === 0
    ) {
      return null;
    }
    return { userId: payload.sub, sessionId: payload.jti };
  } catch {
    return null;
  }
}
