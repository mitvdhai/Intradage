"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { isHQ, isLeiding, scopeVestigingen } from "../access";
import { audit } from "../audit";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import { controleerDienst, leeftijdOp, standaardPauze } from "../planning/atw";
import { maakSuggestie, naarMin, opTijd, slotsVoorWeek, teJongVoor } from "../planning/suggestie";
import { vereisGebruiker } from "../session";
import {
  contract as leesContract, contractenVan, dienst as leesDienst, diensten, kandidaat as leesKandidaat, magDossier, medewerker as leesMedewerker,
  medewerkerOpToken, periodesPerPersoon, planGegevens, vacatureOpSlug, vandaagIso,
} from "./data";
import { contractTekst, deadlineVan, LIFECYCLE } from "./sjablonen";

type Res = { fout?: string; ok?: boolean; info?: string };
const id = (p: string) => `${p}-${crypto.randomUUID().slice(0, 12)}`;
const tekst = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const getal = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").replace(",", "."));
const isTijd = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isDatum = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const MAX_BESTAND = 2 * 1024 * 1024;

async function leiding() {
  const s = await vereisGebruiker();
  if (!isHQ(s.u) && !isLeiding(s.u)) throw new Error("Geen rechten");
  return s;
}
async function inScope(vestigingId: string) {
  const s = await leiding();
  if (!scopeVestigingen(s.org, s.u).includes(vestigingId)) throw new Error("Niet jouw vestiging");
  return s;
}
async function dossierRecht(gebruikerId: string) {
  const s = await leiding();
  const m = await leesMedewerker(gebruikerId);
  if (!m || !magDossier(s.org, s.u, m)) throw new Error("Geen rechten op dit dossier");
  return { ...s, m };
}
const ververs = () => { revalidatePath("/beheer", "layout"); revalidatePath("/app", "layout"); };

async function maakLifecycle(gebruikerId: string, fase: keyof typeof LIFECYCLE, basis: string) {
  const db = await getDb();
  await db.insert(t.lifecycleTaak).values(LIFECYCLE[fase].map((s, i) => ({
    id: id("lc"), gebruikerId, fase, sleutel: s.sleutel, titel: s.titel, wie: s.wie, volgorde: i, deadline: deadlineVan(basis, s.dagen ?? 0),
  }))).onConflictDoNothing();
}
async function vinkAf(gebruikerId: string, sleutel: string, door: string) {
  const db = await getDb();
  await db.update(t.lifecycleTaak).set({ klaar: new Date(), klaarDoor: door }).where(and(eq(t.lifecycleTaak.gebruikerId, gebruikerId), eq(t.lifecycleTaak.sleutel, sleutel), isNull(t.lifecycleTaak.klaar)));
}

// ======================================================================
// Vestiging: openingstijden en standaardbezetting
// ======================================================================

export async function slaVestigingOp(vestigingId: string, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await inScope(vestigingId);
  const opening: t.Openingstijden = {};
  for (let d = 0; d < 7; d++) {
    const open = tekst(fd, `open-${d}`), sluit = tekst(fd, `sluit-${d}`);
    if (fd.get(`dicht-${d}`) || !open || !sluit) { opening[d] = null; continue; }
    if (!isTijd(open) || !isTijd(sluit) || naarMin(sluit) <= naarMin(open)) return { fout: `Controleer de openingstijden op dag ${d}.` };
    opening[d] = { open, sluit };
  }
  let normen: { weekdag: number; positieId: string; aantal: number; van: string; tot: string }[];
  try { normen = JSON.parse(tekst(fd, "normen") || "[]"); } catch { return { fout: "Ongeldige bezetting." }; }
  for (const n of normen) {
    const o = opening[n.weekdag];
    if (!isTijd(n.van) || !isTijd(n.tot) || naarMin(n.tot) <= naarMin(n.van)) return { fout: "Een bezettingsregel heeft geen geldige tijden." };
    if (!o) return { fout: "Er staat bezetting op een dag dat de vestiging dicht is." };
    if (naarMin(n.van) < naarMin(o.open) - 60 || naarMin(n.tot) > naarMin(o.sluit) + 60) return { fout: `Bezetting ${n.van}–${n.tot} valt buiten de openingstijden (een uur ervoor/erna mag, voor openen en sluiten).` };
    if (!(n.aantal >= 1 && n.aantal <= 20)) return { fout: "Aantal moet tussen 1 en 20 liggen." };
  }
  const db = await getDb();
  await db.update(t.vestiging).set({ openingstijden: opening }).where(eq(t.vestiging.id, vestigingId));
  await db.delete(t.bezettingsnorm).where(eq(t.bezettingsnorm.vestigingId, vestigingId));
  if (normen.length) await db.insert(t.bezettingsnorm).values(normen.map((n) => ({ id: id("bn"), vestigingId, ...n })));
  await audit(u.id, "Openingstijden en bezetting bijgewerkt", vestigingId);
  ververs();
  return { ok: true };
}

// ======================================================================
// Planning
// ======================================================================

export async function maakRoosterSuggestie(vestigingId: string, maandag: string): Promise<Res> {
  const { u, org } = await inScope(vestigingId);
  const db = await getDb();
  const [v] = await db.select().from(t.vestiging).where(eq(t.vestiging.id, vestigingId));
  const normen = await db.select().from(t.bezettingsnorm).where(eq(t.bezettingsnorm.vestigingId, vestigingId));
  if (!normen.length) return { fout: "Stel eerst de standaardbezetting in bij Vestigingen." };
  const van = new Date(`${maandag}T00:00:00`), tot = new Date(`${deadlineVan(maandag, 7)}T00:00:00`);
  const bestaand = await diensten({ vestigingIds: [vestigingId], van, tot });
  // Opnieuw maken: oude suggesties (concept) weg; handmatige en gepubliceerde diensten blijven staan en tellen mee
  const weg = bestaand.filter((d) => d.status === "concept" && d.bron === "suggestie");
  const blijft = bestaand.filter((d) => !weg.includes(d));
  const { kandidaten, elders } = await planGegevens(org, vestigingId, maandag);
  // Normen die al door blijvende diensten gedekt zijn, niet nog eens vullen
  const slots = slotsVoorWeek(maandag, normen, (d) => !v.openingstijden[new Date(`${d}T12:00:00`).getDay()])
    .filter((s) => {
      const gedekt = blijft.filter((d) => d.positieId === s.positieId && d.start.getTime() === opTijd(s.datum, s.van).getTime() && d.eind.getTime() === opTijd(s.datum, s.tot).getTime()).length;
      return s.nr > gedekt;
    });
  const pos = await db.select().from(t.positie);
  const res = maakSuggestie({ slots, kandidaten, bestaand: periodesPerPersoon(elders, new Set(weg.map((d) => d.id))), minLeeftijd: Object.fromEntries(pos.map((p) => [p.id, p.minLeeftijd])) });
  if (weg.length) await db.delete(t.dienst).where(inArray(t.dienst.id, weg.map((d) => d.id)));
  if (res.toewijzingen.length) await db.insert(t.dienst).values(res.toewijzingen.map((tw) => ({
    id: id("d"), vestigingId, positieId: tw.slot.positieId, gebruikerId: tw.gebruikerId, start: opTijd(tw.slot.datum, tw.slot.van), eind: opTijd(tw.slot.datum, tw.slot.tot), pauzeMin: tw.pauzeMin, status: "concept" as const, bron: "suggestie" as const,
  })));
  await audit(u.id, "Roostersuggestie gemaakt", `${vestigingId} · week van ${maandag} · ${res.dekking.gevuld}/${res.dekking.totaal} gevuld`);
  ververs();
  return { ok: true, info: `${res.dekking.gevuld} van de ${res.dekking.totaal} diensten ingevuld${res.dekking.gevuld < res.dekking.totaal ? `; ${res.dekking.totaal - res.dekking.gevuld} open` : ""}.` };
}

export async function publiceerWeek(vestigingId: string, maandag: string) {
  const { u } = await inScope(vestigingId);
  const db = await getDb();
  const van = new Date(`${maandag}T00:00:00`), tot = new Date(`${deadlineVan(maandag, 7)}T00:00:00`);
  await db.update(t.dienst).set({ status: "gepubliceerd" }).where(and(eq(t.dienst.vestigingId, vestigingId), eq(t.dienst.status, "concept"), gte(t.dienst.start, van), lt(t.dienst.start, tot)));
  await audit(u.id, "Rooster gepubliceerd", `${vestigingId} · week van ${maandag}`);
  ververs();
}

/** Wijs een dienst toe (of maak hem open). Weigert bij een ATW-overtreding, overlap of als iemand de positie niet heeft. */
export async function wijsDienstToe(dienstId: string, gebruikerId: string | null): Promise<Res> {
  const d = await leesDienst(dienstId);
  if (!d) return { fout: "Dienst niet gevonden." };
  const { u } = await inScope(d.vestigingId);
  const db = await getDb();
  if (gebruikerId) {
    const fout = await controleerToewijzing(d, gebruikerId);
    if (fout) return { fout };
  }
  await db.update(t.dienst).set({ gebruikerId, bron: "handmatig" }).where(eq(t.dienst.id, dienstId));
  await audit(u.id, gebruikerId ? "Dienst toegewezen" : "Dienst open gezet", `${dienstId}${gebruikerId ? ` → ${gebruikerId}` : ""}`);
  ververs();
  return { ok: true };
}

async function controleerToewijzing(d: typeof t.dienst.$inferSelect, gebruikerId: string): Promise<string | null> {
  const db = await getDb();
  const [m] = await db.select().from(t.gebruiker).where(eq(t.gebruiker.id, gebruikerId));
  if (!m) return "Medewerker niet gevonden.";
  const gv = await db.select().from(t.gebruikerVestiging).where(and(eq(t.gebruikerVestiging.gebruikerId, gebruikerId), eq(t.gebruikerVestiging.vestigingId, d.vestigingId)));
  if (!gv.length) return `${m.voornaam} is niet gekoppeld aan deze vestiging.`;
  const pos = await db.select().from(t.gebruikerPositie).where(and(eq(t.gebruikerPositie.gebruikerId, gebruikerId), eq(t.gebruikerPositie.positieId, d.positieId)));
  if (!pos.length) return `${m.voornaam} is niet inzetbaar op deze positie.`;
  const datum = d.start.toLocaleDateString("sv-SE");
  const [positie] = await db.select().from(t.positie).where(eq(t.positie.id, d.positieId));
  if (teJongVoor(m.geboortedatum, datum, positie?.minLeeftijd)) return `${m.voornaam} is te jong voor ${positie.naam} (vanaf ${positie.minLeeftijd} jaar).`;
  const verlof = await db.select().from(t.verlof).where(and(eq(t.verlof.gebruikerId, gebruikerId), eq(t.verlof.status, "goedgekeurd")));
  if (verlof.some((v) => v.van <= datum && (!v.tot || v.tot >= datum))) return `${m.voornaam} heeft dan verlof of is ziek.`;
  const rond = await diensten({ gebruikerIds: [gebruikerId], van: new Date(d.start.getTime() - 8 * 86400000), tot: new Date(d.eind.getTime() + 8 * 86400000) });
  const fouten = controleerDienst({ start: d.start, eind: d.eind }, leeftijdOp(m.geboortedatum, datum), rond.filter((x) => x.id !== d.id).map((x) => ({ start: x.start, eind: x.eind })));
  return fouten.length ? `${m.voornaam}: ${fouten.join("; ")}.` : null;
}

export async function voegDienstToe(vestigingId: string, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await inScope(vestigingId);
  const datum = tekst(fd, "datum"), van = tekst(fd, "van"), tot = tekst(fd, "tot"), positieId = tekst(fd, "positie");
  if (!isDatum(datum) || !isTijd(van) || !isTijd(tot) || naarMin(tot) <= naarMin(van) || !positieId) return { fout: "Vul datum, positie en geldige tijden in." };
  const db = await getDb();
  const nieuw = { id: id("d"), vestigingId, positieId, gebruikerId: null, start: opTijd(datum, van), eind: opTijd(datum, tot), pauzeMin: standaardPauze(naarMin(tot) - naarMin(van), null), status: "concept" as const, bron: "handmatig" as const };
  const gebruikerId = tekst(fd, "gebruiker") || null;
  if (gebruikerId) {
    const fout = await controleerToewijzing({ ...nieuw, gebruikerId }, gebruikerId);
    if (fout) return { fout };
  }
  await db.insert(t.dienst).values({ ...nieuw, gebruikerId });
  await audit(u.id, "Dienst toegevoegd", `${vestigingId} · ${datum} ${van}–${tot}`);
  ververs();
  return { ok: true };
}

export async function verwijderDienst(dienstId: string) {
  const d = await leesDienst(dienstId);
  if (!d) return;
  const { u } = await inScope(d.vestigingId);
  const db = await getDb();
  await db.delete(t.dienst).where(eq(t.dienst.id, dienstId));
  await audit(u.id, "Dienst verwijderd", dienstId);
  ververs();
}

/** Medewerker neemt een open (gepubliceerde) dienst. Dezelfde controles als bij toewijzen. */
export async function neemOpenDienst(dienstId: string): Promise<Res> {
  const { u } = await vereisGebruiker();
  const d = await leesDienst(dienstId);
  if (!d || d.gebruikerId || d.status !== "gepubliceerd" || d.start < new Date()) return { fout: "Deze dienst is niet meer beschikbaar." };
  const fout = await controleerToewijzing(d, u.id);
  if (fout) return { fout };
  const db = await getDb();
  await db.update(t.dienst).set({ gebruikerId: u.id }).where(and(eq(t.dienst.id, dienstId), isNull(t.dienst.gebruikerId)));
  await audit(u.id, "Open dienst genomen", dienstId);
  ververs();
  return { ok: true };
}

// ======================================================================
// Beschikbaarheid, verlof, ziekte
// ======================================================================

async function bewaarBeschikbaarheid(gebruikerId: string, fd: FormData): Promise<Res> {
  const rijen: { gebruikerId: string; weekdag: number; van: string; tot: string }[] = [];
  for (let d = 0; d < 7; d++) {
    if (!fd.get(`dag-${d}`)) continue;
    const van = tekst(fd, `van-${d}`) || "10:00", tot = tekst(fd, `tot-${d}`) || "22:00";
    if (!isTijd(van) || !isTijd(tot) || naarMin(tot) <= naarMin(van)) return { fout: "Controleer de tijden: 'tot' moet na 'van' liggen." };
    rijen.push({ gebruikerId, weekdag: d, van, tot });
  }
  const db = await getDb();
  await db.delete(t.beschikbaarheid).where(eq(t.beschikbaarheid.gebruikerId, gebruikerId));
  if (rijen.length) await db.insert(t.beschikbaarheid).values(rijen);
  await vinkAf(gebruikerId, "beschikbaarheid", gebruikerId);
  return { ok: true };
}

export async function slaBeschikbaarheidOp(_: unknown, fd: FormData): Promise<Res> {
  const { u } = await vereisGebruiker();
  const r = await bewaarBeschikbaarheid(u.id, fd);
  if (r.ok) { await audit(u.id, "Beschikbaarheid bijgewerkt"); ververs(); }
  return r;
}

export async function vraagVerlofAan(_: unknown, fd: FormData): Promise<Res> {
  const { u } = await vereisGebruiker();
  const type = tekst(fd, "type") as "vakantie" | "bijzonder" | "onbetaald";
  const van = tekst(fd, "van"), tot = tekst(fd, "tot") || van;
  if (!["vakantie", "bijzonder", "onbetaald"].includes(type) || !isDatum(van) || !isDatum(tot) || tot < van) return { fout: "Kies een soort verlof en geldige data." };
  if (van < vandaagIso()) return { fout: "Verlof kun je niet met terugwerkende kracht aanvragen." };
  const uren = getal(fd, "uren");
  const db = await getDb();
  await db.insert(t.verlof).values({ id: id("vl"), gebruikerId: u.id, type, van, tot, uren: Number.isFinite(uren) && uren > 0 ? uren : null, opmerking: tekst(fd, "opmerking") || null });
  await audit(u.id, "Verlof aangevraagd", `${type} ${van} t/m ${tot}`);
  ververs();
  return { ok: true };
}

export async function trekVerlofIn(verlofId: string) {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  await db.delete(t.verlof).where(and(eq(t.verlof.id, verlofId), eq(t.verlof.gebruikerId, u.id), eq(t.verlof.status, "aangevraagd")));
  ververs();
}

export async function meldZiek(_: unknown, fd: FormData): Promise<Res> {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  const lopend = await db.select().from(t.verlof).where(and(eq(t.verlof.gebruikerId, u.id), eq(t.verlof.type, "ziek"), isNull(t.verlof.tot)));
  if (lopend.length) return { fout: "Je bent al ziek gemeld." };
  const vandaag = vandaagIso();
  await db.insert(t.verlof).values({ id: id("vl"), gebruikerId: u.id, type: "ziek", van: vandaag, status: "goedgekeurd", opmerking: tekst(fd, "opmerking") || null });
  // Diensten vanaf nu tot en met morgen komen open te staan, zodat de leiding direct kan schuiven
  const morgen = new Date(`${deadlineVan(vandaag, 2)}T00:00:00`);
  const open = await diensten({ gebruikerIds: [u.id], van: new Date(), tot: morgen });
  if (open.length) await db.update(t.dienst).set({ gebruikerId: null }).where(inArray(t.dienst.id, open.map((d) => d.id)));
  await audit(u.id, "Ziek gemeld", `${open.length} dienst(en) open gezet`);
  ververs();
  return { ok: true, info: open.length ? `${open.length} dienst${open.length > 1 ? "en" : ""} staat nu open voor collega's. Je leidinggevende is op de hoogte.` : "Je leidinggevende is op de hoogte." };
}

export async function meldBeter(verlofId: string) {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  await db.update(t.verlof).set({ tot: vandaagIso() }).where(and(eq(t.verlof.id, verlofId), eq(t.verlof.gebruikerId, u.id), eq(t.verlof.type, "ziek"), isNull(t.verlof.tot)));
  await audit(u.id, "Beter gemeld");
  ververs();
}

export async function beslisVerlof(verlofId: string, akkoord: boolean) {
  const { u, org } = await leiding();
  const db = await getDb();
  const [v] = await db.select().from(t.verlof).where(eq(t.verlof.id, verlofId));
  const m = v && await leesMedewerker(v.gebruikerId);
  if (!v || !m || !magDossier(org, u, m) || v.status !== "aangevraagd") return;
  await db.update(t.verlof).set({ status: akkoord ? "goedgekeurd" : "afgewezen", behandeldDoor: u.id }).where(eq(t.verlof.id, verlofId));
  await audit(u.id, akkoord ? "Verlof goedgekeurd" : "Verlof afgewezen", `${v.gebruikerId} · ${v.van} t/m ${v.tot}`);
  ververs();
}

// ======================================================================
// Klokken en uren
// ======================================================================

export async function klokIn(dienstId: string | null) {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  const open = await db.select().from(t.klok).where(and(eq(t.klok.gebruikerId, u.id), eq(t.klok.status, "open")));
  if (open.length) return;
  const d = dienstId ? await leesDienst(dienstId) : undefined;
  if (dienstId && d?.gebruikerId !== u.id) return;
  const vestigingId = d?.vestigingId ?? u.vestigingIds[0];
  if (!vestigingId) return;
  await db.insert(t.klok).values({ id: id("kl"), gebruikerId: u.id, vestigingId, dienstId: d?.id ?? null, in: new Date() });
  ververs();
}

export async function klokUit(_: unknown, fd: FormData): Promise<Res> {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  const [k] = await db.select().from(t.klok).where(and(eq(t.klok.gebruikerId, u.id), eq(t.klok.status, "open")));
  if (!k) return { fout: "Je bent niet ingeklokt." };
  const pauze = Math.max(0, Math.min(120, getal(fd, "pauze") || 0));
  await db.update(t.klok).set({ uit: new Date(), pauzeMin: pauze, status: "ingediend", opmerking: tekst(fd, "opmerking") || null }).where(eq(t.klok.id, k.id));
  await audit(u.id, "Uitgeklokt", k.id);
  ververs();
  return { ok: true };
}

export async function keurUrenGoed(ids: string[]) {
  const { u, org } = await leiding();
  const db = await getDb();
  const scope = scopeVestigingen(org, u);
  const rijen = ids.length ? await db.select().from(t.klok).where(and(inArray(t.klok.id, ids), eq(t.klok.status, "ingediend"))) : [];
  const ok = rijen.filter((k) => scope.includes(k.vestigingId)).map((k) => k.id);
  if (ok.length) await db.update(t.klok).set({ status: "goedgekeurd", goedgekeurdDoor: u.id }).where(inArray(t.klok.id, ok));
  await audit(u.id, "Uren goedgekeurd", `${ok.length} regels`);
  ververs();
}

export async function corrigeerKlok(klokId: string, _: unknown, fd: FormData): Promise<Res> {
  const { u, org } = await leiding();
  const db = await getDb();
  const [k] = await db.select().from(t.klok).where(eq(t.klok.id, klokId));
  if (!k || !scopeVestigingen(org, u).includes(k.vestigingId)) return { fout: "Geen rechten." };
  const datum = k.in.toLocaleDateString("sv-SE");
  const van = tekst(fd, "in"), tot = tekst(fd, "uit");
  if (!isTijd(van) || !isTijd(tot) || naarMin(tot) <= naarMin(van)) return { fout: "Ongeldige tijden." };
  await db.update(t.klok).set({ in: opTijd(datum, van), uit: opTijd(datum, tot), pauzeMin: Math.max(0, getal(fd, "pauze") || 0), status: "goedgekeurd", goedgekeurdDoor: u.id, opmerking: tekst(fd, "opmerking") || k.opmerking }).where(eq(t.klok.id, klokId));
  await audit(u.id, "Uren gecorrigeerd", `${klokId}: ${van}–${tot}`);
  ververs();
  return { ok: true };
}

// ======================================================================
// Dossier: gegevens, vestigingen, posities, documenten
// ======================================================================

export async function slaDossierOp(gebruikerId: string, _: unknown, fd: FormData): Promise<Res> {
  const { u, org, m } = await dossierRecht(gebruikerId);
  const scope = scopeVestigingen(org, u);
  const gekozen = fd.getAll("vestiging").map(String).filter((v) => scope.includes(v));
  // Vestigingen buiten mijn scope blijven staan
  const vest = [...new Set([...m.vestigingIds.filter((v) => !scope.includes(v)), ...gekozen])];
  if (!vest.length) return { fout: "Koppel minstens één vestiging." };
  const pos = fd.getAll("positie").map(String);
  const geb = tekst(fd, "geboortedatum");
  const db = await getDb();
  const geboorte = isDatum(geb) ? geb : m.geboortedatum;
  const posities = await db.select().from(t.positie);
  const teJong = posities.filter((p) => pos.includes(p.id) && teJongVoor(geboorte, vandaagIso(), p.minLeeftijd));
  if (teJong.length) return { fout: `${m.voornaam} is te jong voor ${teJong.map((p) => `${p.naam} (vanaf ${p.minLeeftijd})`).join(", ")}.` };
  await db.update(t.gebruiker).set({
    functieId: tekst(fd, "functie") || m.functieId, rol: (["medewerker", "shiftleider", "manager"].includes(tekst(fd, "rol")) ? tekst(fd, "rol") : m.rol) as typeof m.rol,
    geboortedatum: isDatum(geb) ? geb : m.geboortedatum, email: tekst(fd, "email") || m.email, mobiel: tekst(fd, "mobiel") || m.mobiel,
  }).where(eq(t.gebruiker.id, gebruikerId));
  await db.delete(t.gebruikerVestiging).where(eq(t.gebruikerVestiging.gebruikerId, gebruikerId));
  await db.insert(t.gebruikerVestiging).values(vest.map((v) => ({ gebruikerId, vestigingId: v })));
  await db.delete(t.gebruikerPositie).where(eq(t.gebruikerPositie.gebruikerId, gebruikerId));
  if (pos.length) await db.insert(t.gebruikerPositie).values(pos.map((p) => ({ gebruikerId, positieId: p })));
  if (fd.has("dag-0") || [...fd.keys()].some((k) => k.startsWith("dag-"))) await bewaarBeschikbaarheid(gebruikerId, fd);
  await audit(u.id, "Dossier bijgewerkt", gebruikerId);
  ververs();
  return { ok: true };
}

async function leesBestand(fd: FormData): Promise<{ fout?: string; b?: { naam: string; mime: string; kb: number; inhoud: string } }> {
  const f = fd.get("bestand");
  if (!(f instanceof File) || !f.size) return {};
  if (f.size > MAX_BESTAND) return { fout: "Bestand is groter dan 2 MB." };
  if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(f.type)) return { fout: "Alleen een foto (jpg, png) of pdf." };
  return { b: { naam: f.name.slice(0, 120), mime: f.type, kb: Math.ceil(f.size / 1024), inhoud: Buffer.from(await f.arrayBuffer()).toString("base64") } };
}

async function bewaarDocument(gebruikerId: string, door: string, fd: FormData): Promise<Res> {
  const categorie = tekst(fd, "categorie") as t.DossierCategorie;
  const titel = tekst(fd, "titel");
  if (!["identiteit", "contract", "diploma", "certificaat", "loonheffing", "verklaring", "overig"].includes(categorie) || !titel) return { fout: "Kies een soort en geef een titel." };
  const { fout, b } = await leesBestand(fd);
  if (fout) return { fout };
  if (!b) return { fout: "Kies een bestand." };
  const vervalt = tekst(fd, "vervalt");
  const db = await getDb();
  await db.insert(t.dossierDocument).values({ id: id("dd"), gebruikerId, categorie, titel, bestandsnaam: b.naam, mime: b.mime, grootte: b.kb, inhoud: b.inhoud, vervalt: isDatum(vervalt) ? vervalt : null, geuploadDoor: door });
  if (categorie === "identiteit") await vinkAf(gebruikerId, "identiteit", door);
  await audit(door, "Document toegevoegd aan dossier", `${gebruikerId} · ${titel}`);
  ververs();
  return { ok: true };
}

export async function uploadDocument(gebruikerId: string | null, _: unknown, fd: FormData): Promise<Res> {
  if (!gebruikerId) { const { u } = await vereisGebruiker(); return bewaarDocument(u.id, u.id, fd); }
  const { u } = await dossierRecht(gebruikerId);
  return bewaarDocument(gebruikerId, u.id, fd);
}

export async function verwijderDocument(documentId: string) {
  const db = await getDb();
  const [d] = await db.select().from(t.dossierDocument).where(eq(t.dossierDocument.id, documentId));
  if (!d) return;
  const { u } = await dossierRecht(d.gebruikerId);
  await db.delete(t.dossierDocument).where(eq(t.dossierDocument.id, documentId));
  await audit(u.id, "Document verwijderd uit dossier", `${d.gebruikerId} · ${d.titel}`);
  ververs();
}

export async function vinkTaakAf(taakId: string) {
  const db = await getDb();
  const [tk] = await db.select().from(t.lifecycleTaak).where(eq(t.lifecycleTaak.id, taakId));
  if (!tk) return;
  const { u } = tk.wie === "leiding" ? await dossierRecht(tk.gebruikerId) : await vereisGebruiker();
  if (tk.wie === "medewerker" && u.id !== tk.gebruikerId && !isLeiding(u) && !isHQ(u)) return;
  await db.update(t.lifecycleTaak).set({ klaar: tk.klaar ? null : new Date(), klaarDoor: tk.klaar ? null : u.id }).where(eq(t.lifecycleTaak.id, taakId));
  ververs();
}

// ======================================================================
// Contracten en digitaal tekenen
// ======================================================================

export async function maakContract(gebruikerId: string, _: unknown, fd: FormData): Promise<Res> {
  const { u, org, m } = await dossierRecht(gebruikerId);
  const type = tekst(fd, "type") as "oproep" | "minmax" | "vast";
  const urenMin = type === "oproep" ? 0 : getal(fd, "urenMin"), urenMax = getal(fd, "urenMax"), uurloon = getal(fd, "uurloon");
  const start = tekst(fd, "start"), eind = tekst(fd, "eind"), proeftijd = tekst(fd, "proeftijd");
  if (!["oproep", "minmax", "vast"].includes(type) || !isDatum(start) || !(urenMax > 0) || !(uurloon > 0)) return { fout: "Vul soort, uren, uurloon en startdatum in." };
  if (type === "vast" ? false : urenMin > urenMax) return { fout: "Minimum uren mag niet hoger zijn dan maximum." };
  if (eind && (!isDatum(eind) || eind <= start)) return { fout: "Einddatum moet na de startdatum liggen." };
  const bestaande = await contractenVan([gebruikerId]);
  const volgnummer = (bestaande[0]?.volgnummer ?? 0) + 1;
  const fn = org.franchisenemers.find((f) => f.id === m.franchisenemerId);
  const functie = org.functies.find((f) => f.id === m.functieId);
  const velden = {
    werkgever: fn?.naam ?? "De werkgever", vestigingen: m.vestigingIds.map((v) => org.vestigingen.find((x) => x.id === v)?.naam ?? v), naam: `${m.voornaam} ${m.achternaam}`,
    geboortedatum: m.geboortedatum, functie: functie?.naam ?? "Medewerker", type, urenMin: type === "vast" ? urenMax : urenMin, urenMax, uurloon, start, eind: eind || null, proeftijdTot: proeftijd || null, volgnummer,
  };
  const tekstC = contractTekst(velden);
  const db = await getDb();
  const nieuwId = id("ct");
  await db.insert(t.contract).values({ id: nieuwId, gebruikerId, volgnummer, type, urenMin: velden.urenMin, urenMax, uurloon, functieId: m.functieId, start, eind: eind || null, proeftijdTot: proeftijd || null, tekst: tekstC, status: "ter-ondertekening", documentHash: hash(tekstC), aangemaaktDoor: u.id });
  await audit(u.id, "Contract opgesteld", `${gebruikerId} · contract ${volgnummer}`);
  ververs();
  redirect(`/beheer/personeel/${gebruikerId}/contract/${nieuwId}`);
}

function geldigeHandtekening(svg: string) {
  return /^[MLCQSZmlcqsz0-9 .,-]+$/.test(svg) && svg.length > 20 && svg.length < 20000;
}

async function rondContractAf(c: typeof t.contract.$inferSelect) {
  const db = await getDb();
  await db.update(t.contract).set({ status: "getekend" }).where(eq(t.contract.id, c.id));
  // Vorige contracten met overlap eindigen
  await db.update(t.contract).set({ status: "beeindigd" }).where(and(eq(t.contract.gebruikerId, c.gebruikerId), eq(t.contract.status, "getekend"), lt(t.contract.volgnummer, c.volgnummer), lt(t.contract.start, c.start), eq(t.contract.eind, deadlineVan(c.start, -1))));
  await db.insert(t.dossierDocument).values({ id: id("dd"), gebruikerId: c.gebruikerId, categorie: "contract", titel: `Arbeidsovereenkomst ${c.volgnummer} (getekend)`, bestandsnaam: `contract-${c.volgnummer}.txt`, mime: "text/plain", grootte: Math.ceil(c.tekst.length / 1024), inhoud: Buffer.from(c.tekst).toString("base64") });
  // Nieuwe medewerker: na beide handtekeningen actief + onboarding
  const [g] = await db.select().from(t.gebruiker).where(eq(t.gebruiker.id, c.gebruikerId));
  if (g?.status === "preboarding") {
    await db.update(t.gebruiker).set({ status: "actief", actief: true }).where(eq(t.gebruiker.id, g.id));
    await maakLifecycle(g.id, "onboarding", g.inDienstSinds);
  }
}

/** Medewerker tekent (in de app). */
export async function tekenContract(contractId: string, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await vereisGebruiker();
  return tekenAlsWerknemer(contractId, u.id, fd);
}

async function tekenAlsWerknemer(contractId: string, gebruikerId: string, fd: FormData): Promise<Res> {
  const c = await leesContract(contractId);
  if (!c || c.gebruikerId !== gebruikerId || c.status !== "ter-ondertekening" || c.ondertekendWerknemer) return { fout: "Dit contract kun je niet (meer) tekenen." };
  if (!fd.get("akkoord")) return { fout: "Vink aan dat je het contract hebt gelezen." };
  const svg = tekst(fd, "handtekening");
  if (!geldigeHandtekening(svg)) return { fout: "Zet eerst je handtekening." };
  if (hash(c.tekst) !== c.documentHash) return { fout: "De contracttekst is gewijzigd. Vraag een nieuw contract aan." };
  const db = await getDb();
  await db.update(t.contract).set({ ondertekendWerknemer: new Date(), handtekeningWerknemer: svg }).where(eq(t.contract.id, contractId));
  await vinkAf(gebruikerId, "contract-werknemer", gebruikerId);
  await audit(gebruikerId, "Contract getekend door medewerker", `${contractId} · hash ${c.documentHash?.slice(0, 12)}`);
  if (c.ondertekendWerkgever) await rondContractAf(c);
  ververs();
  return { ok: true };
}

export async function tekenAlsWerkgever(contractId: string, _: unknown, fd: FormData): Promise<Res> {
  const c = await leesContract(contractId);
  if (!c) return { fout: "Contract niet gevonden." };
  const { u } = await dossierRecht(c.gebruikerId);
  if (u.rol !== "franchisenemer" && !isHQ(u)) return { fout: "Alleen de franchisenemer (werkgever) tekent het contract." };
  if (c.status !== "ter-ondertekening" || c.ondertekendWerkgever) return { fout: "Dit contract is al getekend." };
  const svg = tekst(fd, "handtekening");
  if (!geldigeHandtekening(svg)) return { fout: "Zet eerst je handtekening." };
  const db = await getDb();
  await db.update(t.contract).set({ ondertekendWerkgever: new Date(), handtekeningWerkgever: svg, werkgeverOndertekenaarId: u.id }).where(eq(t.contract.id, contractId));
  await vinkAf(c.gebruikerId, "contract-werkgever", u.id);
  await audit(u.id, "Contract getekend door werkgever", `${contractId} · hash ${c.documentHash?.slice(0, 12)}`);
  if (c.ondertekendWerknemer) await rondContractAf(c);
  ververs();
  return { ok: true };
}

export async function trekContractIn(contractId: string) {
  const c = await leesContract(contractId);
  if (!c) return;
  const { u } = await dossierRecht(c.gebruikerId);
  if (c.status !== "ter-ondertekening") return;
  const db = await getDb();
  await db.delete(t.contract).where(eq(t.contract.id, contractId));
  await audit(u.id, "Contractvoorstel ingetrokken", contractId);
  ververs();
  redirect(`/beheer/personeel/${c.gebruikerId}`);
}

// ======================================================================
// Offboarding
// ======================================================================

export async function meldUitDienst(gebruikerId: string, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await dossierRecht(gebruikerId);
  const laatsteDag = tekst(fd, "laatsteDag"), reden = tekst(fd, "reden");
  if (!isDatum(laatsteDag)) return { fout: "Kies de laatste werkdag." };
  const db = await getDb();
  await db.update(t.gebruiker).set({ uitDienstPer: laatsteDag, uitDienstReden: reden || null }).where(eq(t.gebruiker.id, gebruikerId));
  // Diensten na de laatste werkdag komen open te staan
  const na = new Date(`${deadlineVan(laatsteDag, 1)}T00:00:00`);
  const later = await diensten({ gebruikerIds: [gebruikerId], van: na, tot: new Date(na.getTime() + 365 * 86400000) });
  if (later.length) await db.update(t.dienst).set({ gebruikerId: null }).where(inArray(t.dienst.id, later.map((d) => d.id)));
  await maakLifecycle(gebruikerId, "offboarding", laatsteDag);
  if (later.length) await vinkAf(gebruikerId, "diensten", u.id);
  await audit(u.id, "Uit dienst gemeld", `${gebruikerId} · laatste werkdag ${laatsteDag}`);
  ververs();
  return { ok: true, info: `Offboarding gestart.${later.length ? ` ${later.length} dienst(en) na de laatste werkdag staan nu open.` : ""}` };
}

// ======================================================================
// Werving
// ======================================================================

export async function maakVacature(_: unknown, fd: FormData): Promise<Res> {
  const vestigingId = tekst(fd, "vestiging");
  const { u } = await inScope(vestigingId);
  const titel = tekst(fd, "titel"), omschrijving = tekst(fd, "omschrijving"), uren = tekst(fd, "uren");
  if (!titel || !omschrijving || !uren) return { fout: "Vul titel, omschrijving en uren in." };
  const db = await getDb();
  const [v] = await db.select().from(t.vestiging).where(eq(t.vestiging.id, vestigingId));
  const slug = `${titel}-${v.naam}-${v.plaats}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + crypto.randomUUID().slice(0, 4);
  await db.insert(t.vacature).values({ id: id("vac"), slug, vestigingId, functieId: tekst(fd, "functie") || null, titel, omschrijving, uren });
  await audit(u.id, "Vacature geplaatst", titel);
  ververs();
  return { ok: true };
}

export async function sluitVacature(vacatureId: string) {
  const db = await getDb();
  const [v] = await db.select().from(t.vacature).where(eq(t.vacature.id, vacatureId));
  if (!v) return;
  const { u } = await inScope(v.vestigingId);
  await db.update(t.vacature).set({ status: v.status === "open" ? "gesloten" : "open" }).where(eq(t.vacature.id, vacatureId));
  await audit(u.id, v.status === "open" ? "Vacature gesloten" : "Vacature heropend", v.titel);
  ververs();
}

/** Openbaar sollicitatieformulier (geen login). */
export async function solliciteer(slug: string, _: unknown, fd: FormData): Promise<Res> {
  const v = await vacatureOpSlug(slug);
  if (!v || v.status !== "open") return { fout: "Deze vacature is niet meer open." };
  const voornaam = tekst(fd, "voornaam"), achternaam = tekst(fd, "achternaam"), email = tekst(fd, "email"), mobiel = tekst(fd, "mobiel"), geb = tekst(fd, "geboortedatum");
  if (!voornaam || !achternaam || !/^\S+@\S+\.\S+$/.test(email) || mobiel.replace(/\D/g, "").length < 10) return { fout: "Vul je naam, een geldig e-mailadres en je mobiele nummer in." };
  if (!fd.get("privacy")) return { fout: "Geef toestemming voor het verwerken van je gegevens." };
  const leeftijd = leeftijdOp(isDatum(geb) ? geb : null, vandaagIso());
  if (leeftijd !== null && leeftijd < 15) return { fout: "Je moet minimaal 15 jaar zijn om bij ons te werken." };
  const ref = tekst(fd, "ref");
  const db = await getDb();
  const [aandrager] = ref ? await db.select({ id: t.gebruiker.id }).from(t.gebruiker).where(eq(t.gebruiker.personeelsnummer, ref)) : [];
  await db.insert(t.kandidaat).values({
    id: id("k"), vacatureId: v.id, voornaam, achternaam, email, mobiel, geboortedatum: isDatum(geb) ? geb : null,
    motivatie: tekst(fd, "motivatie").slice(0, 2000) || null, beschikbaarheid: tekst(fd, "beschikbaarheid").slice(0, 500) || null,
    bron: aandrager ? "referral" : "website", aangedragenDoor: aandrager?.id ?? null,
  });
  return { ok: true };
}

export async function wijzigFase(kandidaatId: string, fase: "nieuw" | "gesprek" | "proefdraaien" | "aanbod" | "afgewezen") {
  const k = await leesKandidaat(kandidaatId);
  if (!k || k.fase === "aangenomen") return;
  const db = await getDb();
  const [v] = await db.select().from(t.vacature).where(eq(t.vacature.id, k.vacatureId));
  const { u } = await inScope(v.vestigingId);
  await db.update(t.kandidaat).set({ fase, notities: [...k.notities, { door: u.id, tijd: new Date().toISOString(), tekst: `Fase gewijzigd naar ${fase}` }] }).where(eq(t.kandidaat.id, kandidaatId));
  ververs();
}

export async function bewerkKandidaat(kandidaatId: string, _: unknown, fd: FormData): Promise<Res> {
  const k = await leesKandidaat(kandidaatId);
  if (!k) return { fout: "Kandidaat niet gevonden." };
  const db = await getDb();
  const [v] = await db.select().from(t.vacature).where(eq(t.vacature.id, k.vacatureId));
  const { u } = await inScope(v.vestigingId);
  const notitie = tekst(fd, "notitie"), gesprek = tekst(fd, "gesprek"), beoordeling = getal(fd, "beoordeling");
  const notities = notitie ? [...k.notities, { door: u.id, tijd: new Date().toISOString(), tekst: notitie.slice(0, 1000) }] : k.notities;
  const gesprekOp = gesprek ? new Date(gesprek) : k.gesprekOp;
  await db.update(t.kandidaat).set({
    notities, gesprekOp: gesprekOp && !Number.isNaN(gesprekOp.getTime()) ? gesprekOp : k.gesprekOp,
    beoordeling: beoordeling >= 1 && beoordeling <= 5 ? beoordeling : k.beoordeling,
    fase: gesprek && k.fase === "nieuw" ? "gesprek" : k.fase,
  }).where(eq(t.kandidaat.id, kandidaatId));
  ververs();
  return { ok: true };
}

/** Kandidaat aannemen: medewerker in preboarding, contractvoorstel, preboarding-taken en een persoonlijke startlink. */
export async function neemAan(kandidaatId: string, _: unknown, fd: FormData): Promise<Res> {
  const k = await leesKandidaat(kandidaatId);
  if (!k || k.fase === "aangenomen") return { fout: "Deze kandidaat is al aangenomen." };
  const db = await getDb();
  const [v] = await db.select().from(t.vacature).where(eq(t.vacature.id, k.vacatureId));
  const { u, org } = await inScope(v.vestigingId);
  const start = tekst(fd, "start"), type = tekst(fd, "type") as "oproep" | "minmax" | "vast";
  const urenMin = type === "oproep" ? 0 : getal(fd, "urenMin"), urenMax = getal(fd, "urenMax"), uurloon = getal(fd, "uurloon");
  const maanden = getal(fd, "maanden");
  if (!isDatum(start) || !["oproep", "minmax", "vast"].includes(type) || !(urenMax > 0) || !(uurloon > 0)) return { fout: "Vul startdatum, contractsoort, uren en uurloon in." };
  const vestigingNaam = org.vestigingen.find((x) => x.id === v.vestigingId);
  const fn = org.franchisenemers.find((f) => f.id === vestigingNaam?.franchisenemerId);
  const gebruikerId = id("u");
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  await db.insert(t.gebruiker).values({
    id: gebruikerId, voornaam: k.voornaam, achternaam: k.achternaam, rol: v.functieId === "f-shiftleider" ? "shiftleider" : "medewerker", functieId: v.functieId ?? "f-medewerker",
    franchisenemerId: fn?.id ?? null, mobiel: k.mobiel, email: k.email, geboortedatum: k.geboortedatum, inDienstSinds: start,
    personeelsnummer: `P${Date.now().toString(36).toUpperCase()}`, actief: false, status: "preboarding", uitnodigingToken: token, agendaToken: crypto.randomUUID().slice(0, 16),
  });
  await db.insert(t.gebruikerVestiging).values({ gebruikerId, vestigingId: v.vestigingId });
  // Standaardposities, alleen waar de nieuwe medewerker oud genoeg voor is (bij de start)
  const startPos = (await db.select().from(t.positie)).filter((p) => ["pos-kassa", "pos-uitgifte"].includes(p.id) && !teJongVoor(k.geboortedatum, start, p.minLeeftijd));
  if (startPos.length) await db.insert(t.gebruikerPositie).values(startPos.map((p) => ({ gebruikerId, positieId: p.id })));
  const eind = maanden > 0 ? deadlineVan(start, Math.round(maanden * 30.44) - 1) : null;
  const proeftijdTot = eind && maanden >= 6 ? deadlineVan(start, 30) : null;
  const functie = org.functies.find((f) => f.id === v.functieId);
  const tekstC = contractTekst({ werkgever: fn?.naam ?? "De werkgever", vestigingen: [vestigingNaam?.naam ?? ""], naam: `${k.voornaam} ${k.achternaam}`, geboortedatum: k.geboortedatum, functie: functie?.naam ?? "Medewerker", type, urenMin: type === "vast" ? urenMax : urenMin, urenMax, uurloon, start, eind, proeftijdTot, volgnummer: 1 });
  await db.insert(t.contract).values({ id: id("ct"), gebruikerId, volgnummer: 1, type, urenMin: type === "vast" ? urenMax : urenMin, urenMax, uurloon, functieId: v.functieId, start, eind, proeftijdTot, tekst: tekstC, status: "ter-ondertekening", documentHash: hash(tekstC), aangemaaktDoor: u.id });
  await db.insert(t.salaris).values({ gebruikerId, uurloon, schaalMin: uurloon, schaalMax: Math.round(uurloon * 1.15 * 100) / 100 });
  await maakLifecycle(gebruikerId, "preboarding", start);
  await db.update(t.kandidaat).set({ fase: "aangenomen", gebruikerId, notities: [...k.notities, { door: u.id, tijd: new Date().toISOString(), tekst: `Aangenomen per ${start}` }] }).where(eq(t.kandidaat.id, kandidaatId));
  if (k.aangedragenDoor) await db.insert(t.waardering).values({ id: id("wd"), vanId: u.id, aanId: k.aangedragenDoor, waardeId: "w-samen", tekst: `Bedankt voor het aandragen van ${k.voornaam}, die bij ons komt werken!`, punten: 50 }).onConflictDoNothing();
  await audit(u.id, "Kandidaat aangenomen", `${k.voornaam} ${k.achternaam} · start ${start}`);
  ververs();
  redirect(`/beheer/personeel/${gebruikerId}?nieuw=1`);
}

// ======================================================================
// Preboarding via persoonlijke link (nog geen account)
// ======================================================================

async function nieuweMedewerker(token: string) {
  const g = await medewerkerOpToken(token);
  if (!g || g.status !== "preboarding") throw new Error("Deze link is niet (meer) geldig.");
  return g;
}

export async function preboardingGegevens(token: string, _: unknown, fd: FormData): Promise<Res> {
  const g = await nieuweMedewerker(token);
  const iban = tekst(fd, "iban").replace(/\s/g, "").toUpperCase();
  const bsn = tekst(fd, "bsn").replace(/\D/g, "");
  if (!tekst(fd, "adres") || !tekst(fd, "postcode") || !tekst(fd, "woonplaats")) return { fout: "Vul je adres in." };
  if (!/^NL\d{2}[A-Z]{4}\d{10}$/.test(iban)) return { fout: "Controleer je IBAN (bijv. NL12ABCD0123456789)." };
  if (bsn.length !== 9 || !elfproef(bsn)) return { fout: "Dit BSN klopt niet. Je vindt het op je ID-kaart of paspoort." };
  const db = await getDb();
  await db.update(t.gebruiker).set({
    persoonsgegevens: {
      adres: tekst(fd, "adres"), postcode: tekst(fd, "postcode").toUpperCase(), woonplaats: tekst(fd, "woonplaats"), iban: `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`,
      noodcontactNaam: tekst(fd, "noodNaam"), noodcontactTelefoon: tekst(fd, "noodTel"), bsnLaatste4: bsn.slice(-4), loonheffingskorting: fd.get("loonheffing") === "ja",
    },
  }).where(eq(t.gebruiker.id, g.id));
  // In productie gaan volledig IBAN en BSN versleuteld rechtstreeks naar de loonadministratie; hier bewaren we ze niet.
  await vinkAf(g.id, "gegevens", g.id);
  await audit(g.id, "Preboarding: gegevens ingevuld");
  revalidatePath(`/start/${token}`);
  return { ok: true };
}

/** Elfproef voor BSN (de standaardcontrole van de overheid). */
function elfproef(bsn: string) {
  const c = bsn.split("").map(Number);
  const som = c.slice(0, 8).reduce((s, n, i) => s + n * (9 - i), 0) - c[8];
  return som % 11 === 0;
}

export async function preboardingDocument(token: string, _: unknown, fd: FormData): Promise<Res> {
  const g = await nieuweMedewerker(token);
  const r = await bewaarDocument(g.id, g.id, fd);
  revalidatePath(`/start/${token}`);
  return r;
}

export async function preboardingBeschikbaarheid(token: string, _: unknown, fd: FormData): Promise<Res> {
  const g = await nieuweMedewerker(token);
  const r = await bewaarBeschikbaarheid(g.id, fd);
  revalidatePath(`/start/${token}`);
  return r;
}

export async function preboardingTeken(token: string, contractId: string, _: unknown, fd: FormData): Promise<Res> {
  const g = await nieuweMedewerker(token);
  const r = await tekenAlsWerknemer(contractId, g.id, fd);
  revalidatePath(`/start/${token}`);
  return r;
}
