"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/client";
import { requireParentSession } from "@/lib/auth/guards";
import {
  setChildCookie,
  clearChildCookie,
} from "@/lib/auth/child-guard";
import {
  canCreateChild,
  createChild,
  getChildForParent,
  softDeleteChild,
  updateChild,
} from "@/features/children/service";

/**
 * Server Actions des profils enfants — réservées au parent connecté
 * (CSRF : vérification d'Origin intégrée de Next.js).
 */

export type ChildFormState = { error?: string; success?: string };

export async function createChildAction(
  _prevState: ChildFormState,
  formData: FormData,
): Promise<ChildFormState> {
  const { user } = await requireParentSession();

  const avatarId = String(formData.get("avatarId") ?? "");
  const pseudonym = String(formData.get("pseudonym") ?? "");
  if (!avatarId) return { error: "Choisissez un avatar." };

  if (!(await canCreateChild(prisma, user.id))) {
    return {
      error: `Maximum ${6} profils enfants par compte.`,
    };
  }

  const result = await createChild(prisma, user.id, {
    pseudonym,
    avatarId,
  });
  switch (result.status) {
    case "invalid_input":
      return {
        error:
          "Pseudonyme ou avatar invalide (2 à 20 caractères, lettres/chiffres/tirets).",
      };
    case "not_found":
      return { error: "Profil introuvable." };
    case "ok":
      revalidatePath("/parent");
      return { success: `Profil de ${result.data.pseudonym} créé !` };
  }
}

export async function updateChildAction(
  _prevState: ChildFormState,
  formData: FormData,
): Promise<ChildFormState> {
  const { user } = await requireParentSession();
  const childProfileId = String(formData.get("childProfileId") ?? "");
  if (!childProfileId) return { error: "Profil manquant." };

  const input: { pseudonym?: string; avatarId?: string } = {};
  const pseudonym = formData.get("pseudonym");
  const avatarId = formData.get("avatarId");
  if (pseudonym) input.pseudonym = String(pseudonym);
  if (avatarId) input.avatarId = String(avatarId);

  const result = await updateChild(prisma, childProfileId, user.id, input);
  switch (result.status) {
    case "not_found":
      return { error: "Profil introuvable." };
    case "invalid_input":
      return { error: "Champ invalide (2 à 20 caractères pour le pseudonyme)." };
    case "ok":
      revalidatePath("/parent");
      return { success: "Profil mis à jour." };
  }
}

export async function deleteChildAction(
  _prevState: ChildFormState,
  formData: FormData,
): Promise<ChildFormState> {
  const { user } = await requireParentSession();
  const childProfileId = String(formData.get("childProfileId") ?? "");
  if (!childProfileId) return { error: "Profil manquant." };

  const result = await softDeleteChild(prisma, childProfileId, user.id);
  switch (result.status) {
    case "not_found":
      return { error: "Profil introuvable." };
    case "invalid_input":
      return { error: "Requête invalide." };
    case "ok":
      revalidatePath("/parent");
      return { success: "Profil supprimé. Vous pouvez le recréer." };
  }
}

/** Sélectionne un profil enfant pour entrer dans l'espace du jeu. */
export async function selectChildAction(formData: FormData): Promise<void> {
  const { user } = await requireParentSession();
  const childProfileId = String(formData.get("childProfileId") ?? "");
  if (!childProfileId) redirect("/parent");

  // Vérification d'appartenance AVANT de poser le cookie.
  const owned = await getChildForParent(prisma, childProfileId, user.id);
  if (owned.status !== "ok") redirect("/parent");

  await setChildCookie(childProfileId);
  redirect("/enfant");
}

/** Quitte l'espace enfant (retour parent) : retire la sélection. */
export async function exitChildSpaceAction(): Promise<void> {
  await requireParentSession();
  await clearChildCookie();
  redirect("/parent");
}
