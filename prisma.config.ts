import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Configuration Prisma ORM 7 (la variable d'environnement n'est plus lue
// automatiquement par le CLI : elle est chargée ici via dotenv).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
