import type { PrismaClient } from "@/lib/database/generated/client";

/**
 * Seed idempotent des avatars (données de référence).
 * Upsert par identifiant stable : réexécutable sans effet de bord.
 * Appelé par `npm run db:seed`, `scripts/e2e-server.ts` et l'assistant
 * d'installation (étape « données indispensables »).
 */
export const AVATARS = [
  { id: "licorne", name: "Licorne", imageKey: "/avatars/licorne.svg", rarity: "common" },
  { id: "petit-dragon", name: "Petit dragon", imageKey: "/avatars/petit-dragon.svg", rarity: "common" },
  { id: "fee", name: "Fée", imageKey: "/avatars/fee.svg", rarity: "common" },
  { id: "magicien", name: "Magicien", imageKey: "/avatars/magicien.svg", rarity: "common" },
  { id: "princesse", name: "Princesse", imageKey: "/avatars/princesse.svg", rarity: "common" },
  { id: "chevalier", name: "Chevalier", imageKey: "/avatars/chevalier.svg", rarity: "common" },
  { id: "petit-sorcier", name: "Petit sorcier", imageKey: "/avatars/petit-sorcier.svg", rarity: "common" },
  { id: "gardienne-etoiles", name: "Gardienne des étoiles", imageKey: "/avatars/gardienne-etoiles.svg", rarity: "rare" },
] as const;

export async function seedAvatars(db: PrismaClient): Promise<number> {
  for (const avatar of AVATARS) {
    await db.avatar.upsert({
      where: { id: avatar.id },
      update: { name: avatar.name, imageKey: avatar.imageKey, rarity: avatar.rarity },
      create: avatar,
    });
  }
  return AVATARS.length;
}
