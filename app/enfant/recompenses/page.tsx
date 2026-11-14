import type { Metadata } from "next";
import { ChildHeader } from "@/components/game/ChildHeader";
import { requireChildContext } from "@/lib/auth/child-guard";
import { prisma } from "@/lib/database/client";
import {
  BADGE_DEFINITIONS,
  badgeByKey,
} from "@/features/rewards/rules";

export const metadata: Metadata = {
  title: "Récompenses — Royaume Magique des Multiplications",
};

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const { child } = await requireChildContext();

  const [badges, masteries] = await Promise.all([
    prisma.childBadge.findMany({
      where: { childProfileId: child.id },
      orderBy: { earnedAt: "desc" },
      select: { badgeKey: true, earnedAt: true },
    }),
    prisma.multiplicationMastery.findMany({
      where: { childProfileId: child.id, masteryLevel: 3 },
      select: { a: true, b: true },
    }),
  ]);

  const ownedKeys = new Set(badges.map((b) => b.badgeKey));
  const xpInLevel = child.xp % 100;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <ChildHeader child={child} active="recompenses" />

      <section className="mt-8 rounded-2xl bg-card p-6 text-card-foreground shadow-lg">
        <h2 className="font-display text-xl font-bold">Mon trésor</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <p className="rounded-xl bg-star/20 px-4 py-3 text-center font-display text-lg font-bold">
            ⭐ {child.totalStars}
          </p>
          <p className="rounded-xl bg-background-soft px-4 py-3 text-center font-display text-lg font-bold">
            🪙 {child.coins}
          </p>
          <p className="rounded-xl bg-magic/15 px-4 py-3 text-center font-display text-lg font-bold">
            💎 {child.diamonds}
          </p>
          <p className="rounded-xl bg-background-soft px-4 py-3 text-center font-display text-lg font-bold">
            Niveau {child.level}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-sm font-semibold text-foreground-soft">
            Progression vers le niveau {child.level + 1} : {xpInLevel}/100 XP
          </p>
          <div
            className="mt-2 h-4 overflow-hidden rounded-full bg-background-soft"
            role="progressbar"
            aria-valuenow={xpInLevel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression vers le niveau suivant"
          >
            <div
              className="h-full rounded-full bg-magic transition-all"
              style={{ width: `${xpInLevel}%` }}
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">
          Ma collection de badges ({badges.length}/{BADGE_DEFINITIONS.length})
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {BADGE_DEFINITIONS.map((definition) => {
            const owned = ownedKeys.has(definition.key);
            const detail = badgeByKey(definition.key)!;
            return (
              <li
                key={definition.key}
                className="flex items-center gap-3 rounded-2xl bg-card p-4 text-card-foreground shadow"
                style={{ opacity: owned ? 1 : 0.55 }}
              >
                <span
                  aria-hidden
                  className="flex size-12 items-center justify-center rounded-full bg-star/25 font-display text-xl"
                >
                  {owned ? "🏅" : "🔒"}
                </span>
                <div>
                  <p className="font-display font-bold">{detail.name}</p>
                  <p className="text-sm text-foreground-soft">
                    {detail.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">
          Multiplications maîtrisées ({masteries.length})
        </h2>
        {masteries.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {masteries.map((m) => (
              <li
                key={`${m.a}x${m.b}`}
                className="rounded-xl bg-success/15 px-3 py-2 font-bold text-success"
              >
                {m.a} × {m.b}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-foreground-soft">
            Réussis chaque multiplication 3 fois pour la maîtriser !
          </p>
        )}
      </section>
    </main>
  );
}
