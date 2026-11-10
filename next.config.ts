import type { NextConfig } from "next";

// Cache Components staat (nog) uit: vrijwel elke pagina is persoonsgebonden.
// Zie docs/architectuur.md voor wanneer we dit aanzetten.
const nextConfig: NextConfig = {
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
