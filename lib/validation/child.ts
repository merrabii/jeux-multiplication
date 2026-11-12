import { z } from "zod";
import { CHILD_PSEUDONYM_SCHEMA } from "./schemas";

/**
 * Validation des profils enfants (Phase 2.2).
 * Minimisation des données : pseudonyme + avatar, rien d'autre.
 */

export const CHILD_AVATAR_SCHEMA = z
  .string()
  .regex(/^[a-z0-9-]{1,50}$/, "Avatar inconnu.");

export const CREATE_CHILD_SCHEMA = z.object({
  pseudonym: CHILD_PSEUDONYM_SCHEMA,
  avatarId: CHILD_AVATAR_SCHEMA,
});

export const UPDATE_CHILD_SCHEMA = z.object({
  pseudonym: CHILD_PSEUDONYM_SCHEMA.optional(),
  avatarId: CHILD_AVATAR_SCHEMA.optional(),
});

export type CreateChildInput = z.infer<typeof CREATE_CHILD_SCHEMA>;
export type UpdateChildInput = z.infer<typeof UPDATE_CHILD_SCHEMA>;
