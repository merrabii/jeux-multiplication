/**
 * Configuration de l'authentification, lue depuis l'environnement.
 * AUCUNE valeur de secret par défaut : l'application refuse de démarrer
 * sans AUTH_SECRET (jamais intégré au code source).
 *
 * Valeurs documentées dans .env.example et docs/ENVIRONMENT.md.
 */

function readInt(name: string, defaultValue: number, minimum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(
      `Variable ${name} invalide : entier >= ${minimum} attendu, reçu "${raw}".`,
    );
  }
  return value;
}

/** Secret de signature des JWT de session (HS256). Minimum 32 caractères. */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET est absent ou trop court (32 caractères minimum). " +
        "Générez-le avec : node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }
  return secret;
}

/** Coût bcrypt (10 à 15). Défaut : 12. */
export const BCRYPT_ROUNDS = readInt("AUTH_BCRYPT_ROUNDS", 12, 10);

/** Durée de vie d'une session en heures. Défaut : 72 h. */
export const SESSION_HOURS = readInt("AUTH_SESSION_HOURS", 72, 1);

/** Nombre maximal de tentatives échouées dans la fenêtre. Défaut : 5. */
export const MAX_LOGIN_ATTEMPTS = readInt("AUTH_MAX_LOGIN_ATTEMPTS", 5, 1);

/** Fenêtre de comptabilisation des tentatives, en minutes. Défaut : 15. */
export const ATTEMPT_WINDOW_MINUTES = readInt("AUTH_ATTEMPT_WINDOW_MIN", 15, 1);

/** Durée du blocage après dépassement, en minutes. Défaut : 15. */
export const BLOCK_MINUTES = readInt("AUTH_BLOCK_MINUTES", 15, 1);

/** Conservation des tentatives (audit + purge), en heures. Défaut : 24. */
export const ATTEMPT_RETENTION_HOURS = readInt(
  "AUTH_ATTEMPT_RETENTION_HOURS",
  24,
  1,
);
