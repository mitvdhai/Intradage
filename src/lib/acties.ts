"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inDoelgroep, isHQ, isLeiding, magBeheer, magMedewerkerZien, scopeVestigingen } from "./access";
import { berekenUitslag, salarisAdvies, valideerFunctie } from "./functiehuis/score";
import { beantwoord, type Antwoord } from "./handboek/assistent";
import { chatGroepenVoor, handboekVoor } from "./data";
import { SESSIE_COOKIE, vereisGebruiker } from "./session";
import { audit, db, profielItemMap, staff } from "./store";
import type { Doelgroep, Rol, Uitkomst, Urgentie } from "./types";

const nu = () => new Date().toISOString();
const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const tekst = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- Sessie ----------

export async function kiesPersona(formData: FormData) {
  const gid = tekst(formData, "id");
  const g = db.gebruikers.find((x) => x.id === gid);
  if (!g) return;
  (await cookies()).set(SESSIE_COOKIE, g.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(g.rol === "hq" ? "/beheer" : "/app");
}

export async function uitloggen() {
  (await cookies()).delete(SESSIE_COOKIE);
  redirect("/");
}

// ---------- Berichten ----------

export async function bevestigBericht(berichtId: string) {
  const u = await vereisGebruiker();
  const b = db.berichten.find((x) => x.id === berichtId);
  if (!b || !inDoelgroep(u, b.doelgroep)) return;
  db.leesstatus[berichtId] ??= {};
  const s = (db.leesstatus[berichtId][u.id] ??= {});
  s.gelezen ??= nu();
  s.bevestigd = nu();
  revalidatePath("/app", "layout");
}

export async function reageer(berichtId: string, formData: FormData) {
  const u = await vereisGebruiker();
  const t = tekst(formData, "tekst");
  const b = db.berichten.find((x) => x.id === berichtId);
  if (!t || !b || !inDoelgroep(u, b.doelgroep)) return;
  db.reacties.push({ id: id("r"), berichtId, gebruikerId: u.id, tekst: t.slice(0, 500), tijd: nu() });
  revalidatePath(`/app/berichten/${berichtId}`);
}

export async function verstuurBericht(_: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const u = await vereisGebruiker();
  if (!magBeheer(u)) return { fout: "Geen rechten om berichten te versturen." };
  const titel = tekst(formData, "titel");
  const inhoud = tekst(formData, "inhoud");
  if (!titel || !inhoud) return { fout: "Vul een titel en tekst in." };
  const lijst = (k: string) => formData.getAll(k).map(String).filter(Boolean);
  const doelgroep: Doelgroep = {
    rollen: lijst("rollen") as Rol[],
    functieIds: lijst("functieIds"),
    vestigingIds: lijst("vestigingIds"),
  };
  // FN mag alleen naar eigen vestigingen sturen
  if (!isHQ(u)) {
    const scope = scopeVestigingen(u);
    doelgroep.vestigingIds = doelgroep.vestigingIds?.length ? doelgroep.vestigingIds.filter((v) => scope.includes(v)) : scope;
  }
  const urgentie = (tekst(formData, "urgentie") || "info") as Urgentie;
  db.berichten.unshift({
    id: id("b"),
    titel,
    inhoud,
    urgentie,
    vastgezet: urgentie === "verplicht",
    afzender: isHQ(u) ? { type: "hq", discipline: u.discipline ?? "operations" } : { type: "fn", franchisenemerId: u.franchisenemerId!, naam: `${u.voornaam} (franchisenemer)` },
    doelgroep,
    gepubliceerd: nu(),
  });
  audit(u.id, "Bericht verstuurd", titel);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Chat & diensten ----------

export async function stuurChat(groepId: string, formData: FormData) {
  const u = await vereisGebruiker();
  const t = tekst(formData, "tekst");
  const gr = chatGroepenVoor(u).find((x) => x.id === groepId);
  if (!t || !gr || (gr.alleenLezen && !isHQ(u))) return;
  db.chatBerichten.push({ id: id("c"), groepId, gebruikerId: u.id, tekst: t.slice(0, 1000), tijd: nu() });
  revalidatePath(`/app/chat/${groepId}`);
}

export async function neemDienstOver(ruilId: string) {
  const u = await vereisGebruiker();
  const r = db.ruilverzoeken.find((x) => x.id === ruilId);
  if (!r || r.status !== "open" || r.aangebodenDoor === u.id) return;
  const aanbieder = db.gebruikers.find((g) => g.id === r.aangebodenDoor);
  if (!aanbieder || aanbieder.functieId !== u.functieId) return; // alleen dezelfde functie
  r.overgenomenDoor = u.id;
  r.status = "wacht-op-akkoord";
  audit(u.id, "Dienst overname aangevraagd", r.dienstId);
  revalidatePath("/app", "layout");
}

export async function beslisRuil(ruilId: string, akkoord: boolean) {
  const u = await vereisGebruiker();
  const r = db.ruilverzoeken.find((x) => x.id === ruilId);
  if (!r || !isLeiding(u) || !magMedewerkerZien(u, r.aangebodenDoor)) return;
  r.status = akkoord ? "goedgekeurd" : "afgewezen";
  audit(u.id, akkoord ? "Ruil goedgekeurd" : "Ruil afgewezen", `${r.dienstId} · verwerken in HorecaManager`);
  revalidatePath("/app", "layout");
}

// ---------- Leren ----------

function zetVoortgang(gebruikerId: string, itemId: string, patch: Partial<(typeof db.voortgang)[number]>) {
  let v = db.voortgang.find((x) => x.gebruikerId === gebruikerId && x.itemId === itemId);
  if (!v) {
    v = { gebruikerId, itemId, status: "gestart", tijd: nu() };
    db.voortgang.push(v);
  }
  Object.assign(v, patch, { tijd: nu() });
}

export async function rondLeerItemAf(itemId: string) {
  const u = await vereisGebruiker();
  zetVoortgang(u.id, itemId, { status: "afgerond" });
  revalidatePath("/app", "layout");
}

export async function beantwoordQuiz(itemId: string, _: unknown, formData: FormData): Promise<{ goed: number; totaal: number }> {
  const u = await vereisGebruiker();
  const item = db.leeritems.find((i) => i.id === itemId);
  const vragen = item?.quiz ?? [];
  const goed = vragen.filter((q, i) => Number(formData.get(`q${i}`)) === q.juist).length;
  if (goed === vragen.length) zetVoortgang(u.id, itemId, { status: "afgerond" });
  revalidatePath("/app", "layout");
  return { goed, totaal: vragen.length };
}

export async function dienChallengeIn(itemId: string, formData: FormData) {
  const u = await vereisGebruiker();
  const t = tekst(formData, "inzending") || "Foto ingediend";
  zetVoortgang(u.id, itemId, { status: "ingediend", inzending: t, feedback: undefined });
  revalidatePath("/app", "layout");
}

export async function beoordeelInzending(gebruikerId: string, itemId: string, formData: FormData) {
  const u = await vereisGebruiker();
  if (!isLeiding(u) || !magMedewerkerZien(u, gebruikerId)) return;
  const akkoord = formData.get("akkoord") === "ja";
  zetVoortgang(gebruikerId, itemId, { status: akkoord ? "afgerond" : "afgekeurd", feedback: tekst(formData, "feedback"), beoordeeldDoor: u.id });
  revalidatePath("/app", "layout");
}

// ---------- Handboek ----------

export async function vraagHandboek(_: unknown, formData: FormData): Promise<{ vraag: string; antwoord: Antwoord } | null> {
  const u = await vereisGebruiker();
  const vraag = tekst(formData, "vraag").slice(0, 300);
  if (!vraag) return null;
  const antwoord = await beantwoord(vraag, handboekVoor(u));
  if (antwoord.weetNiet) audit(u.id, "Handboekvraag zonder antwoord", vraag);
  return { vraag, antwoord };
}

export async function meldFoutAntwoord(vraag: string) {
  const u = await vereisGebruiker();
  audit(u.id, "AI-antwoord gemeld als onjuist", vraag);
}

// ---------- Documenten ----------

export async function ontgrendel(_: unknown, formData: FormData): Promise<{ fout?: string }> {
  const u = await vereisGebruiker();
  // Demo: code 123456. Productie: eenmalige sms-code naar het nummer uit HorecaManager.
  if (tekst(formData, "code") !== "123456") return { fout: "Deze code klopt niet. Probeer het opnieuw." };
  db.ontgrendeld[u.id] = Date.now() + 15 * 60 * 1000;
  audit(u.id, "Gevoelige documenten ontgrendeld");
  revalidatePath("/app/werk/documenten");
  return {};
}

// ---------- Functiehuis ----------

function niveausUit(formData: FormData, prefix: string) {
  const uit: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith(prefix)) {
      const n = Number(v);
      if (n >= 1 && n <= 4) uit[k.slice(prefix.length)] = n;
    }
  }
  return uit;
}

export async function slaZelfbeoordelingOp(formData: FormData) {
  const u = await vereisGebruiker();
  const b = db.beoordelingen.find((x) => x.gebruikerId === u.id && x.status === "zelfbeoordeling");
  if (!b) return;
  b.zelf = niveausUit(formData, "n-");
  b.status = "beoordelen";
  b.bijgewerkt = nu();
  audit(u.id, "Zelfbeoordeling ingediend", b.periode);
  revalidatePath("/app", "layout");
  redirect("/app/werk/functie");
}

export async function slaBeoordelingOp(beoordelingId: string, formData: FormData) {
  const u = await vereisGebruiker();
  const b = db.beoordelingen.find((x) => x.id === beoordelingId);
  if (!b || b.beoordelaarId !== u.id || !magMedewerkerZien(u, b.gebruikerId) || b.status === "besloten") return;
  b.beoordelaar = { ...b.beoordelaar, ...niveausUit(formData, "n-") };
  b.toelichting = tekst(formData, "toelichting") || b.toelichting;
  const functie = db.functies.find((f) => f.id === b.functieId)!;
  const uitslag = berekenUitslag(functie, profielItemMap(), b.beoordelaar, db.regeling);
  if (formData.get("stap") === "gesprek" && uitslag.compleet) b.status = "gesprek";
  b.bijgewerkt = nu();
  audit(u.id, "Beoordeling bijgewerkt", `${b.gebruikerId} · ${uitslag.totaal ?? "onvolledig"}`);
  revalidatePath("/app", "layout");
  revalidatePath("/beheer", "layout");
}

export async function legBesluitVast(beoordelingId: string, _: unknown, formData: FormData): Promise<{ fout?: string }> {
  const u = await vereisGebruiker();
  const b = db.beoordelingen.find((x) => x.id === beoordelingId);
  if (!b || b.beoordelaarId !== u.id || u.rol !== "franchisenemer") return { fout: "Alleen de franchisenemer (werkgever) legt het besluit vast." };
  const functie = db.functies.find((f) => f.id === b.functieId)!;
  const uitslag = berekenUitslag(functie, profielItemMap(), b.beoordelaar, db.regeling);
  const sal = db.salaris.find((s) => s.gebruikerId === b.gebruikerId);
  if (!uitslag.compleet || !uitslag.uitkomst || !sal) return { fout: "De beoordeling is nog niet volledig." };
  const toelichting = tekst(formData, "toelichting");
  const percentage = Number(String(formData.get("percentage") ?? "").replace(",", "."));
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 15) return { fout: "Vul een percentage tussen 0 en 15 in." };
  const advies = salarisAdvies(uitslag.uitkomst, sal, db.regeling);
  if (percentage !== advies.percentage && toelichting.length < 10)
    return { fout: "Je wijkt af van het advies. Licht je besluit kort toe (minimaal 10 tekens)." };
  const nieuw = Math.round(Math.min(Math.max(sal.uurloon, sal.schaalMin) * (1 + percentage / 100), Math.max(sal.schaalMax, sal.uurloon)) * 100) / 100;
  b.besluit = { percentage, nieuwUurloon: nieuw, door: u.id, tijd: nu(), toelichting };
  b.status = "besloten";
  b.bijgewerkt = nu();
  db.huidigNiveau[b.gebruikerId] = { ...b.beoordelaar };
  audit(u.id, "Salarisbesluit vastgelegd", `${b.gebruikerId}: ${percentage}% → € ${nieuw.toFixed(2)} (advies ${advies.percentage}%) · door te zetten naar HorecaManager`);
  revalidatePath("/app", "layout");
  revalidatePath("/beheer", "layout");
  return {};
}

export async function slaFunctieprofielOp(functieId: string, _: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const u = await vereisGebruiker();
  if (!isHQ(u)) return { fout: "Alleen HQ beheert het functiehuis." };
  const f = db.functies.find((x) => x.id === functieId);
  if (!f) return { fout: "Functie niet gevonden." };
  const kandidaat = structuredClone(f);
  for (const r of kandidaat.profiel) {
    const w = Number(formData.get(`w-${r.itemId}`));
    const n = Number(formData.get(`r-${r.itemId}`));
    if (Number.isFinite(w)) r.weging = w;
    if (n >= 1 && n <= 4) r.vereistNiveau = n as 1 | 2 | 3 | 4;
  }
  const fouten = valideerFunctie(kandidaat);
  if (fouten.length) return { fout: fouten.join(" ") };
  Object.assign(f, kandidaat);
  audit(u.id, "Functieprofiel gewijzigd", f.naam);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function slaRegelingOp(_: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const u = await vereisGebruiker();
  if (!isHQ(u) || u.discipline !== "hr") return { fout: "Alleen HQ HR beheert de beloningsregeling." };
  const r = structuredClone(db.regeling);
  for (const b of r.banden) {
    const vanaf = Number(String(formData.get(`vanaf-${b.uitkomst}`)).replace(",", "."));
    const pct = Number(String(formData.get(`pct-${b.uitkomst}`)).replace(",", "."));
    if (!Number.isFinite(vanaf) || !Number.isFinite(pct) || pct < 0 || pct > 15) return { fout: "Controleer de getallen." };
    b.vanaf = vanaf;
    r.verhoging[b.uitkomst as Uitkomst] = pct;
  }
  const opl = r.banden.map((b) => b.vanaf);
  if (opl.some((v, i) => i > 0 && v <= opl[i - 1])) return { fout: "De ondergrenzen moeten oplopen." };
  db.regeling = r;
  audit(u.id, "Beloningsregeling gewijzigd", r.versie);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function biedDienstAan(dienstId: string) {
  const u = await vereisGebruiker();
  const rooster = await staffRooster(u.id);
  const dienst = rooster.find((d) => d.id === dienstId);
  if (!dienst || db.ruilverzoeken.some((r) => r.dienstId === dienstId && r.status !== "afgewezen")) return;
  db.ruilverzoeken.push({ id: id("rv"), dienstId, aangebodenDoor: u.id, status: "open" });
  const groep = db.chatGroepen.find((g) => g.type === "vestiging" && g.vestigingId === dienst.vestigingId);
  if (groep) db.chatBerichten.push({ id: id("c"), groepId: groep.id, gebruikerId: u.id, tekst: "Wie kan deze dienst van mij overnemen?", tijd: nu(), ruilDienstId: dienstId });
  audit(u.id, "Dienst aangeboden", dienstId);
  revalidatePath("/app", "layout");
}

async function staffRooster(gebruikerId: string) {
  const g = db.gebruikers.find((x) => x.id === gebruikerId)!;
  return staff.rooster(g, new Date(), new Date(Date.now() + 30 * 86400000));
}

export async function startBeoordeling(gebruikerId: string) {
  const u = await vereisGebruiker();
  const m = db.gebruikers.find((g) => g.id === gebruikerId);
  if (!m?.functieId || u.rol !== "franchisenemer" || !magMedewerkerZien(u, gebruikerId)) return;
  if (db.beoordelingen.some((b) => b.gebruikerId === gebruikerId && b.periode === "2026")) return;
  db.beoordelingen.push({ id: id("bo"), gebruikerId, functieId: m.functieId, beoordelaarId: u.id, periode: "2026", status: "zelfbeoordeling", zelf: {}, beoordelaar: {}, bijgewerkt: nu() });
  audit(u.id, "Beoordelingsronde gestart", gebruikerId);
  revalidatePath("/app", "layout");
}
