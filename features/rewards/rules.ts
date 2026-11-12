import type { PrismaClient } from "@/lib/database/generated/client";

/**
 * Règles de récompenses — calculées UNIQUEMENT côté serveur (Phase 2.4).
 * Aucun score ni récompense n'est accepté depuis le navigateur : tout est
 * recalculé à partir des `question_attempts` enregistrées en PostgreSQL.
 *
 * Règles documentées (docs/FEATURES.md) :
 * - LEÇON validée          : 10 étoiles + 50 XP (+ 20 XP bonus si sans faute)
 * - ENTRAÎNEMENT           : 1 étoile pour 2 bonnes réponses + 10 XP/bonne
 * - DÉFI                   : 1 étoile/bonne réponse + 15 XP/bonne
 *                            (+ 10 étoiles bonus si 100 %)
 * - Pièces magiques        : 1 pièce / 20 XP gagnés
 * - Diamants               : réservés aux défis parfaits (1 diamant)
 * - Niveau                 : 1 niveau / 100 XP cumulés
 */

export type SessionKind = "LESSON" | "PRACTICE" | "CHALLENGE";

export type RewardComputation = {
  starsEarned: number;
  xpEarned: number;
  coinsEarned: number;
  diamondsEarned: number;
  correctCount: number;
  wrongCount: number;
  percentCorrect: number;
  perfect: boolean;
  targetReached: boolean;
  newLevel: number;
};

/** Vérifie si un défi est réussi selon son seuil (défaut 80 %). */
export function isChallengePassed(percent: number, targetPercent: number): boolean {
  return percent >= targetPercent;
}

/** Calcule les récompenses d'une session terminée, à partir des tentatives. */
export function computeSessionRewards(params: {
  kind: SessionKind;
  correctCount: number;
  totalQuestions: number;
  targetPercent?: number | null;
  currentXp: number;
  currentLevel: number;
}): RewardComputation {
  const { kind, correctCount, totalQuestions, targetPercent } = params;
  const wrongCount = Math.max(0, totalQuestions - correctCount);
  const percentCorrect =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const perfect = totalQuestions > 0 && wrongCount === 0;

  let starsEarned = 0;
  let xpEarned = 0;
  let diamondsEarned = 0;

  switch (kind) {
    case "LESSON":
      starsEarned = 10 + (perfect ? 5 : 0);
      xpEarned = 50 + (perfect ? 20 : 0);
      break;
    case "PRACTICE":
      starsEarned = Math.floor(correctCount / 2);
      xpEarned = correctCount * 10;
      break;
    case "CHALLENGE":
      starsEarned = correctCount + (perfect ? 10 : 0);
      xpEarned = correctCount * 15;
      if (perfect) diamondsEarned = 1;
      break;
  }

  const targetReached =
    kind === "CHALLENGE"
      ? isChallengePassed(percentCorrect, targetPercent ?? 80)
      : true;

  const newXp = params.currentXp + xpEarned;
  const newLevel = Math.max(1, Math.floor(newXp / 100) + 1);

  return {
    starsEarned,
    xpEarned,
    coinsEarned: Math.floor(xpEarned / 20),
    diamondsEarned,
    correctCount,
    wrongCount,
    percentCorrect,
    perfect,
    targetReached,
    newLevel: Math.max(newLevel, params.currentLevel),
  };
}

/* ------------------------------------------------------------------ */
/* Badges — définitions et détection serveur                          */
/* ------------------------------------------------------------------ */

export type BadgeDefinition = {
  key: string;
  name: string;
  description: string;
};

export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  { key: "first_session", name: "Premier pas magique", description: "Première session terminée" },
  { key: "first_lesson", name: "Apprenti éclairé", description: "Première leçon validée" },
  { key: "streak_10", name: "Série de 10", description: "10 bonnes réponses de suite" },
  { key: "perfect_challenge", name: "Défi parfait", description: "Un défi à 100 % de réussite" },
  { key: "challenge_20", name: "Grand défi", description: "Un défi de 20 questions réussi" },
  { key: "tables_1_5_mastered", name: "Gardien de la forêt", description: "Leçons des tables 1 à 5 validées" },
  { key: "tables_1_10_mastered", name: "Maître du royaume", description: "Leçons des tables 1 à 10 validées" },
  { key: "daily_goal", name: "Étoile du jour", description: "Objectif quotidien atteint" },
] as const;

export function badgeByKey(key: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.key === key);
}

/**
 * Détecte les badges nouvellement mérités à la fin d'une session.
 * Les badges déjà possédés ne sont jamais re-attribués (unique en base).
 */
export async function detectNewBadges(
  db: PrismaClient,
  params: {
    childProfileId: string;
    kind: SessionKind;
    perfect: boolean;
    totalQuestions: number;
    streakBest: number;
    dailyGoal: number;
    todayCorrectAnswers: number;
  },
): Promise<string[]> {
  const candidates = new Set<string>();
  candidates.add("first_session");
  if (params.kind === "LESSON") candidates.add("first_lesson");
  if (params.streakBest >= 10) candidates.add("streak_10");
  if (params.kind === "CHALLENGE" && params.perfect) {
    candidates.add("perfect_challenge");
    if (params.totalQuestions >= 20) candidates.add("challenge_20");
  }
  if (params.todayCorrectAnswers >= params.dailyGoal) {
    candidates.add("daily_goal");
  }

  const lessons = await db.childProgress.findMany({
    where: { childProfileId: params.childProfileId, lessonsCompleted: { gt: 0 } },
    select: { table: true },
  });
  const mastered = new Set(lessons.map((l) => l.table));
  if ([1, 2, 3, 4, 5].every((t) => mastered.has(t))) {
    candidates.add("tables_1_5_mastered");
  }
  if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((t) => mastered.has(t))) {
    candidates.add("tables_1_10_mastered");
  }

  const owned = await db.childBadge.findMany({
    where: {
      childProfileId: params.childProfileId,
      badgeKey: { in: [...candidates] },
    },
    select: { badgeKey: true },
  });
  const ownedSet = new Set(owned.map((b) => b.badgeKey));
  return [...candidates].filter((key) => !ownedSet.has(key));
}
