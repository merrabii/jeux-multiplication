import Link from "next/link";
import type { Metadata } from "next";
import { ChildHeader } from "@/components/game/ChildHeader";
import { requireChildContext } from "@/lib/auth/child-guard";
import { prisma } from "@/lib/database/client";
import { getCompletedLessonTables } from "@/features/game/service";
import {
  computeUnlockedWorlds,
  MAGICAL_WORLDS,
  worldUnlockState,
} from "@/features/worlds/worlds";

export const metadata: Metadata = {
  title: "Mon royaume — Royaume Magique des Multiplications",
};

/**
 * Tableau de bord enfant (Phase 2.2/2.2-B) : avatar, étoiles, niveau,
 * mission du jour, mondes, bouton « Continuer mon aventure ».
 */
export default async function ChildDashboardPage() {
  const { child } = await requireChildContext();

  const completedLessonTables = await getCompletedLessonTables(prisma, child.id);
  const unlocked = computeUnlockedWorlds(completedLessonTables);

  // Mission du jour : progression vers l'objectif quotidien.
  const today = new Date();
  const day = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const activity = await prisma.dailyActivity.findUnique({
    where: { childProfileId_day: { childProfileId: child.id, day } },
    select: { correctAnswers: true, starsEarned: true, sessionCount: true },
  });
  const dailyGoal = (
    await prisma.childProfile.findUnique({
      where: { id: child.id },
      select: { dailyGoal: true },
    })
  )?.dailyGoal ?? 20;
  const goalProgress = Math.min(
    100,
    Math.round(((activity?.correctAnswers ?? 0) / dailyGoal) * 100),
  );

  // Première table sans leçon : cible de « Continuer mon aventure ».
  const nextTable = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find(
    (t) => !completedLessonTables.includes(t),
  );
  const continueHref = nextTable
    ? `/enfant/apprendre/${nextTable}`
    : "/enfant/defis";
  const continueLabel = nextTable
    ? `Continuer mon aventure : table de ${nextTable}`
    : "Continuer mon aventure : grands défis !";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <ChildHeader child={child} />

      {/* Mission du jour */}
      <section className="mt-8 rounded-2xl bg-card p-6 text-card-foreground shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Mission du jour</h2>
          <p className="font-semibold text-foreground-soft">
            {activity?.correctAnswers ?? 0} / {dailyGoal} bonnes réponses
          </p>
        </div>
        <div
          className="mt-3 h-4 overflow-hidden rounded-full bg-background-soft"
          role="progressbar"
          aria-valuenow={goalProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression de la mission du jour"
        >
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${goalProgress}%` }}
          />
        </div>
        <Link
          href={continueHref}
          className="btn-large mt-5 inline-block bg-button text-white shadow-lg hover:bg-button-hover"
        >
          {continueLabel}
        </Link>
      </section>

      {/* Mondes magiques */}
      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">Mes mondes magiques</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MAGICAL_WORLDS.map((world) => {
            const state = worldUnlockState(world, completedLessonTables);
            return (
              <li
                key={world.id}
                className="overflow-hidden rounded-2xl bg-card shadow-lg"
                style={{ opacity: state.unlocked ? 1 : 0.65 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={world.imageKey}
                  alt=""
                  width={320}
                  height={180}
                  className={state.unlocked ? "" : "grayscale"}
                />
                <div className="p-4">
                  <p className="font-display font-bold">{world.name}</p>
                  <p className="mt-1 text-sm text-foreground-soft">
                    {state.unlocked
                      ? world.description
                      : `Verrouillé : valide la table ${state.missing[0]} pour ouvrir ce monde.`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Raccourcis */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/enfant/apprendre"
          className="rounded-2xl bg-card p-5 text-card-foreground shadow hover:bg-white"
        >
          <p className="font-display text-lg font-bold">📚 Apprendre</p>
          <p className="mt-1 text-sm text-foreground-soft">
            {completedLessonTables.length}/10 leçons validées
          </p>
        </Link>
        <Link
          href="/enfant/entrainement"
          className="rounded-2xl bg-card p-5 text-card-foreground shadow hover:bg-white"
        >
          <p className="font-display text-lg font-bold">🪄 Entraînement</p>
          <p className="mt-1 text-sm text-foreground-soft">
            Libre, sans chronomètre
          </p>
        </Link>
        <Link
          href="/enfant/defis"
          className="rounded-2xl bg-card p-5 text-card-foreground shadow hover:bg-white"
        >
          <p className="font-display text-lg font-bold">⚔️ Défis</p>
          <p className="mt-1 text-sm text-foreground-soft">5, 10 ou 20 questions</p>
        </Link>
      </section>

      <p className="mt-8 text-center text-xs text-foreground-soft/70">
        {unlocked.length} monde(s) débloqué(s) sur {MAGICAL_WORLDS.length}
      </p>
    </main>
  );
}
