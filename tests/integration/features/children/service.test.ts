import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/database/generated/client";
import {
  canCreateChild,
  createChild,
  getChildForParent,
  listChildren,
  softDeleteChild,
  updateChild,
} from "@/features/children/service";

/**
 * Tests d'intégration des profils enfants (Phase 2.2) sur la base
 * PostgreSQL de test isolée. Domaine @child-test.example, purge au
 * beforeAll/afterAll.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});

const TEST_SUFFIX = "@child-test.example";

async function createParent(): Promise<{ id: string }> {
  const user = await prisma.user.create({
    data: {
      email: `p-${randomUUID()}${TEST_SUFFIX}`,
      passwordHash: "test-hash",
      role: "parent",
    },
    select: { id: true },
  });
  return user;
}

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_SUFFIX } },
    select: { id: true },
  });
  await prisma.user.deleteMany({
    where: { id: { in: users.map((u) => u.id) } },
  });
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_SUFFIX } },
    select: { id: true },
  });
  await prisma.user.deleteMany({
    where: { id: { in: users.map((u) => u.id) } },
  });
  await prisma.$disconnect();
});

describe("création de profils enfants", () => {
  it("crée réellement un profil avec avatar seedé et paramètres par défaut", async () => {
    const parent = await createParent();
    const result = await createChild(
      prisma,
      parent.id,
      { pseudonym: "Perle", avatarId: "licorne" },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.data.pseudonym).toBe("Perle");
    expect(result.data.avatarId).toBe("licorne");
    expect(result.data.avatarName).toBe("Licorne");
    expect(result.data.avatarImageKey).toBe("/avatars/licorne.svg");
    expect(result.data.level).toBe(1);
    expect(result.data.totalStars).toBe(0);

    const row = await prisma.childProfile.findUnique({
      where: { id: result.data.id },
      include: { settings: true },
    });
    expect(row?.settings).not.toBeNull();
    expect(row?.deletedAt).toBeNull();
  });

  it("rejette un pseudonyme invalide ou un avatar inconnu", async () => {
    const parent = await createParent();
    expect(
      (await createChild(prisma, parent.id, { pseudonym: "A", avatarId: "licorne" }))
        .status,
    ).toBe("invalid_input");
    expect(
      (await createChild(prisma, parent.id, { pseudonym: "Perle", avatarId: "inconnu" }))
        .status,
    ).toBe("invalid_input");
    // Données personnelles tentées dans le pseudonyme : rejetées.
    expect(
      (await createChild(prisma, parent.id, {
        pseudonym: "12 rue Dupont",
        avatarId: "licorne",
      })).status,
    ).toBe("invalid_input");
  });
});

describe("isolation stricte entre comptes parents", () => {
  it("un parent ne peut ni voir ni modifier le profil d'un autre parent", async () => {
    const parentA = await createParent();
    const parentB = await createParent();
    const created = await createChild(
      prisma,
      parentA.id,
      { pseudonym: "Tom", avatarId: "petit-dragon" },
    );
    if (created.status !== "ok") throw new Error("setup");

    // Lecture croisée : refusée.
    expect(
      (await getChildForParent(prisma, created.data.id, parentB.id)).status,
    ).toBe("not_found");
    // La liste de B ne contient pas l'enfant de A.
    const listB = await listChildren(prisma, parentB.id);
    expect(listB.some((c) => c.id === created.data.id)).toBe(false);

    // Modification croisée : refusée.
    expect(
      (
        await updateChild(prisma, created.data.id, parentB.id, {
          pseudonym: "Hacked",
        })
      ).status,
    ).toBe("not_found");
    const unchanged = await prisma.childProfile.findUnique({
      where: { id: created.data.id },
    });
    expect(unchanged?.pseudonym).toBe("Tom");

    // Suppression croisée : refusée.
    expect(
      (await softDeleteChild(prisma, created.data.id, parentB.id)).status,
    ).toBe("not_found");
    const stillThere = await prisma.childProfile.findUnique({
      where: { id: created.data.id },
    });
    expect(stillThere?.deletedAt).toBeNull();
  });
});

describe("mise à jour et suppression logique", () => {
  it("met à jour pseudonyme et avatar", async () => {
    const parent = await createParent();
    const created = await createChild(
      prisma,
      parent.id,
      { pseudonym: "Tom", avatarId: "fee" },
    );
    if (created.status !== "ok") throw new Error("setup");
    const updated = await updateChild(
      prisma,
      created.data.id,
      parent.id,
      { pseudonym: "Tom le Brave", avatarId: "chevalier" },
    );
    expect(updated.status).toBe("ok");
    if (updated.status !== "ok") return;
    expect(updated.data.pseudonym).toBe("Tom le Brave");
    expect(updated.data.avatarId).toBe("chevalier");
  });

  it("masque le profil supprimé (deletedAt) sans effacer les données", async () => {
    const parent = await createParent();
    const created = await createChild(
      prisma,
      parent.id,
      { pseudonym: "Faëlys", avatarId: "princesse" },
    );
    if (created.status !== "ok") throw new Error("setup");

    const deleted = await softDeleteChild(prisma, created.data.id, parent.id);
    expect(deleted.status).toBe("ok");

    // Inaccessible après suppression.
    expect(
      (await getChildForParent(prisma, created.data.id, parent.id)).status,
    ).toBe("not_found");
    // La liste ne le contient plus.
    expect(
      (await listChildren(prisma, parent.id)).some((c) => c.id === created.data.id),
    ).toBe(false);
    // Les données sont TOUJOURS en base (soft delete, pas de perte).
    const row = await prisma.childProfile.findUnique({
      where: { id: created.data.id },
    });
    expect(row?.deletedAt).not.toBeNull();
    expect(row?.pseudonym).toBe("Faëlys");
  });
});

describe("limite de profils par parent", () => {
  it("bloque au-delà de 6 profils actifs", async () => {
    const parent = await createParent();
    for (let i = 0; i < 6; i++) {
      const r = await createChild(prisma, parent.id, {
        pseudonym: `Enfant${i}`,
        avatarId: "magicien",
      });
      expect(r.status).toBe("ok");
    }
    await expect(canCreateChild(prisma, parent.id)).resolves.toBe(false);
  });

  it("compte uniquement les profils actifs (supprimés exclus)", async () => {
    const parent = await createParent();
    const first = await createChild(prisma, parent.id, {
      pseudonym: "Premier",
      avatarId: "petit-sorcier",
    });
    if (first.status !== "ok") throw new Error("setup");
    await softDeleteChild(prisma, first.data.id, parent.id);
    await expect(canCreateChild(prisma, parent.id)).resolves.toBe(true);
  });
});
