import { randomBytes } from "node:crypto";
import "dotenv/config";

/**
 * Environnement de test pour Vitest.
 * Fournit un AUTH_SECRET de test si absent (jamais utilisé en production).
 * Charge .env pour DATABASE_URL / TEST_DATABASE_URL (sans écraser les
 * variables déjà définies dans l'environnement).
 */
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = randomBytes(48).toString("hex");
}
