import type { PrismaClient } from "@/lib/database/generated/client";
import { CHILD_PSEUDONYM_SCHEMA } from "@/lib/validation/schemas";

/**
 * Statistiques parentales (Phase 2.8) — agrégats calculés en PostgreSQL.
 * L'appartenance parent/enfant est revérifiée à chaque appel : un parent
 * ne peut jamais lire les résultats d'un enfant d'un autre compte.
 */

export type TableStat = {
  table: number;
  lessonsCompleted: number;
  practiceSessions: number;
  challengesPassed: number;
  correctCount: number;
  wrongCount: number;
  /** Taux de réussite (0-100), null si aucune réponse. */
  accuracy: number | null;
  lastPracticedAt: Date | null;
};

export type ChildStats = {
  childId: string;
  pseudonym: string;
  totalStars: number;
  coins: number;
  diamonds: number;
  xp: number;
  level: number;
  sessionCount: number;
  totalQuestionsAnswered: number;
  totalCorrect: number;
  overallAccuracy: number | null;
  tables: TableStat[];
  /** Tables avec leçon validée (maîtrise de leçon). */
  masteredTables: number[];
  /** Tables travaillées mais fragiles (< 70 % de réussite). */
  tablesToReview: number[];
  badgeCount: number;
  lastActivityAt: Date | null;
  recentDays: Array<{
    day: Date;
    questionsAnswered: number;
    correctAnswers: number;
    starsEarned: number;
  }>;
};

export type StatsResult =
  | { status: "ok"; stats: ChildStats }
  | { status: "not_found" };

function accuracyOf(correct: number, wrong: number): number | null {
  const total = correct + wrong;
  return total > 0 ? Math.round((correct / total) * 100) : null;
}

export async function getChildStats(
  db: PrismaClient,
  childProfileId: string,
  userId: string,
): Promise<StatsResult> {
  // Appartenance stricte : le profil doit appartenir au parent connecté.
  const child = await db.childProfile.findFirst({
    where: { id: childProfileId, userId, deletedAt: null },
    select: {
      id: true,
      pseudonym: true,
      totalStars: true,
      coins: true,
      diamonds: true,
      xp: true,
      level: true,
    },
  });
  if (!child) return { status: "not_found" };

  const [completedSessions, progresses, badgeCount, recentDays] =
    await Promise.all([
      db.learningSession.findMany({
        where: { childProfileId: childProfileId, completedAt: { not: null } },
        select: { questionCount: true, correctCount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      db.childProgress.findMany({
        where: { childProfileId },
        orderBy: { table: "asc" },
      }),
      db.childBadge.count({ where: { childProfileId } }),
      db.dailyActivity.findMany({
        where: { childProfileId },
        orderBy: { day: "desc" },
        take: 7,
      }),
    ]);

  const totalQuestionsAnswered = completedSessions.reduce(
    (sum, s) => sum + s.questionCount, 0,
  );
  const totalCorrect = completedSessions.reduce(
    (sum, s) => sum + s.correctCount, 0,
  );

  const tables: TableStat[] = progresses.map((p) => ({
    table: p.table,
    lessonsCompleted: p.lessonsCompleted,
    practiceSessions: p.practiceSessions,
    challengesPassed: p.challengesPassed,
    correctCount: p.correctCount,
    wrongCount: p.wrongCount,
    accuracy: accuracyOf(p.correctCount, p.wrongCount),
    lastPracticedAt: p.lastPracticedAt,
  }));

  const masteredTables = progresses
    .filter((p) => p.lessonsCompleted > 0)
    .map((p) => p.table)
    .sort((a, b) => a - b);

  const tablesToReview = progresses
    .filter((p) => {
      const acc = accuracyOf(p.correctCount, p.wrongCount);
      return acc !== null && acc < 70 && p.lessonsCompleted === 0;
    })
    .map((p) => p.table)
    .sort((a, b) => a - b);

  const lastActivityAt =
    completedSessions[0]?.createdAt ??
    recentDays
      .map((d) => new Date(d.day))
      .sort((a, b) => b.getTime() - a.getTime())[0] ??
    null;

  return {
    status: "ok",
    stats: {
      childId: childProfileId,
      pseudonym: child.pseudonym,
      totalStars: child.totalStars,
      coins: child.coins,
      diamonds: child.diamonds,
      xp: child.xp,
      level: child.level,
      sessionCount: completedSessions.length,
      totalQuestionsAnswered,
      totalCorrect,
      overallAccuracy: accuracyOf(totalCorrect, totalQuestionsAnswered - totalCorrect),
      tables,
      masteredTables,
      tablesToReview,
      badgeCount,
      lastActivityAt,
      recentDays: recentDays.map((d) => ({
        day: d.day,
        questionsAnswered: d.questionsAnswered,
        correctAnswers: d.correctAnswers,
        starsEarned: d.starsEarned,
      })),
    },
  };
}

/** Le pseudonyme affiché reste validé (défense en profondeur). */
export function isPseudonymValid(value: string): boolean {
  return CHILD_PSEUDONYM_SCHEMA.safeParse(value).success;
}
