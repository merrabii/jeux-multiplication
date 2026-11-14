import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/client";
import { isInstallationRequired } from "@/features/installer/status";

/**
 * Garde « application installée » — exécuté côté serveur uniquement.
 *
 * Si l'application n'est pas encore installée (aucune ligne
 * `installation` terminée, aucun utilisateur, aucun profil enfant),
 * toute page de l'application redirige vers l'assistant
 * /installation. Les routes API restent hors du garde (réponses 401
 * explicites) afin de ne pas dégrader le comportement des clients.
 */
export async function ensureInstalled(): Promise<void> {
  if (await isInstallationRequired(prisma)) {
    redirect("/installation");
  }
}
