import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/database/generated/client";
import {
  completeGameSession,
  startGameSession,
  submitAnswer,
} from "@/features/game/service";
import {
  nextMasteryLevel,
  nextReviewAt,
} from "@/features/spaced-repetition/schedule";
import { computeSessionRewards } from "@/features/rewards/rules";

/**
 * Tests d'intégration du service de jeu (Phase 2.3/2.4/2.5) sur la base
 * PostgreSQL de test isolée : validation serveur des réponses,
 * idempotence de la complétion, récompenses, maîtrise, badges.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});

const TEST_SUFFIX = "@game-test.example";

async function createParentWithChild(): Promise<{
  parentId: string;
  childId: string;
}> {
  const parent = await prisma.user.create({
    data: {
      email: `g-${randomUUID()}${TEST_SUFFIX}`,
      passwordHash: "test-hash",
      role: "parent",
    },
    select: { id: true },
  });
  const child = await prisma.childProfile.create({
    data: {
      userId: parent.id,
      pseudonym: "TestGame",
      avatarId: "licorne",
      dailyGoal: 3,
    },
    select: { id: true },
  });
  return { parentId: parent.id, childId: child.id };
}

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_SUFFIX } },
    select: { id: true },
  });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_SUFFIX } },
    select: { id: true },
  });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.$disconnect();
});

describe("démarrage de session", () => {
  it("crée une session avec questions sans réponses exposées", async () => {
    const { childId } = await createParentWithChild();
    const result = await startGameSession(prisma, childId, {
      kind: "CHALLENGE",
      tables: [2, 3],
      difficulty: "NORMAL",
      questionCount: 5,
      targetPercent: 80,
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.questions).toHaveLength(5);
    for (const q of result.questions) {
      expect([2, 3]).toContain(q.a === 2 || q.a === 3 ? q.a : q.b);
      expect(q.choices).toContain(q.a * q.b);
      expect(q.choices).toHaveLength(4);
      // La réponse attendue figure dans les choix (QCM) mais il n'existe
      // aucun champ « answer » transmis au client.
      expect(Object.hasOwn(q, "answer")).toBe(false);
    }
    const row = await prisma.learningSession.findUnique({
      where: { id: result.sessionId },
      include: { attempts: true },
    });
    expect(row?.attempts).toHaveLength(5);
    expect(row?.completedAt).toBeNull();
  });

  it("rejette les entrées invalides (kind, tables, count)", async () => {
    const { childId } = createParentWithChild && (await createParentWithChild());
    expect(
      (await startGameSession(prisma, childId, {
        kind: "HACK",
        tables: [2],
        difficulty: "NORMAL",
        questionCount: 5,
      })).status,
    ).toBe("invalid_input");
    expect(
      (await startGameSession(prisma, childId, {
        kind: "PRACTICE",
        tables: [99],
        difficulty: "NORMAL",
        questionCount: 5,
      })).status,
    ).toBe("invalid_input");
    expect(
      (await startGameSession(prisma, childId, {
        kind: "PRACTICE",
        tables: [2],
        difficulty: "NORMAL",
        questionCount: 0,
      })).status,
    ).toBe("invalid_input");
  });
});

describe("validation des réponses (côté serveur uniquement)", () => {
  it("accepte une bonne réponse et rejette une mauvaise, en recalculant a×b", async () => {
    const { childId } = await createParentWithChild();
    const start = await startGameSession(prisma, childId, {
      kind: "PRACTICE",
      tables: [3],
      difficulty: "NORMAL",
      questionCount: 2,
    });
    if (start.status !== "ok") throw new Error("setup");
    const q = start.questions[0];

    // Le client peut tricher en envoyant 999 : le serveur recalcule.
    const wrong = await submitAnswer(prisma, childId, start.sessionId, q.questionId, 999);
    expect(wrong.status).toBe("ok");
    if (wrong.status !== "ok") return;
    expect(wrong.isCorrect).toBe(false);
    expect(wrong.correctAnswer).toBe(q.a * q.b);

    const good = await submitAnswer(
      prisma,
      childId,
      start.sessionId,
      start.questions[1].questionId,
      start.questions[1].a * start.questions[1].b,
    );
    expect(good.status).toBe("ok");
    if (good.status !== "ok") return;
    expect(good.isCorrect).toBe(true);
    // Addition répétée : « a + a + … » ; pour 1×b, un seul terme (pas de +).
    if (start.questions[1].a > 1) {
      expect(good.repeatedAddition).toContain("+");
    }
  });

  it("refuse une question d'une autre session ou d'un autre enfant", async () => {
    const a = await createParentWithChild();
    const b = await createParentWithChild();
    const start = await startGameSession(prisma, a.childId, {
      kind: "PRACTICE",
      tables: [4],
      difficulty: "NORMAL",
      questionCount: 1,
    });
    if (start.status !== "ok") throw new Error("setup");
    const q = start.questions[0];

    // Question soumise par un AUTRE enfant (session appartenant à A).
    expect(
      (await submitAnswer(prisma, b.childId, start.sessionId, q.questionId, q.a * q.b))
        .status,
    ).toBe("not_found");

    // Identifiants inventés.
    expect(
      (await submitAnswer(prisma, a.childId, start.sessionId, randomUUID(), 12)).status,
    ).toBe("not_found");
  });
});

describe("complétion idempotente et récompenses", () => {
  it("attribue les récompenses une seule fois, même en cas de double appel", async () => {
    const { childId } = await createParentWithChild();
    const start = await startGameSession(prisma, childId, {
      kind: "CHALLENGE",
      tables: [5],
      difficulty: "EASY",
      questionCount: 4,
      targetPercent: 80,
    });
    if (start.status !== "ok") throw new Error("setup");

    // Toutes les réponses correctes.
    for (const q of start.questions) {
      await submitAnswer(prisma, childId, start.sessionId, q.questionId, q.a * q.b);
    }

    const first = await completeGameSession(prisma, childId, start.sessionId, 60);
    expect(first.status).toBe("ok");
    if (first.status !== "ok") return;
    expect(first.summary.correctCount).toBe(4);
    expect(first.summary.perfect).toBe(true);
    expect(first.summary.targetReached).toBe(true);
    expect(first.summary.starsEarned).toBe(4 + 10); // 4 bonnes + bonus parfait
    expect(first.summary.diamondsEarned).toBe(1);
    expect(first.newBadges).toContain("first_session");
    expect(first.newBadges).toContain("perfect_challenge");

    const afterFirst = await prisma.childProfile.findUnique({ where: { id: childId } });

    // Deuxième appel : AUCUNE récompense supplémentaire.
    const second = await completeGameSession(prisma, childId, start.sessionId, 60);
    expect(second.status).toBe("already_completed");
    const afterSecond = await prisma.childProfile.findUnique({ where: { id: childId } });
    expect(afterSecond?.totalStars).toBe(afterFirst?.totalStars);
    expect(afterSecond?.xp).toBe(afterFirst?.xp);
    expect(afterSecond?.coins).toBe(afterFirst?.coins);

    // Ligne session : correctCount persisté.
    const row = await prisma.learningSession.findUnique({
      where: { id: start.sessionId },
    });
    expect(row?.correctCount).toBe(4);
    expect(row?.starsEarned).toBe(afterFirst!.totalStars);
    expect(row?.completedAt).not.toBeNull();
  });

  it("met à jour la progression par table et la maîtrise après une session", async () => {
    const { childId } = await createParentWithChild();
    const start = await startGameSession(prisma, childId, {
      kind: "PRACTICE",
      tables: [6],
      difficulty: "NORMAL",
      questionCount: 3,
    });
    if (start.status !== "ok") throw new Error("setup");
    await submitAnswer(prisma, childId, start.sessionId, start.questions[0].questionId,
      start.questions[0].a * start.questions[0].b);
    await submitAnswer(prisma, childId, start.sessionId, start.questions[1].questionId, 999);
    await submitAnswer(prisma, childId, start.sessionId, start.questions[2].questionId,
      start.questions[2].a * start.questions[2].b);
    const done = await completeGameSession(prisma, childId, start.sessionId, 90);
    expect(done.status).toBe("ok");

    const progress = await prisma.childProgress.findUnique({
      where: { childProfileId_table: { childProfileId: childId, table: 6 } },
    });
    expect(progress?.correctCount).toBe(2);
    expect(progress?.wrongCount).toBe(1);
    expect(progress?.practiceSessions).toBe(1);

    const masteries = await prisma.multiplicationMastery.findMany({
      where: { childProfileId: childId },
    });
    expect(masteries.length).toBeGreaterThanOrEqual(3);
    // Une erreur retombe au niveau 1 (fragile) ; une réussite monte.
    const wrongOne = masteries.find((m) => m.wrongCount > 0);
    expect(wrongOne?.masteryLevel).toBe(1);
    expect(wrongOne?.nextReviewAt).not.toBeNull();

    // Activité du jour : 3 réponses, 2 bonnes.
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    const activity = await prisma.dailyActivity.findUnique({
      where: { childProfileId_day: { childProfileId: childId, day } },
    });
    expect(activity?.questionsAnswered).toBe(3);
    expect(activity?.correctAnswers).toBe(2);
  });

  it("marque la leçon comme validée (lessonsCompleted)", async () => {
    const { childId } = await createParentWithChild();
    const start = await startGameSession(prisma, childId, {
      kind: "LESSON",
      tables: [2],
      difficulty: "EASY",
      questionCount: 2,
    });
    if (start.status !== "ok") throw new Error("setup");
    for (const q of start.questions) {
      await submitAnswer(prisma, childId, start.sessionId, q.questionId, 999);
    }
    const done = await completeGameSession(prisma, childId, start.sessionId, 120);
    expect(done.status).toBe("ok");

    const progress = await prisma.childProgress.findUnique({
      where: { childProfileId_table: { childProfileId: childId, table: 2 } },
    });
    expect(progress?.lessonsCompleted).toBe(1);
  });
});

describe("révision espacée (unitaire)", () => {
  it("progresse par paliers et plafonne au niveau 3", () => {
    expect(nextMasteryLevel(0, true)).toBe(2);
    expect(nextMasteryLevel(1, true)).toBe(2);
    expect(nextMasteryLevel(2, true)).toBe(3);
    expect(nextMasteryLevel(3, true)).toBe(3);
    expect(nextMasteryLevel(3, false)).toBe(1);
    expect(nextMasteryLevel(0, false)).toBe(1);
  });

  it("définit des intervalles de révision croissants", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const l1 = nextReviewAt(1, now)!;
    const l2 = nextReviewAt(2, now)!;
    const l3 = nextReviewAt(3, now)!;
    expect(l1.getTime() - now.getTime()).toBe(1 * 3600_000);
    expect(l2.getTime() - now.getTime()).toBe(24 * 3600_000);
    expect(l3.getTime() - now.getTime()).toBe(72 * 3600_000);
    expect(nextReviewAt(0, now)).toBeNull();
  });
});

describe("règles de récompenses (unitaire)", () => {
  it("calcule leçons, entraînements et défis selon les règles", () => {
    const lesson = computeSessionRewards({
      kind: "LESSON",
      correctCount: 8,
      totalQuestions: 8,
      currentXp: 0,
      currentLevel: 1,
    });
    expect(lesson.starsEarned).toBe(15); // 10 + 5 bonus parfait
    expect(lesson.xpEarned).toBe(70); // 50 + 20 bonus
    expect(lesson.coinsEarned).toBe(3); // floor(70/20)

    const challenge = computeSessionRewards({
      kind: "CHALLENGE",
      correctCount: 3,
      totalQuestions: 5,
      targetPercent: 80,
      currentXp: 90,
      currentLevel: 1,
    });
    expect(challenge.targetReached).toBe(false); // 60 % < 80 %
    expect(challenge.starsEarned).toBe(3);
    expect(challenge.xpEarned).toBe(45);
    expect(challenge.newLevel).toBe(2); // 90 + 45 >= 100

    const practice = computeSessionRewards({
      kind: "PRACTICE",
      correctCount: 5,
      totalQuestions: 10,
      currentXp: 0,
      currentLevel: 1,
    });
    expect(practice.starsEarned).toBe(2); // floor(5/2)
    expect(practice.percentCorrect).toBe(50);
  });
});
