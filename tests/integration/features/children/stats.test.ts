import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/database/generated/client";
import { createChild } from "@/features/children/service";
import { getChildStats } from "@/features/children/stats";
import {
  completeGameSession,
  startGameSession,
  submitAnswer,
} from "@/features/game/service";

/**
 * Tests d'intégration des statistiques parentales (Étape I) :
 * agrégats corrects + isolation stricte entre parents.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});

const TEST_SUFFIX = "@stats-test.example";

async function createParent(): Promise<{ id: string }> {
  return prisma.user.create({
    data: {
      email: `s-${randomUUID()}${TEST_SUFFIX}`,
      passwordHash: "test-hash",
      role: "parent",
    },
    select: { id: true },
  });
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

describe("statistiques parentales", () => {
  it("refuse un enfant d'un autre parent", async () => {
    const parentA = await createParent();
    const parentB = await createParent();
    const created = await createChild(
      prisma,
      parentA.id,
      { pseudonym: "Perle", avatarId: "licorne" },
    );
    if (created.status !== "ok") throw new Error("setup");
    expect(
      (await getChildStats(prisma, created.data.id, parentB.id)).status,
    ).toBe("not_found");
  });

  it("agrège correctement sessions, réussite et maîtrise après un défi réel", async () => {
    const parent = await createParent();
    const created = await createChild(
      prisma,
      parent.id,
      { pseudonym: "Tom", avatarId: "chevalier" },
    );
    if (created.status !== "ok") throw new Error("setup");
    const childId = created.data.id;

    // Défi de 4 questions : 3 bonnes, 1 erreur.
    const start = await startGameSession(prisma, childId, {
      kind: "CHALLENGE",
      tables: [3],
      difficulty: "NORMAL",
      questionCount: 4,
      targetPercent: 80,
    });
    if (start.status !== "ok") throw new Error("setup");
    const [q0, q1, q2, q3] = start.questions;
    await submitAnswer(prisma, childId, start.sessionId, q0.questionId, q0.a * q0.b);
    await submitAnswer(prisma, childId, start.sessionId, q1.questionId, q1.a * q1.b);
    await submitAnswer(prisma, childId, start.sessionId, q2.questionId, q2.a * q2.b);
    await submitAnswer(prisma, childId, start.sessionId, q3.questionId, 999);
    await completeGameSession(prisma, childId, start.sessionId, 45);

    const result = await getChildStats(prisma, childId, parent.id);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const stats = result.stats;

    expect(stats.sessionCount).toBe(1);
    expect(stats.totalQuestionsAnswered).toBe(4);
    expect(stats.totalCorrect).toBe(3);
    expect(stats.overallAccuracy).toBe(75);

    // Progression de la table 3 : 3 correctes, 1 erreur → 75 %.
    const table3 = stats.tables.find((t) => t.table === 3);
    expect(table3?.correctCount).toBe(3);
    expect(table3?.accuracy).toBe(75);

    // Étoiles du défi : 3 bonnes réponses (pas parfait → pas de bonus).
    expect(stats.totalStars).toBe(3);
    expect(stats.xp).toBe(45); // 3 × 15 XP
    expect(stats.badgeCount).toBeGreaterThanOrEqual(1); // first_session

    // Table non travaillée : absente de la liste.
    expect(stats.tables.some((t) => t.table === 10)).toBe(false);
    expect(stats.masteredTables).toEqual([]); // pas de leçon validée
  });
});
