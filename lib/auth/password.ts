import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "./config";

/**
 * Hachage et vérification des mots de passe (bcryptjs).
 * Aucun mot de passe en clair n'est jamais stocké ni journalisé.
 */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Hachage factice, calculé une fois par processus : comparé lorsqu'un
 * compte est inconnu, afin d'égaliser le temps de réponse entre
 * « compte inconnu » et « mot de passe incorrect » (protection contre
 * les oracles temporels révélant l'existence d'un compte).
 */
const DUMMY_HASH = bcrypt.hashSync("mot-de-passe-factice", BCRYPT_ROUNDS);

export async function dummyVerify(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}
