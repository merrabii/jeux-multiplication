import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker optimisée (voir Dockerfile — stage "runner").
  output: "standalone",
  // cacheComponents (Next 16) volontairement désactivé pour la Phase 1 :
  // l'application est quasi entièrement personnalisée par profil enfant
  // (données dynamiques). Décision documentée dans docs/DECISIONS.md.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
