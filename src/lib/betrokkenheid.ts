import "server-only";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { inDoelgroep, isHQ, isLeiding, scopeVestigingen } from "./access";
import { berichtenVoor, isBevestigd, type BerichtMetStatus } from "./data";
import { getDb } from "./db/client";
import * as t from "./db/schema";
import type { Org } from "./org";
import type { Gebruiker } from "./types";

// Leesfuncties voor tijdlijn, waardering, enquêtes, evenementen, smoelenboek en checklists.

// ---------- Zichtbaarheid van mensen ----------

/** Collega's die je kunt zien in het smoelenboek en kunt waarderen. */
export function zichtbareMensen(org: Org, u: Gebruiker): Gebruiker[] {
  if (isHQ(u)) return org.gebruikers;
  const scope = new Set(isLeiding(u) ? scopeVestigingen(org, u) : u.vestigingIds);
  return org.gebruikers.filter((g) =>
    g.rol === "hq" || // HQ-contactpersonen zijn voor iedereen vindbaar
    (g.rol === "franchisenemer" && g.franchisenemerId === u.franchisenemerId) ||
    g.vestigingIds.some((v) => scope.has(v)));
}

function zichtbareIds(org: Org, u: Gebruiker) {
  return new Set(zichtbareMensen(org, u).map((g) => g.id));
}

// ---------- Likes ----------

export async function likesVoor(doelType: "bericht" | "waardering", ids: string[], gebruikerId: string) {
  const db = await getDb();
  if (!ids.length) return { aantal: new Map<string, number>(), mijn: new Set<string>() };
  const rijen = await db.select({ doelId: t.like.doelId, gebruikerId: t.like.gebruikerId }).from(t.like)
    .where(and(eq(t.like.doelType, doelType), inArray(t.like.doelId, ids)));
  const aantal = new Map<string, number>();
  const mijn = new Set<string>();
  for (const r of rijen) {
    aantal.set(r.doelId, (aantal.get(r.doelId) ?? 0) + 1);
    if (r.gebruikerId === gebruikerId) mijn.add(r.doelId);
  }
  return { aantal, mijn };
}

export async function reactieAantallen(berichtIds: string[]) {
  if (!berichtIds.length) return new Map<string, number>();
  const db = await getDb();
  const rijen = await db.select({ id: t.reactie.berichtId, n: sql<number>`count(*)::int` }).from(t.reactie)
    .where(inArray(t.reactie.berichtId, berichtIds)).groupBy(t.reactie.berichtId);
  return new Map(rijen.map((r) => [r.id, r.n]));
}

// ---------- Waardering ----------

export type Waarde = typeof t.waarde.$inferSelect;
export interface WaarderingItem { id: string; vanId: string; aanId: string; waarde: Waarde; tekst: string; punten: number; tijd: string }

export async function waarden(): Promise<Waarde[]> {
  const db = await getDb();
  return db.select().from(t.waarde).orderBy(t.waarde.volgorde);
}

export async function waarderingen(org: Org, u: Gebruiker, opties: { aanId?: string; limiet?: number; sinds?: Date } = {}): Promise<WaarderingItem[]> {
  const db = await getDb();
  const ws = new Map((await waarden()).map((w) => [w.id, w]));
  const voorwaarden = [];
  if (opties.aanId) voorwaarden.push(eq(t.waardering.aanId, opties.aanId));
  if (opties.sinds) voorwaarden.push(gte(t.waardering.tijd, opties.sinds));
  const rijen = await db.select().from(t.waardering).where(voorwaarden.length ? and(...voorwaarden) : undefined)
    .orderBy(desc(t.waardering.tijd)).limit(opties.limiet ?? 100);
  const zicht = zichtbareIds(org, u);
  return rijen
    .filter((r) => isHQ(u) || zicht.has(r.aanId) || r.aanId === u.id)
    .map((r) => ({ id: r.id, vanId: r.vanId, aanId: r.aanId, waarde: ws.get(r.waardeId)!, tekst: r.tekst, punten: r.punten, tijd: r.tijd.toISOString() }));
}

/** Punten: 10 per ontvangen waardering, 2 per gegeven waardering, 5 per afgerond leeritem, min ingewisselde beloningen. */
export async function punten(gebruikerId: string) {
  const db = await getDb();
  const [r] = (await db.execute<{ ontvangen: number; gegeven: number; geleerd: number; besteed: number }>(sql`
    select
      (select coalesce(sum(punten),0)::int from waardering where aan_id = ${gebruikerId}) as ontvangen,
      (select count(*)::int * 2 from waardering where van_id = ${gebruikerId}) as gegeven,
      (select count(*)::int * 5 from leer_voortgang where gebruiker_id = ${gebruikerId} and status = 'afgerond') as geleerd,
      (select coalesce(sum(punten),0)::int from beloning_aanvraag where gebruiker_id = ${gebruikerId} and status <> 'afgewezen') as besteed
  `)).rows;
  return { ...r, saldo: r.ontvangen + r.gegeven + r.geleerd - r.besteed, verdiend: r.ontvangen + r.gegeven + r.geleerd };
}

/** Ranglijst per vestiging (teamprestatie, geen individuele ranglijst). */
export async function vestigingRanglijst(org: Org, sinds: Date) {
  const db = await getDb();
  const rijen = await db.select({ aanId: t.waardering.aanId, punten: t.waardering.punten }).from(t.waardering).where(gte(t.waardering.tijd, sinds));
  const per = new Map<string, number>();
  for (const r of rijen) {
    const g = org.gebruikers.find((x) => x.id === r.aanId);
    for (const v of g?.vestigingIds.slice(0, 1) ?? []) per.set(v, (per.get(v) ?? 0) + 1);
  }
  return org.vestigingen.map((v) => ({ vestiging: v, aantal: per.get(v.id) ?? 0 })).sort((a, b) => b.aantal - a.aantal);
}

export async function beloningen() {
  const db = await getDb();
  return db.select().from(t.beloning).where(eq(t.beloning.actief, true)).orderBy(t.beloning.punten);
}

export async function beloningAanvragen(filter: { gebruikerId?: string; status?: "aangevraagd" } = {}) {
  const db = await getDb();
  const v = [];
  if (filter.gebruikerId) v.push(eq(t.beloningAanvraag.gebruikerId, filter.gebruikerId));
  if (filter.status) v.push(eq(t.beloningAanvraag.status, filter.status));
  return db.select().from(t.beloningAanvraag).where(v.length ? and(...v) : undefined).orderBy(desc(t.beloningAanvraag.tijd));
}

// ---------- Momenten ----------

export interface Moment { id: string; soort: "verjaardag" | "jubileum" | "welkom"; gebruiker: Gebruiker; datum: Date; jaren?: number }

/** Verjaardagen (alleen bij opt-in), jubilea en nieuwe collega's rond vandaag. */
export function momenten(org: Org, u: Gebruiker, venster = 7): Moment[] {
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  const binnen = (d: Date) => Math.abs(d.getTime() - vandaag.getTime()) <= venster * 86400000;
  const uit: Moment[] = [];
  for (const g of zichtbareMensen(org, u).filter((x) => x.rol !== "hq")) {
    if (g.toonVerjaardag && g.verjaardag) {
      const [m, d] = g.verjaardag.split("-").map(Number);
      const dt = new Date(nu.getFullYear(), m - 1, d);
      if (binnen(dt)) uit.push({ id: `vj-${g.id}`, soort: "verjaardag", gebruiker: g, datum: dt });
    }
    const start = new Date(g.inDienstSinds);
    const jaren = nu.getFullYear() - start.getFullYear();
    const jub = new Date(nu.getFullYear(), start.getMonth(), start.getDate());
    if (jaren >= 1 && binnen(jub)) uit.push({ id: `jb-${g.id}`, soort: "jubileum", gebruiker: g, datum: jub, jaren });
    if (vandaag.getTime() - start.getTime() < 21 * 86400000 && start <= nu) uit.push({ id: `wk-${g.id}`, soort: "welkom", gebruiker: g, datum: start });
  }
  return uit.sort((a, b) => b.datum.getTime() - a.datum.getTime());
}

// ---------- Enquêtes ----------

export type Enquete = typeof t.enquete.$inferSelect;

export async function enquetesVoor(org: Org, u: Gebruiker) {
  const db = await getDb();
  const alle = await db.select().from(t.enquete).orderBy(desc(t.enquete.opent));
  const zichtbaar = alle.filter((e) => inDoelgroep(org, u, e.doelgroep));
  const deelname = zichtbaar.length
    ? await db.select().from(t.enqueteDeelname).where(and(eq(t.enqueteDeelname.gebruikerId, u.id), inArray(t.enqueteDeelname.enqueteId, zichtbaar.map((e) => e.id))))
    : [];
  const gedaan = new Set(deelname.map((d) => d.enqueteId));
  const nu = Date.now();
  return zichtbaar.map((e) => ({ ...e, open: e.opent.getTime() <= nu && (!e.sluit || e.sluit.getTime() > nu), gedaan: gedaan.has(e.id) || false }));
}

export async function enquete(id: string) {
  const db = await getDb();
  const [e] = await db.select().from(t.enquete).where(eq(t.enquete.id, id));
  return e;
}

export const ANONIMITEITSDREMPEL = 5;

export interface VraagResultaat {
  vraagId: string; tekst: string; type: string;
  verdeling?: { label: string; aantal: number }[];
  gemiddelde?: number;
  enps?: { score: number; promotors: number; passief: number; criticasters: number };
  open?: string[];
}

/** Resultaten, met een anonimiteitsdrempel: onder de 5 antwoorden tonen we geen details bij anonieme enquêtes. */
export async function enqueteResultaten(e: Enquete, franchisenemerId?: string) {
  const db = await getDb();
  const v = [eq(t.enqueteAntwoord.enqueteId, e.id)];
  if (franchisenemerId) v.push(eq(t.enqueteAntwoord.franchisenemerId, franchisenemerId));
  const rijen = await db.select().from(t.enqueteAntwoord).where(and(...v));
  const n = rijen.length;
  const teWeinig = e.anoniem && n < ANONIMITEITSDREMPEL;
  const vragen: VraagResultaat[] = teWeinig ? [] : e.vragen.map((q) => {
    const waarden = rijen.map((r) => r.antwoorden[q.id]).filter((x) => x !== undefined && x !== "");
    if (q.type === "keuze") return { vraagId: q.id, tekst: q.tekst, type: q.type, verdeling: q.opties.map((o) => ({ label: o, aantal: waarden.filter((w) => w === o).length })) };
    if (q.type === "schaal") {
      const getallen = waarden.map(Number).filter(Number.isFinite);
      const res: VraagResultaat = {
        vraagId: q.id, tekst: q.tekst, type: q.type,
        gemiddelde: getallen.length ? Math.round((getallen.reduce((a, b) => a + b, 0) / getallen.length) * 10) / 10 : undefined,
        verdeling: Array.from({ length: q.max - q.min + 1 }, (_, i) => ({ label: String(q.min + i), aantal: getallen.filter((g) => g === q.min + i).length })),
      };
      if (e.type === "enps" && q.max === 10 && getallen.length) {
        const p = getallen.filter((g) => g >= 9).length, c = getallen.filter((g) => g <= 6).length;
        res.enps = { score: Math.round(((p - c) / getallen.length) * 100), promotors: p, passief: getallen.length - p - c, criticasters: c };
      }
      return res;
    }
    return { vraagId: q.id, tekst: q.tekst, type: q.type, open: waarden.map(String) };
  });
  return { aantal: n, teWeinig, vragen };
}

export async function deelnameAantal(enqueteId: string) {
  const db = await getDb();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(t.enqueteDeelname).where(eq(t.enqueteDeelname.enqueteId, enqueteId));
  return r.n;
}

// ---------- Evenementen ----------

export async function evenementenVoor(org: Org, u: Gebruiker, alleenKomend = true) {
  const db = await getDb();
  const rijen = await db.select().from(t.evenement).where(alleenKomend ? gte(t.evenement.eind, new Date()) : undefined).orderBy(t.evenement.start);
  const zicht = rijen.filter((e) => inDoelgroep(org, u, e.doelgroep));
  const aanm = zicht.length ? await db.select().from(t.evenementAanmelding).where(inArray(t.evenementAanmelding.evenementId, zicht.map((e) => e.id))) : [];
  return zicht.map((e) => {
    const eigen = aanm.filter((a) => a.evenementId === e.id);
    return { ...e, mijnStatus: eigen.find((a) => a.gebruikerId === u.id)?.status, ja: eigen.filter((a) => a.status === "ja").map((a) => a.gebruikerId), misschien: eigen.filter((a) => a.status === "misschien").length };
  });
}

// ---------- Tijdlijn ----------

export type TijdlijnItem =
  | { soort: "bericht"; tijd: string; b: BerichtMetStatus; likes: number; geliked: boolean; reacties: number }
  | { soort: "waardering"; tijd: string; w: WaarderingItem; likes: number; geliked: boolean }
  | { soort: "moment"; tijd: string; m: Moment };

export async function tijdlijn(org: Org, u: Gebruiker, limiet = 25): Promise<TijdlijnItem[]> {
  const sinds = new Date(Date.now() - 30 * 86400000);
  const [berichten, ws] = await Promise.all([berichtenVoor(org, u, 60), waarderingen(org, u, { sinds, limiet: 40 })]);
  const zichtbaar = berichten.filter((b) => isBevestigd(b)); // onbevestigde verplichte berichten staan in "Te doen"
  const [lb, lw, rc] = await Promise.all([
    likesVoor("bericht", zichtbaar.map((b) => b.id), u.id),
    likesVoor("waardering", ws.map((w) => w.id), u.id),
    reactieAantallen(zichtbaar.map((b) => b.id)),
  ]);
  const items: TijdlijnItem[] = [
    ...zichtbaar.map((b) => ({ soort: "bericht" as const, tijd: b.gepubliceerd, b, likes: lb.aantal.get(b.id) ?? 0, geliked: lb.mijn.has(b.id), reacties: rc.get(b.id) ?? 0 })),
    ...ws.map((w) => ({ soort: "waardering" as const, tijd: w.tijd, w, likes: lw.aantal.get(w.id) ?? 0, geliked: lw.mijn.has(w.id) })),
    ...momenten(org, u).filter((m) => m.datum.getTime() <= Date.now() + 86400000).map((m) => ({ soort: "moment" as const, tijd: m.datum.toISOString(), m })),
  ];
  return items.sort((a, b) => b.tijd.localeCompare(a.tijd)).slice(0, limiet);
}

// ---------- Checklists en evaluaties ----------

export type Sjabloon = typeof t.checklistSjabloon.$inferSelect;
export type Uitvoering = typeof t.checklistUitvoering.$inferSelect;
export type Actiepunt = typeof t.actiepunt.$inferSelect;

export async function sjablonen(soort?: "dagtaak" | "evaluatie") {
  const db = await getDb();
  return db.select().from(t.checklistSjabloon).where(and(eq(t.checklistSjabloon.actief, true), soort ? eq(t.checklistSjabloon.soort, soort) : undefined));
}

export async function sjabloon(id: string) {
  const db = await getDb();
  const [s] = await db.select().from(t.checklistSjabloon).where(eq(t.checklistSjabloon.id, id));
  return s;
}

export async function uitvoeringen(filter: { vestigingIds?: string[]; sjabloonId?: string; soort?: "dagtaak" | "evaluatie"; sinds?: Date }) {
  const db = await getDb();
  const v = [];
  if (filter.vestigingIds) { if (!filter.vestigingIds.length) return []; v.push(inArray(t.checklistUitvoering.vestigingId, filter.vestigingIds)); }
  if (filter.sjabloonId) v.push(eq(t.checklistUitvoering.sjabloonId, filter.sjabloonId));
  if (filter.sinds) v.push(gte(t.checklistUitvoering.datum, filter.sinds));
  if (filter.soort) {
    const ids = (await sjablonen(filter.soort)).map((s) => s.id);
    if (!ids.length) return [];
    v.push(inArray(t.checklistUitvoering.sjabloonId, ids));
  }
  return db.select().from(t.checklistUitvoering).where(v.length ? and(...v) : undefined).orderBy(desc(t.checklistUitvoering.datum));
}

export async function uitvoering(id: string) {
  const db = await getDb();
  const [u] = await db.select().from(t.checklistUitvoering).where(eq(t.checklistUitvoering.id, id));
  return u;
}

export async function actiepunten(filter: { vestigingIds?: string[]; uitvoeringId?: string; open?: boolean }) {
  const db = await getDb();
  const v = [];
  if (filter.vestigingIds) { if (!filter.vestigingIds.length) return []; v.push(inArray(t.actiepunt.vestigingId, filter.vestigingIds)); }
  if (filter.uitvoeringId) v.push(eq(t.actiepunt.uitvoeringId, filter.uitvoeringId));
  if (filter.open) v.push(ne(t.actiepunt.status, "klaar"));
  return db.select().from(t.actiepunt).where(v.length ? and(...v) : undefined).orderBy(t.actiepunt.deadline);
}

/** Vestigingen waarvoor deze gebruiker checklists mag invullen of evaluaties mag zien. */
export function checklistVestigingen(org: Org, u: Gebruiker) {
  return isHQ(u) || isLeiding(u) ? scopeVestigingen(org, u) : u.vestigingIds;
}
