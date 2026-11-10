import { Segmenten } from "./ui";
import type { Gebruiker } from "@/lib/types";

export function WerkSegmenten({ u, actief }: { u: Gebruiker; actief: "Rooster" | "Taken" | "Functie" | "Documenten" }) {
  const items = [
    ...(u.rol !== "franchisenemer" ? [{ label: "Rooster", href: "/app/werk" }] : []),
    { label: "Taken", href: "/app/werk/taken" },
    ...(u.functieId ? [{ label: "Functie", href: "/app/werk/functie" }] : []),
    { label: "Documenten", href: "/app/werk/documenten" },
  ];
  return <Segmenten items={items} actief={actief} />;
}
