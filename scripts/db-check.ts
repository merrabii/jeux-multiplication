/**
 * Vérification de la chaîne complète application -> PostgreSQL.
 * Principe : créer une donnée de test IDENTIFIABLE, la relire, la nettoyer.
 * Aucune donnée réelle n'est créée ni supprimée par ce script.
 *
 * Usage : npm run db:check
 */
import "dotenv/config";
import { prisma } from "@/lib/database/client";
import { randomUUID } from "node:crypto";

const MARKER = `db-check-${randomUUID()}`;

async function main() {
  console.log("1. Connexion à PostgreSQL…");
  await prisma.$queryRaw`SELECT 1`;
  console.log("   ✔ SELECT 1 : PostgreSQL répond");

  console.log("2. Transaction : création d'une donnée de test identifiable…");
  const email = `${MARKER}@test.example`;
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash: "test-only-not-a-real-password",
        displayName: MARKER,
      },
    });
    const child = await tx.childProfile.create({
      data: {
        userId: created.id,
        pseudonym: MARKER,
        settings: { create: { difficulty: "EASY" } },
      },
    });
    return { created, child };
  });
  console.log(`   ✔ Utilisateur ${user.created.id} + profil enfant ${user.child.id}`);

  console.log("3. Relecture depuis la base (persistance)…");
  const reloaded = await prisma.childProfile.findUnique({
    where: { id: user.child.id },
    include: { settings: true, user: true },
  });
  if (!reloaded || reloaded.settings?.difficulty !== "EASY") {
    throw new Error("La relecture a échoué : données incomplètes.");
  }
  console.log(
    `   ✔ Profil relu : pseudonyme=${reloaded.pseudonym}, difficulté=${reloaded.settings.difficulty}`,
  );

  console.log("4. Nettoyage (cascade sur profil enfant)…");
  await prisma.user.delete({ where: { id: user.created.id } });
  const remaining = await prisma.childProfile.count({
    where: { userId: user.created.id },
  });
  if (remaining !== 0) {
    throw new Error("La suppression en cascade a échoué.");
  }
  console.log("   ✔ Suppression en cascade vérifiée");

  console.log("\n✅ Persistance PostgreSQL vérifiée de bout en bout.");
}

main()
  .catch((error) => {
    console.error("❌ Échec de la vérification :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
