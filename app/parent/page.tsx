import Link from "next/link";
import type { Metadata } from "next";
import { logoutParentAction } from "@/app/parent/auth-actions";
import { requireParentSession } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Espace parent — Royaume Magique des Multiplications",
};

/**
 * Tableau de bord parent — Phase 2.1 : session authentifiée vérifiée
 * côté serveur (requireParentSession redirige vers /parent/connexion
 * si la session est absente, expirée ou révoquée).
 */
export default async function ParentSpacePage() {
  const { user } = await requireParentSession();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-sm text-star">
            Royaume Magique des Multiplications
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold sm:text-4xl">
            Espace parent
          </h1>
        </div>
        <form action={logoutParentAction}>
          <button
            type="submit"
            className="btn-large border-2 border-magic bg-transparent text-foreground hover:bg-background-soft"
          >
            Se déconnecter
          </button>
        </form>
      </header>

      <section className="mt-10 rounded-2xl bg-card p-6 text-card-foreground shadow-lg sm:p-8">
        <h2 className="font-display text-xl font-bold">Compte connecté</h2>
        <p className="mt-3">
          Bienvenue{user.displayName ? `, ${user.displayName}` : ""} ! Votre
          session est active.
        </p>
        <p className="mt-2 text-sm text-card-foreground/80">
          E-mail du compte : <strong>{user.email}</strong>
        </p>
      </section>

      <section className="mt-6 rounded-2xl border-2 border-magic/30 p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold">Prochaines étapes</h2>
        <p className="mt-3 text-foreground-soft">
          La gestion des profils enfants (création, avatars, suivi
          pédagogique) arrive à l&apos;étape suivante du chantier.
        </p>
        <Link href="/" className="btn-large mt-6 inline-block bg-card text-card-foreground hover:bg-white">
          ← Retour à l&apos;accueil
        </Link>
      </section>
    </main>
  );
}
