import type { Metadata } from "next";
import { ChildHeader } from "@/components/game/ChildHeader";
import { GameSession } from "@/components/game/GameSession";
import { requireChildContext } from "@/lib/auth/child-guard";
import { prisma } from "@/lib/database/client";
import { pickReviewMultiplications } from "@/features/spaced-repetition/schedule";

export const metadata: Metadata = {
  title: "Entraînement — Royaume Magique des Multiplications",
};

export default async function PracticePage() {
  const { child } = await requireChildContext();

  // Révision espacée : multiplications à revoir en priorité (Phase 2.7).
  const recommendedReview = await pickReviewMultiplications(prisma, child.id, 8);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
      <ChildHeader child={child} active="entrainement" />
      <h2 className="font-display mt-8 text-2xl font-bold">Entraînement libre</h2>
      <p className="mt-1 text-foreground-soft">
        Choisis tes tables et ton niveau. Ici, pas de chronomètre : prends ton
        temps, les erreurs sont autorisées !
      </p>
      <div className="mt-6">
        <GameSession
          kind="PRACTICE"
          availableTables={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
          recommendedReview={recommendedReview}
        />
      </div>
    </main>
  );
}
