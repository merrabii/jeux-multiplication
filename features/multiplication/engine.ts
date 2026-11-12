/**
 * Moteur de génération de questions de multiplication.
 * Logique métier pure (aucune dépendance à React ou à la base de données),
 * testée unitairement dans tests/unit.
 *
 * Difficulté :
 *  - EASY   : petit multiplicande ou multiplicateur (<= 5), ordre aidant
 *  - NORMAL : tables 1..10, ordre aléatoire
 *  - HARD   : priorité aux combinaisons 6..10 des deux côtés
 */

import { TABLE_NUMBERS } from "./tables";

export type Difficulty = "EASY" | "NORMAL" | "HARD";

export type MultiplicationQuestion = {
  /** Première opérande (nombre de groupes) */
  a: number;
  /** Seconde opérande (taille des groupes) */
  b: number;
  /** Table d'origine de la question */
  table: number;
  /** Réponse attendue */
  answer: number;
  /** Propositions de réponses (QCM), la bonne y figure toujours */
  choices: number[];
};

export type GenerateOptions = {
  tables: number[];
  difficulty: Difficulty;
  count: number;
  /** Graine déterministe pour les tests (optionnelle) */
  seed?: number;
};

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function createRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Génère des distracteurs plausibles pour un QCM enfant. */
function buildChoices(
  random: () => number,
  a: number,
  b: number,
): number[] {
  const answer = a * b;
  const distractors = new Set<number>();

  // Distracteurs pédagogiques : erreurs typiques des enfants.
  const candidates = [
    answer + a, // erreur classique : +1 groupe
    answer - b, // erreur classique : -1 groupe
    (a + 1) * b, // confusion de table
    a * (b + 1),
    answer + 1,
    answer - 1,
    answer + 10,
    answer - 10,
  ];

  for (const candidate of shuffle(candidates, random)) {
    if (distractors.size >= 3) break;
    if (candidate !== answer && candidate > 0) distractors.add(candidate);
  }
  // Filet de sécurité : si pas assez de distracteurs, valeurs proches.
  let offset = 2;
  while (distractors.size < 3) {
    const candidate = answer + offset;
    if (candidate > 0) distractors.add(candidate);
    offset += 1;
  }

  return shuffle([answer, ...distractors], random);
}

function pickOperands(
  random: () => number,
  table: number,
  difficulty: Difficulty,
): { a: number; b: number } {
  const other = (() => {
    switch (difficulty) {
      case "EASY":
        return pickInt(random, 1, 5);
      case "HARD":
        return pickInt(random, 6, 10);
      case "NORMAL":
      default:
        return pickInt(random, 1, 10);
    }
  })();

  // Ordre aléatoire (commutativité) sauf en EASY où "2 × 3" reste "2 groupes de 3".
  return random() < 0.5 || difficulty === "EASY"
    ? { a: table, b: other }
    : { a: other, b: table };
}

export function generateQuestions(options: GenerateOptions): MultiplicationQuestion[] {
  const { tables, difficulty, count, seed } = options;

  const validTables = tables.filter((t) => TABLE_NUMBERS.includes(t));
  if (validTables.length === 0) {
    throw new Error("Aucune table valide fournie (attendu : 1 à 10).");
  }
  if (count <= 0) {
    return [];
  }

  const random = createRandom(seed ?? Date.now());
  const questions: MultiplicationQuestion[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (questions.length < count && attempts < count * 20) {
    attempts += 1;
    const table = validTables[Math.floor(random() * validTables.length)];
    const { a, b } = pickOperands(random, table, difficulty);
    const key = `${a}x${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push({
      a,
      b,
      table,
      answer: a * b,
      choices: buildChoices(random, a, b),
    });
  }

  // Si toutes les combinaisons possibles sont épuisées (ex. table 1), on
  // autorise les répétitions plutôt que de renvoyer moins que demandé.
  while (questions.length < count) {
    const table = validTables[Math.floor(random() * validTables.length)];
    const { a, b } = pickOperands(random, table, difficulty);
    questions.push({
      a,
      b,
      table,
      answer: a * b,
      choices: buildChoices(random, a, b),
    });
  }

  return questions;
}

/** Vérifie la réponse d'un enfant (jamais côté navigateur en production). */
export function isCorrect(
  question: Pick<MultiplicationQuestion, "a" | "b">,
  answer: number,
): boolean {
  return Number.isInteger(answer) && answer === question.a * question.b;
}
