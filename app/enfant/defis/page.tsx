import type { Metadata } from "next";
import { ChildHeader } from "@/components/game/ChildHeader";
import { GameSession } from "@/components/game/GameSession";
import { requireChildContext } from "@/lib/auth/child-guard";

export const metadata: Metadata = {
  title: "Défis — Royaume Magique des Multiplications",
};

export default async function ChallengePage() {
  const { child } = await requireChildContext();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <ChildHeader child={child} active="defis" />
      <h2 className="font-display mt-8 text-2xl font-bold">Défis magiques</h2>
      <p className="mt-1 text-foreground-soft">
        Choisis 5, 10 ou 20 questions. Réussis 80 % du défi pour le gagner !
      </p>
      <div className="mt-6">
        <GameSession
          kind="CHALLENGE"
          availableTables={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          fixedCount={10}
        />
      </div>
    </main>
  );
}
