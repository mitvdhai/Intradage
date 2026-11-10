import type { NextConfig } from "next";

// Roosters, klokken en ATW-regels rekenen in Nederlandse tijd, ook op een server die op UTC staat.
process.env.TZ ??= "Europe/Amsterdam";

// Cache Components staat (nog) uit: vrijwel elke pagina is persoonsgebonden.
// Zie docs/architectuur.md voor wanneer we dit aanzetten.
const nextConfig: NextConfig = {
  // Database-drivers niet bundelen (native/wasm-bestanden)
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
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
