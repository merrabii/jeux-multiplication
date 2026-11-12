import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/client";
import {
  readSessionToken,
  resolveSession,
  type ResolvedSession,
} from "@/lib/database/session";

/**
 * Gardes d'autorisation — exécutés côté serveur, jamais côté navigateur.
 */

/**
 * Exige une session parent valide pour une page serveur.
 * Redirige vers la connexion si la session est absente, expirée ou révoquée.
 */
export async function requireParentSession(): Promise<ResolvedSession> {
  const token = await readSessionToken();
  const auth = await resolveSession(prisma, token);
  if (!auth) {
    redirect("/parent/connexion");
  }
  return auth;
}

/**
 * Session optionnelle pour les routes API :
 * retourne null si non authentifié (la route doit répondre 401).
 */
export async function getOptionalParentSession(): Promise<ResolvedSession | null> {
  const token = await readSessionToken();
  return resolveSession(prisma, token);
}
