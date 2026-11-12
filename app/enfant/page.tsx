import Link from "next/link";

/**
 * Espace enfant — Phase 1 : page d'attente.
 * Phase 2 : tableau de bord enfant (avatar, niveau, étoiles, progression).
 */
export default function ChildSpacePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span aria-hidden className="text-6xl">🦄</span>
      <h1 className="font-display mt-6 text-3xl font-bold sm:text-4xl">
        Le royaume se construit…
      </h1>
      <p className="mt-4 max-w-md text-lg text-foreground-soft">
        Perle la licorne prépare ton tableau de bord magique : étoiles,
        niveaux et aventures t&apos;attendent très bientôt.
      </p>
      <Link
        href="/"
        className="btn-large mt-8 bg-card text-card-foreground hover:bg-white"
      >
        ← Retour au château
      </Link>
    </main>
  );
}
