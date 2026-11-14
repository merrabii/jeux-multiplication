import { describe, expect, it } from "vitest";
import {
  ADMIN_SCHEMA,
  APP_CONFIG_SCHEMA,
  EXTERNAL_DB_SCHEMA,
  INSTALL_TOKEN_SCHEMA,
} from "@/features/installer/schemas";

/**
 * Validation côté serveur des formulaires de l'assistant (Zod) :
 * la sélection de ces scénarios suit la mission (champs requis,
 * mot de passe confirmé, URL optionnelle mais bien formée).
 */

describe("APP_CONFIG_SCHEMA (étape 2)", () => {
  it("accepte une configuration complète", () => {
    const result = APP_CONFIG_SCHEMA.safeParse({
      appName: "Royaume de l'école A",
      appUrl: "https://royaume.example.com",
      defaultLanguage: "fr",
      timezone: "Europe/Paris",
      organization: "École A",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un nom trop court", () => {
    expect(
      APP_CONFIG_SCHEMA.safeParse({
        appName: "R",
        appUrl: "",
        defaultLanguage: "fr",
        timezone: "UTC",
      }).success,
    ).toBe(false);
  });

  it("rejette une URL mal formée (mais accepte une URL vide)", () => {
    expect(
      APP_CONFIG_SCHEMA.safeParse({
        appName: "Royaume",
        appUrl: "ftp://pas-un-site",
        defaultLanguage: "fr",
        timezone: "UTC",
      }).success,
    ).toBe(false);
    expect(
      APP_CONFIG_SCHEMA.safeParse({
        appName: "Royaume",
        appUrl: "",
        defaultLanguage: "fr",
        timezone: "UTC",
      }).success,
    ).toBe(true);
  });
});

describe("EXTERNAL_DB_SCHEMA (étape 3B)", () => {
  it("accepte une connexion valide", () => {
    const result = EXTERNAL_DB_SCHEMA.safeParse({
      host: "db.example.com",
      port: "5432",
      database: "jeux",
      user: "jeux_user",
      password: "mot-de-passe",
      sslMode: "require",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.port).toBe(5432);
  });

  it("rejette un port hors bornes", () => {
    const result = EXTERNAL_DB_SCHEMA.safeParse({
      host: "db.example.com",
      port: "70000",
      database: "jeux",
      user: "jeux_user",
      password: "",
      sslMode: "prefer",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un sslMode inconnu", () => {
    const result = EXTERNAL_DB_SCHEMA.safeParse({
      host: "db.example.com",
      port: 5432,
      database: "jeux",
      user: "u",
      password: "",
      sslMode: "toujours",
    });
    expect(result.success).toBe(false);
  });
});

describe("ADMIN_SCHEMA (étape 5)", () => {
  it("accepte un administrateur complet", () => {
    const result = ADMIN_SCHEMA.safeParse({
      displayName: "Admin",
      email: "admin@example.com",
      password: "MotDePasseSolide1",
      passwordConfirm: "MotDePasseSolide1",
    });
    expect(result.success).toBe(true);
  });

  it("rejette des mots de passe différents", () => {
    const result = ADMIN_SCHEMA.safeParse({
      displayName: "Admin",
      email: "admin@example.com",
      password: "MotDePasseSolide1",
      passwordConfirm: "AutreMotDePasse1",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un mot de passe de moins de 8 caractères", () => {
    const result = ADMIN_SCHEMA.safeParse({
      displayName: "Admin",
      email: "admin@example.com",
      password: "court",
      passwordConfirm: "court",
    });
    expect(result.success).toBe(false);
  });

  it("normalise l'e-mail en minuscules", () => {
    const result = ADMIN_SCHEMA.safeParse({
      displayName: "Admin",
      email: "  Admin@Example.COM  ",
      password: "MotDePasseSolide1",
      passwordConfirm: "MotDePasseSolide1",
    });
    if (result.success) expect(result.data.email).toBe("admin@example.com");
    else expect.unreachable();
  });
});

describe("INSTALL_TOKEN_SCHEMA", () => {
  it("rejette un jeton vide", () => {
    expect(INSTALL_TOKEN_SCHEMA.safeParse({ token: "" }).success).toBe(false);
  });
});
