import Link from "next/link";
import { exitChildSpaceAction } from "@/app/parent/children-actions";
import type { ChildContext } from "@/lib/auth/child-guard";

/**
 * En-tête commun de l'espace enfant : avatar, pseudonyme, étoiles,
 * niveau, pièces et bouton retour parent (sécurisé).
 */
export function ChildHeader({
  child,
  active,
}: {
  child: ChildContext["child"];
  active?: "apprendre" | "entrainement" | "defis" | "recompenses";
}) {
  const navItems = [
    { key: "apprendre", href: "/enfant/apprendre", label: "Apprendre" },
    { key: "entrainement", href: "/enfant/entrainement", label: "Entraînement" },
    { key: "defis", href: "/enfant/defis", label: "Défis" },
    { key: "recompenses", href: "/enfant/recompenses", label: "Récompenses" },
  ] as const;

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {child.avatarImageKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={child.avatarImageKey}
              alt={`Avatar de ${child.pseudonym}`}
              width={56}
              height={56}
              className="size-14 rounded-full shadow"
            />
          ) : null}
          <div>
            <p className="font-display text-lg font-bold">{child.pseudonym}</p>
            <p className="text-sm font-semibold text-foreground-soft">
              Niveau {child.level} · ⭐ {child.totalStars} · 🪙 {child.coins}
              {child.diamonds > 0 ? ` · 💎 ${child.diamonds}` : ""}
            </p>
          </div>
        </div>
        <form action={exitChildSpaceAction}>
          <button
            type="submit"
            className="rounded-xl border-2 border-magic/40 px-3 py-2 text-sm font-bold hover:bg-background-soft"
          >
            Retour parent
          </button>
        </form>
      </div>
      <nav aria-label="Navigation du jeu" className="flex flex-wrap gap-2">
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active === item.key ? "page" : undefined}
            className="rounded-xl px-4 py-2 font-bold"
            style={
              active === item.key
                ? { background: "var(--magic)", color: "#fff" }
                : { background: "var(--background-soft)", color: "var(--foreground)" }
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
