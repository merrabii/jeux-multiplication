/**
 * Vérification manuelle de la protection des routes (Phase 2.1).
 * Crée un utilisateur de test identifiable, une session valide et une
 * session révoquée, puis affiche des jetons à utiliser avec curl.
 * Nettoie après usage : node scripts/auth-smoke.js --cleanup <email>
 */
import "dotenv/config";
import { prisma } from "@/lib/database/client";
import { createSessionForUser, revokeSessionById } from "@/lib/database/session";

const EMAIL = `smoke-${Date.now()}@auth-test.example`;

const mode = process.argv[2] ?? "setup";

async function main() {
  if (mode === "--cleanup") {
    const email = process.argv[3];
    await prisma.user.deleteMany({ where: { email } });
    console.log(`✔ Nettoyage de ${email}`);
    return;
  }

  const user = await prisma.user.create({
    data: { email: EMAIL, passwordHash: "smoke-test-hash", role: "parent" },
  });
  const valid = await createSessionForUser(prisma, user.id);
  const revoked = await createSessionForUser(prisma, user.id);
  await revokeSessionById(prisma, revoked.sessionId);

  console.log(JSON.stringify({
    email: EMAIL,
    validCookie: `rmm_session=${valid.token}`,
    revokedCookie: `rmm_session=${revoked.token}`,
  }));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
