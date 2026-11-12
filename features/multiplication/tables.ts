/**
 * Métadonnées des tables de multiplication (1 à 10).
 * Chaque table est associée à un univers magique (Phase 3 : mondes).
 */

export type TableTheme = {
  /** Numéro de la table (1..10) */
  number: number;
  /** Nom de l'univers magique associé */
  world: string;
  /** Personnage guide de la table */
  guide: string;
  /** Emoji principal (solution provisoire tant que les illustrations définitives manquent) */
  emoji: string;
  /** Astuce pédagogique en français */
  tip: string;
};

export const MULTIPLICATION_TABLES: readonly TableTheme[] = [
  {
    number: 1,
    world: "Village des apprentis magiciens",
    guide: "Étoile Première",
    emoji: "⭐",
    tip: "Multiplier par 1, c'est garder le nombre : 1 × 7 = 7.",
  },
  {
    number: 2,
    world: "Village des apprentis magiciens",
    guide: "Grimm le petit dragon",
    emoji: "🐉",
    tip: "Multiplier par 2, c'est doubler : 2 × 8 = 8 + 8 = 16.",
  },
  {
    number: 3,
    world: "Forêt enchantée",
    guide: "Luciole la fée",
    emoji: "🧚",
    tip: "Multiplier par 3, c'est ajouter trois fois le nombre : 3 × 4 = 4 + 4 + 4.",
  },
  {
    number: 4,
    world: "Forêt enchantée",
    guide: "Cristal le renard",
    emoji: "🦊",
    tip: "Multiplier par 4, c'est doubler deux fois : 4 × 6 = (6 + 6) + (6 + 6).",
  },
  {
    number: 5,
    world: "Château des licornes",
    guide: "Perle la licorne",
    emoji: "🦄",
    tip: "Multiplier par 5 donne toujours un nombre qui finit par 0 ou 5.",
  },
  {
    number: 6,
    world: "Château des licornes",
    guide: "Nacre le poney ailé",
    emoji: "🐴",
    tip: "Multiplier par 6, c'est multiplier par 5 puis ajouter le nombre : 6 × 4 = 20 + 4.",
  },
  {
    number: 7,
    world: "Montagne des dragons",
    guide: "Braise le dragon",
    emoji: "🐲",
    tip: "La table de 7 est la plus mystérieuse : entraîne-toi souvent !",
  },
  {
    number: 8,
    world: "Montagne des dragons",
    guide: "Orage le griffon",
    emoji: "🦅",
    tip: "Multiplier par 8, c'est doubler trois fois : 8 × 3 = 3 → 6 → 12 → 24.",
  },
  {
    number: 9,
    world: "Montagne des dragons",
    guide: "Brume le phoenix",
    emoji: "🔥",
    tip: "Pour 9 × n : le chiffre des dizaines est n-1, et les chiffres font toujours 9.",
  },
  {
    number: 10,
    world: "Royaume des champions",
    guide: "Astra la magicienne",
    emoji: "✨",
    tip: "Multiplier par 10, c'est ajouter un zéro : 10 × 6 = 60.",
  },
] as const;

export const TABLE_NUMBERS: readonly number[] = MULTIPLICATION_TABLES.map(
  (t) => t.number,
);

export function getTableTheme(number: number): TableTheme | undefined {
  return MULTIPLICATION_TABLES.find((t) => t.number === number);
}

/** Résultat de a × b. */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * 3 × 4 signifie "3 groupes de 4" — représentation en addition répétée,
 * cœur de l'approche pédagogique (comprendre avant de mémoriser).
 */
export function asRepeatedAddition(a: number, b: number): string {
  if (b === 1) return `${a}`;
  if (a === 1) return `${b}`;
  return Array.from({ length: a }, () => b).join(" + ");
}
