"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { inDoelgroep, isHQ, isLeiding, mag, scopeVestigingen } from "./access";
import { audit } from "./audit";
import { checklistVestigingen, enquete as leesEnquete, punten, sjabloon as leesSjabloon, uitvoering as leesUitvoering, zichtbareMensen } from "./betrokkenheid";
import { berekenChecklist } from "./checklist/score";
import { bericht as leesBericht } from "./data";
import { getDb } from "./db/client";
import * as t from "./db/schema";
import type { ChecklistAntwoorden, EnqueteVraag } from "./db/schema";
import { vereisGebruiker } from "./session";
import type { Doelgroep, Rol } from "./types";

const id = (p: string) => `${p}-${crypto.randomUUID().slice(0, 12)}`;
const tekst = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- Tijdlijn ----------

export async function plaatsPost(_: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u } = await vereisGebruiker();
  const inhoud = tekst(formData, "inhoud").slice(0, 1000);
  if (inhoud.length < 2) return { fout: "Schrijf eerst iets." };
  if (u.rol === "hq") return { fout: "HQ plaatst berichten via de beheeromgeving." };
  const db = await getDb();
  const eersteRegel = inhoud.split("\n")[0];
  await db.insert(t.bericht).values({
    id: id("p"), titel: eersteRegel.length > 60 ? `${eersteRegel.slice(0, 57)}…` : eersteRegel, inhoud,
    afzenderType: "medewerker", afzenderGebruikerId: u.id, afzenderNaam: u.voornaam, urgentie: "info", vastgezet: false,
    doelgroep: u.rol === "franchisenemer" ? { franchisenemerIds: [u.franchisenemerId!] } : { vestigingIds: u.vestigingIds },
  });
  revalidatePath("/app");
  return { ok: true };
}

export async function verwijderPost(berichtId: string) {
  const { u, org } = await vereisGebruiker();
  const b = await leesBericht(berichtId);
  if (!b || b.afzender.type !== "medewerker") return;
  // Eigen post, of moderatie door leiding binnen de eigen scope
  const auteur = org.gebruikers.find((g) => g.id === (b.afzender as { gebruikerId: string }).gebruikerId);
  const magModereren = isHQ(u) || (isLeiding(u) && !!auteur && auteur.vestigingIds.some((v) => scopeVestigingen(org, u).includes(v)));
  if (auteur?.id !== u.id && !magModereren) return;
  const db = await getDb();
  await db.delete(t.bericht).where(eq(t.bericht.id, berichtId));
  if (auteur?.id !== u.id) await audit(u.id, "Post verwijderd (moderatie)", b.titel);
  revalidatePath("/app");
}

export async function toggleLike(doelType: "bericht" | "waardering", doelId: string) {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  const w = and(eq(t.like.doelType, doelType), eq(t.like.doelId, doelId), eq(t.like.gebruikerId, u.id));
  const [bestaand] = await db.select().from(t.like).where(w);
  if (bestaand) await db.delete(t.like).where(w);
  else await db.insert(t.like).values({ doelType, doelId, gebruikerId: u.id }).onConflictDoNothing();
  revalidatePath("/app", "layout");
}

// ---------- Waardering en beloningen ----------

export async function geefWaardering(_: unknown, formData: FormData): Promise<{ fout?: string }> {
  const { u, org } = await vereisGebruiker();
  const aanId = tekst(formData, "aan");
  const waardeId = tekst(formData, "waarde");
  const bericht = tekst(formData, "tekst").slice(0, 500);
  if (!aanId) return { fout: "Kies een collega." };
  if (aanId === u.id) return { fout: "Jezelf waarderen kan niet 😉" };
  if (!zichtbareMensen(org, u).some((g) => g.id === aanId)) return { fout: "Deze collega kun je niet waarderen." };
  if (!waardeId) return { fout: "Kies een waarde." };
  if (bericht.length < 5) return { fout: "Schrijf erbij waarvoor je diegene waardeert." };
  const db = await getDb();
  await db.insert(t.waardering).values({ id: id("wd"), vanId: u.id, aanId, waardeId, tekst: bericht });
  revalidatePath("/app", "layout");
  redirect("/app/waardering?gegeven=1");
}

export async function vraagBeloningAan(beloningId: string) {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  const [b] = await db.select().from(t.beloning).where(eq(t.beloning.id, beloningId));
  if (!b || !b.actief) return;
  const p = await punten(u.id);
  if (p.saldo < b.punten) return;
  await db.insert(t.beloningAanvraag).values({ id: id("ba"), beloningId, gebruikerId: u.id, punten: b.punten });
  await audit(u.id, "Beloning aangevraagd", b.titel);
  revalidatePath("/app", "layout");
  revalidatePath("/beheer/betrokkenheid");
}

export async function behandelBeloning(aanvraagId: string, uitgereikt: boolean) {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "betrokkenheid")) return;
  const db = await getDb();
  const [a] = await db.select().from(t.beloningAanvraag).where(eq(t.beloningAanvraag.id, aanvraagId));
  const aanvrager = org.gebruikers.find((g) => g.id === a?.gebruikerId);
  if (!a || !aanvrager || (!isHQ(u) && aanvrager.franchisenemerId !== u.franchisenemerId)) return;
  await db.update(t.beloningAanvraag).set({ status: uitgereikt ? "uitgereikt" : "afgewezen", behandeldDoor: u.id }).where(eq(t.beloningAanvraag.id, aanvraagId));
  await audit(u.id, uitgereikt ? "Beloning uitgereikt" : "Beloning afgewezen", aanvraagId);
  revalidatePath("/beheer/betrokkenheid");
}

// ---------- Enquêtes ----------

export async function beantwoordEnquete(enqueteId: string, _: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u, org } = await vereisGebruiker();
  const e = await leesEnquete(enqueteId);
  if (!e || !inDoelgroep(org, u, e.doelgroep)) return { fout: "Deze enquête is niet voor jou." };
  if (e.sluit && e.sluit.getTime() < Date.now()) return { fout: "Deze enquête is gesloten." };
  const antwoorden: Record<string, string | number> = {};
  for (const q of e.vragen) {
    const v = tekst(formData, q.id);
    if (!v) { if (q.type !== "open" || e.type === "idee") return { fout: "Beantwoord alle vragen." }; continue; }
    if (q.type === "schaal") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < q.min || n > q.max) return { fout: "Ongeldig antwoord." };
      antwoorden[q.id] = n;
    } else if (q.type === "keuze") {
      if (!q.opties.includes(v)) return { fout: "Ongeldig antwoord." };
      antwoorden[q.id] = v;
    } else antwoorden[q.id] = v.slice(0, 1000);
  }
  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      // Ideeënbox mag vaker; andere enquêtes één keer per persoon
      if (e.type !== "idee") await tx.insert(t.enqueteDeelname).values({ enqueteId, gebruikerId: u.id });
      else await tx.insert(t.enqueteDeelname).values({ enqueteId, gebruikerId: u.id }).onConflictDoNothing();
      await tx.insert(t.enqueteAntwoord).values({ enqueteId, gebruikerId: e.anoniem ? null : u.id, franchisenemerId: u.franchisenemerId ?? null, antwoorden });
    });
  } catch {
    return { fout: "Je hebt deze enquête al ingevuld." };
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function maakEnquete(_: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "betrokkenheid")) return { fout: "Geen rechten." };
  const type = tekst(formData, "type") as "poll" | "pulse" | "enps";
  const titel = tekst(formData, "titel");
  const vraag = tekst(formData, "vraag");
  if (!titel || !vraag) return { fout: "Vul een titel en een vraag in." };
  let vragen: EnqueteVraag[];
  if (type === "poll") {
    const opties = tekst(formData, "opties").split("\n").map((o) => o.trim()).filter(Boolean).slice(0, 8);
    if (opties.length < 2) return { fout: "Geef minstens twee opties, elk op een eigen regel." };
    vragen = [{ id: "q1", type: "keuze", tekst: vraag, opties }];
  } else if (type === "enps") {
    vragen = [{ id: "q1", type: "schaal", tekst: vraag, min: 0, max: 10, labels: ["Zeer onwaarschijnlijk", "Zeer waarschijnlijk"] }, { id: "q2", type: "open", tekst: "Wat is de belangrijkste reden voor je cijfer?" }];
  } else {
    vragen = [{ id: "q1", type: "schaal", tekst: vraag, min: 1, max: 5, labels: ["😞", "😄"] }, { id: "q2", type: "open", tekst: "Wil je er iets over kwijt? (optioneel)" }];
  }
  const dagen = Math.min(60, Math.max(1, Number(tekst(formData, "dagen")) || 7));
  const doelgroep: Doelgroep = isHQ(u) ? {} : { vestigingIds: scopeVestigingen(org, u) };
  const db = await getDb();
  await db.insert(t.enquete).values({
    id: id("e"), titel, type, vragen, doelgroep, anoniem: type !== "poll", gemaaktDoor: u.id, sluit: new Date(Date.now() + dagen * 86400000),
    intro: type === "poll" ? "Stem mee!" : "Anoniem. Resultaten zie je pas vanaf 5 antwoorden.",
  });
  await audit(u.id, "Enquête gestart", titel);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Evenementen ----------

export async function meldAan(evenementId: string, status: "ja" | "misschien" | "nee") {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  await db.insert(t.evenementAanmelding).values({ evenementId, gebruikerId: u.id, status })
    .onConflictDoUpdate({ target: [t.evenementAanmelding.evenementId, t.evenementAanmelding.gebruikerId], set: { status, tijd: new Date() } });
  revalidatePath("/app", "layout");
}

export async function maakEvenement(_: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u, org } = await vereisGebruiker();
  if (!mag(org, u, "betrokkenheid")) return { fout: "Geen rechten." };
  const titel = tekst(formData, "titel");
  const start = new Date(tekst(formData, "start"));
  if (!titel || Number.isNaN(start.getTime())) return { fout: "Vul een titel en een datum en tijd in." };
  const duurUur = Math.min(24, Math.max(0, Number(tekst(formData, "duur")) || 2));
  const db = await getDb();
  await db.insert(t.evenement).values({
    id: id("ev"), titel, omschrijving: tekst(formData, "omschrijving"), start, eind: new Date(start.getTime() + duurUur * 3600000),
    locatie: tekst(formData, "locatie") || "Volgt", doelgroep: isHQ(u) ? {} : { franchisenemerIds: [u.franchisenemerId!] }, gemaaktDoor: u.id,
  });
  await audit(u.id, "Evenement aangemaakt", titel);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Profiel ----------

export async function slaOverMijOp(formData: FormData) {
  const { u } = await vereisGebruiker();
  const db = await getDb();
  await db.update(t.gebruiker).set({ overMij: tekst(formData, "overMij").slice(0, 280) || null, toonVerjaardag: formData.get("toonVerjaardag") === "on" }).where(eq(t.gebruiker.id, u.id));
  revalidatePath("/app", "layout");
}

// ---------- Checklists en evaluaties ----------

export async function slaChecklistOp(sjabloonId: string, vestigingId: string, uitvoeringId: string | null, _: unknown, formData: FormData): Promise<{ fout?: string; id?: string }> {
  const { u, org } = await vereisGebruiker();
  const s = await leesSjabloon(sjabloonId);
  if (!s || !s.rollen.includes(u.rol as Rol)) return { fout: "Je mag deze checklist niet invullen." };
  if (!checklistVestigingen(org, u).includes(vestigingId)) return { fout: "Niet jouw vestiging." };
  let antwoorden: ChecklistAntwoorden;
  try { antwoorden = JSON.parse(String(formData.get("antwoorden") ?? "{}")); } catch { return { fout: "Ongeldige invoer." }; }
  const geldig = new Set(s.onderdelen.flatMap((o) => o.vragen.map((v) => v.id)));
  antwoorden = Object.fromEntries(Object.entries(antwoorden).filter(([k]) => geldig.has(k)));
  const uitslag = berekenChecklist(s.onderdelen, antwoorden);
  const afronden = formData.get("stap") === "afronden";
  if (afronden && !uitslag.compleet) return { fout: "Vul eerst alle vragen in." };
  const db = await getDb();
  const waarden = { antwoorden, score: uitslag.cijfer, knockout: uitslag.knockouts.length > 0, status: afronden ? "afgerond" as const : "concept" as const, datum: new Date() };
  let rid = uitvoeringId;
  if (rid) {
    const bestaand = await leesUitvoering(rid);
    if (!bestaand || bestaand.uitgevoerdDoor !== u.id || bestaand.status === "afgerond") return { fout: "Deze checklist kun je niet meer wijzigen." };
    await db.update(t.checklistUitvoering).set(waarden).where(eq(t.checklistUitvoering.id, rid));
  } else {
    rid = id("ui");
    await db.insert(t.checklistUitvoering).values({ id: rid, sjabloonId, sjabloonVersie: s.versie, vestigingId, uitgevoerdDoor: u.id, ...waarden });
  }
  if (afronden) await audit(u.id, `${s.soort === "evaluatie" ? "Evaluatie" : "Checklist"} afgerond: ${s.titel}`, `${vestigingId} · ${uitslag.cijfer ?? ""}${uitslag.knockouts.length ? " · knock-out" : ""}`);
  revalidatePath("/app", "layout");
  revalidatePath("/beheer", "layout");
  if (afronden) redirect(s.soort === "evaluatie" ? `/app/evaluaties/${rid}` : "/app/werk/taken?klaar=1");
  return { id: rid };
}

export async function maakActiepunt(uitvoeringId: string, _: unknown, formData: FormData): Promise<{ fout?: string; ok?: boolean }> {
  const { u, org } = await vereisGebruiker();
  const ui = await leesUitvoering(uitvoeringId);
  if (!ui || !(isHQ(u) || isLeiding(u)) || !checklistVestigingen(org, u).includes(ui.vestigingId)) return { fout: "Geen rechten." };
  const tekst2 = tekst(formData, "tekst");
  const eigenaarId = tekst(formData, "eigenaar");
  const deadline = tekst(formData, "deadline");
  if (!tekst2 || !eigenaarId || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return { fout: "Vul alles in." };
  const db = await getDb();
  await db.insert(t.actiepunt).values({ id: id("ap"), uitvoeringId, vestigingId: ui.vestigingId, tekst: tekst2, eigenaarId, deadline });
  await audit(u.id, "Actiepunt aangemaakt", tekst2);
  revalidatePath("/app", "layout");
  revalidatePath("/beheer", "layout");
  return { ok: true };
}

export async function rondActiepuntAf(actiepuntId: string) {
  const { u, org } = await vereisGebruiker();
  const db = await getDb();
  const [a] = await db.select().from(t.actiepunt).where(eq(t.actiepunt.id, actiepuntId));
  if (!a || !(a.eigenaarId === u.id || ((isHQ(u) || isLeiding(u)) && checklistVestigingen(org, u).includes(a.vestigingId)))) return;
  await db.update(t.actiepunt).set({ status: "klaar" }).where(eq(t.actiepunt.id, actiepuntId));
  revalidatePath("/app", "layout");
  revalidatePath("/beheer", "layout");
}
