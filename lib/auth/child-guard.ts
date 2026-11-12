import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/client";
import {
  readSessionToken,
  resolveSession,
  type ResolvedSession,
} from "@/lib/database/session";

/**
 * Garde d'accès enfant (Phase 2.2).
 *
 * Modèle d'accès : session parent + cookie de sélection d'enfant
 * (`rmm_child`). À CHAQUE page ou appel API enfant, le couple est
 * revérifié côté serveur :
 *  1. la session parent est valide (non révoquée, non expirée) ;
 *  2. le profil enfant sélectionné appartient bien à ce parent ;
 *  3. le profil n'est pas supprimé (deletedAt null).
 * Un enfant ne peut donc jamais accéder aux données d'une autre famille
 * en manipulant un cookie ou une URL.
 */

export const CHILD_COOKIE_NAME = "rmm_child";

export type ChildContext = {
  auth: ResolvedSession;
  child: {
    id: string;
    pseudonym: string;
    avatarId: string | null;
    avatarName: string | null;
    avatarImageKey: string | null;
    level: number;
    totalStars: number;
    coins: number;
    diamonds: number;
    xp: number;
  };
};

/** Lit l'identifiant d'enfant sélectionné dans le cookie. */
export async function readSelectedChildId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CHILD_COOKIE_NAME)?.value ?? null;
}

/** Pose le cookie de sélection d'enfant (valable 90 jours glissants). */
export async function setChildCookie(childProfileId: string): Promise<void> {
  const store = await cookies();
  store.set(CHILD_COOKIE_NAME, childProfileId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 60 * 60,
  });
}

/** Supprime le cookie de sélection (retour à l'espace parent). */
export async function clearChildCookie(): Promise<void> {
  const store = await cookies();
  store.set(CHILD_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Résout le contexte enfant complet, ou null. Vérifie session + propriété
 * + non-suppression. Utilisé par les routes API (réponse 401/404).
 */
export async function getOptionalChildContext(): Promise<ChildContext | null> {
  const token = await readSessionToken();
  const auth = await resolveSession(prisma, token);
  if (!auth) return null;

  const childId = await readSelectedChildId();
  if (!childId) return null;

  const child = await prisma.childProfile.findFirst({
    where: { id: childId, userId: auth.user.id, deletedAt: null },
    select: {
      id: true,
      pseudonym: true,
      avatarId: true,
      level: true,
      totalStars: true,
      coins: true,
      diamonds: true,
      xp: true,
      avatar: { select: { name: true, imageKey: true } },
    },
  });
  if (!child) return null;

  return {
    auth,
    child: {
      id: child.id,
      pseudonym: child.pseudonym,
      avatarId: child.avatarId,
      avatarName: child.avatar?.name ?? null,
      avatarImageKey: child.avatar?.imageKey ?? null,
      level: child.level,
      totalStars: child.totalStars,
      coins: child.coins,
      diamonds: child.diamonds,
      xp: child.xp,
    },
  };
}

/**
 * Exige un contexte enfant valide pour une page serveur.
 * - Sans session parent valide → /parent/connexion.
 * - Session valide mais aucun enfant sélectionné (ou invalide) →
 *   /parent (sélection/création de profil).
 */
export async function requireChildContext(): Promise<ChildContext> {
  const token = await readSessionToken();
  const auth = await resolveSession(prisma, token);
  if (!auth) redirect("/parent/connexion");

  const context = await getOptionalChildContext();
  if (!context) redirect("/parent");
  return context;
}
