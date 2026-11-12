import { z } from "zod";

/**
 * Schémas de validation pour l'authentification parent.
 * Toute entrée est validée côté serveur (AGENTS.md).
 * Les messages sont en français et compréhensibles.
 */

const EMAIL_MESSAGE = "Veuillez saisir une adresse e-mail valide.";

/** Adresse e-mail : normalisée (espaces retirés, minuscules). */
export const EMAIL_SCHEMA = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, "L'adresse e-mail est trop longue (120 caractères maximum).")
  .email(EMAIL_MESSAGE);

/**
 * Mot de passe parent : minimum 8 caractères, maximum 100.
 * Aucune complexité imposée (NIST) : la longueur prime ; le hachage
 * bcrypt (coût 12) protège contre les attaques hors ligne.
 */
export const PASSWORD_SCHEMA = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(100, "Le mot de passe ne peut pas dépasser 100 caractères.");

export const REGISTER_SCHEMA = z
  .object({
    email: EMAIL_SCHEMA,
    password: PASSWORD_SCHEMA,
    passwordConfirm: z.string(),
    acceptTerms: z.literal(true, {
      message: "Vous devez accepter les conditions d'utilisation.",
    }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["passwordConfirm"],
  });

export const LOGIN_SCHEMA = z.object({
  email: EMAIL_SCHEMA,
  password: z
    .string()
    .min(1, "Veuillez saisir votre mot de passe.")
    .max(100),
});

export type RegisterInput = z.infer<typeof REGISTER_SCHEMA>;
export type LoginInput = z.infer<typeof LOGIN_SCHEMA>;

/** Version courante des conditions d'utilisation (trace de consentement). */
export const CURRENT_TERMS_VERSION = "v1";
