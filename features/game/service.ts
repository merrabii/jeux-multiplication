import type { PrismaClient } from "@/lib/database/generated/client";
import { generateQuestions } from "@/features/multiplication/engine";
import type { Difficulty } from "@/features/multiplication/engine";
import {
  computeSessionRewards,
  detectNewBadges,
  type RewardComputation,
  type SessionKind,
} from "@/features/rewards/rules";
import {
  nextMasteryLevel,
  nextReviewAt,
  type MasteryLevel,
} from "@/features/spaced-repetition/schedule";

/**
 * Service de jeu (Phase 2.3/2.5) — TOUT est validé côté serveur.
 *
 * Sécurité anti-triche :
 * - Les questions sont générées par le serveur ; les réponses attendues
 *   ne sont JAMAIS envoyées au navigateur (a, b et l'identifiant de
 *   tentative suffisent : attendu = a×b recalculé ici).
 * - Chaque réponse est enregistrée dans `question_attempts` puis
 *   revérifiée (appartenance session/enfant) avant comptage.
 * - La complétion est idempotente : les récompenses ne peuvent être
 *   attribuées qu'une fois (UPDATE conditionnel WHERE completedAt IS NULL).
 */

export type ClientQuestion = {
  questionId: string;
  a: number;
  b: number;
  choices: number[];
  table: number;
};

export type StartSessionResult =
  | { status: "ok"; sessionId: string; questions: ClientQuestion[] }
  | { status: "invalid_input" };

export type AnswerResult =
  | {
      status: "ok";
      isCorrect: boolean;
      correctAnswer: number;
      repeatedAddition: string;
    }
  | { status: "invalid_input" }
  | { status: "not_found" };

export type CompleteSessionResult =
  | { status: "ok"; summary: RewardComputation; newBadges: string[] }
  | { status: "not_found" }
  | { status: "already_completed"; summary: RewardComputation; newBadges: string[] };

const DIFFICULTIES: Difficulty[] = ["EASY", "NORMAL", "HARD"];
const KINDS: SessionKind[] = ["LESSON", "PRACTICE", "CHALLENGE"];

function isValidDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as string[]).includes(value);
}
function isValidKind(value: string): value is SessionKind {
  return (KINDS as string[]).includes(value);
}
function isValidTables(tables: number[]): boolean {
  return (
    Array.isArray(tables) &&
    tables.length >= 1 &&
    tables.every((t) => Number.isInteger(t) && t >= 1 && t <= 10)
  );
}

/**
 * Démarre une session : crée la ligne en base, génère les questions et
 * enregistre les tentatives (sans réponse encore). Retourne les questions
 * SANS les réponses attendues.
 */
export async function startGameSession(
  db: PrismaClient,
  childProfileId: string,
  input: {
    kind: string;
    tables: number[];
    difficulty: string;
    questionCount: number;
    targetPercent?: number;
  },
): Promise<StartSessionResult> {
  if (
    !isValidKind(input.kind) ||
    !isValidDifficulty(input.difficulty) ||
    !isValidTables(input.tables) ||
    !Number.isInteger(input.questionCount) ||
    input.questionCount < 1 ||
    input.questionCount > 50
  ) {
    return { status: "invalid_input" };
  }

  const questions = generateQuestions({
    tables: input.tables,
    difficulty: input.difficulty,
    count: input.questionCount,
  });

  const session = await db.learningSession.create({
    data: {
      childProfileId,
      kind: input.kind,
      tableList: input.tables,
      difficulty: input.difficulty,
      questionCount: questions.length,
      targetPercent: input.kind === "CHALLENGE" ? (input.targetPercent ?? 80) : null,
      attempts: {
        create: questions.map((q) => ({
          childProfileId,
          a: q.a,
          b: q.b,
          offeredChoices: q.choices,
          isCorrect: false,
        })),
      },
    },
    select: {
      id: true,
      attempts: { select: { id: true, a: true, b: true, offeredChoices: true } },
    },
  });

  // Chaque tentative est auto-descriptive (a, b, choix) : la table est
  // déduite de la liste travaillée, sans dépendre d'un ordre quelconque.
  const clientQuestions: ClientQuestion[] = session.attempts.map((attempt) => ({
    questionId: attempt.id,
    a: attempt.a,
    b: attempt.b,
    choices: attempt.offeredChoices,
    table: input.tables.includes(attempt.a) ? attempt.a : attempt.b,
  }));

  return { status: "ok", sessionId: session.id, questions: clientQuestions };
}

/**
 * Enregistre la réponse à une question. La validité est recalculée
 * côté serveur (a×b) ; le navigateur ne peut pas tricher.
 */
export async function submitAnswer(
  db: PrismaClient,
  childProfileId: string,
  sessionId: string,
  questionId: string,
  answer: number,
): Promise<AnswerResult> {
  if (!Number.isInteger(answer) || answer < 0 || answer > 1000) {
    return { status: "invalid_input" };
  }

  const attempt = await db.questionAttempt.findFirst({
    where: { id: questionId, sessionId, childProfileId },
    select: { id: true, a: true, b: true, answeredAt: true },
  });
  if (!attempt) return { status: "not_found" };

  const correctAnswer = attempt.a * attempt.b;
  const isCorrect = answer === correctAnswer;

  await db.questionAttempt.update({
    where: { id: attempt.id },
    data: { givenAnswer: answer, isCorrect, answeredAt: new Date() },
  });

  // Mise à jour de la maîtrise fine (révision espacée).
  await updateMastery(db, childProfileId, attempt.a, attempt.b, isCorrect);

  // Agrégats quotidiens (une ligne par jour, upsert).
  const day = utcDayStart();
  await db.dailyActivity.upsert({
    where: { childProfileId_day: { childProfileId, day } },
    create: {
      childProfileId,
      day,
      questionsAnswered: 1,
      correctAnswers: isCorrect ? 1 : 0,
    },
    update: {
      questionsAnswered: { increment: 1 },
      correctAnswers: { increment: isCorrect ? 1 : 0 },
    },
  });

  return {
    status: "ok",
    isCorrect,
    correctAnswer,
    repeatedAddition: asRepeatedAdditionString(attempt.a, attempt.b),
  };
}

/** Termine une session de façon IDEMPOTENTE et attribue les récompenses. */
export async function completeGameSession(
  db: PrismaClient,
  childProfileId: string,
  sessionId: string,
  durationSeconds: number,
): Promise<CompleteSessionResult> {
  const session = await db.learningSession.findFirst({
    where: { id: sessionId, childProfileId },
    select: {
      id: true,
      kind: true,
      questionCount: true,
      targetPercent: true,
      completedAt: true,
      tableList: true,
      attempts: { select: { isCorrect: true, givenAnswer: true } },
    },
  });
  if (!session) return { status: "not_found" };

  // Résumé calculé depuis les tentatives RÉELLES en base.
  const correctCount = session.attempts.filter(
    (a) => a.isCorrect && a.givenAnswer !== null,
  ).length;
  const totalQuestions = session.questionCount;
  const child = await db.childProfile.findUnique({
    where: { id: childProfileId },
    select: { xp: true, level: true, totalStars: true, coins: true, diamonds: true, dailyGoal: true },
  });
  if (!child) return { status: "not_found" };

  const rewards = computeSessionRewards({
    kind: session.kind as SessionKind,
    correctCount,
    totalQuestions,
    targetPercent: session.targetPercent,
    currentXp: child.xp,
    currentLevel: child.level,
  });

  // Idempotence : un seul appel applique les récompenses.
  const claimed = await db.learningSession.updateMany({
    where: { id: sessionId, completedAt: null },
    data: {
      completedAt: new Date(),
      correctCount,
      wrongCount: rewards.wrongCount,
      durationSeconds: Number.isInteger(durationSeconds)
        ? Math.min(3600, Math.max(0, durationSeconds))
        : 0,
      starsEarned: rewards.starsEarned,
      xpEarned: rewards.xpEarned,
      coinsEarned: rewards.coinsEarned,
    },
  });

  let newBadges: string[] = [];
  if (claimed.count === 0) {
    // Déjà complétée (double clic, rejeu réseau) : résumé sans double récompense.
    return { status: "already_completed", summary: rewards, newBadges };
  }

  const kind = session.kind as SessionKind;

  // 1. Profil enfant : étoiles, XP, pièces, diamants, niveau.
  await db.childProfile.update({
    where: { id: childProfileId },
    data: {
      totalStars: { increment: rewards.starsEarned },
      xp: { increment: rewards.xpEarned },
      coins: { increment: rewards.coinsEarned },
      diamonds: { increment: rewards.diamondsEarned },
      level: rewards.newLevel,
    },
  });

  // 2. Progression par table.
  const attemptRows = await db.questionAttempt.findMany({
    where: { sessionId },
    select: { a: true, b: true },
  });
  const tablesWorked = [
    ...new Set(
      attemptRows.map((r) =>
        session.tableList.includes(r.a) ? r.a : r.b,
      ),
    ),
  ];
  for (const table of tablesWorked) {
    if (!Number.isInteger(table) || table < 1 || table > 10) continue;
    await db.childProgress.upsert({
      where: { childProfileId_table: { childProfileId, table } },
      create: {
        childProfileId,
        table,
        practiceSessions: kind === "PRACTICE" ? 1 : 0,
        challengesPassed: kind === "CHALLENGE" && rewards.targetReached ? 1 : 0,
        lessonsCompleted: 0,
        correctCount,
        wrongCount: rewards.wrongCount,
        lastPracticedAt: new Date(),
      },
      update: {
        practiceSessions: { increment: kind === "PRACTICE" ? 1 : 0 },
        challengesPassed: {
          increment: kind === "CHALLENGE" && rewards.targetReached ? 1 : 0,
        },
        correctCount: { increment: correctCount },
        wrongCount: { increment: rewards.wrongCount },
        lastPracticedAt: new Date(),
      },
    });
  }

  // 3. Leçon validée : marque lessonsCompleted pour la table (<=10, unique).
  if (kind === "LESSON") {
    const lessonTables = session.tableList.filter((t) => t >= 1 && t <= 10);
    for (const table of lessonTables) {
      await db.childProgress.upsert({
        where: { childProfileId_table: { childProfileId, table } },
        create: { childProfileId, table, lessonsCompleted: 1 },
        update: { lessonsCompleted: { increment: 1 }, lastPracticedAt: new Date() },
      });
    }
  }

  // 4. Activité quotidienne : étoiles, XP, session comptée.
  const day = utcDayStart();
  await db.dailyActivity.upsert({
    where: { childProfileId_day: { childProfileId, day } },
    create: {
      childProfileId,
      day,
      starsEarned: rewards.starsEarned,
      xpEarned: rewards.xpEarned,
      sessionCount: 1,
    },
    update: {
      starsEarned: { increment: rewards.starsEarned },
      xpEarned: { increment: rewards.xpEarned },
      sessionCount: { increment: 1 },
    },
  });

  // 5. Badges (serveur uniquement).
  const todayActivity = await db.dailyActivity.findUnique({
    where: { childProfileId_day: { childProfileId, day } },
    select: { correctAnswers: true },
  });
  const bestStreak = await computeBestStreak(db, sessionId);
  newBadges = await detectNewBadges(db, {
    childProfileId,
    kind,
    perfect: rewards.perfect,
    totalQuestions,
    streakBest: bestStreak,
    dailyGoal: child.dailyGoal,
    todayCorrectAnswers: todayActivity?.correctAnswers ?? 0,
  });
  if (newBadges.length > 0) {
    await db.childBadge.createMany({
      data: newBadges.map((badgeKey) => ({ childProfileId, badgeKey })),
      skipDuplicates: true,
    });
  }

  return { status: "ok", summary: rewards, newBadges };
}

/* ------------------------------------------------------------------ */
/* Helpers internes                                                    */
/* ------------------------------------------------------------------ */

function utcDayStart(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function asRepeatedAdditionString(a: number, b: number): string {
  if (b === 1) return `${a}`;
  if (a === 1) return `${b}`;
  return Array.from({ length: a }, () => b).join(" + ");
}

async function updateMastery(
  db: PrismaClient,
  childProfileId: string,
  a: number,
  b: number,
  wasCorrect: boolean,
): Promise<void> {
  const existing = await db.multiplicationMastery.findUnique({
    where: { childProfileId_a_b: { childProfileId, a, b } },
    select: { masteryLevel: true },
  });
  const currentLevel: MasteryLevel = (existing?.masteryLevel ?? 0) as MasteryLevel;
  const level = nextMasteryLevel(currentLevel, wasCorrect);
  const now = new Date();
  await db.multiplicationMastery.upsert({
    where: { childProfileId_a_b: { childProfileId, a, b } },
    create: {
      childProfileId,
      a,
      b,
      correctCount: wasCorrect ? 1 : 0,
      wrongCount: wasCorrect ? 0 : 1,
      masteryLevel: level,
      nextReviewAt: wasCorrect ? nextReviewAt(level, now) : now,
      lastReviewedAt: now,
    },
    update: {
      correctCount: { increment: wasCorrect ? 1 : 0 },
      wrongCount: { increment: wasCorrect ? 0 : 1 },
      masteryLevel: level,
      nextReviewAt: wasCorrect ? nextReviewAt(level, now) : now,
      lastReviewedAt: now,
    },
  });
}

/** Meilleure série de bonnes réponses consécutives de la session. */
async function computeBestStreak(
  db: PrismaClient,
  sessionId: string,
): Promise<number> {
  const attempts = await db.questionAttempt.findMany({
    where: { sessionId, givenAnswer: { not: null } },
    orderBy: { answeredAt: "asc" },
    select: { isCorrect: true },
  });
  let best = 0;
  let current = 0;
  for (const attempt of attempts) {
    if (attempt.isCorrect) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

/**
 * Tables restant à apprendre (leçons non validées) pour le monde suivant.
 */
export async function getCompletedLessonTables(
  db: PrismaClient,
  childProfileId: string,
): Promise<number[]> {
  const rows = await db.childProgress.findMany({
    where: { childProfileId, lessonsCompleted: { gt: 0 } },
    select: { table: true },
  });
  return rows.map((r) => r.table);
}
