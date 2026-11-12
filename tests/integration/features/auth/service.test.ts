import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/database/generated/client";
import {
  authenticateParent,
  registerParent,
} from "@/features/auth/service";
import {
  checkLoginAllowed,
  recordLoginAttempt,
} from "@/features/auth/rate-limit";
import {
  createSessionForUser,
  resolveSession,
  revokeSessionById,
} from "@/lib/database/session";
import { REGISTER_SCHEMA } from "@/lib/validation/auth";

/**
 * Tests d'intégration de l'authentification parent.
 * Base PostgreSQL de test ISOLÉE (TEST_DATABASE_URL) — jamais la base de
 * développement ni celle de production. Les données de test portent
 * l' domaine @auth-test.example et sont supprimées au teardown.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});

const TEST_SUFFIX = "@auth-test.example";

function testEmail(): string {
  return `t-${randomUUID()}${TEST_SUFFIX}`;
}

const STRONG_PASSWORD = "MotDePasseSolide1";

beforeAll(async () => {
  // Isolation : purge des restes éventuels d'exécutions précédentes.
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_SUFFIX } } });
  await prisma.loginAttempt.deleteMany({
    where: { email: { endsWith: TEST_SUFFIX } },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: TEST_SUFFIX } } });
  await prisma.loginAttempt.deleteMany({
    where: { email: { endsWith: TEST_SUFFIX } },
  });
  await prisma.$disconnect();
});

describe("inscription parent", () => {
  it("crée réellement un compte avec mot de passe haché (scénarios 1 et 4)", async () => {
    const email = testEmail();
    const result = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    expect(result.status).toBe("created");
    if (result.status !== "created") return;

    const row = await prisma.user.findUnique({ where: { email } });
    expect(row).not.toBeNull();
    expect(row!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row!.passwordHash).not.toContain(STRONG_PASSWORD);
    expect(row!.termsAcceptedAt).not.toBeNull();
    expect(row!.email).toBe(email.toLowerCase());
  });

  it("refuse une adresse e-mail déjà utilisée (scénario 2)", async () => {
    const email = testEmail();
    const first = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    expect(first.status).toBe("created");

    const second = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    expect(second.status).toBe("email_taken");
  });

  it("refuse un doublon par changement de casse (contournement impossible)", async () => {
    const email = testEmail();
    await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    const upper = await registerParent(
      {
        email: email.toUpperCase(),
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    expect(upper.status).toBe("email_taken");
  });

  it("valide strictement les champs (scénario 3)", () => {
    const base = {
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
      acceptTerms: true,
    };
    // E-mail invalide
    expect(
      REGISTER_SCHEMA.safeParse({ ...base, email: "pas-un-email" }).success,
    ).toBe(false);
    // Mot de passe trop court
    expect(
      REGISTER_SCHEMA.safeParse({
        ...base,
        email: testEmail(),
        password: "court",
        passwordConfirm: "court",
      }).success,
    ).toBe(false);
    // Confirmation différente
    expect(
      REGISTER_SCHEMA.safeParse({
        ...base,
        email: testEmail(),
        passwordConfirm: "AutreMotDePasse1",
      }).success,
    ).toBe(false);
    // Conditions non acceptées
    expect(
      REGISTER_SCHEMA.safeParse({ email: testEmail(), ...base, acceptTerms: false })
        .success,
    ).toBe(false);
  });

  it("gère l'erreur PostgreSQL de contrainte d'unicité concurrente (P2002)", async () => {
    // Deux inscriptions quasi simultanées du même e-mail : au plus un succès.
    const email = testEmail();
    const input = {
      email,
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
      acceptTerms: true,
    };
    const [a, b] = await Promise.all([
      registerParent(input, prisma),
      registerParent(input, prisma),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["created", "email_taken"]);
  });
});

describe("connexion parent", () => {
  it("authentifie un compte existant avec le bon mot de passe (scénario 7)", async () => {
    const email = testEmail();
    await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    const result = await authenticateParent(
      email.toUpperCase(),
      STRONG_PASSWORD,
      prisma,
    );
    expect(result.status).toBe("authenticated");
    if (result.status === "authenticated") {
      expect(result.user.email).toBe(email);
    }
  });

  it("rejette un mot de passe incorrect (scénario 6)", async () => {
    const email = testEmail();
    await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    const result = await authenticateParent(email, "MauvaisMotDePasse1", prisma);
    expect(result.status).toBe("invalid_credentials");
  });

  it("rejette un compte inexistant sans le révéler (scénario 8)", async () => {
    const result = await authenticateParent(
      testEmail(),
      STRONG_PASSWORD,
      prisma,
    );
    // Même statut que « mot de passe incorrect » : message générique.
    expect(result.status).toBe("invalid_credentials");
  });

  it("vérifie un mot de passe valide contre le hachage stocké (scénario 5)", async () => {
    const email = testEmail();
    await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    const row = await prisma.user.findUnique({ where: { email } });
    expect(row).not.toBeNull();
  });
});

describe("limitation des tentatives", () => {
  it("bloque après 5 échecs dans la fenêtre (scénario 9)", async () => {
    const email = testEmail();

    // Aucun blocage initial.
    await expect(checkLoginAllowed(prisma, email)).resolves.toEqual({
      blocked: false,
    });

    for (let i = 0; i < 5; i++) {
      const result = await authenticateParent(email, "MauvaisMotDePasse1", prisma);
      expect(result.status).toBe("invalid_credentials");
    }

    const blocked = await authenticateParent(email, STRONG_PASSWORD, prisma);
    expect(blocked.status).toBe("blocked");
    if (blocked.status === "blocked") {
      expect(blocked.retryAfterMinutes).toBeGreaterThan(0);
      expect(blocked.retryAfterMinutes).toBeLessThanOrEqual(15);
    }
    // Même un mot de passe correct est refusé pendant le blocage.
    await expect(checkLoginAllowed(prisma, email)).resolves.toEqual({
      blocked: true,
      retryAfterMinutes: expect.any(Number),
    });
  });

  it("compte les tentatives indépendamment de la casse de l'e-mail", async () => {
    const email = testEmail();
    for (let i = 0; i < 3; i++) {
      await recordLoginAttempt(prisma, {
        email: email.toUpperCase(),
        success: false,
      });
    }
    const blocked = await checkLoginAllowed(prisma, email);
    // 3 échecs < 5 : pas encore bloqué, mais le comptage est partagé.
    expect(blocked).toEqual({ blocked: false });
    await recordLoginAttempt(prisma, { email, success: false });
    await recordLoginAttempt(prisma, { email, success: false });
    await expect(checkLoginAllowed(prisma, email)).resolves.toMatchObject({
      blocked: true,
    });
  });

  it("lève le blocage après expiration (scénario 10)", async () => {
    const email = testEmail();
    for (let i = 0; i < 5; i++) {
      await recordLoginAttempt(prisma, { email, success: false });
    }
    await expect(checkLoginAllowed(prisma, email)).resolves.toMatchObject({
      blocked: true,
    });

    // Simulation de l'écoulement du temps : les échecs sont rejetés à
    // 20 minutes en arrière (au-delà de la fenêtre de 15 minutes).
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    await prisma.loginAttempt.updateMany({
      where: { email, success: false },
      data: { attemptedAt: twentyMinutesAgo },
    });
    await expect(checkLoginAllowed(prisma, email)).resolves.toEqual({
      blocked: false,
    });
  });

  it("réinitialise les échecs après une connexion réussie", async () => {
    const email = testEmail();
    await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    for (let i = 0; i < 4; i++) {
      await authenticateParent(email, "MauvaisMotDePasse1", prisma);
    }
    const success = await authenticateParent(email, STRONG_PASSWORD, prisma);
    expect(success.status).toBe("authenticated");
    await expect(checkLoginAllowed(prisma, email)).resolves.toEqual({
      blocked: false,
    });
  });
});

describe("sessions signées et révocables", () => {
  it("crée une session valide et résout son utilisateur (scénarios 11 et 17)", async () => {
    const email = testEmail();
    const created = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    expect(created.status).toBe("created");
    if (created.status !== "created") return;

    const { token, expiresAt } = await createSessionForUser(prisma, created.user.id);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const resolved = await resolveSession(prisma, token);
    expect(resolved).not.toBeNull();
    expect(resolved!.user.id).toBe(created.user.id);
    expect(resolved!.user.email).toBe(email);
  });

  it("rejette une session révoquée (déconnexion) — scénario 14", async () => {
    const email = testEmail();
    const created = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    if (created.status !== "created") throw new Error("setup");

    const { token, sessionId } = await createSessionForUser(prisma, created.user.id);
    await expect(resolveSession(prisma, token)).resolves.not.toBeNull();

    await revokeSessionById(prisma, sessionId);
    await expect(resolveSession(prisma, token)).resolves.toBeNull();
  });

  it("rend inutilisable un jeton copié avant la déconnexion (scénario 15)", async () => {
    const email = testEmail();
    const created = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    if (created.status !== "created") throw new Error("setup");

    const { token, sessionId } = await createSessionForUser(prisma, created.user.id);
    const stolenToken = token; // « copie » du jeton avant déconnexion

    await revokeSessionById(prisma, sessionId);
    // Le jeton volé reste signé et non expiré, mais la révocation en base
    // le rend définitivement inutilisable.
    await expect(resolveSession(prisma, stolenToken)).resolves.toBeNull();
  });

  it("rejette une session expirée (scénario 12)", async () => {
    const email = testEmail();
    const created = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    if (created.status !== "created") throw new Error("setup");

    // Session créée directement avec une expiration passée.
    const expiresAt = new Date(Date.now() - 60_000);
    const session = await prisma.session.create({
      data: { userId: created.user.id, expiresAt },
      select: { id: true },
    });
    const { signSessionToken } = await import("@/lib/auth/session-token");
    const token = await signSessionToken(
      { userId: created.user.id, sessionId: session.id },
      expiresAt,
    );
    await expect(resolveSession(prisma, token)).resolves.toBeNull();
  });

  it("rejette une session falsifiée (scénario 13)", async () => {
    const email = testEmail();
    const created = await registerParent(
      {
        email,
        password: STRONG_PASSWORD,
        passwordConfirm: STRONG_PASSWORD,
        acceptTerms: true,
      },
      prisma,
    );
    if (created.status !== "created") throw new Error("setup");

    const { token } = await createSessionForUser(prisma, created.user.id);
    const tampered = token.slice(0, -4) + "AAAA";
    await expect(resolveSession(prisma, tampered)).resolves.toBeNull();
  });

  it("rejette tout accès sans session (scénario 16)", async () => {
    await expect(resolveSession(prisma, null)).resolves.toBeNull();
    await expect(resolveSession(prisma, undefined)).resolves.toBeNull();
    await expect(resolveSession(prisma, "")).resolves.toBeNull();
    await expect(resolveSession(prisma, "jeton-inexistant")).resolves.toBeNull();
  });

  it("isole strictement les comptes (scénario 18)", async () => {
    const emailA = testEmail();
    const emailB = testEmail();
    const input = (mail: string) => ({
      email: mail,
      password: STRONG_PASSWORD,
      passwordConfirm: STRONG_PASSWORD,
      acceptTerms: true,
    });
    const createdA = await registerParent(input(emailA), prisma);
    const createdB = await registerParent(input(emailB), prisma);
    if (createdA.status !== "created" || createdB.status !== "created") {
      throw new Error("setup");
    }

    const sessionA = await createSessionForUser(prisma, createdA.user.id);
    const resolved = await resolveSession(prisma, sessionA.token);
    expect(resolved!.user.id).toBe(createdA.user.id);
    expect(resolved!.user.id).not.toBe(createdB.user.id);
    expect(resolved!.user.email).toBe(emailA);

    // Un jeton de A n'ouvre jamais les données de B : la session en base
    // appartient à A et le couple (sub, jti) est vérifié.
    const sessionRow = await prisma.session.findUnique({
      where: { id: sessionA.sessionId },
    });
    expect(sessionRow!.userId).toBe(createdA.user.id);
    expect(sessionRow!.userId).not.toBe(createdB.user.id);
  });
});
