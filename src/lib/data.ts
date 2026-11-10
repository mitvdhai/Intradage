import "server-only";
import { inDoelgroep, isHQ, isLeiding, scopeVestigingen, teamVan } from "./access";
import { db } from "./store";
import type { Bericht, ChatGroep, Gebruiker, HandboekDoc, LeerItem } from "./types";

// Leesfuncties. Elke functie filtert op wat de gebruiker mag zien.

export const naamVan = (id: string) => {
  const g = db.gebruikers.find((x) => x.id === id);
  return g ? `${g.voornaam} ${g.achternaam}` : "Onbekend";
};
export const voornaamVan = (id: string) => db.gebruikers.find((x) => x.id === id)?.voornaam ?? "Onbekend";
export const vestigingNaam = (id: string) => db.vestigingen.find((v) => v.id === id)?.naam ?? id;
export const functieVan = (u: Gebruiker) => db.functies.find((f) => f.id === u.functieId);

export const DISCIPLINE_LABEL = { operations: "Operations", marketing: "Marketing", hr: "HR", inkoop: "Inkoop", kwaliteit: "Kwaliteit" } as const;

export function afzenderLabel(b: Bericht) {
  return b.afzender.type === "hq" ? `HQ ${DISCIPLINE_LABEL[b.afzender.discipline]}` : b.afzender.naam;
}

export function berichtenVoor(u: Gebruiker): Bericht[] {
  const nu = Date.now();
  return db.berichten
    .filter((b) => inDoelgroep(u, b.doelgroep) && (!b.vervalt || Date.parse(b.vervalt) > nu))
    .sort((a, b) => Number(b.vastgezet && !isBevestigd(b, u)) - Number(a.vastgezet && !isBevestigd(a, u)) || b.gepubliceerd.localeCompare(a.gepubliceerd));
}

export const status = (b: Bericht, u: Gebruiker) => db.leesstatus[b.id]?.[u.id] ?? {};
export const isGelezen = (b: Bericht, u: Gebruiker) => !!status(b, u).gelezen;
export const isBevestigd = (b: Bericht, u: Gebruiker) => b.urgentie !== "verplicht" || !!status(b, u).bevestigd;

export function reactiesVan(berichtId: string) {
  return db.reacties.filter((r) => r.berichtId === berichtId).sort((a, b) => a.tijd.localeCompare(b.tijd));
}

export function leerItemsVoor(u: Gebruiker): LeerItem[] {
  return db.leeritems
    .filter((i) => !i.functieIds.length || (u.functieId && i.functieIds.includes(u.functieId)))
    .sort((a, b) => (a.volgorde ?? 99) - (b.volgorde ?? 99));
}

export function voortgangVan(gebruikerId: string, itemId: string) {
  return db.voortgang.find((v) => v.gebruikerId === gebruikerId && v.itemId === itemId);
}

export function onboarding(u: Gebruiker) {
  const items = leerItemsVoor(u).filter((i) => i.onboarding);
  const klaar = items.filter((i) => voortgangVan(u.id, i.id)?.status === "afgerond").length;
  return { items, klaar, totaal: items.length, pct: items.length ? Math.round((klaar / items.length) * 100) : 100 };
}

export function handboekVoor(u: Gebruiker): HandboekDoc[] {
  return db.handboek.filter((d) => inDoelgroep(u, d.doelgroep));
}

export function chatGroepenVoor(u: Gebruiker): ChatGroep[] {
  const vest = new Set(scopeVestigingen(u));
  return db.chatGroepen.filter((gr) => {
    if (gr.type === "hq-kanaal") return true;
    if (isHQ(u)) return gr.type !== "vestiging";
    if (gr.type === "vestiging") return !!gr.vestigingId && vest.has(gr.vestigingId);
    if (gr.type === "franchisenemer") return gr.franchisenemerId === u.franchisenemerId;
    if (gr.type === "shiftleiders") return u.rol === "shiftleider" || isLeiding(u);
    return false;
  });
}

export function ledenVan(gr: ChatGroep): Gebruiker[] {
  return db.gebruikers.filter((u) => {
    if (gr.type === "vestiging") return u.rol !== "hq" && !!gr.vestigingId && (u.vestigingIds.includes(gr.vestigingId) || (u.rol === "franchisenemer" && scopeVestigingen(u).includes(gr.vestigingId)));
    if (gr.type === "franchisenemer") return u.franchisenemerId === gr.franchisenemerId;
    if (gr.type === "shiftleiders") return u.rol === "shiftleider" || isLeiding(u);
    return true;
  });
}

export function chatVan(groepId: string) {
  return db.chatBerichten.filter((c) => c.groepId === groepId).sort((a, b) => a.tijd.localeCompare(b.tijd));
}

export interface TeDoe { id: string; titel: string; sub: string; href: string; urgent?: boolean; pct?: number; soort: "bericht" | "leren" | "beoordelen" | "ruil" | "zelfbeoordeling" }

/** Wat moet deze gebruiker nu doen? Basis voor "Te doen" en het meldingencentrum. */
export function teDoen(u: Gebruiker): TeDoe[] {
  const lijst: TeDoe[] = [];
  for (const b of berichtenVoor(u)) {
    if (b.urgentie === "verplicht" && !isBevestigd(b, u))
      lijst.push({ id: `b-${b.id}`, titel: b.titel, sub: "Verplicht · lezen en bevestigen", href: `/app/berichten/${b.id}`, urgent: true, soort: "bericht" });
  }
  const ob = onboarding(u);
  if (u.functieId && ob.klaar < ob.totaal)
    lijst.push({ id: "onboarding", titel: "Onboarding", sub: `${ob.klaar} van ${ob.totaal} klaar`, href: "/app/leren", pct: ob.pct, soort: "leren" });
  const eigen = db.beoordelingen.find((b) => b.gebruikerId === u.id && b.status === "zelfbeoordeling");
  if (eigen) lijst.push({ id: "zelf", titel: "Zelfbeoordeling invullen", sub: `Beoordeling ${eigen.periode}`, href: "/app/werk/functie/zelfbeoordeling", soort: "zelfbeoordeling" });
  if (isLeiding(u)) {
    const team = new Set(teamVan(u).map((t) => t.id));
    const inzendingen = db.voortgang.filter((v) => v.status === "ingediend" && team.has(v.gebruikerId)).length;
    if (inzendingen) lijst.push({ id: "beoordelen-leren", titel: `${inzendingen} inzending${inzendingen > 1 ? "en" : ""} beoordelen`, sub: "Challenges van je team", href: "/app/team/inzendingen", soort: "beoordelen" });
    const open = db.beoordelingen.filter((b) => b.beoordelaarId === u.id && b.status === "beoordelen").length;
    if (open) lijst.push({ id: "beoordelingen", titel: `${open} beoordeling${open > 1 ? "en" : ""} afronden`, sub: "Functiehuis · ronde 2026", href: "/app/team", soort: "beoordelen" });
    const ruil = db.ruilverzoeken.filter((r) => r.status === "wacht-op-akkoord").length;
    if (ruil) lijst.push({ id: "ruil", titel: `${ruil} ruilverzoek${ruil > 1 ? "en" : ""} goedkeuren`, sub: "Diensten", href: "/app/team", soort: "ruil" });
  }
  return lijst;
}

export function verjaardagenBinnenkort(u: Gebruiker, dagen = 7) {
  const vest = new Set(u.vestigingIds);
  const nu = new Date();
  return db.gebruikers
    .filter((g) => g.toonVerjaardag && g.verjaardag && g.vestigingIds.some((v) => vest.has(v)))
    .map((g) => {
      const [m, d] = g.verjaardag!.split("-").map(Number);
      let dt = new Date(nu.getFullYear(), m - 1, d);
      if (dt < new Date(nu.getFullYear(), nu.getMonth(), nu.getDate())) dt = new Date(nu.getFullYear() + 1, m - 1, d);
      return { g, dt };
    })
    .filter(({ dt }) => dt.getTime() - nu.getTime() < dagen * 86400000)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime());
}
