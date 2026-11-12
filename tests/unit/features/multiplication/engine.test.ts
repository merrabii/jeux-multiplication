import { describe, expect, it } from "vitest";
import {
  generateQuestions,
  isCorrect,
  type MultiplicationQuestion,
} from "@/features/multiplication/engine";

describe("generateQuestions", () => {
  it("génère le nombre de questions demandé", () => {
    const questions = generateQuestions({
      tables: [2, 3],
      difficulty: "NORMAL",
      count: 10,
      seed: 42,
    });
    expect(questions).toHaveLength(10);
  });

  it("génère des questions déterministes pour une même graine", () => {
    const first = generateQuestions({
      tables: [7],
      difficulty: "NORMAL",
      count: 8,
      seed: 1234,
    });
    const second = generateQuestions({
      tables: [7],
      difficulty: "NORMAL",
      count: 8,
      seed: 1234,
    });
    expect(first).toEqual(second);
  });

  it("utilise uniquement les tables demandées", () => {
    const questions = generateQuestions({
      tables: [4],
      difficulty: "NORMAL",
      count: 20,
      seed: 7,
    });
    for (const q of questions) {
      expect([q.a, q.b]).toContain(4);
    }
  });

  it("proposer toujours la bonne réponse dans les choix du QCM", () => {
    const questions = generateQuestions({
      tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      difficulty: "HARD",
      count: 50,
      seed: 99,
    });
    for (const q of questions) {
      expect(q.choices).toContain(q.answer);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices).toHaveLength(4);
    }
  });

  it("respecte la difficulté EASY (opérandes 1..5)", () => {
    const questions = generateQuestions({
      tables: [6, 7, 8],
      difficulty: "EASY",
      count: 30,
      seed: 5,
    });
    for (const q of questions) {
      const [operand] = q.a === q.table ? [q.b] : [q.a];
      expect(operand).toBeLessThanOrEqual(5);
    }
  });

  it("lève une erreur si aucune table valide n'est fournie", () => {
    expect(() =>
      generateQuestions({
        tables: [11, 0],
        difficulty: "NORMAL",
        count: 5,
      }),
    ).toThrow("Aucune table valide fournie (attendu : 1 à 10).");
  });

  it("renvoie un tableau vide pour un nombre de questions nul", () => {
    expect(
      generateQuestions({ tables: [2], difficulty: "NORMAL", count: 0 }),
    ).toEqual([]);
  });
});

describe("isCorrect", () => {
  const question: Pick<MultiplicationQuestion, "a" | "b"> = { a: 3, b: 4 };

  it("accepte la bonne réponse", () => {
    expect(isCorrect(question, 12)).toBe(true);
  });

  it("refuse une réponse fausse", () => {
    expect(isCorrect(question, 11)).toBe(false);
  });

  it("refuse une valeur non entière", () => {
    expect(isCorrect(question, Number.NaN)).toBe(false);
    expect(isCorrect(question, 12.5)).toBe(false);
  });
});
