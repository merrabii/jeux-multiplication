import type { PrismaClient } from "@/lib/database/generated/client";
import { CREATE_CHILD_SCHEMA, UPDATE_CHILD_SCHEMA } from "@/lib/validation/child";

/**
 * Service métier des profils enfants (Phase 2.2).
 * - Le client Prisma est injectable pour les tests d'intégration.
 * - Toutes les fonctions vérifient l'appartenance au compte parent
 *   (isolation stricte entre familles).
 * - Suppression LOGIQUE (deletedAt) : aucune donnée n'est effacée.
 */

export type ChildProfileView = {
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
  createdAt: Date;
};

export type ChildrenServiceResult<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" }
  | { status: "invalid_input" };

const CHILD_SELECT = {
  id: true,
  pseudonym: true,
  avatarId: true,
  level: true,
  totalStars: true,
  coins: true,
  diamonds: true,
  xp: true,
  createdAt: true,
  avatar: { select: { name: true, imageKey: true } },
} as const;

type ChildRow = {
  id: string;
  pseudonym: string;
  avatarId: string | null;
  level: number;
  totalStars: number;
  coins: number;
  diamonds: number;
  xp: number;
  createdAt: Date;
  avatar: { name: string; imageKey: string } | null;
};

export function toChildView(row: ChildRow): ChildProfileView {
  return {
    id: row.id,
    pseudonym: row.pseudonym,
    avatarId: row.avatarId,
    avatarName: row.avatar?.name ?? null,
    avatarImageKey: row.avatar?.imageKey ?? null,
    level: row.level,
    totalStars: row.totalStars,
    coins: row.coins,
    diamonds: row.diamonds,
    xp: row.xp,
    createdAt: row.createdAt,
  };
}

/** Liste des profils actifs d'un parent (profils supprimés exclus). */
export async function listChildren(
  db: PrismaClient,
  userId: string,
): Promise<ChildProfileView[]> {
  const rows = await db.childProfile.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: CHILD_SELECT,
  });
  return rows.map(toChildView);
}

/**
 * Crée un profil enfant pour le parent.
 * L'avatar doit exister dans le catalogue seedé.
 */
export async function createChild(
  db: PrismaClient,
  userId: string,
  input: unknown,
): Promise<ChildrenServiceResult<ChildProfileView>> {
  const parsed = CREATE_CHILD_SCHEMA.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };

  const avatarExists = await db.avatar.findUnique({
    where: { id: parsed.data.avatarId },
    select: { id: true },
  });
  if (!avatarExists) return { status: "invalid_input" };

  const row = await db.childProfile.create({
    data: {
      userId,
      pseudonym: parsed.data.pseudonym,
      avatarId: parsed.data.avatarId,
      settings: { create: {} },
    },
    select: CHILD_SELECT,
  });
  return { status: "ok", data: toChildView(row) };
}

/**
 * Récupère un profil enfant en vérifiant l'appartenance au parent.
 * Les profils supprimés (deletedAt) sont traités comme inexistants.
 */
export async function getChildForParent(
  db: PrismaClient,
  childProfileId: string,
  userId: string,
): Promise<ChildrenServiceResult<ChildProfileView>> {
  const row = await db.childProfile.findFirst({
    where: { id: childProfileId, userId, deletedAt: null },
    select: CHILD_SELECT,
  });
  if (!row) return { status: "not_found" };
  return { status: "ok", data: toChildView(row) };
}

/**
 * Modifie pseudonyme et/ou avatar d'un profil enfant (parent propriétaire).
 */
export async function updateChild(
  db: PrismaClient,
  childProfileId: string,
  userId: string,
  input: unknown,
): Promise<ChildrenServiceResult<ChildProfileView>> {
  const parsed = UPDATE_CHILD_SCHEMA.safeParse(input);
  if (!parsed.success) return { status: "invalid_input" };

  // Vérification d'appartenance AVANT toute écriture.
  const owned = await db.childProfile.findFirst({
    where: { id: childProfileId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!owned) return { status: "not_found" };

  const data: { pseudonym?: string; avatarId?: string } = {};
  if (parsed.data.pseudonym !== undefined) data.pseudonym = parsed.data.pseudonym;
  if (parsed.data.avatarId !== undefined) {
    const avatarExists = await db.avatar.findUnique({
      where: { id: parsed.data.avatarId },
      select: { id: true },
    });
    if (!avatarExists) return { status: "invalid_input" };
    data.avatarId = parsed.data.avatarId;
  }

  const row = await db.childProfile.update({
    where: { id: childProfileId },
    data,
    select: CHILD_SELECT,
  });
  return { status: "ok", data: toChildView(row) };
}

/**
 * Suppression logique (deletedAt) : les données pédagogiques sont
 * conservées ; le profil disparaît des listes et devient inaccessible.
 */
export async function softDeleteChild(
  db: PrismaClient,
  childProfileId: string,
  userId: string,
): Promise<ChildrenServiceResult<{ id: string }>> {
  const owned = await db.childProfile.findFirst({
    where: { id: childProfileId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!owned) return { status: "not_found" };

  await db.childProfile.update({
    where: { id: childProfileId },
    data: { deletedAt: new Date() },
  });
  return { status: "ok", data: { id: childProfileId } };
}

/** Nombre maximum de profils enfants par compte parent (minimisation). */
export const MAX_CHILDREN_PER_PARENT = 6;

export async function canCreateChild(
  db: PrismaClient,
  userId: string,
): Promise<boolean> {
  const count = await db.childProfile.count({
    where: { userId, deletedAt: null },
  });
  return count < MAX_CHILDREN_PER_PARENT;
}
