import { describe, expect, it } from "vitest";
import {
  asRepeatedAddition,
  getTableTheme,
  multiply,
  TABLE_NUMBERS,
} from "@/features/multiplication/tables";
import { GENERATE_QUESTIONS_SCHEMA, CHILD_PSEUDONYM_SCHEMA } from "@/lib/validation/schemas";

describe("tables de multiplication", () => {
  it("couvre les 10 tables", () => {
    expect(TABLE_NUMBERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("calcule la multiplication", () => {
    expect(multiply(3, 4)).toBe(12);
    expect(multiply(7, 8)).toBe(56);
  });

  it("représente 3 × 4 comme 3 groupes de 4 (addition répétée)", () => {
    expect(asRepeatedAddition(3, 4)).toBe("4 + 4 + 4");
    expect(asRepeatedAddition(1, 7)).toBe("7");
  });

  it("fournit un thème pour chaque table", () => {
    for (const n of TABLE_NUMBERS) {
      const theme = getTableTheme(n);
      expect(theme).toBeDefined();
      expect(theme?.world.length).toBeGreaterThan(0);
      expect(theme?.tip.length).toBeGreaterThan(0);
    }
  });
});

describe("validation Zod", () => {
  it("accepte une requête de génération valide", () => {
    const result = GENERATE_QUESTIONS_SCHEMA.safeParse({
      tables: [2, 3],
      difficulty: "EASY",
      count: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.count).toBe(10);
    }
  });

  it("applique les valeurs par défaut", () => {
    const result = GENERATE_QUESTIONS_SCHEMA.safeParse({ tables: [1] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difficulty).toBe("NORMAL");
      expect(result.data.count).toBe(10);
    }
  });

  it("rejette des tables hors bornes", () => {
    const result = GENERATE_QUESTIONS_SCHEMA.safeParse({ tables: [0, 11] });
    expect(result.success).toBe(false);
  });

  it("rejette un pseudonyme d'enfant trop long ou avec caractères interdits", () => {
    expect(CHILD_PSEUDONYM_SCHEMA.safeParse("Lily").success).toBe(true);
    expect(CHILD_PSEUDONYM_SCHEMA.safeParse("L").success).toBe(false);
    expect(
      CHILD_PSEUDONYM_SCHEMA.safeParse("<script>").success,
    ).toBe(false);
    // Minimisation des données : pas de nom complet ni d'adresse.
    expect(
      CHILD_PSEUDONYM_SCHEMA.safeParse("Dupont Jean 15 rue de la gare").success,
    ).toBe(false);
  });
});
