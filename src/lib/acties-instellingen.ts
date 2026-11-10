"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { mag } from "./access";
import { audit } from "./audit";
import { getDb } from "./db/client";
import * as t from "./db/schema";
import type { ChecklistOnderdeel } from "./db/schema";
import type { Module } from "./rechten";
import { vereisGebruiker } from "./session";
import type { Doelgroep, Rol } from "./types";

type Res = { fout?: string; ok?: boolean; info?: string };
const id = (p: string) => `${p}-${crypto.randomUUID().slice(0, 10)}`;
const tekst = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function beheer(module: Module) {
  const s = await vereisGebruiker();
  if (!mag(s.org, s.u, module)) throw new Error(`Geen rechten voor ${module}`);
  return s;
}
const klaar = (pad = "/") => revalidatePath(pad, "layout");

// ---------- Posities (incl. minimumleeftijd) ----------

export async function slaPositieOp(positieId: string | null, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("instellingen");
  const naam = tekst(fd, "naam"), kleur = tekst(fd, "kleur") || "#2f56a6", min = Number(tekst(fd, "minLeeftijd") || 0);
  if (!naam) return { fout: "Geef de positie een naam." };
  if (!Number.isInteger(min) || min < 0 || min > 21) return { fout: "Minimumleeftijd tussen 0 en 21." };
  const db = await getDb();
  if (positieId) await db.update(t.positie).set({ naam, kleur, minLeeftijd: min }).where(eq(t.positie.id, positieId));
  else {
    const n = (await db.select().from(t.positie)).length;
    await db.insert(t.positie).values({ id: id("pos"), naam, kleur, minLeeftijd: min, volgorde: n + 1 });
  }
  await audit(u.id, positieId ? "Positie gewijzigd" : "Positie toegevoegd", `${naam} · vanaf ${min} jaar`);
  klaar();
  return { ok: true };
}

// ---------- Kernwaarden en beloningen ----------

export async function slaWaardeOp(waardeId: string | null, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("instellingen");
  const naam = tekst(fd, "naam"), emoji = tekst(fd, "emoji") || "⭐", omschrijving = tekst(fd, "omschrijving");
  if (!naam || !omschrijving) return { fout: "Naam en omschrijving zijn nodig." };
  const db = await getDb();
  if (waardeId) await db.update(t.waarde).set({ naam, emoji, omschrijving }).where(eq(t.waarde.id, waardeId));
  else await db.insert(t.waarde).values({ id: id("w"), naam, emoji, omschrijving, volgorde: (await db.select().from(t.waarde)).length + 1 });
  await audit(u.id, waardeId ? "Kernwaarde gewijzigd" : "Kernwaarde toegevoegd", naam);
  klaar();
  return { ok: true };
}

export async function slaBeloningOp(beloningId: string | null, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("instellingen");
  const titel = tekst(fd, "titel"), omschrijving = tekst(fd, "omschrijving"), emoji = tekst(fd, "emoji") || "🎁", punten = Number(tekst(fd, "punten"));
  if (!titel || !(punten > 0 && punten <= 5000)) return { fout: "Titel en een puntenaantal (1–5000) zijn nodig." };
  const actief = fd.get("actief") !== null;
  const db = await getDb();
  if (beloningId) await db.update(t.beloning).set({ titel, omschrijving, emoji, punten, actief }).where(eq(t.beloning.id, beloningId));
  else await db.insert(t.beloning).values({ id: id("bl"), titel, omschrijving, emoji, punten, actief: true });
  await audit(u.id, beloningId ? "Beloning gewijzigd" : "Beloning toegevoegd", `${titel} · ${punten} p${actief ? "" : " · uit catalogus"}`);
  klaar();
  return { ok: true };
}

// ---------- Checklists en evaluaties ----------

export async function slaSjabloonOp(sjabloonId: string | null, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("instellingen");
  const titel = tekst(fd, "titel"), omschrijving = tekst(fd, "omschrijving"), soort = tekst(fd, "soort") as "dagtaak" | "evaluatie";
  const rollen = fd.getAll("rol").map(String) as Rol[];
  let onderdelen: ChecklistOnderdeel[];
  try { onderdelen = JSON.parse(tekst(fd, "onderdelen")); } catch { return { fout: "Ongeldige vragenlijst." }; }
  if (!titel || !["dagtaak", "evaluatie"].includes(soort) || !rollen.length) return { fout: "Titel, soort en minstens één rol zijn nodig." };
  if (!onderdelen.length || onderdelen.some((o) => !o.naam || !o.vragen.length || o.vragen.some((v) => !v.tekst))) return { fout: "Elk onderdeel heeft een naam en minstens één vraag nodig." };
  if (soort === "evaluatie" && onderdelen.reduce((s, o) => s + Number(o.weging), 0) !== 100) return { fout: "Bij een evaluatie tellen de wegingen op tot 100%." };
  const schoon = onderdelen.map((o, i) => ({ id: o.id || `o${i + 1}`, naam: o.naam, weging: Number(o.weging) || 100, vragen: o.vragen.map((v, j) => ({
    id: v.id || `${o.id || `o${i + 1}`}-${j + 1}`, tekst: v.tekst, type: v.type, ...(v.knockout ? { knockout: true } : {}), ...(v.type === "meting" && v.max !== undefined && String(v.max) !== "" ? { max: Number(v.max), eenheid: v.eenheid || "" } : {}),
  })) }));
  const db = await getDb();
  if (sjabloonId) {
    const [oud] = await db.select().from(t.checklistSjabloon).where(eq(t.checklistSjabloon.id, sjabloonId));
    // Nieuwe versie: oude uitvoeringen houden hun eigen versienummer
    await db.update(t.checklistSjabloon).set({ titel, omschrijving, soort, rollen, onderdelen: schoon, versie: (oud?.versie ?? 1) + 1, actief: fd.get("actief") !== null }).where(eq(t.checklistSjabloon.id, sjabloonId));
  } else await db.insert(t.checklistSjabloon).values({ id: id("cl"), titel, omschrijving, soort, rollen, onderdelen: schoon });
  await audit(u.id, sjabloonId ? "Checklist gewijzigd (nieuwe versie)" : "Checklist toegevoegd", titel);
  klaar();
  return { ok: true };
}

// ---------- Organisatie: franchisenemers en vestigingen ----------

export async function maakFranchisenemer(_: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("organisatie");
  const naam = tekst(fd, "naam"), regioId = tekst(fd, "regio");
  if (!naam || !regioId) return { fout: "Naam en regio zijn nodig." };
  const db = await getDb();
  const fnId = id("fn");
  await db.insert(t.franchisenemer).values({ id: fnId, naam, regioId });
  await db.insert(t.chatGroep).values({ id: id("g"), naam: `Team ${naam}`, type: "franchisenemer", franchisenemerId: fnId });
  await audit(u.id, "Franchisenemer toegevoegd", naam);
  klaar();
  return { ok: true };
}

export async function slaVestigingOrgOp(vestigingId: string | null, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("organisatie");
  const naam = tekst(fd, "naam"), plaats = tekst(fd, "plaats"), adres = tekst(fd, "adres"), fn = tekst(fd, "franchisenemer");
  if (!naam || !plaats || !fn) return { fout: "Naam, plaats en franchisenemer zijn nodig." };
  const db = await getDb();
  if (vestigingId) await db.update(t.vestiging).set({ naam, plaats, adres: adres || null, franchisenemerId: fn }).where(eq(t.vestiging.id, vestigingId));
  else {
    const vid = id("v");
    await db.insert(t.vestiging).values({ id: vid, naam, plaats, adres: adres || null, franchisenemerId: fn });
    await db.insert(t.chatGroep).values({ id: id("g"), naam: `${naam} ${plaats}`, type: "vestiging", vestigingId: vid });
  }
  await audit(u.id, vestigingId ? "Vestiging gewijzigd" : "Vestiging toegevoegd", `${naam} (${plaats})`);
  klaar();
  return { ok: true, info: vestigingId ? "Opgeslagen." : "Vestiging toegevoegd. Stel nu de openingstijden en bezetting in bij Vestigingen." };
}

// ---------- Handboek ----------

export async function slaHandboekDocOp(docId: string | null, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("handboek");
  const titel = tekst(fd, "titel"), inhoud = tekst(fd, "inhoud"), eigenaar = tekst(fd, "eigenaar") as typeof t.handboekDoc.$inferInsert.eigenaar, review = tekst(fd, "review");
  if (!titel || inhoud.length < 20) return { fout: "Geef een titel en de instructie (minstens een paar zinnen)." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review)) return { fout: "Kies een reviewdatum." };
  const doelgroep: Doelgroep = {};
  const functies = fd.getAll("functie").map(String), rollen = fd.getAll("rol").map(String) as Rol[];
  if (functies.length) doelgroep.functieIds = functies;
  if (rollen.length) doelgroep.rollen = rollen;
  const db = await getDb();
  if (docId) {
    const [oud] = await db.select().from(t.handboekDoc).where(eq(t.handboekDoc.id, docId));
    const [maj, min] = (oud?.versie ?? "1.0").split(".").map(Number);
    const versie = fd.get("groot") ? `${maj + 1}.0` : `${maj}.${(min || 0) + 1}`;
    await db.update(t.handboekDoc).set({ titel, inhoud, eigenaar, reviewVoor: new Date(`${review}T12:00:00`), doelgroep, versie, bijgewerkt: new Date() }).where(eq(t.handboekDoc.id, docId));
    await audit(u.id, "Handboek bijgewerkt", `${titel} → v${versie}`);
    klaar();
    return { ok: true, info: `Opgeslagen als versie ${versie}. De assistent gebruikt meteen de nieuwe tekst.` };
  }
  await db.insert(t.handboekDoc).values({ id: id("d"), titel, inhoud, eigenaar, reviewVoor: new Date(`${review}T12:00:00`), doelgroep, versie: "1.0", bijgewerkt: new Date() });
  await audit(u.id, "Handboekdocument toegevoegd", titel);
  klaar();
  return { ok: true, info: "Toegevoegd. De assistent kan er direct uit antwoorden." };
}

// ---------- Leren ----------

/** Quizregels: één vraag per regel: "Vraag? || antwoord A | *goed antwoord | antwoord C". */
function leesQuiz(s: string) {
  const uit: { vraag: string; opties: string[]; juist: number }[] = [];
  for (const regel of s.split("\n").map((r) => r.trim()).filter(Boolean)) {
    const [vraag, rest] = regel.split("||").map((x) => x?.trim());
    const opties = (rest ?? "").split("|").map((x) => x.trim()).filter(Boolean);
    const juist = opties.findIndex((o) => o.startsWith("*"));
    if (!vraag || opties.length < 2 || juist < 0) return null;
    uit.push({ vraag, opties: opties.map((o) => o.replace(/^\*/, "").trim()), juist });
  }
  return uit;
}

export async function slaLeerItemOp(itemId: string | null, _: unknown, fd: FormData): Promise<Res> {
  const { u } = await beheer("leren");
  const titel = tekst(fd, "titel"), type = tekst(fd, "type") as "video" | "quiz" | "module" | "challenge", inhoud = tekst(fd, "inhoud"), duur = Number(tekst(fd, "duur"));
  if (!titel || !inhoud || !["video", "quiz", "module", "challenge"].includes(type) || !(duur > 0)) return { fout: "Titel, soort, duur en inhoud zijn nodig." };
  const quiz = type === "quiz" ? leesQuiz(tekst(fd, "quiz")) : null;
  if (type === "quiz" && (!quiz || !quiz.length)) return { fout: "Schrijf de quiz als: Vraag? || antwoord | *goed antwoord | antwoord (één vraag per regel)." };
  const waarden = { titel, type, inhoud, duurMin: duur, functieIds: fd.getAll("functie").map(String), onboarding: fd.get("onboarding") !== null, quiz: quiz ?? null };
  const db = await getDb();
  if (itemId) await db.update(t.leerItem).set(waarden).where(eq(t.leerItem.id, itemId));
  else await db.insert(t.leerItem).values({ id: id("l"), ...waarden, volgorde: waarden.onboarding ? 99 : null });
  await audit(u.id, itemId ? "Leeritem gewijzigd" : "Leeritem toegevoegd", titel);
  klaar();
  return { ok: true };
}
