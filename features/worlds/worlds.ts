/**
 * Les cinq mondes magiques (Phase 2.6) — définis en code (données de
 * contenu, pas de données utilisateur). Le déblocage dépend de la
 * PROGRESSION PÉDAGOGIQUE (leçons validées), jamais du temps passé.
 */

export type MagicalWorld = {
  id: string;
  name: string;
  description: string;
  /** Leçons de tables requises pour débloquer (numéros de tables). */
  requiredLessons: number[];
  /** Tables recommandées dans ce monde. */
  recommendedTables: number[];
  /** Illustration locale (SVG). */
  imageKey: string;
  palette: { from: string; to: string };
};

export const MAGICAL_WORLDS: readonly MagicalWorld[] = [
  {
    id: "village-magiciens",
    name: "Village des magiciens",
    description:
      "Les premières incantations ! Ici on découvre les tables de 1 et de 2.",
    requiredLessons: [],
    recommendedTables: [1, 2],
    imageKey: "/images/worlds/village-magiciens.svg",
    palette: { from: "#e0e7ff", to: "#bfdbfe" },
  },
  {
    id: "foret-enchantee",
    name: "Forêt enchantée",
    description:
      "Luciole la fée t'attend pour consolider les tables de 3 et de 4.",
    requiredLessons: [1, 2],
    recommendedTables: [3, 4],
    imageKey: "/images/worlds/foret-enchantee.svg",
    palette: { from: "#dcfce7", to: "#a7f3d0" },
  },
  {
    id: "chateau-licornes",
    name: "Château des licornes",
    description:
      "Perle la licorne ouvre les portes : tables de 5 et de 6 au programme.",
    requiredLessons: [1, 2, 3, 4],
    recommendedTables: [5, 6],
    imageKey: "/images/worlds/chateau-licornes.svg",
    palette: { from: "#fdf2f8", to: "#f5d0fe" },
  },
  {
    id: "montagne-dragons",
    name: "Montagne des dragons",
    description:
      "Braise le dragon lance les défis avancés : tables de 7, 8 et 9.",
    requiredLessons: [1, 2, 3, 4, 5, 6],
    recommendedTables: [7, 8, 9],
    imageKey: "/images/worlds/montagne-dragons.svg",
    palette: { from: "#fee2e2", to: "#fed7aa" },
  },
  {
    id: "royaume-champions",
    name: "Royaume des champions",
    description:
      "Le sommet ! Toutes les tables, y compris la 10, pour devenir maître.",
    requiredLessons: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    recommendedTables: [10],
    imageKey: "/images/worlds/royaume-champions.svg",
    palette: { from: "#fef9c3", to: "#fde68a" },
  },
] as const;

/** Les leçons déjà validées (numéros de tables) → mondes débloqués. */
export function computeUnlockedWorlds(
  completedLessonTables: number[],
): MagicalWorld[] {
  const completed = new Set(completedLessonTables);
  return MAGICAL_WORLDS.filter((world) =>
    world.requiredLessons.every((t) => completed.has(t)),
  );
}

/** État de déblocage détaillé pour l'affichage enfant. */
export function worldUnlockState(
  world: MagicalWorld,
  completedLessonTables: number[],
): { unlocked: boolean; missing: number[] } {
  const completed = new Set(completedLessonTables);
  const missing = world.requiredLessons.filter((t) => !completed.has(t));
  return { unlocked: missing.length === 0, missing };
}
