/**
 * Marque l'installation comme terminée sur la base indiquée
 * (TEST_DATABASE_URL sinon DATABASE_URL). Utilisé par l'environnement
 * E2E : la base de test héberge des comptes de test, donc mode hérité —
 * le garde d'installation ne doit pas rediriger vers l'assistant.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/database/generated/client";

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("❌ TEST_DATABASE_URL ou DATABASE_URL manquant.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  await db.installation.upsert({
    where: { id: "installation" },
    update: { status: "completed", completedAt: new Date() },
    create: { id: "installation", status: "completed", completedAt: new Date() },
  });
  console.log("✔ Installation marquée comme terminée (mode hérité E2E).");
} finally {
  await db.$disconnect();
}
