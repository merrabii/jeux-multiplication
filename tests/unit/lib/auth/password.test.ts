import { describe, expect, it } from "vitest";
import {
  dummyVerify,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";

describe("hachage des mots de passe (bcrypt)", () => {
  it("produit un hachage bcrypt différent du mot de passe en clair", async () => {
    const hash = await hashPassword("MotDePasseSecret1");
    expect(hash).not.toBe("MotDePasseSecret1");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("produit des hachages salés uniques pour le même mot de passe", async () => {
    const hash1 = await hashPassword("MotDePasseSecret1");
    const hash2 = await hashPassword("MotDePasseSecret1");
    expect(hash1).not.toBe(hash2);
  });

  it("vérifie un mot de passe valide", async () => {
    const hash = await hashPassword("MotDePasseSecret1");
    await expect(verifyPassword("MotDePasseSecret1", hash)).resolves.toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hash = await hashPassword("MotDePasseSecret1");
    await expect(verifyPassword("MotDePasseFaux1", hash)).resolves.toBe(false);
    await expect(verifyPassword("", hash)).resolves.toBe(false);
  });

  it("compare factiquement un mot de passe contre le hachage factice", async () => {
    // Utilisé pour égaliser le temps de réponse des comptes inconnus.
    await expect(dummyVerify("nimporte-quoi")).resolves.toBe(false);
  });
});
