/**
 * Seed idempotent des données de référence (avatars).
 * La définition des avatars vit dans features/avatars/seed.ts afin de
 * pouvoir être réutilisée par l'assistant d'installation.
 * Usage : npm run db:seed
 */
import "dotenv/config";
import { prisma } from "@/lib/database/client";
import { seedAvatars } from "@/features/avatars/seed";

async function main() {
  const count = await seedAvatars(prisma);
  console.log(`✔ ${count} avatars seedés (upsert idempotent).`);
}

main()
  .catch((error) => {
    console.error("❌ Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
