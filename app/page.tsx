import Link from "next/link";
import { ensureInstalled } from "@/lib/auth/install-guard";

/**
 * Page d'accueil — Phase 1 (fondations).
 * Page d'entrée de l'univers magique. Si l'application n'est pas encore
 * installée, le visiteur est redirigé vers l'assistant /installation.
 * Dynamique : la redirection dépend de l'état d'installation en base.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureInstalled();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Étoiles magiques (décor CSS léger, sans images temporaires) */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {[
          { top: "12%", left: "8%", size: "text-4xl", delay: "0s" },
          { top: "18%", right: "12%", size: "text-2xl", delay: "0.8s" },
          { top: "70%", left: "15%", size: "text-3xl", delay: "1.6s" },
          { top: "80%", right: "10%", size: "text-2xl", delay: "0.4s" },
          { top: "40%", left: "5%", size: "text-xl", delay: "2s" },
          { top: "30%", right: "6%", size: "text-xl", delay: "1.2s" },
        ].map((star, i) => (
          <span
            key={i}
            className={`absolute ${star.size} animate-pulse opacity-70`}
            style={{ top: star.top, left: star.left, right: star.right, animationDelay: star.delay }}
          >
            ✨
          </span>
        ))}
      </div>

      <div className="relative z-10 flex max-w-3xl flex-col items-center text-center">
        <p className="font-display text-lg text-star" aria-hidden>
          🦄 🧚 🐲 🏰
        </p>
        <h1 className="font-display mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
          Royaume Magique des{" "}
          <span className="text-star">Multiplications</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-foreground-soft sm:text-xl">
          Rejoins Perle la licorne et Braise le dragon pour apprendre les
          tables de 1 à 10, pas à pas, dans un royaume plein d&apos;étoiles
          magiques.
        </p>

        <div className="mt-10 grid w-full gap-5 sm:grid-cols-2">
          <Link
            href="/enfant"
            className="btn-large flex items-center justify-center gap-3 bg-card text-card-foreground shadow-lg hover:bg-white"
          >
            <span aria-hidden className="text-2xl">🦄</span>
            Entrer dans le royaume
            <span className="sr-only">(bientôt disponible)</span>
          </Link>
          <Link
            href="/parent"
            className="btn-large flex items-center justify-center gap-3 border-2 border-magic bg-transparent text-foreground hover:bg-background-soft"
          >
            <span aria-hidden className="text-2xl">🔐</span>
            Espace parent
            <span className="sr-only">(bientôt disponible)</span>
          </Link>
        </div>

        <p className="mt-8 text-sm text-foreground-soft/80">
          ✨ Les portes du royaume s&apos;ouvriront très bientôt — les tables de
          1 à 10 s&apos;installent magiquement. ✨
        </p>
      </div>
    </main>
  );
}
