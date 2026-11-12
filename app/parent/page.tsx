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
import { getChildStats, type ChildStats } from "@/features/children/stats";
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

  // Statistiques réelles par enfant (agrégats PostgreSQL, ownership vérifié).
  const statsResults = await Promise.all(
    children.map((child) => getChildStats(prisma, child.id, user.id)),
  );
  const stats = new Map<string, ChildStats>();
  for (const result of statsResults) {
    if (result.status === "ok") stats.set(result.stats.childId, result.stats);
  }

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

                {/* Statistiques pédagogiques (données PostgreSQL réelles) */}
                {stats.get(child.id) ? (
                  <ParentChildStats stat={stats.get(child.id)!} />
                ) : null}
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

/** Panneau de statistiques d'un enfant (espace parent, Étape I). */
function ParentChildStats({ stat }: { stat: ChildStats }) {
  return (
    <div className="rounded-xl border-2 border-magic/20 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-card-foreground/85">
        <span>Sessions : {stat.sessionCount}</span>
        <span>
          Réponses : {stat.totalCorrect}/{stat.totalQuestionsAnswered}
          {stat.overallAccuracy !== null ? ` (${stat.overallAccuracy} %)` : ""}
        </span>
        <span>Badges : {stat.badgeCount}</span>
      </div>

      {stat.masteredTables.length > 0 ? (
        <p className="mt-2">
          <span className="font-semibold">Tables maîtrisées :</span>{" "}
          {stat.masteredTables.join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-card-foreground/70">
          Aucune leçon validée pour l&apos;instant.
        </p>
      )}

      {stat.tablesToReview.length > 0 && (
        <p className="mt-1 text-error">
          <span className="font-semibold">À réviser :</span>{" "}
          {stat.tablesToReview.join(", ")} (moins de 70 % de réussite)
        </p>
      )}

      {stat.tables.filter((t) => t.accuracy !== null).length > 0 ? (
        <table className="mt-3 w-full text-left text-xs">
          <caption className="sr-only">
            Résultats par table de {stat.pseudonym}
          </caption>
          <thead>
            <tr className="text-card-foreground/60">
              <th scope="col" className="py-1">Table</th>
              <th scope="col" className="py-1">Réussite</th>
              <th scope="col" className="py-1">Leçons</th>
              <th scope="col" className="py-1">Défis gagnés</th>
            </tr>
          </thead>
          <tbody>
            {stat.tables
              .filter((t) => t.accuracy !== null)
              .map((t) => (
                <tr key={t.table} className="border-t border-magic/10">
                  <td className="py-1 font-bold">{t.table}</td>
                  <td className="py-1">
                    {t.accuracy} % ({t.correctCount}/{t.correctCount + t.wrongCount})
                  </td>
                  <td className="py-1">{t.lessonsCompleted}</td>
                  <td className="py-1">{t.challengesPassed}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-card-foreground/70">
          Aucune session terminée pour l&apos;instant.
        </p>
      )}

      {stat.recentDays.length > 0 ? (
        <p className="mt-3 text-xs text-card-foreground/70">
          Activité récente :{" "}
          {stat.recentDays
            .slice(0, 3)
            .map(
              (d) =>
                `${d.day.toISOString().slice(0, 10)} : ${d.correctAnswers}/${d.questionsAnswered}`,
            )
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
