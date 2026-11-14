import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/database/client";
import { getInstallationState } from "@/features/installer/status";
import { isInstallTokenRequired } from "@/features/installer/token";
import { getEnvironmentChecks } from "@/features/installer/environment";
import { readAppConfig } from "@/features/installer/service";
import { isInstallerUnlocked } from "./actions";
import { InstallerWizard } from "@/components/installer/InstallerWizard";

export const metadata: Metadata = {
  title: "Installation — Royaume Magique des Multiplications",
  /** L'assistant d'installation ne doit jamais être indexé. */
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Assistant d'installation (étape d'entrée).
 *
 * Règles de sécurité :
 * - installation terminée → redirection vers la connexion (verrou
 *   définitif, aucune recréation d'administrateur possible) ;
 * - mode hérité (comptes existants, base dev/test ou mise à jour) →
 *   redirection vers l'accueil, l'assistant n'est jamais proposé ;
 * - jeton d'installation exigé si INSTALL_TOKEN est défini.
 */
export default async function InstallationPage() {
  const state = await getInstallationState(prisma);
  if (state.status === "completed") {
    redirect("/parent/connexion");
  }
  if (state.legacy) {
    redirect("/");
  }

  const unlocked = await isInstallerUnlocked();
  const environment = await getEnvironmentChecks(prisma);
  const config = await readAppConfig(prisma);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-10 sm:px-6">
      <div className="mb-6 text-center">
        <p aria-hidden className="font-display text-lg text-star">
          🦄 🏰 ✨
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold sm:text-4xl">
          Installation du Royaume
        </h1>
        <p className="mt-2 max-w-xl text-foreground-soft">
          Quelques étapes guidées pour préparer l&apos;application, sa base de
          données et le premier compte administrateur.
        </p>
      </div>
      <InstallerWizard
        tokenRequired={isInstallTokenRequired()}
        unlocked={unlocked}
        environment={environment}
        config={config}
        databaseUrlPresent={Boolean(process.env.DATABASE_URL)}
      />
    </main>
  );
}
