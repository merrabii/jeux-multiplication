import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Jeton d'installation (protection de l'assistant sur un serveur
 * exposé publiquement avant la fin de la procédure).
 *
 * Deux sources, vérifiées dans cet ordre :
 *  1. variable d'environnement `INSTALL_TOKEN` ;
 *  2. fichier `.install_token` (généré au démarrage du conteneur par
 *     docker/entrypoint.sh et imprimé dans les logs — visible
 *     uniquement de l'administrateur du serveur).
 *
 * Si aucune source n'est définie, l'assistant reste accessible :
 * c'est la configuration par défaut documentée pour Coolify / Dokploy
 * / un réseau privé ; un jeton est recommandé si l'application est
 * exposée à Internet avant l'installation.
 */

export const INSTALL_TOKEN_COOKIE = "installer_unlocked";

function readEnvToken(): string | null {
  const raw = process.env.INSTALL_TOKEN;
  if (raw === undefined || raw.trim() === "") return null;
  return raw.trim();
}

function readFileToken(): string | null {
  try {
    const path = process.env.INSTALL_TOKEN_FILE ?? ".install_token";
    const raw = readFileSync(/* turbopackIgnore: true */ path, "utf8").trim();
    return raw === "" ? null : raw;
  } catch {
    return null;
  }
}

/** Un jeton d'installation est-il exigé pour ouvrir l'assistant ? */
export function isInstallTokenRequired(): boolean {
  return readEnvToken() !== null || readFileToken() !== null;
}

/** Comparaison à temps constant (protection contre les oracles temporels). */
export function verifyInstallToken(input: string | undefined | null): boolean {
  const expected = readEnvToken() ?? readFileToken();
  if (expected === null) return true; // aucun jeton exigé
  if (input === undefined || input === null) return false;
  const provided = input.trim();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) {
    // Compare quand même à temps constant sur une taille fictive.
    timingSafeEqual(a, Buffer.alloc(a.length));
    return false;
  }
  return timingSafeEqual(a, b);
}

/** Jeton de récupération administrateur (variable ADMIN_RECOVERY_TOKEN). */
export function verifyRecoveryToken(input: string | undefined | null): boolean {
  const expected = process.env.ADMIN_RECOVERY_TOKEN;
  if (!expected || expected.trim() === "") return false; // mécanisme désactivé
  if (input === undefined || input === null) return false;
  const a = Buffer.from(expected.trim(), "utf8");
  const b = Buffer.from(input.trim(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isRecoveryEnabled(): boolean {
  const expected = process.env.ADMIN_RECOVERY_TOKEN;
  return Boolean(expected && expected.trim() !== "");
}
