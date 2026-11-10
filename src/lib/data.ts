import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { inDoelgroep, isHQ, isLeiding, scopeVestigingen, teamVan } from "./access";
import { getDb } from "./db/client";
import * as t from "./db/schema";
import type { Org } from "./org";
import type {
  AuditRegel, Bericht, Beoordeling, ChatBericht, ChatGroep, Document, Gebruiker, HandboekDoc, LeerItem, LeerVoortgang, LeesStatus, Reactie, RuilVerzoek, Salarisgegevens,
} from "./types";

// Leesfuncties. Alles wat persoonsgebonden is, wordt gefilterd op wat de gebruiker mag zien.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : undefined);

export const DISCIPLINE_LABEL = { operations: "Operations", marketing: "Marketing", hr: "HR", inkoop: "Inkoop", kwaliteit: "Kwaliteit" } as const;

export const naamVan = (org: Org, id: string) => {
  const g = org.gebruikers.find((x) => x.id === id);
  return g ? `${g.voornaam} ${g.achternaam}` : "Onbekend";
};
export const voornaamVan = (org: Org, id: string) => org.gebruikers.find((x) => x.id === id)?.voornaam ?? "Onbekend";
export const vestigingNaam = (org: Org, id: string) => org.vestigingen.find((v) => v.id === id)?.naam ?? id;
export const functieVan = (org: Org, u: Gebruiker) => org.functies.find((f) => f.id === u.functieId);

export function afzenderLabel(b: Bericht) {
  return b.afzender.type === "hq" ? `HQ ${DISCIPLINE_LABEL[b.afzender.discipline]}` : b.afzender.naam;
}

// ---------- Berichten ----------

type BerichtRij = typeof t.bericht.$inferSelect;
function naarBericht(r: BerichtRij): Bericht {
  return {
    id: r.id, titel: r.titel, inhoud: r.inhoud, urgentie: r.urgentie, vastgezet: r.vastgezet, doelgroep: r.doelgroep,
    gepubliceerd: r.gepubliceerd.toISOString(), vervalt: iso(r.vervalt), handboekDocId: r.handboekDocId ?? undefined,
    afzender: r.afzenderType === "hq"
      ? { type: "hq", discipline: r.afzenderDiscipline ?? "operations" }
      : { type: "fn", franchisenemerId: r.afzenderFranchisenemerId ?? "", naam: r.afzenderNaam ?? "Franchisenemer" },
  };
}

export interface BerichtMetStatus extends Bericht { status: LeesStatus }

export const isBevestigd = (b: BerichtMetStatus) => b.urgentie !== "verplicht" || !!b.status.bevestigd;
export const isGelezen = (b: BerichtMetStatus) => !!b.status.gelezen;

/** Berichten voor deze gebruiker, met zijn eigen lees-/bevestigstatus. Vastgezet en onbevestigd bovenaan. */
export async function berichtenVoor(org: Org, u: Gebruiker, limiet = 200): Promise<BerichtMetStatus[]> {
  const db = await getDb();
  const rijen = await db.select().from(t.bericht).orderBy(desc(t.bericht.gepubliceerd)).limit(limiet);
  const nu = Date.now();
  const zichtbaar = rijen.map(naarBericht).filter((b) => inDoelgroep(org, u, b.doelgroep) && (!b.vervalt || Date.parse(b.vervalt) > nu));
  const st = zichtbaar.length
    ? await db.select().from(t.berichtStatus).where(and(eq(t.berichtStatus.gebruikerId, u.id), inArray(t.berichtStatus.berichtId, zichtbaar.map((b) => b.id))))
    : [];
  const per = new Map(st.map((s) => [s.berichtId, { gelezen: iso(s.gelezen), bevestigd: iso(s.bevestigd) }]));
  const lijst = zichtbaar.map((b) => ({ ...b, status: per.get(b.id) ?? {} }));
  const open = (b: BerichtMetStatus) => Number(b.vastgezet && !isBevestigd(b));
  return lijst.sort((a, b) => open(b) - open(a) || b.gepubliceerd.localeCompare(a.gepubliceerd));
}

export async function bericht(id: string): Promise<Bericht | undefined> {
  const db = await getDb();
  const [r] = await db.select().from(t.bericht).where(eq(t.bericht.id, id));
  return r ? naarBericht(r) : undefined;
}

export async function leesStatus(berichtId: string, gebruikerId: string): Promise<LeesStatus> {
  const db = await getDb();
  const [s] = await db.select().from(t.berichtStatus).where(and(eq(t.berichtStatus.berichtId, berichtId), eq(t.berichtStatus.gebruikerId, gebruikerId)));
  return s ? { gelezen: iso(s.gelezen), bevestigd: iso(s.bevestigd) } : {};
}

/** Alle statussen van één bericht (voor bereik in beheer). */
export async function statussenVan(berichtIds: string[]) {
  if (!berichtIds.length) return [];
  const db = await getDb();
  return db.select().from(t.berichtStatus).where(inArray(t.berichtStatus.berichtId, berichtIds));
}

export async function alleBerichten(limiet = 50): Promise<Bericht[]> {
  const db = await getDb();
  return (await db.select().from(t.bericht).orderBy(desc(t.bericht.gepubliceerd)).limit(limiet)).map(naarBericht);
}

export async function reactiesVan(berichtId: string): Promise<Reactie[]> {
  const db = await getDb();
  return (await db.select().from(t.reactie).where(eq(t.reactie.berichtId, berichtId)).orderBy(asc(t.reactie.tijd)))
    .map((r) => ({ ...r, tijd: r.tijd.toISOString() }));
}

// ---------- Leren ----------

type LeerRij = typeof t.leerItem.$inferSelect;
const naarLeerItem = (l: LeerRij): LeerItem => ({
  ...l, volgorde: l.volgorde ?? undefined, quiz: l.quiz ?? undefined, handboekDocId: l.handboekDocId ?? undefined, profielItemId: l.profielItemId ?? undefined,
});
type VoortgangRij = typeof t.leerVoortgang.$inferSelect;
const naarVoortgang = (v: VoortgangRij): LeerVoortgang => ({
  ...v, inzending: v.inzending ?? undefined, feedback: v.feedback ?? undefined, beoordeeldDoor: v.beoordeeldDoor ?? undefined, tijd: v.tijd.toISOString(),
});

export async function leerItemsVoor(u: Gebruiker): Promise<LeerItem[]> {
  const db = await getDb();
  const alle = (await db.select().from(t.leerItem)).map(naarLeerItem);
  return alle
    .filter((i) => !i.functieIds.length || (u.functieId && i.functieIds.includes(u.functieId)))
    .sort((a, b) => (a.volgorde ?? 99) - (b.volgorde ?? 99));
}

export async function voortgangVan(gebruikerId: string): Promise<Map<string, LeerVoortgang>> {
  const db = await getDb();
  const rijen = await db.select().from(t.leerVoortgang).where(eq(t.leerVoortgang.gebruikerId, gebruikerId));
  return new Map(rijen.map((v) => [v.itemId, naarVoortgang(v)]));
}

export async function inzendingenVan(gebruikerIds: string[]): Promise<LeerVoortgang[]> {
  if (!gebruikerIds.length) return [];
  const db = await getDb();
  return (await db.select().from(t.leerVoortgang).where(and(eq(t.leerVoortgang.status, "ingediend"), inArray(t.leerVoortgang.gebruikerId, gebruikerIds))))
    .map(naarVoortgang);
}

export async function feedbackVoor(gebruikerId: string): Promise<LeerVoortgang[]> {
  return [...(await voortgangVan(gebruikerId)).values()].filter((v) => v.beoordeeldDoor);
}

export async function leerItem(id: string): Promise<LeerItem | undefined> {
  const db = await getDb();
  const [l] = await db.select().from(t.leerItem).where(eq(t.leerItem.id, id));
  return l ? naarLeerItem(l) : undefined;
}

export async function onboarding(u: Gebruiker, items?: LeerItem[], vg?: Map<string, LeerVoortgang>) {
  const lijst = (items ?? (await leerItemsVoor(u))).filter((i) => i.onboarding);
  const voortgang = vg ?? (await voortgangVan(u.id));
  const klaar = lijst.filter((i) => voortgang.get(i.id)?.status === "afgerond").length;
  return { items: lijst, klaar, totaal: lijst.length, pct: lijst.length ? Math.round((klaar / lijst.length) * 100) : 100 };
}

// ---------- Handboek ----------

type DocRij = typeof t.handboekDoc.$inferSelect;
const naarDoc = (d: DocRij): HandboekDoc => ({ ...d, bijgewerkt: d.bijgewerkt.toISOString(), reviewVoor: d.reviewVoor.toISOString() });

export async function handboekVoor(org: Org, u: Gebruiker): Promise<HandboekDoc[]> {
  const db = await getDb();
  return (await db.select().from(t.handboekDoc)).map(naarDoc).filter((d) => inDoelgroep(org, u, d.doelgroep));
}

export async function alleHandboekDocs(): Promise<HandboekDoc[]> {
  const db = await getDb();
  return (await db.select().from(t.handboekDoc)).map(naarDoc);
}

// ---------- Chat & ruilen ----------

export async function chatGroepenVoor(org: Org, u: Gebruiker): Promise<ChatGroep[]> {
  const db = await getDb();
  const vest = new Set(scopeVestigingen(org, u));
  const alle = (await db.select().from(t.chatGroep)).map((g) => ({ ...g, vestigingId: g.vestigingId ?? undefined, franchisenemerId: g.franchisenemerId ?? undefined }));
  return alle.filter((gr) => {
    if (gr.type === "hq-kanaal") return true;
    if (isHQ(u)) return gr.type !== "vestiging";
    if (gr.type === "vestiging") return !!gr.vestigingId && vest.has(gr.vestigingId);
    if (gr.type === "franchisenemer") return gr.franchisenemerId === u.franchisenemerId;
    if (gr.type === "shiftleiders") return u.rol === "shiftleider" || isLeiding(u);
    return false;
  });
}

/** Leden worden afgeleid uit de organisatie (die uit HorecaManager komt): nooit handmatig beheren. */
export function ledenVan(org: Org, gr: ChatGroep): Gebruiker[] {
  return org.gebruikers.filter((u) => {
    if (gr.type === "vestiging") return u.rol !== "hq" && !!gr.vestigingId && (u.vestigingIds.includes(gr.vestigingId) || (u.rol === "franchisenemer" && scopeVestigingen(org, u).includes(gr.vestigingId)));
    if (gr.type === "franchisenemer") return u.franchisenemerId === gr.franchisenemerId;
    if (gr.type === "shiftleiders") return u.rol === "shiftleider" || isLeiding(u);
    return true;
  });
}

const naarChat = (c: typeof t.chatBericht.$inferSelect): ChatBericht => ({ ...c, tijd: c.tijd.toISOString(), ruilDienstId: c.ruilDienstId ?? undefined });

export async function chatVan(groepId: string, limiet = 200): Promise<ChatBericht[]> {
  const db = await getDb();
  const rijen = await db.select().from(t.chatBericht).where(eq(t.chatBericht.groepId, groepId)).orderBy(desc(t.chatBericht.tijd)).limit(limiet);
  return rijen.reverse().map(naarChat);
}

export async function laatsteChats(groepIds: string[]): Promise<Map<string, ChatBericht>> {
  if (!groepIds.length) return new Map();
  const db = await getDb();
  const rijen = await db.selectDistinctOn([t.chatBericht.groepId]).from(t.chatBericht)
    .where(inArray(t.chatBericht.groepId, groepIds)).orderBy(t.chatBericht.groepId, desc(t.chatBericht.tijd));
  return new Map(rijen.map((r) => [r.groepId, naarChat(r)]));
}

const naarRuil = (r: typeof t.ruilverzoek.$inferSelect): RuilVerzoek => ({ id: r.id, dienstId: r.dienstId, aangebodenDoor: r.aangebodenDoor, overgenomenDoor: r.overgenomenDoor ?? undefined, status: r.status });

export async function ruilverzoeken(): Promise<RuilVerzoek[]> {
  const db = await getDb();
  return (await db.select().from(t.ruilverzoek)).map(naarRuil);
}

// ---------- Documenten ----------

export async function documentenVan(gebruikerId: string): Promise<Document[]> {
  const db = await getDb();
  return (await db.select().from(t.document).where(eq(t.document.gebruikerId, gebruikerId))).map((d) => ({ ...d, datum: d.datum.toISOString() }));
}

export async function isOntgrendeld(gebruikerId: string): Promise<boolean> {
  const db = await getDb();
  const [o] = await db.select().from(t.ontgrendeling).where(eq(t.ontgrendeling.gebruikerId, gebruikerId));
  return !!o && o.tot.getTime() > Date.now();
}

// ---------- Functiehuis & beoordelen ----------

export async function beoordelingen(filter?: { gebruikerIds?: string[]; beoordelaarId?: string }): Promise<Beoordeling[]> {
  const db = await getDb();
  const voorwaarden = [];
  if (filter?.gebruikerIds) {
    if (!filter.gebruikerIds.length) return [];
    voorwaarden.push(inArray(t.beoordeling.gebruikerId, filter.gebruikerIds));
  }
  if (filter?.beoordelaarId) voorwaarden.push(eq(t.beoordeling.beoordelaarId, filter.beoordelaarId));
  const rijen = await db.select().from(t.beoordeling).where(voorwaarden.length ? and(...voorwaarden) : undefined).orderBy(desc(t.beoordeling.periode));
  if (!rijen.length) return [];
  const scores = await db.select().from(t.beoordelingScore).where(inArray(t.beoordelingScore.beoordelingId, rijen.map((r) => r.id)));
  return rijen.map((r) => {
    const eigen = scores.filter((s) => s.beoordelingId === r.id);
    const per = (bron: "zelf" | "beoordelaar") => Object.fromEntries(eigen.filter((s) => s.bron === bron).map((s) => [s.itemId, s.niveau]));
    return {
      id: r.id, gebruikerId: r.gebruikerId, functieId: r.functieId, beoordelaarId: r.beoordelaarId, periode: r.periode, status: r.status,
      toelichting: r.toelichting ?? undefined, zelf: per("zelf"), beoordelaar: per("beoordelaar"), bijgewerkt: r.bijgewerkt.toISOString(),
      besluit: r.besluitPercentage !== null && r.besluitUurloon !== null && r.besluitDoor && r.besluitTijd
        ? { percentage: r.besluitPercentage, nieuwUurloon: r.besluitUurloon, door: r.besluitDoor, tijd: r.besluitTijd.toISOString(), toelichting: r.besluitToelichting ?? "" }
        : undefined,
    };
  });
}

export async function huidigNiveau(gebruikerId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rijen = await db.select().from(t.medewerkerNiveau).where(eq(t.medewerkerNiveau.gebruikerId, gebruikerId));
  return Object.fromEntries(rijen.map((r) => [r.itemId, r.niveau]));
}

export async function salarisVan(gebruikerId: string): Promise<Salarisgegevens | undefined> {
  const db = await getDb();
  const [s] = await db.select().from(t.salaris).where(eq(t.salaris.gebruikerId, gebruikerId));
  return s;
}

export async function auditLog(limiet = 200): Promise<AuditRegel[]> {
  const db = await getDb();
  return (await db.select().from(t.auditLog).orderBy(desc(t.auditLog.tijd)).limit(limiet)).map((a) => ({ ...a, tijd: a.tijd.toISOString(), details: a.details ?? undefined }));
}

// ---------- Te doen ----------

export interface TeDoe { id: string; titel: string; sub: string; href: string; urgent?: boolean; pct?: number; soort: "bericht" | "leren" | "beoordelen" | "ruil" | "zelfbeoordeling" }

/** Wat moet deze gebruiker nu doen? Basis voor "Te doen", de badge en het meldingencentrum. */
export async function teDoen(org: Org, u: Gebruiker): Promise<TeDoe[]> {
  const lijst: TeDoe[] = [];
  const [berichten, ob, eigen] = await Promise.all([berichtenVoor(org, u), u.functieId ? onboarding(u) : null, beoordelingen({ gebruikerIds: [u.id] })]);
  for (const b of berichten) {
    if (!isBevestigd(b)) lijst.push({ id: `b-${b.id}`, titel: b.titel, sub: "Verplicht · lezen en bevestigen", href: `/app/berichten/${b.id}`, urgent: true, soort: "bericht" });
  }
  if (ob && ob.klaar < ob.totaal) lijst.push({ id: "onboarding", titel: "Onboarding", sub: `${ob.klaar} van ${ob.totaal} klaar`, href: "/app/leren", pct: ob.pct, soort: "leren" });
  const zelf = eigen.find((b) => b.status === "zelfbeoordeling");
  if (zelf) lijst.push({ id: "zelf", titel: "Zelfbeoordeling invullen", sub: `Beoordeling ${zelf.periode}`, href: "/app/werk/functie/zelfbeoordeling", soort: "zelfbeoordeling" });

  if (isLeiding(u)) {
    const team = teamVan(org, u).map((x) => x.id);
    const [inz, mijnBeo, ruil] = await Promise.all([inzendingenVan(team), beoordelingen({ beoordelaarId: u.id }), ruilverzoeken()]);
    if (inz.length) lijst.push({ id: "beoordelen-leren", titel: `${inz.length} inzending${inz.length > 1 ? "en" : ""} beoordelen`, sub: "Challenges van je team", href: "/app/team/inzendingen", soort: "beoordelen" });
    const open = mijnBeo.filter((b) => b.status === "beoordelen").length;
    if (open) lijst.push({ id: "beoordelingen", titel: `${open} beoordeling${open > 1 ? "en" : ""} afronden`, sub: "Functiehuis · ronde 2026", href: "/app/team", soort: "beoordelen" });
    const teamSet = new Set(team);
    const wacht = ruil.filter((r) => r.status === "wacht-op-akkoord" && teamSet.has(r.aangebodenDoor)).length;
    if (wacht) lijst.push({ id: "ruil", titel: `${wacht} ruilverzoek${wacht > 1 ? "en" : ""} goedkeuren`, sub: "Diensten", href: "/app/team", soort: "ruil" });
  }
  return lijst;
}

export function verjaardagenBinnenkort(org: Org, u: Gebruiker, dagen = 7) {
  const vest = new Set(u.vestigingIds);
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  return org.gebruikers
    .filter((g) => g.toonVerjaardag && g.verjaardag && g.vestigingIds.some((v) => vest.has(v)))
    .map((g) => {
      const [m, d] = g.verjaardag!.split("-").map(Number);
      let dt = new Date(nu.getFullYear(), m - 1, d);
      if (dt < vandaag) dt = new Date(nu.getFullYear() + 1, m - 1, d);
      return { g, dt };
    })
    .filter(({ dt }) => dt.getTime() - vandaag.getTime() < dagen * 86400000)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime());
}

/** Openen = gelezen. Bevestigen is een aparte, bewuste actie. */
export async function markeerGelezen(berichtId: string, gebruikerId: string) {
  const db = await getDb();
  await db.insert(t.berichtStatus).values({ berichtId, gebruikerId, gelezen: new Date() }).onConflictDoNothing();
}

export async function alleLeerItems(): Promise<LeerItem[]> {
  const db = await getDb();
  return (await db.select().from(t.leerItem)).map(naarLeerItem);
}

/** Voortgang van meerdere medewerkers in één query (dashboards). */
export async function voortgangVanMeerdere(gebruikerIds: string[]): Promise<LeerVoortgang[]> {
  if (!gebruikerIds.length) return [];
  const db = await getDb();
  return (await db.select().from(t.leerVoortgang).where(inArray(t.leerVoortgang.gebruikerId, gebruikerIds))).map(naarVoortgang);
}
