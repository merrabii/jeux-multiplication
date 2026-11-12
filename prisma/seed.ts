/**
 * Seed idempotent des données de référence (avatars).
 * Upsert par identifiant stable : peut être réexécuté sans effet de bord.
 * Usage : npm run db:seed
 */
import "dotenv/config";
import { prisma } from "@/lib/database/client";

const AVATARS = [
  { id: "licorne", name: "Licorne", imageKey: "/avatars/licorne.svg", rarity: "common" },
  { id: "petit-dragon", name: "Petit dragon", imageKey: "/avatars/petit-dragon.svg", rarity: "common" },
  { id: "fee", name: "Fée", imageKey: "/avatars/fee.svg", rarity: "common" },
  { id: "magicien", name: "Magicien", imageKey: "/avatars/magicien.svg", rarity: "common" },
  { id: "princesse", name: "Princesse", imageKey: "/avatars/princesse.svg", rarity: "common" },
  { id: "chevalier", name: "Chevalier", imageKey: "/avatars/chevalier.svg", rarity: "common" },
  { id: "petit-sorcier", name: "Petit sorcier", imageKey: "/avatars/petit-sorcier.svg", rarity: "common" },
  { id: "gardienne-etoiles", name: "Gardienne des étoiles", imageKey: "/avatars/gardienne-etoiles.svg", rarity: "rare" },
] as const;

async function main() {
  for (const avatar of AVATARS) {
    await prisma.avatar.upsert({
      where: { id: avatar.id },
      update: { name: avatar.name, imageKey: avatar.imageKey, rarity: avatar.rarity },
      create: avatar,
    });
  }
  console.log(`✔ ${AVATARS.length} avatars seedés (upsert idempotent).`);
}

main()
  .catch((error) => {
    console.error("❌ Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
