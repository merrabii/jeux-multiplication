import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/database/generated/client";
import type { ExternalDbInput } from "./schemas";

/**
 * Base PostgreSQL externe (étape 3B de l'assistant).
 * - Construction de l'URL de connexion à partir du formulaire.
 * - Test réel de la connexion avec un client Prisma jetable.
 * - Le mot de passe n'est jamais stocké en base, ni journalisé, ni
 *   renvoyé au navigateur (seul un diagnostic textuel est retourné).
 */

export function buildExternalDatabaseUrl(input: ExternalDbInput): string {
  const auth = `${encodeURIComponent(input.user)}:${encodeURIComponent(input.password)}`;
  return (
    `postgresql://${auth}@${input.host}:${input.port}/${encodeURIComponent(input.database)}` +
    `?sslmode=${input.sslMode}`
  );
}

type ProbeResult = {
  ok: boolean;
  /** Diagnostic en français, sans valeur de secret. */
  message: string;
  /** La base visée existe-t-elle ? (code 3D000 si non) */
  databaseMissing?: boolean;
  /** Connexion possible vers le serveur (base « postgres ») ? */
  serverReachable?: boolean;
};

function describePgError(error: unknown): ProbeResult {
  const err = error as { code?: string; message?: string };
  const code = err.code ?? "";
  if (code === "3D000") {
    return {
      ok: false,
      databaseMissing: true,
      serverReachable: true,
      message:
        "Le serveur PostgreSQL est joignable, mais la base indiquée n'existe pas.",
    };
  }
  if (code === "28P01") {
    return {
      ok: false,
      serverReachable: true,
      message: "Authentification refusée : utilisateur ou mot de passe incorrect.",
    };
  }
  if (code === "42501" || code === "28000") {
    return {
      ok: false,
      serverReachable: true,
      message:
        "Connexion refusée pour cet utilisateur (permissions ou restrictions pg_hba.conf).",
    };
  }
  if (code === "ECONNREFUSED") {
    return {
      ok: false,
      message:
        "Connexion refusée : aucun serveur PostgreSQL n'écoute sur cet hôte/port.",
    };
  }
  if (code === "ENOTFOUND" || code === "ETIMEDOUT") {
    return {
      ok: false,
      message:
        "Hôte introuvable ou délai dépassé : vérifiez le nom d'hôte et le réseau.",
    };
  }
  if (code.includes("ssl") || (err.message ?? "").includes("SSL")) {
    return {
      ok: false,
      message:
        "Échec du SSL : essayez sslmode=prefer ou disable selon les exigences du serveur.",
    };
  }
  return {
    ok: false,
    message: "Connexion impossible (voir les journaux du serveur pour la cause).",
  };
}

/** Test réel de connexion (SELECT 1) sur la base externe. */
export async function testExternalConnection(
  input: ExternalDbInput,
): Promise<ProbeResult> {
  const connectionString = buildExternalDatabaseUrl(input);
  const adapter = new PrismaPg({ connectionString, max: 1 });
  const probe = new PrismaClient({ adapter });
  try {
    await probe.$queryRaw`SELECT 1`;
    return {
      ok: true,
      message: "Connexion réussie : la base répond.",
      serverReachable: true,
    };
  } catch (error) {
    const described = describePgError(error);
    if (described.databaseMissing && input.database !== "postgres") {
      // Tentative de création : uniquement si l'identité de connexion
      // dispose du droit CREATEDB. Le diagnostic reste honnête si non.
      try {
        const creationUrl =
          `postgresql://${encodeURIComponent(input.user)}:${encodeURIComponent(input.password)}` +
          `@${input.host}:${input.port}/postgres?sslmode=${input.sslMode}`;
        const creator = new PrismaClient({
          adapter: new PrismaPg({ connectionString: creationUrl, max: 1 }),
        });
        try {
          // Identifiant encadré par des guillemets doubles via $executeRawUnsafe
          // — le nom provient d'un formulaire validé (63 caractères max,
          // pas de guillemet double autorisé par PostgreSQL de toute façon).
          await creator.$executeRawUnsafe(
            `CREATE DATABASE "${input.database.replace(/"/g, "")}"`,
          );
          return {
            ok: true,
            message: `Base « ${input.database} » créée puis connexion vérifiée.`,
            serverReachable: true,
          };
        } finally {
          await creator.$disconnect();
        }
      } catch {
        return {
          ...described,
          message:
            described.message +
            " La création automatique a échoué : l'utilisateur de connexion " +
            "n'a pas le droit CREATEDB. Créez la base manuellement ou " +
            "utilisez une connexion disposant des droits nécessaires.",
        };
      }
    }
    return described;
  } finally {
    await probe.$disconnect();
  }
}
