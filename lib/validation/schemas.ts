import { z } from "zod";

/**
 * Schémas de validation Zod pour la Phase 1.
 * Toute donnée entrante d'API sera validée côté serveur (règle AGENTS.md).
 */

export const TABLES_SCHEMA = z
  .array(z.int().min(1).max(10))
  .min(1)
  .max(10);

export const DIFFICULTY_SCHEMA = z.enum(["EASY", "NORMAL", "HARD"]);

export const GENERATE_QUESTIONS_SCHEMA = z.object({
  tables: TABLES_SCHEMA,
  difficulty: DIFFICULTY_SCHEMA.default("NORMAL"),
  count: z.int().min(1).max(50).default(10),
  seed: z.int().optional(),
});

export type GenerateQuestionsInput = z.infer<typeof GENERATE_QUESTIONS_SCHEMA>;

/** Réponse d'un enfant à une question. */
export const ANSWER_SCHEMA = z.object({
  questionId: z.string().min(1),
  answer: z.int().min(0).max(100),
});

/** Validation d'un pseudonyme d'enfant : court, sans données personnelles. */
export const CHILD_PSEUDONYM_SCHEMA = z
  .string()
  .trim()
  .min(2, "Le pseudonyme doit contenir au moins 2 caractères")
  .max(20, "Le pseudonyme doit contenir au plus 20 caractères")
  .regex(
    /^[a-zA-ZÀ-ÿ0-9 \-']+$/,
    "Lettres, chiffres, espaces et tirets uniquement",
  );
