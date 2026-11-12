import type { PrismaClient } from "@/lib/database/generated/client";

/**
 * Révision espacée — première version simple, documentée et testée
 * (Phase 2.7). Intervalle de re-révision selon le niveau de maîtrise :
 *
 *  niveau 1 (fragile)    → revoir dans 1 h
 *  niveau 2 (en cours)   → revoir dans 24 h
 *  niveau 3 (maîtrisée)  → revoir dans 72 h (entretien)
 *
 * Une erreur retombe au niveau 1 (revoir bientôt). Une réussite monte
 * d'un niveau (plafond 3). Les multiplications du retard de révision
 * sont proposées en priorité dans l'entraînement.
 */

const REVIEW_INTERVALS_HOURS = [1, 24, 72] as const;

export type MasteryLevel = 0 | 1 | 2 | 3;

/** Mise à jour du niveau de maîtrise après une réponse. */
export function nextMasteryLevel(
  current: MasteryLevel,
  wasCorrect: boolean,
): MasteryLevel {
  if (!wasCorrect) return 1;
  return Math.min(3, (current === 0 ? 1 : current) + 1) as MasteryLevel;
}

/** Prochaine date de révision conseillée après une réussite. */
export function nextReviewAt(masteryLevel: MasteryLevel, from: Date): Date | null {
  if (masteryLevel <= 0 || masteryLevel > 3) return null;
  const hours = REVIEW_INTERVALS_HOURS[masteryLevel - 1];
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Multiplications à réviser en priorité (retard de révision + les plus
 * fragiles), mélangées pour éviter l'effet séquence.
 */
export async function pickReviewMultiplications(
  db: PrismaClient,
  childProfileId: string,
  limit = 10,
): Promise<Array<{ a: number; b: number }>> {
  const now = new Date();
  const due = await db.multiplicationMastery.findMany({
    where: { childProfileId, nextReviewAt: { not: null, lte: now } },
    orderBy: [{ masteryLevel: "asc" }, { nextReviewAt: "asc" }],
    select: { a: true, b: true, masteryLevel: true },
    take: limit * 2,
  });

  // Mélange simple (Fisher-Yates) sur les plus fragiles d'abord.
  const shuffled = [...due];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sorted = shuffled.sort((x, y) => x.masteryLevel - y.masteryLevel);
  const seen = new Set<string>();
  const result: Array<{ a: number; b: number }> = [];
  for (const row of sorted) {
    const key = `${row.a}x${row.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ a: row.a, b: row.b });
    if (result.length >= limit) break;
  }
  return result;
}
