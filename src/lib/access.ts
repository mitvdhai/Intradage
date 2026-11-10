import type { Org } from "./org";
import type { Doelgroep, Gebruiker, Rol } from "./types";

// Rechtenmodel: rol (wat mag je) × scope (over welk deel van de organisatie).
// Pure functies op de organisatie-snapshot, zodat ze overal en in tests bruikbaar zijn.
// In productie komt daar row-level security in PostgreSQL bij.

export const isLeiding = (u: Gebruiker) => u.rol === "franchisenemer" || u.rol === "manager";
export const isHQ = (u: Gebruiker) => u.rol === "hq";
export const magBeheer = (u: Gebruiker) => isHQ(u) || u.rol === "franchisenemer";

/** Vestigingen binnen de scope van deze gebruiker. */
export function scopeVestigingen(org: Org, u: Gebruiker): string[] {
  if (isHQ(u)) return org.vestigingen.map((v) => v.id);
  if (u.rol === "franchisenemer") return org.vestigingen.filter((v) => v.franchisenemerId === u.franchisenemerId).map((v) => v.id);
  return u.vestigingIds;
}

/** Medewerkers die deze gebruiker mag zien (en, bij leiding, mag beoordelen). */
export function teamVan(org: Org, u: Gebruiker): Gebruiker[] {
  if (!isLeiding(u) && !isHQ(u)) return [];
  const scope = new Set(scopeVestigingen(org, u));
  return org.gebruikers.filter(
    (g) => g.id !== u.id && g.functieId && g.vestigingIds.some((v) => scope.has(v)) && (isHQ(u) || g.rol !== "franchisenemer"),
  );
}

export function magMedewerkerZien(org: Org, kijker: Gebruiker, medewerkerId: string) {
  if (kijker.id === medewerkerId) return true;
  return teamVan(org, kijker).some((g) => g.id === medewerkerId);
}

function regioVan(org: Org, vestigingId: string) {
  const v = org.vestigingen.find((x) => x.id === vestigingId);
  return org.franchisenemers.find((f) => f.id === v?.franchisenemerId)?.regioId;
}

/** Valt deze gebruiker in de doelgroep? Lege dimensie = geen beperking. HQ ziet alles. */
export function inDoelgroep(org: Org, u: Gebruiker, d: Doelgroep, strikt = false): boolean {
  if (isHQ(u) && !strikt) return true;
  const vest = u.rol === "franchisenemer" ? scopeVestigingen(org, u) : u.vestigingIds;
  if (d.rollen?.length && !d.rollen.includes(u.rol)) return false;
  if (d.functieIds?.length && !(u.functieId && d.functieIds.includes(u.functieId))) return false;
  if (d.vestigingIds?.length && !vest.some((v) => d.vestigingIds!.includes(v))) return false;
  if (d.franchisenemerIds?.length && !(u.franchisenemerId && d.franchisenemerIds.includes(u.franchisenemerId))) return false;
  if (d.regioIds?.length && !vest.some((v) => d.regioIds!.includes(regioVan(org, v) ?? ""))) return false;
  return true;
}

/** Ontvangers van een doelgroep binnen de scope van de afzender. */
export function ontvangers(org: Org, d: Doelgroep, afzender: Gebruiker): Gebruiker[] {
  const scope = new Set(scopeVestigingen(org, afzender));
  return org.gebruikers.filter((g) => g.rol !== "hq" && g.vestigingIds.some((v) => scope.has(v)) && inDoelgroep(org, g, d, true));
}

export const ROL_LABEL: Record<Rol, string> = {
  medewerker: "Medewerker",
  shiftleider: "Shiftleider",
  manager: "Vestigingsmanager",
  franchisenemer: "Franchisenemer",
  hq: "HQ",
};
