import { z } from "zod";

/**
 * Validation côté serveur des formulaires de l'assistant d'installation.
 * Aucune valeur sensible (mot de passe, jeton) n'est renvoyée au
 * navigateur ni journalisée.
 */

/** Étape 2 — Configuration générale de l'application. */
export const APP_CONFIG_SCHEMA = z.object({
  appName: z
    .string()
    .trim()
    .min(2, "Le nom de l'application doit contenir au moins 2 caractères.")
    .max(60, "Le nom de l'application ne peut pas dépasser 60 caractères."),
  appUrl: z
    .string()
    .trim()
    .max(200)
    .refine(
      (v) => v === "" || /^https?:\/\/.+/.test(v),
      "L'URL principale doit commencer par http:// ou https:// (ou rester vide).",
    ),
  defaultLanguage: z.enum(["fr", "en"]),
  timezone: z
    .string()
    .trim()
    .min(2, "Veuillez indiquer un fuseau horaire (ex. Europe/Paris).")
    .max(60),
  organization: z.string().trim().max(120).optional().default(""),
});

export type AppConfigInput = z.infer<typeof APP_CONFIG_SCHEMA>;

/** Étape 3B — Base PostgreSQL externe (formulaire + « Tester la connexion »). */
export const EXTERNAL_DB_SCHEMA = z.object({
  host: z.string().trim().min(1, "Veuillez indiquer l'hôte PostgreSQL.").max(255),
  port: z.coerce
    .number({ message: "Le port doit être un nombre." })
    .int("Le port doit être un entier.")
    .min(1, "Port invalide (1–65535).")
    .max(65535, "Port invalide (1–65535)."),
  database: z
    .string()
    .trim()
    .min(1, "Veuillez indiquer le nom de la base.")
    .max(63, "Un nom de base PostgreSQL ne dépasse pas 63 caractères."),
  user: z.string().trim().min(1, "Veuillez indiquer l'utilisateur PostgreSQL.").max(63),
  password: z.string().max(200),
  sslMode: z.enum(["disable", "prefer", "require"]),
});

export type ExternalDbInput = z.infer<typeof EXTERNAL_DB_SCHEMA>;

/** Étape 5 — Premier administrateur. */
export const ADMIN_SCHEMA = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Le pseudonyme administrateur doit contenir au moins 2 caractères.")
      .max(60, "Le pseudonyme ne peut pas dépasser 60 caractères."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(120)
      .email("Veuillez saisir une adresse e-mail valide."),
    password: z
      .string()
      .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
      .max(100, "Le mot de passe ne peut pas dépasser 100 caractères."),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["passwordConfirm"],
  });

export type AdminInput = z.infer<typeof ADMIN_SCHEMA>;

/** Jeton d'installation (étape d'entrée si exigé). */
export const INSTALL_TOKEN_SCHEMA = z.object({
  token: z.string().min(1, "Veuillez saisir le jeton d'installation.").max(200),
});
