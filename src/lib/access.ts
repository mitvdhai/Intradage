import "server-only";
import { db } from "./store";
import type { Doelgroep, Gebruiker, Rol } from "./types";

// Rechtenmodel: rol (wat mag je) × scope (over welk deel van de organisatie).

export const isLeiding = (u: Gebruiker) => u.rol === "franchisenemer" || u.rol === "manager";
export const isHQ = (u: Gebruiker) => u.rol === "hq";
export const magBeheer = (u: Gebruiker) => isHQ(u) || u.rol === "franchisenemer";

/** Vestigingen binnen de scope van deze gebruiker. */
export function scopeVestigingen(u: Gebruiker): string[] {
  if (isHQ(u)) return db.vestigingen.map((v) => v.id);
  if (u.rol === "franchisenemer") return db.vestigingen.filter((v) => v.franchisenemerId === u.franchisenemerId).map((v) => v.id);
  return u.vestigingIds;
}

/** Medewerkers die deze gebruiker mag zien (en, bij leiding, mag beoordelen). */
export function teamVan(u: Gebruiker): Gebruiker[] {
  if (!isLeiding(u) && !isHQ(u)) return [];
  const scope = new Set(scopeVestigingen(u));
  return db.gebruikers.filter(
    (g) => g.id !== u.id && g.functieId && g.vestigingIds.some((v) => scope.has(v)) && (isHQ(u) || g.rol !== "franchisenemer"),
  );
}

export function magMedewerkerZien(kijker: Gebruiker, medewerkerId: string) {
  if (kijker.id === medewerkerId) return true;
  return teamVan(kijker).some((g) => g.id === medewerkerId);
}

function regioVan(vestigingId: string) {
  const v = db.vestigingen.find((x) => x.id === vestigingId);
  return db.franchisenemers.find((f) => f.id === v?.franchisenemerId)?.regioId;
}

/** Valt deze gebruiker in de doelgroep? Lege dimensie = geen beperking. */
export function inDoelgroep(u: Gebruiker, d: Doelgroep): boolean {
  if (isHQ(u)) return true; // HQ ziet alles wat gepubliceerd is
  const vest = u.rol === "franchisenemer" ? scopeVestigingen(u) : u.vestigingIds;
  if (d.rollen?.length && !d.rollen.includes(u.rol)) return false;
  if (d.functieIds?.length && !(u.functieId && d.functieIds.includes(u.functieId))) return false;
  if (d.vestigingIds?.length && !vest.some((v) => d.vestigingIds!.includes(v))) return false;
  if (d.franchisenemerIds?.length && !(u.franchisenemerId && d.franchisenemerIds.includes(u.franchisenemerId))) return false;
  if (d.regioIds?.length && !vest.some((v) => d.regioIds!.includes(regioVan(v) ?? ""))) return false;
  return true;
}

/** Ontvangers van een doelgroep, voor de live telling bij het versturen. */
export function ontvangers(d: Doelgroep, afzender: Gebruiker): Gebruiker[] {
  const scope = new Set(scopeVestigingen(afzender));
  return db.gebruikers.filter((g) => g.rol !== "hq" && g.vestigingIds.some((v) => scope.has(v)) && inDoelgroepStrikt(g, d));
}

function inDoelgroepStrikt(u: Gebruiker, d: Doelgroep) {
  // Zelfde als inDoelgroep, maar zonder HQ-uitzondering
  return inDoelgroep({ ...u, rol: u.rol === "hq" ? ("medewerker" as Rol) : u.rol }, d);
}

export const ROL_LABEL: Record<Rol, string> = {
  medewerker: "Medewerker",
  shiftleider: "Shiftleider",
  manager: "Vestigingsmanager",
  franchisenemer: "Franchisenemer",
  hq: "HQ",
};
