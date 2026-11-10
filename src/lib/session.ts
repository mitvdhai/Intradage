import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./store";
import type { Gebruiker } from "./types";

// Demo-sessie: een cookie met de gekozen persona.
// Productie: inloggen met mobiel nummer + sms-code (zie docs/architectuur.md).
export const SESSIE_COOKIE = "intradage_persona";

export async function huidigeGebruiker(): Promise<Gebruiker | null> {
  const id = (await cookies()).get(SESSIE_COOKIE)?.value;
  return db.gebruikers.find((g) => g.id === id) ?? null;
}

export async function vereisGebruiker(): Promise<Gebruiker> {
  const u = await huidigeGebruiker();
  if (!u) redirect("/");
  return u;
}
