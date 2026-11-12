import Link from "next/link";
import type { Metadata } from "next";
import { logoutParentAction } from "@/app/parent/auth-actions";
import { selectChildAction } from "@/app/parent/children-actions";
import { DeleteChildButton } from "@/components/parent/children/DeleteChildButton";
import { CreateChildForm } from "@/components/parent/children/CreateChildForm";
import { requireParentSession } from "@/lib/auth/guards";
import {
  listChildren,
  MAX_CHILDREN_PER_PARENT,
} from "@/features/children/service";
import { prisma } from "@/lib/database/client";

export const metadata: Metadata = {
  title: "Espace parent — Royaume Magique des Multiplications",
};

/**
 * Tableau de bord parent — Phase 2.2 : gestion des profils enfants
 * (création, sélection, suppression logique) + suivi à venir (Étape I).
 */
export default async function ParentSpacePage() {
  const { user } = await requireParentSession();
  const children = await listChildren(prisma, user.id);
  const avatars = await prisma.avatar.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, imageKey: true },
  });
  const canCreate = children.length < MAX_CHILDREN_PER_PARENT;

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

      {/* Profils enfants */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">
            Profils enfants ({children.length}/{MAX_CHILDREN_PER_PARENT})
          </h2>
          <Link href="/" className="text-sm text-star underline">
            Accueil
          </Link>
        </div>

        {children.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-card p-6 text-card-foreground shadow">
            Aucun profil enfant pour l&apos;instant. Créez-en un ci-dessous pour
            commencer l&apos;aventure.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {children.map((child) => (
              <li
                key={child.id}
                className="flex flex-col gap-3 rounded-2xl bg-card p-5 text-card-foreground shadow-lg"
              >
                <div className="flex items-center gap-4">
                  {child.avatarImageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={child.avatarImageKey}
                      alt={child.avatarName ?? "Avatar"}
                      width={64}
                      height={64}
                      className="size-16 rounded-full shadow"
                    />
                  ) : null}
                  <div>
                    <p className="font-display text-lg font-bold">
                      {child.pseudonym}
                    </p>
                    <p className="text-sm text-card-foreground/75">
                      Niveau {child.level} · ⭐ {child.totalStars} étoiles ·{" "}
                      {child.coins} pièces
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={selectChildAction}>
                    <input
                      type="hidden"
                      name="childProfileId"
                      value={child.id}
                    />
                    <button
                      type="submit"
                      className="btn-large bg-button text-white shadow hover:bg-button-hover"
                    >
                      Entrer dans le royaume
                    </button>
                  </form>
                  <DeleteChildButton childProfileId={child.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Création */}
      {canCreate && (
        <section className="mt-10 rounded-2xl border-2 border-magic/30 p-6 sm:p-8">
          <h2 className="font-display text-xl font-bold">
            Nouveau profil enfant
          </h2>
          <div className="mt-5">
            <CreateChildForm avatars={avatars} />
          </div>
        </section>
      )}
    </main>
  );
}
