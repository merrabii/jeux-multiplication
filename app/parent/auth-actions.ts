"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/database/client";
import {
  clearSessionCookie,
  createSessionForUser,
  readSessionToken,
  resolveSession,
  revokeSessionById,
  setSessionCookie,
} from "@/lib/database/session";
import {
  authenticateParent,
  registerParent,
} from "@/features/auth/service";
import { LOGIN_SCHEMA, REGISTER_SCHEMA } from "@/lib/validation/auth";

/**
 * Server Actions d'authentification parent.
 * Protection CSRF : Next.js vérifie l'en-tête Origin de chaque Server
 * Action (comportement intégré, documenté dans docs/SECURITY.md).
 * Aucun mot de passe n'est journalisé.
 */

export type AuthFormState = { error?: string };

/** Message d'échec générique (ne révèle pas l'existence d'un compte). */
const GENERIC_CREDENTIALS_ERROR =
  "E-mail ou mot de passe incorrect.";

export async function registerParentAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = REGISTER_SCHEMA.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    passwordConfirm: formData.get("passwordConfirm") ?? "",
    acceptTerms: formData.get("acceptTerms") === "on" ? true : undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Formulaire invalide." };
  }

  const result = await registerParent(
    {
      email: parsed.data.email,
      password: parsed.data.password,
      passwordConfirm: parsed.data.passwordConfirm,
      acceptTerms: parsed.data.acceptTerms,
    },
    prisma,
  );

  switch (result.status) {
    case "invalid_input":
      return { error: "Formulaire invalide. Vérifiez les champs saisis." };
    case "email_taken":
      return {
        error:
          "Cette adresse e-mail est déjà utilisée. Vous pouvez vous connecter.",
      };
    case "created": {
      const { token, expiresAt } = await createSessionForUser(
        prisma,
        result.user.id,
      );
      await setSessionCookie(token, expiresAt);
      redirect("/parent");
    }
  }
}

export async function loginParentAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = LOGIN_SCHEMA.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Formulaire invalide." };
  }

  const headerList = await headers();
  const ipAddress =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const result = await authenticateParent(
    parsed.data.email,
    parsed.data.password,
    prisma,
    ipAddress,
  );

  switch (result.status) {
    case "blocked":
      return {
        error:
          `Trop de tentatives. Réessayez dans ${result.retryAfterMinutes} minute(s).`,
      };
    case "invalid_credentials":
      return { error: GENERIC_CREDENTIALS_ERROR };
    case "authenticated": {
      const { token, expiresAt } = await createSessionForUser(
        prisma,
        result.user.id,
      );
      await setSessionCookie(token, expiresAt);
      redirect("/parent");
    }
  }
}

export async function logoutParentAction(): Promise<void> {
  const token = await readSessionToken();
  if (token) {
    const auth = await resolveSession(prisma, token);
    if (auth) {
      // Révocation effective en base : le jeton devient inutilisable,
      // y compris s'il a été copié avant la déconnexion.
      await revokeSessionById(prisma, auth.session.id);
    }
  }
  await clearSessionCookie();
  redirect("/parent/connexion");
}
