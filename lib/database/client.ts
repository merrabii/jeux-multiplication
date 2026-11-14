import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

/**
 * Client Prisma (singleton).
 * Prisma ORM 7 utilise un driver adapter (pg pur JavaScript, sans binaire Rust).
 * La variable DATABASE_URL provient de l'environnement (Next.js charge .env ;
 * en production, Coolify/Docker injecte la variable).
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL n'est pas défini. Vérifier .env (dev) ou les variables Coolify (production).",
    );
  }
  // PGPOOL_MAX : limite du pool de connexions. Utile en serverless
  // (Vercel/Netlify) où chaque instance ouvre son propre pool ;
  // recommandé entre 1 et 5 sur ces plateformes. Vide = défaut du driver.
  const poolMaxRaw = process.env.PGPOOL_MAX;
  const poolMax =
    poolMaxRaw && poolMaxRaw !== "" ? Number(poolMaxRaw) : undefined;
  if (poolMaxRaw && poolMaxRaw !== "" && (!Number.isInteger(poolMax) || (poolMax as number) < 1)) {
    throw new Error(
      `Variable PGPOOL_MAX invalide : entier >= 1 attendu, reçu "${poolMaxRaw}".`,
    );
  }
  const adapter = new PrismaPg({
    connectionString,
    ...(poolMax !== undefined ? { max: poolMax } : {}),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Ping simple de la base (SELECT 1) pour le healthcheck. */
export async function pingDatabase(): Promise<boolean> {
  await prisma.$queryRaw`SELECT 1`;
  return true;
}
