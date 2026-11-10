import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOrg, type Org } from "./org";
import type { Gebruiker } from "./types";

// Demo-sessie: een cookie met de gekozen persona.
// Productie: inloggen met mobiel nummer + sms-code (zie docs/architectuur.md).
export const SESSIE_COOKIE = "intradage_persona";

export async function huidigeGebruiker(): Promise<{ u: Gebruiker; org: Org } | null> {
  const id = (await cookies()).get(SESSIE_COOKIE)?.value;
  if (!id) return null;
  const org = await getOrg();
  const u = org.gebruikers.find((g) => g.id === id);
  return u ? { u, org } : null;
}

/** Ingelogde gebruiker + organisatie-snapshot; stuurt anders naar het inlogscherm. */
export async function vereisGebruiker(): Promise<{ u: Gebruiker; org: Org }> {
  const s = await huidigeGebruiker();
  if (!s) redirect("/");
  return s;
}
