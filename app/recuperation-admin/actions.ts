"use server";

import { prisma } from "@/lib/database/client";
import { verifyRecoveryToken } from "@/features/installer/token";
import { hashPassword } from "@/lib/auth/password";
import { getInstallationState } from "@/features/installer/status";
import { z } from "zod";

/**
 * Récupération sécurisée de l'accès administrateur.
 *
 * Ce mécanisme est DISTINCT de l'installation initiale :
 * - il ne fonctionne que si l'installation est terminée (verrou posé) ;
 * - il exige la variable ADMIN_RECOVERY_TOKEN, définie uniquement par
 *   l'administrateur du serveur (absente → mécanisme désactivé) ;
 * - le jeton est comparé à temps constant ;
 * - limitation : 3 tentatives maximum par heure et par instance
 *   (compteur mémoire — le jeton serveur reste la protection
 *   principale, documenté dans docs/SECURITY.md) ;
 * - le mot de passe est réinitialisé par e-mail connu + hachage bcrypt,
 *   et toutes les sessions existantes de l'administrateur sont
 *   révoquées ;
 * - aucun e-mail/mot de passe n'est journalisé.
 */

const RECOVERY_SCHEMA = z.object({
  token: z.string().min(1).max(200),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .email("Veuillez saisir une adresse e-mail valide."),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(100, "Le mot de passe ne peut pas dépasser 100 caractères."),
  passwordConfirm: z.string(),
});

export type RecoveryFormState = { error?: string; ok?: boolean };

const attempts: number[] = [];
const MAX_ATTEMPTS_PER_HOUR = 3;

function tooManyAttempts(): boolean {
  const now = Date.now();
  const recent = attempts.filter((t) => now - t < 60 * 60 * 1000);
  attempts.length = 0;
  attempts.push(...recent);
  return recent.length >= MAX_ATTEMPTS_PER_HOUR;
}

export async function recoverAdminAction(
  _prev: RecoveryFormState,
  formData: FormData,
): Promise<RecoveryFormState> {
  // L'installation est-elle terminée ? Sinon, pas de mécanisme.
  const state = await getInstallationState(prisma);
  if (state.status !== "completed") {
    return {
      error: "La récupération n'est disponible qu'après l'installation.",
    };
  }

  if (tooManyAttempts()) {
    return {
      error: "Trop de tentatives. Réessayez dans une heure.",
    };
  }
  attempts.push(Date.now());

  const parsed = RECOVERY_SCHEMA.safeParse({
    token: formData.get("token") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    passwordConfirm: formData.get("passwordConfirm") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  if (parsed.data.password !== parsed.data.passwordConfirm) {
    return { error: "Les mots de passe ne correspondent pas." };
  }

  if (!verifyRecoveryToken(parsed.data.token)) {
    return { error: "Jeton de récupération invalide." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "admin") {
    // Message volontairement générique (pas d'énumération de comptes).
    return { error: "Récupération impossible pour ces informations." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    // Révocation de toutes les sessions existantes du compte.
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
