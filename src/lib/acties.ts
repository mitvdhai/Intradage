"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { inDoelgroep, isHQ, isLeiding, mag, magMedewerkerZien, scopeVestigingen } from "./access";
import { audit } from "./audit";
import { beoordelingen, bericht as leesBericht, chatGroepenVoor, handboekVoor, leerItem, salarisVan } from "./data";
import { getDb } from "./db/client";
import * as t from "./db/schema";
import { berekenUitslag, salarisAdvies, valideerFunctie } from "./functiehuis/score";
import { beantwoord, type Antwoord } from "./handboek/assistent";
import { getOrg } from "./org";
import { SESSIE_COOKIE, vereisGebruiker } from "./session";
import { staff } from "./staff/adapter";
import type { Doelgroep, Rol, Uitkomst, Urgentie } from "./types";

// Alle schrijfacties. Elke actie: wie ben je → mag dit → schrijven → logboek waar relevant.

const id = (p: string) => `${p}-${crypto.randomUUID().slice(0, 12)}`;
const tekst = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const getal = (f: FormData, k: string) => Number(String(f.get(k) ?? "").replace(",", "."));

// ---------- Sessie ----------

export async function kiesPersona(_: unknown, formData: FormData): Promise<{ fout?: string }> {
  const wachtwoord = process.env.DEMO_WACHTWOORD;
  if (wachtwoord && tekst(formData, "wachtwoord") !== wachtwoord) return { fout: "Onjuist wachtwoord." };
  const org = await getOrg();
  const g = org.gebruikers.find((x) => x.id === tekst(formData, "id"));
  if (!g) return { fout: "Kies een persoon." };
  (await cookies()).set(SESSIE_COOKIE, g.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(g.rol === "hq" ? "/beheer" : "/app");
}

export async function uitloggen() {
  (await cookies()).delete(SESSIE_COOKIE);
  redirect("/");
}

// ---------- Berichten ----------

export async function bevestigBericht(berichtId: string) {
  const { u, org } = await vereisGebruiker();
  const b = await leesBericht(berichtId);
  if (!b || !inDoelgroep(org, u, b.doelgroep)) return;
  const db = await getDb();
  const nu = new Date();
  await db.insert(t.berichtStatus).values({ berichtId, gebruikerId: u.id, gelezen: nu, bevestigd: nu })
    .onConflictDoUpdate({ target: [t.berichtStatus.berichtId, t.berichtStatus.gebruikerId], set: { bevestigd: nu } });
  revalidatePath("/app", "layout");
}

export async function reageer(berichtId: string, formData: FormData) {
  const { u, org } = await vereisGebruiker();
  const t2 = tekst(formData, "tekst");
  const b = await leesBericht(berichtId);
  if (!t2 || !b || !inDoelgroep(org, u, b.doelgroep)) return;
  const db = await getDb();
  await db.insert(t.reactie).values({ id: id("r"), berichtId, gebruikerId: u.id, tekst: t2.slice(0, 500) });
  revalidatePath(`/app/berichten/${berichtId}`);
}

export async function verstuurBericht(_: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "berichten")) return { fout: "Geen rechten om berichten te versturen." };
  const titel = tekst(formData, "titel");
  const inhoud = tekst(formData, "inhoud");
  if (!titel || !inhoud) return { fout: "Vul een titel en tekst in." };
  const lijst = (k: string) => formData.getAll(k).map(String).filter(Boolean);
  const doelgroep: Doelgroep = { rollen: lijst("rollen") as Rol[], functieIds: lijst("functieIds"), vestigingIds: lijst("vestigingIds") };
  if (!isHQ(u)) {
    const scope = scopeVestigingen(org, u);
    doelgroep.vestigingIds = doelgroep.vestigingIds?.length ? doelgroep.vestigingIds.filter((v) => scope.includes(v)) : scope;
  }
  const urgentie = (["info", "belangrijk", "verplicht"].includes(tekst(formData, "urgentie")) ? tekst(formData, "urgentie") : "info") as Urgentie;
  const db = await getDb();
  await db.insert(t.bericht).values({
    id: id("b"), titel, inhoud, urgentie, vastgezet: urgentie === "verplicht", doelgroep,
    afzenderType: isHQ(u) ? "hq" : "fn",
    afzenderDiscipline: isHQ(u) ? (u.discipline ?? "operations") : null,
    afzenderFranchisenemerId: isHQ(u) ? null : u.franchisenemerId,
    afzenderNaam: isHQ(u) ? null : `${u.voornaam} (franchisenemer)`,
  });
  await audit(u.id, "Bericht verstuurd", titel);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Chat & diensten ----------

export async function stuurChat(groepId: string, formData: FormData) {
  const { u, org } = await vereisGebruiker();
  const t2 = tekst(formData, "tekst");
  const gr = (await chatGroepenVoor(org, u)).find((x) => x.id === groepId);
  if (!t2 || !gr || (gr.alleenLezen && !isHQ(u))) return;
  const db = await getDb();
  await db.insert(t.chatBericht).values({ id: id("c"), groepId, gebruikerId: u.id, tekst: t2.slice(0, 1000) });
  revalidatePath(`/app/chat/${groepId}`);
}

export async function biedDienstAan(dienstId: string) {
  const { u } = await vereisGebruiker();
  const dienst = (await staff.rooster(u, new Date(), new Date(Date.now() + 30 * 86400000))).find((d) => d.id === dienstId);
  if (!dienst) return;
  const db = await getDb();
  const bestaand = await db.select().from(t.ruilverzoek).where(and(eq(t.ruilverzoek.dienstId, dienstId), ne(t.ruilverzoek.status, "afgewezen")));
  if (bestaand.length) return;
  await db.insert(t.ruilverzoek).values({ id: id("rv"), dienstId, aangebodenDoor: u.id });
  const [groep] = await db.select().from(t.chatGroep).where(and(eq(t.chatGroep.type, "vestiging"), eq(t.chatGroep.vestigingId, dienst.vestigingId)));
  if (groep) await db.insert(t.chatBericht).values({ id: id("c"), groepId: groep.id, gebruikerId: u.id, tekst: "Wie kan deze dienst van mij overnemen?", ruilDienstId: dienstId });
  await audit(u.id, "Dienst aangeboden", dienstId);
  revalidatePath("/app", "layout");
}

export async function neemDienstOver(ruilId: string) {
  const { u, org } = await vereisGebruiker();
  const db = await getDb();
  const [r] = await db.select().from(t.ruilverzoek).where(eq(t.ruilverzoek.id, ruilId));
  if (!r || r.status !== "open" || r.aangebodenDoor === u.id) return;
  const aanbieder = org.gebruikers.find((g) => g.id === r.aangebodenDoor);
  if (!aanbieder || aanbieder.functieId !== u.functieId) return; // alleen dezelfde functie
  // Voorwaardelijke update: wie het eerst komt, het eerst maalt
  await db.update(t.ruilverzoek).set({ overgenomenDoor: u.id, status: "wacht-op-akkoord" }).where(and(eq(t.ruilverzoek.id, ruilId), eq(t.ruilverzoek.status, "open")));
  await audit(u.id, "Dienst overname aangevraagd", r.dienstId);
  revalidatePath("/app", "layout");
}

export async function beslisRuil(ruilId: string, akkoord: boolean) {
  const { u, org } = await vereisGebruiker();
  const db = await getDb();
  const [r] = await db.select().from(t.ruilverzoek).where(eq(t.ruilverzoek.id, ruilId));
  if (!r || r.status !== "wacht-op-akkoord" || !(isLeiding(u) || mag(org, u, "planning")) || !magMedewerkerZien(org, u, r.aangebodenDoor)) return;
  await db.update(t.ruilverzoek).set({ status: akkoord ? "goedgekeurd" : "afgewezen" }).where(eq(t.ruilverzoek.id, ruilId));
  // De ruil direct in het rooster verwerken
  if (akkoord && r.overgenomenDoor) await db.update(t.dienst).set({ gebruikerId: r.overgenomenDoor }).where(and(eq(t.dienst.id, r.dienstId), eq(t.dienst.gebruikerId, r.aangebodenDoor)));
  await audit(u.id, akkoord ? "Ruil goedgekeurd" : "Ruil afgewezen", `${r.dienstId}${akkoord ? " · rooster bijgewerkt" : ""}`);
  revalidatePath("/app", "layout");
}

// ---------- Leren ----------

type VoortgangWaarden = { status: "gestart" | "ingediend" | "afgerond" | "afgekeurd"; inzending?: string | null; feedback?: string | null; beoordeeldDoor?: string | null };

async function zetVoortgang(gebruikerId: string, itemId: string, waarden: VoortgangWaarden) {
  const db = await getDb();
  const rij = { ...waarden, tijd: new Date() };
  await db.insert(t.leerVoortgang).values({ gebruikerId, itemId, ...rij })
    .onConflictDoUpdate({ target: [t.leerVoortgang.gebruikerId, t.leerVoortgang.itemId], set: rij });
}

export async function rondLeerItemAf(itemId: string) {
  const { u } = await vereisGebruiker();
  const item = await leerItem(itemId);
  if (!item || item.type === "challenge" || item.type === "quiz") return; // die hebben een eigen route
  await zetVoortgang(u.id, itemId, { status: "afgerond" });
  revalidatePath("/app", "layout");
}

export async function beantwoordQuiz(itemId: string, _: unknown, formData: FormData): Promise<{ goed: number; totaal: number }> {
  const { u } = await vereisGebruiker();
  const vragen = (await leerItem(itemId))?.quiz ?? [];
  const goed = vragen.filter((q, i) => Number(formData.get(`q${i}`)) === q.juist).length;
  if (vragen.length && goed === vragen.length) await zetVoortgang(u.id, itemId, { status: "afgerond" });
  revalidatePath("/app", "layout");
  return { goed, totaal: vragen.length };
}

export async function dienChallengeIn(itemId: string, formData: FormData) {
  const { u } = await vereisGebruiker();
  await zetVoortgang(u.id, itemId, { status: "ingediend", inzending: tekst(formData, "inzending") || "Foto ingediend", feedback: null, beoordeeldDoor: null });
  revalidatePath("/app", "layout");
}

export async function beoordeelInzending(gebruikerId: string, itemId: string, formData: FormData) {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "beoordelingen") || !magMedewerkerZien(org, u, gebruikerId)) return;
  const akkoord = formData.get("akkoord") === "ja";
  await zetVoortgang(gebruikerId, itemId, { status: akkoord ? "afgerond" : "afgekeurd", feedback: tekst(formData, "feedback") || null, beoordeeldDoor: u.id });
  revalidatePath("/app", "layout");
}

// ---------- Handboek ----------

export async function vraagHandboek(_: unknown, formData: FormData): Promise<{ vraag: string; antwoord: Antwoord } | null> {
  const { u, org } = await vereisGebruiker();
  const vraag = tekst(formData, "vraag").slice(0, 300);
  if (!vraag) return null;
  const antwoord = await beantwoord(vraag, await handboekVoor(org, u));
  if (antwoord.weetNiet) await audit(u.id, "Handboekvraag zonder antwoord", vraag);
  return { vraag, antwoord };
}

export async function meldFoutAntwoord(vraag: string) {
  const { u } = await vereisGebruiker();
  await audit(u.id, "AI-antwoord gemeld als onjuist", vraag.slice(0, 300));
}

// ---------- Documenten ----------

export async function ontgrendel(_: unknown, formData: FormData): Promise<{ fout?: string }> {
  const { u } = await vereisGebruiker();
  // Demo: code 123456. Productie: eenmalige sms-code naar het nummer uit het personeelsdossier.
  if (tekst(formData, "code") !== "123456") return { fout: "Deze code klopt niet. Probeer het opnieuw." };
  const db = await getDb();
  const tot = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(t.ontgrendeling).values({ gebruikerId: u.id, tot }).onConflictDoUpdate({ target: t.ontgrendeling.gebruikerId, set: { tot } });
  await audit(u.id, "Gevoelige documenten ontgrendeld");
  revalidatePath("/app/werk/documenten");
  return {};
}

// ---------- Functiehuis ----------

function niveausUit(formData: FormData, prefix: string) {
  const uit: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith(prefix)) {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 4) uit[k.slice(prefix.length)] = n;
    }
  }
  return uit;
}

async function schrijfScores(beoordelingId: string, bron: "zelf" | "beoordelaar", niveaus: Record<string, number>, toegestaan: Set<string>) {
  const db = await getDb();
  for (const [itemId, niveau] of Object.entries(niveaus)) {
    if (!toegestaan.has(itemId)) continue;
    await db.insert(t.beoordelingScore).values({ beoordelingId, itemId, bron, niveau })
      .onConflictDoUpdate({ target: [t.beoordelingScore.beoordelingId, t.beoordelingScore.itemId, t.beoordelingScore.bron], set: { niveau } });
  }
}

export async function slaZelfbeoordelingOp(formData: FormData) {
  const { u, org } = await vereisGebruiker();
  const b = (await beoordelingen({ gebruikerIds: [u.id] })).find((x) => x.status === "zelfbeoordeling");
  if (!b) return;
  const functie = org.functies.find((f) => f.id === b.functieId)!;
  await schrijfScores(b.id, "zelf", niveausUit(formData, "n-"), new Set(functie.profiel.map((r) => r.itemId)));
  const db = await getDb();
  await db.update(t.beoordeling).set({ status: "beoordelen", bijgewerkt: new Date() }).where(eq(t.beoordeling.id, b.id));
  await audit(u.id, "Zelfbeoordeling ingediend", b.periode);
  revalidatePath("/app", "layout");
  redirect("/app/werk/functie");
}

export async function startBeoordeling(gebruikerId: string) {
  const { u, org } = await vereisGebruiker();
  const m = org.gebruikers.find((g) => g.id === gebruikerId);
  if (!m?.functieId || u.rol !== "franchisenemer" || !magMedewerkerZien(org, u, gebruikerId)) return;
  const db = await getDb();
  await db.insert(t.beoordeling).values({ id: id("bo"), gebruikerId, functieId: m.functieId, beoordelaarId: u.id, periode: "2026", status: "zelfbeoordeling" }).onConflictDoNothing();
  await audit(u.id, "Beoordelingsronde gestart", gebruikerId);
  revalidatePath("/app", "layout");
}

async function eigenBeoordeling(beoordelingId: string) {
  const { u, org } = await vereisGebruiker();
  const b = (await beoordelingen({ beoordelaarId: u.id })).find((x) => x.id === beoordelingId);
  if (!b || !magMedewerkerZien(org, u, b.gebruikerId)) return null;
  return { u, org, b, functie: org.functies.find((f) => f.id === b.functieId)! };
}

export async function slaBeoordelingOp(beoordelingId: string, formData: FormData) {
  const ctx = await eigenBeoordeling(beoordelingId);
  if (!ctx || ctx.b.status === "besloten" || ctx.b.status === "zelfbeoordeling") return;
  const { u, org, b, functie } = ctx;
  const nieuw = niveausUit(formData, "n-");
  await schrijfScores(b.id, "beoordelaar", nieuw, new Set(functie.profiel.map((r) => r.itemId)));
  const uitslag = berekenUitslag(functie, org.itemMap, { ...b.beoordelaar, ...nieuw }, org.regeling);
  const db = await getDb();
  await db.update(t.beoordeling).set({
    toelichting: tekst(formData, "toelichting") || b.toelichting || null,
    status: formData.get("stap") === "gesprek" && uitslag.compleet ? "gesprek" : b.status,
    bijgewerkt: new Date(),
  }).where(eq(t.beoordeling.id, b.id));
  await audit(u.id, "Beoordeling bijgewerkt", `${b.gebruikerId} · ${uitslag.totaal ?? "onvolledig"}`);
  revalidatePath("/app", "layout");
  revalidatePath("/beheer", "layout");
}

export async function legBesluitVast(beoordelingId: string, _: unknown, formData: FormData): Promise<{ fout?: string }> {
  const ctx = await eigenBeoordeling(beoordelingId);
  if (!ctx || ctx.u.rol !== "franchisenemer") return { fout: "Alleen de franchisenemer (werkgever) legt het besluit vast." };
  const { u, org, b, functie } = ctx;
  if (b.status !== "gesprek") return { fout: "Zet de beoordeling eerst op 'Klaar voor gesprek'." };
  const uitslag = berekenUitslag(functie, org.itemMap, b.beoordelaar, org.regeling);
  const sal = await salarisVan(b.gebruikerId);
  if (!uitslag.compleet || !uitslag.uitkomst || !sal) return { fout: "De beoordeling is nog niet volledig." };
  const toelichting = tekst(formData, "toelichting");
  const percentage = getal(formData, "percentage");
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 15) return { fout: "Vul een percentage tussen 0 en 15 in." };
  const advies = salarisAdvies(uitslag.uitkomst, sal, org.regeling);
  if (percentage !== advies.percentage && toelichting.length < 10) return { fout: "Je wijkt af van het advies. Licht je besluit kort toe (minimaal 10 tekens)." };
  const basis = Math.max(sal.uurloon, sal.schaalMin);
  const nieuw = Math.round(Math.min(basis * (1 + percentage / 100), Math.max(sal.schaalMax, basis)) * 100) / 100;

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.update(t.beoordeling).set({
      status: "besloten", besluitPercentage: percentage, besluitUurloon: nieuw, besluitDoor: u.id, besluitTijd: new Date(), besluitToelichting: toelichting, bijgewerkt: new Date(),
    }).where(eq(t.beoordeling.id, b.id));
    for (const [itemId, niveau] of Object.entries(b.beoordelaar)) {
      await tx.insert(t.medewerkerNiveau).values({ gebruikerId: b.gebruikerId, itemId, niveau })
        .onConflictDoUpdate({ target: [t.medewerkerNiveau.gebruikerId, t.medewerkerNiveau.itemId], set: { niveau, bijgewerkt: new Date() } });
    }
  });
  await audit(u.id, "Salarisbesluit vastgelegd", `${b.gebruikerId}: ${percentage}% → € ${nieuw.toFixed(2)} (advies ${advies.percentage}%) · nieuw contract opstellen en doorzetten naar de loonadministratie`);
  revalidatePath("/app", "layout");
  revalidatePath("/beheer", "layout");
  return {};
}

export async function slaFunctieprofielOp(functieId: string, _: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "functiehuis")) return { fout: "Je hebt geen rechten om het functiehuis te wijzigen." };
  const f = org.functies.find((x) => x.id === functieId);
  if (!f) return { fout: "Functie niet gevonden." };
  const kandidaat = structuredClone(f);
  for (const r of kandidaat.profiel) {
    const w = getal(formData, `w-${r.itemId}`);
    const n = getal(formData, `r-${r.itemId}`);
    if (Number.isInteger(w)) r.weging = w;
    if (n >= 1 && n <= 4) r.vereistNiveau = n as 1 | 2 | 3 | 4;
  }
  const fouten = valideerFunctie(kandidaat);
  if (fouten.length) return { fout: fouten.join(" ") };
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const r of kandidaat.profiel) {
      await tx.update(t.functieProfiel).set({ weging: r.weging, vereistNiveau: r.vereistNiveau })
        .where(and(eq(t.functieProfiel.functieId, f.id), eq(t.functieProfiel.itemId, r.itemId)));
    }
  });
  await audit(u.id, "Functieprofiel gewijzigd", f.naam);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function slaRegelingOp(_: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "regeling")) return { fout: "Je hebt geen rechten om de beloningsregeling te wijzigen." };
  const r = structuredClone(org.regeling);
  for (const b of r.banden) {
    const vanaf = getal(formData, `vanaf-${b.uitkomst}`);
    const pct = getal(formData, `pct-${b.uitkomst}`);
    if (!Number.isFinite(vanaf) || !Number.isFinite(pct) || pct < 0 || pct > 15) return { fout: "Controleer de getallen." };
    b.vanaf = vanaf;
    r.verhoging[b.uitkomst as Uitkomst] = pct;
  }
  const opl = r.banden.map((b) => b.vanaf);
  if (opl.some((v, i) => i > 0 && v <= opl[i - 1])) return { fout: "De ondergrenzen moeten oplopen." };
  const db = await getDb();
  await db.update(t.beloningsregeling).set({ banden: r.banden, verhoging: r.verhoging, gewijzigd: new Date() }).where(eq(t.beloningsregeling.versie, r.versie));
  await audit(u.id, "Beloningsregeling gewijzigd", r.versie);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Demo ----------

export async function herstelDemodata() {
  const { u } = await vereisGebruiker();
  if (!isHQ(u)) return;
  const db = await getDb();
  const { leegmaken, seed } = await import("./db/seed");
  await db.transaction(async (tx) => {
    await leegmaken(tx as unknown as typeof db);
    await seed(tx as unknown as typeof db);
  });
  revalidatePath("/", "layout");
  redirect("/");
}
