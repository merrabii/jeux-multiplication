import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/database/client";
import { getInstallationState } from "@/features/installer/status";
import { isRecoveryEnabled } from "@/features/installer/token";
import { RecoveryForm } from "@/components/installer/RecoveryForm";

export const metadata: Metadata = {
  title: "Récupération administrateur — Royaume Magique",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Récupération sécurisée de l'accès administrateur.
 * DISTINCT de l'installation initiale : disponible uniquement après
 * l'installation et protégée par ADMIN_RECOVERY_TOKEN (variable
 * serveur ; sans elle, la fonctionnalité est désactivée).
 */
export default async function RecoveryPage() {
  const state = await getInstallationState(prisma);
  if (state.status !== "completed") {
    // Avant l'installation, cette page n'existe pas fonctionnellement.
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/" className="font-display text-sm text-star">
        ← Royaume Magique des Multiplications
      </Link>
      <h1 className="font-display mt-6 text-3xl font-bold sm:text-4xl">
        Récupération administrateur
      </h1>
      {isRecoveryEnabled() ? (
        <>
          <p className="mt-2 max-w-md text-center text-foreground-soft">
            Page réservée à l&apos;administrateur du serveur. Le jeton de
            récupération est défini dans la configuration du serveur
            (variable <code className="rounded bg-background-soft px-1">ADMIN_RECOVERY_TOKEN</code>).
          </p>
          <div className="mt-8 flex w-full justify-center">
            <RecoveryForm />
          </div>
        </>
      ) : (
        <p
          role="alert"
          className="mt-6 max-w-md rounded-xl bg-error/15 px-4 py-3 text-sm font-semibold text-error"
        >
          La récupération est désactivée : la variable
          ADMIN_RECOVERY_TOKEN n&apos;est pas définie sur ce serveur.
          Définissez-la (déploiement Coolify / Compose / .env) puis
          rechargez cette page.
        </p>
      )}
    </main>
  );
}
