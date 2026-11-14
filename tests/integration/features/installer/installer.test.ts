import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/database/generated/client";
import { createFirstAdmin } from "@/features/installer/admin";
import {
  getInstallationState,
  isInstallationRequired,
} from "@/features/installer/status";
import { readAppConfig, saveAppConfig } from "@/features/installer/service";

/**
 * Tests d'intégration de l'installateur (scénarios de la mission 4–8) :
 * - création du premier administrateur, une seule fois ;
 * - atomicité : deux créations simultanées ne produisent jamais deux
 *   administrateurs (SELECT ... FOR UPDATE sur la ligne singleton) ;
 * - verrou définitif après création (statut completed) ;
 * - anti-abus (blocage après échecs répétés) ;
 * - mode hérité (comptes existants → assistant jamais proposé).
 *
 * Base PostgreSQL de TEST isolée. Suffixe @installer-test.example :
 * NON purgé par les autres fichiers de tests (qui purgent
 * @auth-test.example en parallèle) — les comptes de ce fichier sont
 * purgés ici exclusivement, ce qui rend les assertions déterministes.
 * La ligne `installation` est restaurée dans son état initial.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});

const TEST_SUFFIX = "@installer-test.example";
const STRONG_PASSWORD = "MotDePasseSolide1";

let savedInstallation: {
  status: string;
  completedAt: Date | null;
  adminUserId: string | null;
} | null;

async function resetInstallationRow(): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM installation WHERE id = 'installation'`);
}

beforeAll(async () => {
  const rows = await prisma.$queryRaw<
    { status: string; completedAt: Date | null; adminUserId: string | null }[]
  >`SELECT status, "completedAt", "adminUserId" FROM installation WHERE id = 'installation'`;
  savedInstallation = rows[0] ?? null;
  await resetInstallationRow();
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_SUFFIX } } });
  // La base de test peut contenir l'administrateur créé par les tests
  // E2E (installation.spec) : le premier admin doit être créable ici.
  await prisma.user.deleteMany({ where: { role: "admin" } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_SUFFIX } } });
  await resetInstallationRow();
  if (savedInstallation) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO installation (id, status, "completedAt", "adminUserId", "updatedAt")
       VALUES ('installation', $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET status = $1, "completedAt" = $2, "adminUserId" = $3, "updatedAt" = NOW()`,
      savedInstallation.status,
      savedInstallation.completedAt,
      savedInstallation.adminUserId,
    );
  } else {
    // Aucune ligne sauvegardée (base de test E2E) : convention = installation
    // terminée pour ne pas faire dévier les specs suivantes.
    await prisma.$executeRawUnsafe(
      `INSERT INTO installation (id, status, "completedAt", "appVersion", "updatedAt")
       VALUES ('installation', 'completed', NOW(), 'vitest', NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
  }
  await prisma.$disconnect();
});

async function testEmail(prefix: string): Promise<string> {
  return `${prefix}-${randomUUID()}${TEST_SUFFIX}`;
}

describe("statut d'installation", () => {
  it("sans ligne : statut en attente, cohérence du garde", async () => {
    const state = await getInstallationState(prisma);
    expect(state.status).toBe("pending");
    // Le garde reflète le mode hérité (d'autres fichiers de tests
    // peuvent créer des comptes en parallèle sur la même base).
    expect(await isInstallationRequired(prisma)).toBe(!state.legacy);
  });

  it("mode hérité : un utilisateur existant → assistant jamais proposé", async () => {
    const email = await testEmail("legacy-parent");
    await prisma.user.create({
      data: { email, passwordHash: "x", role: "parent" },
    });
    const state = await getInstallationState(prisma);
    expect(state.legacy).toBe(true);
    expect(await isInstallationRequired(prisma)).toBe(false);
  });
});

describe("création du premier administrateur", () => {
  it("crée l'administrateur puis verrouille définitivement l'assistant", async () => {
    const email = await testEmail("admin");
    const first = await createFirstAdmin(prisma, {
      displayName: "Admin Test",
      email,
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
    });
    expect(first.status).toBe("created");

    // L'administrateur existe avec le rôle admin, hachage bcrypt vérifié.
    const admin = await prisma.user.findUnique({ where: { email } });
    expect(admin?.role).toBe("admin");
    expect(admin?.passwordHash).toMatch(/^\$2[aby]\$/);

    // Verrou en base.
    const row = await prisma.installation.findUnique({
      where: { id: "installation" },
    });
    expect(row?.status).toBe("completed");
    expect(row?.completedAt).not.toBeNull();
    expect(row?.adminUserId).toBe(admin?.id);

    // Toute nouvelle tentative est refusée (jamais de 2e admin initial).
    const second = await createFirstAdmin(prisma, {
      displayName: "Admin 2",
      email: await testEmail("admin2"),
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
    });
    expect(second.status).toBe("already_installed");

    // Le garde ne propose plus l'assistant.
    expect(await isInstallationRequired(prisma)).toBe(false);
  });

  it("un administrateur existe : nouvelle création refusée (admin_exists)", async () => {
    await resetInstallationRow();
    // Un administrateur préexistant (autre que celui des tests ci-dessus).
    const existing = await testEmail("preexisting-admin");
    await prisma.user.create({
      data: {
        email: existing,
        passwordHash: "x",
        role: "admin",
      },
    });
    const result = await createFirstAdmin(prisma, {
      displayName: "Admin 3",
      email: await testEmail("admin3"),
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
    });
    expect(result.status).toBe("admin_exists");
    await prisma.user.delete({ where: { email: existing } });
  });

  it("formulaire invalide : comptage des tentatives puis blocage anti-abus", async () => {
    await resetInstallationRow();
    for (let i = 0; i < 5; i++) {
      const result = await createFirstAdmin(prisma, {
        displayName: "A", // trop court → invalide
        email: await testEmail("bad"),
        password: "court",
        passwordConfirm: "court",
      });
      expect(result.status).toBe("invalid_input");
    }
    const row = await prisma.installation.findUnique({
      where: { id: "installation" },
    });
    expect(row?.attemptsCount).toBeGreaterThanOrEqual(5);
    expect(row?.blockedUntil).not.toBeNull();
    // Tant que le blocage est actif, toute tentative est rejetée.
    const blocked = await createFirstAdmin(prisma, {
      displayName: "Admin 4",
      email: await testEmail("admin4"),
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
    });
    expect(blocked.status).toBe("blocked");
  });

  it("deux créations simultanées : un seul administrateur (atomicité)", async () => {
    await resetInstallationRow();
    // Purge des administrateurs de test précédents (prérequis : aucun
    // admin existant).
    await prisma.user.deleteMany({ where: { email: { endsWith: TEST_SUFFIX } } });
    const email = await testEmail("race");
    const input = {
      displayName: "Admin Race",
      email,
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
    };
    const [a, b] = await Promise.all([
      createFirstAdmin(prisma, input),
      createFirstAdmin(prisma, input),
    ]);
    const statuses = [a.status, b.status].sort();
    // Exactement une création réussie ; l'autre aboutit sur le verrou.
    expect(statuses).toEqual(["already_installed", "created"]);
    const admins = await prisma.user.findMany({
      where: { role: "admin", email: { endsWith: TEST_SUFFIX } },
    });
    expect(admins).toHaveLength(1);
  });
});

describe("configuration applicative (étape 2)", () => {
  it("sauvegarde et relit la configuration sans secret", async () => {
    const result = await saveAppConfig(prisma, {
      appName: "Royaume Test",
      appUrl: "https://test.example.com",
      defaultLanguage: "fr",
      timezone: "Europe/Paris",
      organization: "École Test",
    });
    expect(result.ok).toBe(true);
    const config = await readAppConfig(prisma);
    expect(config.appName).toBe("Royaume Test");
    expect(config.defaultLanguage).toBe("fr");

    // Nettoyage (clés `app.*` de test).
    await prisma.appConfig.deleteMany({ where: { key: { startsWith: "app." } } });
  });
});
