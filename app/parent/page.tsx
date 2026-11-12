import Link from "next/link";

/**
 * Espace parent — Phase 1 : page d'attente.
 * Phase 2 : authentification sécurisée, gestion des profils enfants,
 * suivi pédagogique et paramètres.
 */
export default function ParentSpacePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span aria-hidden className="text-6xl">🔐</span>
      <h1 className="font-display mt-6 text-3xl font-bold sm:text-4xl">
        Espace parent en préparation
      </h1>
      <p className="mt-4 max-w-md text-lg text-foreground-soft">
        Cet espace sera protégé par une authentification sécurisée et vous
        permettra de suivre la progression de votre enfant et de gérer ses
        profils.
      </p>
      <Link
        href="/"
        className="btn-large mt-8 border-2 border-magic text-foreground hover:bg-background-soft"
      >
        ← Retour à l&apos;accueil
      </Link>
    </main>
  );
}
