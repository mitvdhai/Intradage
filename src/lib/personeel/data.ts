import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { isHQ, mag, scopeVestigingen } from "../access";
import type { Module, Niveau } from "../rechten";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import type { Org } from "../org";
import { controleerDienst, leeftijdOp, weekStart, type Periode } from "../planning/atw";
import type { PlanKandidaat } from "../planning/suggestie";
import type { Gebruiker } from "../types";
import { deadlineVan, isoDatum, ketenSignaal } from "./sjablonen";

export type Positie = typeof t.positie.$inferSelect;
export type DienstRij = typeof t.dienst.$inferSelect;
export type Contract = typeof t.contract.$inferSelect;
export type Verlof = typeof t.verlof.$inferSelect;
export type Klok = typeof t.klok.$inferSelect;
export type Medewerker = typeof t.gebruiker.$inferSelect & { vestigingIds: string[] };


export const vandaagIso = () => isoDatum(new Date());
export const maandagVan = (d = new Date()) => isoDatum(weekStart(d));

export async function posities() {
  const db = await getDb();
  return db.select().from(t.positie).orderBy(asc(t.positie.volgorde));
}

export async function vestigingen(ids: string[]) {
  const db = await getDb();
  return ids.length ? db.select().from(t.vestiging).where(inArray(t.vestiging.id, ids)).orderBy(asc(t.vestiging.naam)) : [];
}

export async function normen(vestigingId: string) {
  const db = await getDb();
  return db.select().from(t.bezettingsnorm).where(eq(t.bezettingsnorm.vestigingId, vestigingId)).orderBy(asc(t.bezettingsnorm.weekdag), asc(t.bezettingsnorm.van));
}

/** Alle medewerkers (ook preboarding en uit dienst) binnen de scope van de gebruiker. */
export async function medewerkers(org: Org, u: Gebruiker, opties: { metUitDienst?: boolean } = {}): Promise<Medewerker[]> {
  const db = await getDb();
  const scope = scopeVestigingen(org, u);
  if (!scope.length) return [];
  const gv = await db.select().from(t.gebruikerVestiging).where(inArray(t.gebruikerVestiging.vestigingId, scope));
  const ids = [...new Set(gv.map((r) => r.gebruikerId))];
  if (!ids.length) return [];
  const alleGv = await db.select().from(t.gebruikerVestiging).where(inArray(t.gebruikerVestiging.gebruikerId, ids));
  const rijen = await db.select().from(t.gebruiker).where(and(inArray(t.gebruiker.id, ids), inArray(t.gebruiker.rol, ["medewerker", "shiftleider", "manager"]))).orderBy(asc(t.gebruiker.voornaam));
  const vandaag = vandaagIso();
  return rijen
    .filter((g) => opties.metUitDienst || !(g.uitDienstPer && g.uitDienstPer < vandaag))
    .map((g) => ({ ...g, vestigingIds: alleGv.filter((x) => x.gebruikerId === g.id).map((x) => x.vestigingId) }));
}

export async function medewerker(id: string): Promise<Medewerker | undefined> {
  const db = await getDb();
  const [g] = await db.select().from(t.gebruiker).where(eq(t.gebruiker.id, id));
  if (!g) return undefined;
  const gv = await db.select().from(t.gebruikerVestiging).where(eq(t.gebruikerVestiging.gebruikerId, id));
  return { ...g, vestigingIds: gv.map((x) => x.vestigingId) };
}

/** Mag `u` het dossier van medewerker `m` beheren? Alleen leiding en HQ, binnen hun vestigingen. */
export function magDossier(org: Org, u: Gebruiker, m: Pick<Medewerker, "vestigingIds" | "id">, module: Module = "medewerkers", niveau: Niveau = 1) {
  if (!mag(org, u, module, niveau) || u.id === m.id) return false;
  if (isHQ(u)) return true;
  const scope = new Set(scopeVestigingen(org, u));
  return m.vestigingIds.some((v) => scope.has(v));
}

export async function positiesVan(ids: string[]) {
  const db = await getDb();
  return ids.length ? db.select().from(t.gebruikerPositie).where(inArray(t.gebruikerPositie.gebruikerId, ids)) : [];
}

export async function beschikbaarheidVan(ids: string[]) {
  const db = await getDb();
  return ids.length ? db.select().from(t.beschikbaarheid).where(inArray(t.beschikbaarheid.gebruikerId, ids)) : [];
}

export async function contractenVan(ids: string[]) {
  const db = await getDb();
  return ids.length ? db.select().from(t.contract).where(inArray(t.contract.gebruikerId, ids)).orderBy(desc(t.contract.volgnummer)) : [];
}

/** Het contract dat op `datum` geldt (getekend), anders het meest recente. */
export function geldendContract(contracten: Contract[], gebruikerId: string, datum = vandaagIso()) {
  const eigen = contracten.filter((c) => c.gebruikerId === gebruikerId);
  return eigen.find((c) => c.status === "getekend" && c.start <= datum && (!c.eind || c.eind >= datum)) ?? eigen.find((c) => c.status === "getekend") ?? eigen[0];
}

export async function verlofVan(filter: { gebruikerIds?: string[]; status?: "aangevraagd"; vanaf?: string }) {
  const db = await getDb();
  const v = [];
  if (filter.gebruikerIds) { if (!filter.gebruikerIds.length) return []; v.push(inArray(t.verlof.gebruikerId, filter.gebruikerIds)); }
  if (filter.status) v.push(eq(t.verlof.status, filter.status));
  if (filter.vanaf) v.push(or(isNull(t.verlof.tot), gte(t.verlof.tot, filter.vanaf))!);
  return db.select().from(t.verlof).where(v.length ? and(...v) : undefined).orderBy(asc(t.verlof.van));
}

export async function diensten(filter: { vestigingIds?: string[]; gebruikerIds?: string[]; van: Date; tot: Date; status?: "gepubliceerd"; open?: boolean }) {
  const db = await getDb();
  const v = [lt(t.dienst.start, filter.tot), gte(t.dienst.eind, filter.van)];
  if (filter.vestigingIds) { if (!filter.vestigingIds.length) return []; v.push(inArray(t.dienst.vestigingId, filter.vestigingIds)); }
  if (filter.gebruikerIds) { if (!filter.gebruikerIds.length) return []; v.push(inArray(t.dienst.gebruikerId, filter.gebruikerIds)); }
  if (filter.status) v.push(eq(t.dienst.status, filter.status));
  if (filter.open) v.push(isNull(t.dienst.gebruikerId));
  return db.select().from(t.dienst).where(and(...v)).orderBy(asc(t.dienst.start));
}

export async function dienst(id: string) {
  const db = await getDb();
  const [d] = await db.select().from(t.dienst).where(eq(t.dienst.id, id));
  return d;
}

export async function klokVan(filter: { gebruikerIds?: string[]; vestigingIds?: string[]; van?: Date; tot?: Date; status?: "ingediend" | "open" }) {
  const db = await getDb();
  const v = [];
  if (filter.gebruikerIds) { if (!filter.gebruikerIds.length) return []; v.push(inArray(t.klok.gebruikerId, filter.gebruikerIds)); }
  if (filter.vestigingIds) { if (!filter.vestigingIds.length) return []; v.push(inArray(t.klok.vestigingId, filter.vestigingIds)); }
  if (filter.van) v.push(gte(t.klok.in, filter.van));
  if (filter.tot) v.push(lt(t.klok.in, filter.tot));
  if (filter.status) v.push(eq(t.klok.status, filter.status));
  return db.select().from(t.klok).where(v.length ? and(...v) : undefined).orderBy(desc(t.klok.in));
}

export const nettoUren = (k: Pick<Klok, "in" | "uit" | "pauzeMin">) => k.uit ? Math.max(0, (k.uit.getTime() - k.in.getTime()) / 3600000 - k.pauzeMin / 60) : 0;
export const dienstUren = (d: Pick<DienstRij, "start" | "eind" | "pauzeMin">) => (d.eind.getTime() - d.start.getTime()) / 3600000 - d.pauzeMin / 60;

/** Afwezige dagen (goedgekeurd verlof en ziekte) per medewerker. */
export function afwezigheid(verlof: Verlof[], gebruikerId: string, tot: string) {
  const set = new Set<string>();
  for (const v of verlof.filter((x) => x.gebruikerId === gebruikerId && x.status === "goedgekeurd")) {
    for (let d = v.van; d <= (v.tot ?? tot); d = deadlineVan(d, 1)) set.add(d);
  }
  return set;
}

/** Alles wat de roostersuggestie nodig heeft voor één vestiging en één week. */
export async function planGegevens(org: Org, vestigingId: string, maandag: string) {
  const db = await getDb();
  const zondag = deadlineVan(maandag, 6);
  const gv = await db.select().from(t.gebruikerVestiging).where(eq(t.gebruikerVestiging.vestigingId, vestigingId));
  const ids = gv.map((r) => r.gebruikerId).filter((id) => org.gebruikers.some((g) => g.id === id && g.rol !== "franchisenemer" && g.rol !== "hq"));
  const [mensen, pos, besch, contracten, verlof] = await Promise.all([
    db.select().from(t.gebruiker).where(inArray(t.gebruiker.id, ids.length ? ids : ["-"])),
    positiesVan(ids), beschikbaarheidVan(ids), contractenVan(ids), verlofVan({ gebruikerIds: ids, vanaf: maandag }),
  ]);
  // Diensten van deze mensen in andere vestigingen (en de dag vóór/na) tellen mee voor uren en rust
  const van = new Date(`${deadlineVan(maandag, -1)}T00:00:00`), tot = new Date(`${deadlineVan(maandag, 8)}T00:00:00`);
  const elders = await diensten({ gebruikerIds: ids, van, tot });
  const kandidaten: PlanKandidaat[] = mensen.filter((m) => !m.uitDienstPer || m.uitDienstPer >= maandag).map((m) => {
    const c = geldendContract(contracten, m.id, maandag);
    return {
      id: m.id, naam: `${m.voornaam} ${m.achternaam}`, geboortedatum: m.geboortedatum,
      positieIds: pos.filter((p) => p.gebruikerId === m.id).map((p) => p.positieId),
      beschikbaar: Object.fromEntries(besch.filter((b) => b.gebruikerId === m.id).map((b) => [b.weekdag, { van: b.van, tot: b.tot }])),
      afwezig: new Set([...afwezigheid(verlof, m.id, zondag), ...(m.uitDienstPer ? Array.from({ length: 7 }, (_, i) => deadlineVan(maandag, i)).filter((d) => d > m.uitDienstPer!) : [])]),
      urenMin: c?.urenMin ?? 0, urenMax: c?.urenMax || 12,
    };
  });
  return { kandidaten, elders, contracten, verlof };
}

/** Bestaande diensten per persoon, als periodes (optioneel zonder bepaalde ids, bv. de concepten die we opnieuw maken). */
export function periodesPerPersoon(lijst: DienstRij[], behalve = new Set<string>()): Record<string, Periode[]> {
  const uit: Record<string, Periode[]> = {};
  for (const d of lijst) if (d.gebruikerId && !behalve.has(d.id)) (uit[d.gebruikerId] ??= []).push({ start: d.start, eind: d.eind });
  return uit;
}

// ---------- Signalen voor de leiding ----------

export interface Signaal { soort: "contract" | "keten" | "certificaat" | "preboarding" | "offboarding" | "verlof" | "uren" | "teken"; gebruikerId?: string; tekst: string; urgent: boolean; href: string }

export async function signalen(org: Org, u: Gebruiker): Promise<Signaal[]> {
  if (!mag(org, u, "medewerkers", 1)) return [];
  const db = await getDb();
  const mensen = await medewerkers(org, u);
  const ids = mensen.map((m) => m.id);
  if (!ids.length) return [];
  const vandaag = vandaagIso();
  const [contracten, docs, taken, verlof, uren] = await Promise.all([
    contractenVan(ids),
    db.select().from(t.dossierDocument).where(and(inArray(t.dossierDocument.gebruikerId, ids), lte(t.dossierDocument.vervalt, deadlineVan(vandaag, 30)))),
    db.select().from(t.lifecycleTaak).where(and(inArray(t.lifecycleTaak.gebruikerId, ids), isNull(t.lifecycleTaak.klaar), eq(t.lifecycleTaak.wie, "leiding"))),
    verlofVan({ gebruikerIds: ids, status: "aangevraagd" }),
    db.select({ n: sql<number>`count(*)::int` }).from(t.klok).where(and(inArray(t.klok.gebruikerId, ids), eq(t.klok.status, "ingediend"))),
  ]);
  const naam = (id: string) => { const m = mensen.find((x) => x.id === id); return m ? `${m.voornaam} ${m.achternaam}` : id; };
  const uit: Signaal[] = [];
  for (const m of mensen) {
    const eigen = contracten.filter((c) => c.gebruikerId === m.id);
    const huidig = geldendContract(contracten, m.id);
    const opvolger = eigen.some((c) => c.volgnummer > (huidig?.volgnummer ?? 0));
    if (huidig?.eind && huidig.eind <= deadlineVan(vandaag, 42) && !opvolger && !m.uitDienstPer) {
      const dagen = Math.round((new Date(`${huidig.eind}T12:00:00`).getTime() - Date.now()) / 86400000);
      uit.push({ soort: "contract", gebruikerId: m.id, tekst: `Contract van ${naam(m.id)} loopt af over ${dagen} dagen. Aanzeggen vóór ${new Date(`${deadlineVan(huidig.eind, -30)}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`, urgent: dagen <= 31, href: `/beheer/personeel/${m.id}` });
      const keten = ketenSignaal(eigen);
      if (keten) uit.push({ soort: "keten", gebruikerId: m.id, tekst: `${naam(m.id)}: ${keten}`, urgent: false, href: `/beheer/personeel/${m.id}` });
    }
    const teTekenen = eigen.find((c) => c.status === "ter-ondertekening" && !c.ondertekendWerkgever);
    if (teTekenen) uit.push({ soort: "teken", gebruikerId: m.id, tekst: `Contract ${teTekenen.volgnummer} van ${naam(m.id)} wacht op jouw handtekening${teTekenen.ondertekendWerknemer ? "" : " (en die van de medewerker)"}`, urgent: !!teTekenen.ondertekendWerknemer, href: `/beheer/personeel/${m.id}/contract/${teTekenen.id}` });
  }
  for (const d of docs) uit.push({ soort: "certificaat", gebruikerId: d.gebruikerId, tekst: `${d.titel} van ${naam(d.gebruikerId)} ${d.vervalt! < vandaag ? "is verlopen" : `verloopt op ${new Date(`${d.vervalt}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`}`, urgent: d.vervalt! < vandaag, href: `/beheer/personeel/${d.gebruikerId}` });
  for (const tk of taken.filter((x) => x.deadline && x.deadline <= deadlineVan(vandaag, 7))) uit.push({ soort: tk.fase === "offboarding" ? "offboarding" : "preboarding", gebruikerId: tk.gebruikerId, tekst: `${naam(tk.gebruikerId)}: ${tk.titel}`, urgent: !!tk.deadline && tk.deadline < vandaag, href: `/beheer/personeel/${tk.gebruikerId}` });
  for (const v of verlof) uit.push({ soort: "verlof", gebruikerId: v.gebruikerId, tekst: `Verlofaanvraag van ${naam(v.gebruikerId)}`, urgent: v.van <= deadlineVan(vandaag, 7), href: "/beheer/verlof" });
  if (uren[0]?.n) uit.push({ soort: "uren", tekst: `${uren[0].n} klokregels wachten op goedkeuring`, urgent: false, href: "/beheer/uren" });
  return uit.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

/** Vakantiesaldo (benadering): wettelijk 4× de gemiddelde wekelijkse arbeidsduur per jaar, naar rato; min opgenomen uren. */
export async function verlofSaldo(gebruikerId: string) {
  const [contracten, verlof] = await Promise.all([contractenVan([gebruikerId]), verlofVan({ gebruikerIds: [gebruikerId] })]);
  const c = geldendContract(contracten, gebruikerId);
  const weekuren = c ? (c.urenMin + c.urenMax) / 2 || 8 : 0;
  const jaar = new Date().getFullYear();
  const start = c && c.start > `${jaar}-01-01` ? new Date(`${c.start}T12:00:00`) : new Date(`${jaar}-01-01T12:00:00`);
  const fractie = Math.min(1, (Date.now() - start.getTime()) / (365 * 86400000));
  const opgebouwd = Math.round(weekuren * 4 * fractie);
  const opgenomen = verlof.filter((v) => v.type === "vakantie" && v.status !== "afgewezen" && v.van.startsWith(String(jaar))).reduce((s, v) => s + (v.uren ?? 0), 0);
  return { opgebouwd, opgenomen, saldo: opgebouwd - opgenomen, weekuren };
}

export async function lifecycleVan(gebruikerId: string) {
  const db = await getDb();
  return db.select().from(t.lifecycleTaak).where(eq(t.lifecycleTaak.gebruikerId, gebruikerId)).orderBy(asc(t.lifecycleTaak.fase), asc(t.lifecycleTaak.volgorde));
}

export async function dossierVan(gebruikerId: string) {
  const db = await getDb();
  return db.select({ id: t.dossierDocument.id, categorie: t.dossierDocument.categorie, titel: t.dossierDocument.titel, bestandsnaam: t.dossierDocument.bestandsnaam, grootte: t.dossierDocument.grootte, vervalt: t.dossierDocument.vervalt, tijd: t.dossierDocument.tijd, geuploadDoor: t.dossierDocument.geuploadDoor, heeftBestand: sql<boolean>`${t.dossierDocument.inhoud} is not null` })
    .from(t.dossierDocument).where(eq(t.dossierDocument.gebruikerId, gebruikerId)).orderBy(desc(t.dossierDocument.tijd));
}

export async function contract(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(t.contract).where(eq(t.contract.id, id));
  return c;
}

// ---------- Werving ----------

export async function vacatures(vestigingIds?: string[]) {
  const db = await getDb();
  return db.select().from(t.vacature).where(vestigingIds ? inArray(t.vacature.vestigingId, vestigingIds.length ? vestigingIds : ["-"]) : undefined).orderBy(desc(t.vacature.gemaakt));
}

export async function vacatureOpSlug(slug: string) {
  const db = await getDb();
  const [v] = await db.select().from(t.vacature).where(eq(t.vacature.slug, slug));
  return v;
}

export async function kandidaten(vacatureIds: string[]) {
  const db = await getDb();
  return vacatureIds.length ? db.select().from(t.kandidaat).where(inArray(t.kandidaat.vacatureId, vacatureIds)).orderBy(desc(t.kandidaat.tijd)) : [];
}

export async function kandidaat(id: string) {
  const db = await getDb();
  const [k] = await db.select().from(t.kandidaat).where(eq(t.kandidaat.id, id));
  return k;
}

export async function medewerkerOpToken(token: string) {
  const db = await getDb();
  const [g] = await db.select().from(t.gebruiker).where(eq(t.gebruiker.uitnodigingToken, token));
  return g;
}

/** Welke (open) diensten passen bij deze medewerker: positie, beschikbaarheid, verlof en ATW. */
export async function passendVoor(gebruikerId: string, lijst: DienstRij[]) {
  if (!lijst.length) return [];
  const [m, pos, besch, verlof] = await Promise.all([medewerker(gebruikerId), positiesVan([gebruikerId]), beschikbaarheidVan([gebruikerId]), verlofVan({ gebruikerIds: [gebruikerId] })]);
  if (!m) return [];
  const van = new Date(Math.min(...lijst.map((d) => d.start.getTime())) - 8 * 86400000);
  const tot = new Date(Math.max(...lijst.map((d) => d.eind.getTime())) + 8 * 86400000);
  const eigen = (await diensten({ gebruikerIds: [gebruikerId], van, tot })).map((d) => ({ start: d.start, eind: d.eind }));
  const afwezig = afwezigheid(verlof, gebruikerId, isoDatum(tot));
  const hhmm = (d: Date) => d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  const minLeeftijd = new Map((await posities()).map((p) => [p.id, p.minLeeftijd]));
  return lijst.filter((d) => {
    const datum = d.start.toLocaleDateString("sv-SE");
    const l = leeftijdOp(m.geboortedatum, datum);
    if ((minLeeftijd.get(d.positieId) ?? 0) > 0 && (l === null || l < minLeeftijd.get(d.positieId)!)) return false;
    const b = besch.find((x) => x.weekdag === d.start.getDay());
    return pos.some((p) => p.positieId === d.positieId) && !afwezig.has(datum) && !!b && b.van <= hhmm(d.start) && b.tot >= hhmm(d.eind)
      && controleerDienst({ start: d.start, eind: d.eind }, leeftijdOp(m.geboortedatum, datum), eigen).length === 0;
  });
}

/** Afgelopen, gepubliceerde diensten (laatste 21 dagen) waarvoor nog geen uren zijn ingevuld of geklokt. */
export async function urenInTeVullen(gebruikerId: string) {
  const db = await getDb();
  const nu = new Date();
  const lijst = await diensten({ gebruikerIds: [gebruikerId], van: new Date(nu.getTime() - 21 * 86400000), tot: nu, status: "gepubliceerd" });
  const af = lijst.filter((d) => d.eind <= nu);
  if (!af.length) return [];
  const klok = await db.select({ dienstId: t.klok.dienstId }).from(t.klok).where(and(eq(t.klok.gebruikerId, gebruikerId), inArray(t.klok.dienstId, af.map((d) => d.id))));
  const gedaan = new Set(klok.map((k) => k.dienstId));
  return af.filter((d) => !gedaan.has(d.id));
}

/** Vestigingen waarvan deze gebruiker uren mag bevestigen. */
export function bevestigVestigingen(org: Org, u: Gebruiker) {
  return mag(org, u, "uren") ? scopeVestigingen(org, u) : [];
}

/** Ingediende urenregels die deze gebruiker mag bevestigen (nooit de eigen). */
export async function teBevestigen(org: Org, u: Gebruiker) {
  const vest = bevestigVestigingen(org, u);
  if (!vest.length) return [];
  return (await klokVan({ vestigingIds: vest, status: "ingediend" })).filter((k) => k.gebruikerId !== u.id);
}

/**
 * Bewaartermijn sollicitaties: 4 weken na afwijzing gaan kandidaat en het dossier in opbouw (incl. cv en beschikbaarheid) weg.
 * Draait bij het openen van Werving; in productie ook dagelijks.
 */
export async function ruimSollicitatiesOp() {
  const db = await getDb();
  const grens = Date.now() - 28 * 864e5;
  const afgewezen = await db.select().from(t.kandidaat).where(eq(t.kandidaat.fase, "afgewezen"));
  for (const k of afgewezen) {
    const laatste = Math.max(k.tijd.getTime(), ...k.notities.map((n) => new Date(n.tijd).getTime()));
    if (laatste > grens) continue;
    await db.delete(t.kandidaat).where(eq(t.kandidaat.id, k.id));
    if (k.gebruikerId) await db.delete(t.gebruiker).where(and(eq(t.gebruiker.id, k.gebruikerId), eq(t.gebruiker.status, "kandidaat")));
  }
}

/** Dossier in opbouw van een sollicitant: zichtbaar voor wie werving mag bekijken in de vestiging van de vacature. */
export async function magKandidaatZien(org: Org, u: Gebruiker, gebruikerId: string) {
  if (!mag(org, u, "werving", 1)) return false;
  const db = await getDb();
  const [r] = await db.select({ vestigingId: t.vacature.vestigingId }).from(t.kandidaat).innerJoin(t.vacature, eq(t.vacature.id, t.kandidaat.vacatureId)).where(eq(t.kandidaat.gebruikerId, gebruikerId));
  return !!r && scopeVestigingen(org, u).includes(r.vestigingId);
}
