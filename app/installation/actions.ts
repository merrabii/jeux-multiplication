"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/database/client";
import { getAuthSecret } from "@/lib/auth/config";
import { isInstallationRequired } from "@/features/installer/status";
import {
  INSTALL_TOKEN_COOKIE,
  isInstallTokenRequired,
  verifyInstallToken,
} from "@/features/installer/token";
import { INSTALL_TOKEN_SCHEMA } from "@/features/installer/schemas";
import { EXTERNAL_DB_SCHEMA } from "@/features/installer/schemas";
import type { ExternalDbInput } from "@/features/installer/schemas";
import {
  saveAppConfig,
  testExternalDb,
  initializeDatabase,
} from "@/features/installer/service";
import type { InitStepResult } from "@/features/installer/service";
import {
  createFirstAdmin,
} from "@/features/installer/admin";
import type { InitReport } from "@/features/installer/service";

/**
 * Server Actions de l'assistant d'installation.
 *
 * CSRF : Next.js vérifie l'en-tête Origin de chaque Server Action
 * (protection intégrée, cohérente avec les autres actions du projet).
 * Chaque action revérifie côté serveur :
 *  1. l'installation n'est pas terminée (mode hérité compris) ;
 *  2. le jeton d'installation si exigé (cookie signé, 24 h).
 * Aucun secret (mot de passe, jeton, DATABASE_URL) n'est renvoyé au
 * navigateur ni journalisé.
 */

const INSTALLER_UNLOCK_TTL_HOURS = 24;

export type InstallerFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  /** Résultats réels de l'initialisation (étape 4). */
  init?: InitStepResult[];
  /** Détail d'échec (ex. blocage anti-abus). */
  retryAfterMinutes?: number;
};

function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret());
}

async function setUnlockedCookie(): Promise<void> {
  const token = await new SignJWT({ scope: "installer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${INSTALLER_UNLOCK_TTL_HOURS}h`)
    .sign(getSigningKey());
  const store = await cookies();
  store.set(INSTALL_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INSTALLER_UNLOCK_TTL_HOURS * 60 * 60,
  });
}

export async function isInstallerUnlocked(): Promise<boolean> {
  if (!isInstallTokenRequired()) return true;
  const store = await cookies();
  const raw = store.get(INSTALL_TOKEN_COOKIE)?.value;
  if (!raw) return false;
  try {
    const { payload } = await jwtVerify(raw, getSigningKey(), {
      algorithms: ["HS256"],
    });
    return payload.scope === "installer";
  } catch {
    return false;
  }
}

/**
 * Garde partagé de toutes les actions : redirige vers l'assistant si
 * l'installation est déjà faite, refuse si le jeton n'est pas validé.
 */
async function requireInstallerOpen(): Promise<void> {
  if (!(await isInstallationRequired(prisma))) {
    // Installateur verrouillé : aucune action n'est possible.
    redirect("/parent/connexion");
  }
  if (!(await isInstallerUnlocked())) {
    redirect("/installation");
  }
}

/** Étape d'entrée — validation du jeton d'installation (si exigé). */
export async function verifyInstallTokenAction(
  _prev: InstallerFormState,
  formData: FormData,
): Promise<InstallerFormState> {
  if (!(await isInstallationRequired(prisma))) {
    redirect("/parent/connexion");
  }
  const parsed = INSTALL_TOKEN_SCHEMA.safeParse({
    token: formData.get("token") ?? "",
  });
  if (!parsed.success || !verifyInstallToken(parsed.data.token)) {
    return { error: "Jeton d'installation invalide." };
  }
  await setUnlockedCookie();
  return { ok: true };
}

/** Étape 2 — sauvegarde de la configuration générale. */
export async function saveAppConfigAction(
  _prev: InstallerFormState,
  formData: FormData,
): Promise<InstallerFormState> {
  await requireInstallerOpen();
  const result = await saveAppConfig(prisma, {
    appName: formData.get("appName") ?? "",
    appUrl: formData.get("appUrl") ?? "",
    defaultLanguage: formData.get("defaultLanguage") ?? "fr",
    timezone: formData.get("timezone") ?? "",
    organization: formData.get("organization") ?? "",
  });
  if (!result.ok) {
    return {
      error: "Formulaire invalide. Corrigez les champs indiqués.",
      fieldErrors: result.errors,
    };
  }
  return { ok: true };
}

/** Étape 3B — « Tester la connexion » (aucune donnée n'est modifiée). */
export async function testExternalDbAction(
  _prev: InstallerFormState,
  formData: FormData,
): Promise<InstallerFormState> {
  await requireInstallerOpen();
  const input = externalDbFromForm(formData);
  if (typeof input === "string") {
    return { error: input };
  }
  const result = await testExternalDb(input);
  return result.ok
    ? { ok: true, error: undefined, fieldErrors: undefined, init: undefined }
    : { ok: false, error: result.message, fieldErrors: result.errors };
}

function externalDbFromForm(
  formData: FormData,
): ExternalDbInput | string {
  const parsed = EXTERNAL_DB_SCHEMA.safeParse({
    host: formData.get("host") ?? "",
    port: formData.get("port") ?? "",
    database: formData.get("database") ?? "",
    user: formData.get("user") ?? "",
    password: formData.get("password") ?? "",
    sslMode: formData.get("sslMode") ?? "prefer",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] = issue.message;
    }
    return "Formulaire incomplet ou invalide.";
  }
  return parsed.data;
}

/** Étape 4 — initialisation réelle (migrations, tables, avatars). */
export async function initializeAction(
  _prev: InstallerFormState,
  formData: FormData,
): Promise<InstallerFormState> {
  await requireInstallerOpen();
  const mode = formData.get("mode") === "external" ? "external" : "auto";
  let externalDb: ExternalDbInput | undefined;
  if (mode === "external") {
    const input = externalDbFromForm(formData);
    if (typeof input === "string") {
      return { error: input };
    }
    // Re-test rapide pour éviter d'appliquer des migrations vers une
    // cible invalide (aucune donnée n'est modifiée en cas d'échec).
    const check = await testExternalDb(input);
    if (!check.ok) {
      return { ok: false, error: check.message, fieldErrors: check.errors };
    }
    externalDb = input;
  }

  const report: InitReport = await initializeDatabase({
    externalDb,
    runMigrations: true,
  });
  return {
    ok: report.ok,
    init: report.steps,
    error: report.ok
      ? undefined
      : "Initialisation incomplète. Corrigez la configuration puis relancez : " +
        "aucune donnée existante n'a été supprimée.",
  };
}

/** Étape 5 — création atomique du premier administrateur. */
export async function createAdminAction(
  _prev: InstallerFormState,
  formData: FormData,
): Promise<InstallerFormState> {
  await requireInstallerOpen();
  const result = await createFirstAdmin(prisma, {
    displayName: formData.get("displayName") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    passwordConfirm: formData.get("passwordConfirm") ?? "",
  });

  switch (result.status) {
    case "created":
      return { ok: true };
    case "invalid_input":
      return {
        error: "Formulaire invalide. Corrigez les champs indiqués.",
        fieldErrors: result.errors,
      };
    case "admin_exists":
      return {
        error:
          "Un administrateur existe déjà : l'installation est verrouillée. " +
          "Utilisez la page de connexion ou la récupération sécurisée.",
      };
    case "blocked":
      return {
        error: `Trop de tentatives. Réessayez dans ${result.retryAfterMinutes} minute(s).`,
        retryAfterMinutes: result.retryAfterMinutes,
      };
    case "already_installed":
      return {
        error: "L'installation est déjà terminée : l'assistant est verrouillé.",
      };
  }
}
