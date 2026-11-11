import { eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { weekStart, type Periode } from "../planning/atw";
import { maakSuggestie, opTijd, slotsVoorWeek, type PlanKandidaat } from "../planning/suggestie";
import { contractTekst, deadlineVan, isoDatum, LIFECYCLE } from "../personeel/sjablonen";
import type { DB } from "./client";
import * as t from "./schema";

// Demodata voor personeelsbeheer. Alles relatief aan vandaag, zodat de demo altijd "nu" is.

const vandaag = isoDatum(new Date());
const dag = (n: number) => deadlineVan(vandaag, n);
const uur = (n: number) => new Date(Date.now() + n * 3600000);

const OPEN = (o: string, s: string) => ({ open: o, sluit: s });
const OPENING: Record<string, t.Openingstijden> = {
  "v-centrum": { 0: OPEN("12:00", "20:00"), 1: OPEN("11:00", "21:00"), 2: OPEN("11:00", "21:00"), 3: OPEN("11:00", "21:00"), 4: OPEN("11:00", "21:00"), 5: OPEN("11:00", "22:00"), 6: OPEN("11:00", "22:00") },
  "v-markt": { 0: null, 1: OPEN("11:00", "19:00"), 2: OPEN("11:00", "19:00"), 3: OPEN("11:00", "19:00"), 4: OPEN("11:00", "19:00"), 5: OPEN("11:00", "21:00"), 6: OPEN("10:00", "21:00") },
  "v-station": { 0: OPEN("09:00", "20:00"), 1: OPEN("07:00", "21:00"), 2: OPEN("07:00", "21:00"), 3: OPEN("07:00", "21:00"), 4: OPEN("07:00", "21:00"), 5: OPEN("07:00", "21:00"), 6: OPEN("09:00", "21:00") },
  "v-plein": { 0: null, 1: OPEN("11:00", "20:00"), 2: OPEN("11:00", "20:00"), 3: OPEN("11:00", "20:00"), 4: OPEN("11:00", "20:00"), 5: OPEN("11:00", "20:00"), 6: OPEN("11:00", "20:00") },
};
const ADRES: Record<string, string> = { "v-centrum": "Lijnbaan 12, Rotterdam", "v-markt": "Binnenrotte 3, Rotterdam", "v-station": "Stationsplein 1, Delft", "v-plein": "Markt 20, Gouda" };

const POSITIES = [
  { id: "pos-shift", naam: "Shiftleider", kleur: "#16336e", volgorde: 1, minLeeftijd: 18 },
  { id: "pos-bakken", naam: "Bakken", kleur: "#d0112b", volgorde: 2, minLeeftijd: 16 },
  { id: "pos-kassa", naam: "Kassa", kleur: "#2f56a6", volgorde: 3, minLeeftijd: 16 },
  { id: "pos-uitgifte", naam: "Uitgifte", kleur: "#b45309", volgorde: 4, minLeeftijd: 0 },
];

type Norm = [weekdagen: number[], positie: string, aantal: number, van: string, tot: string];
const NORMEN: Record<string, Norm[]> = {
  "v-centrum": [
    [[1, 2, 3, 4, 5, 6], "pos-shift", 1, "11:00", "17:00"], [[1, 2, 3, 4], "pos-shift", 1, "17:00", "21:00"], [[5, 6], "pos-shift", 1, "17:00", "22:00"],
    [[1, 2, 3, 4, 5, 6], "pos-bakken", 1, "11:00", "17:00"], [[1, 2, 3, 4], "pos-bakken", 1, "17:00", "21:00"], [[5, 6], "pos-bakken", 2, "17:00", "22:00"],
    [[1, 2, 3, 4, 5], "pos-kassa", 1, "11:00", "17:00"], [[6], "pos-kassa", 2, "11:00", "17:00"], [[1, 2, 3, 4], "pos-kassa", 1, "17:00", "21:00"], [[5, 6], "pos-kassa", 1, "17:00", "22:00"],
    [[1, 2, 3, 4, 5, 6], "pos-uitgifte", 1, "12:00", "15:00"], [[5, 6], "pos-uitgifte", 1, "17:00", "21:00"],
    [[0], "pos-shift", 1, "12:00", "20:00"], [[0], "pos-bakken", 1, "12:00", "20:00"], [[0], "pos-kassa", 1, "12:00", "17:00"],
  ],
  "v-markt": [
    [[1, 2, 3, 4, 5, 6], "pos-shift", 1, "11:00", "17:00"], [[1, 2, 3, 4, 5, 6], "pos-bakken", 1, "11:00", "17:00"], [[6], "pos-kassa", 1, "11:00", "17:00"],
    [[5, 6], "pos-bakken", 1, "17:00", "21:00"], [[5, 6], "pos-kassa", 1, "17:00", "21:00"], [[1, 2, 3, 4], "pos-kassa", 1, "15:00", "19:00"],
  ],
  "v-station": [[[1, 2, 3, 4, 5], "pos-kassa", 1, "07:00", "13:00"], [[1, 2, 3, 4, 5], "pos-bakken", 1, "13:00", "21:00"]],
  "v-plein": [[[1, 2, 3, 4, 5, 6], "pos-bakken", 1, "11:00", "17:00"]],
};

// [id, voornaam, achternaam, rol, functie, vestigingen, geboortedatum, in dienst, posities, beschikbaarheid, contract]
type B = Record<number, [string, string]>;
const ALLES = (van: string, tot: string, dagen = [0, 1, 2, 3, 4, 5, 6]): B => Object.fromEntries(dagen.map((d) => [d, [van, tot]]));
const STUDENT: B = { 1: ["16:00", "22:00"], 2: ["16:00", "22:00"], 4: ["16:00", "22:00"], 5: ["12:00", "22:00"], 6: ["10:00", "22:00"] };
const SCHOLIER: B = { 3: ["13:00", "21:00"], 5: ["16:00", "22:00"], 6: ["11:00", "22:00"], 0: ["12:00", "20:00"] };
interface Mens { id: string; voornaam?: string; achternaam?: string; rol?: "medewerker" | "shiftleider" | "manager"; functie?: string; vest?: string[]; geb: string; sinds?: string; pos: string[]; besch: B; c: [type: "oproep" | "minmax" | "vast", min: number, max: number, loon: number, eindOverDagen?: number] }

const NIEUW: Mens[] = [
  { id: "u-fleur", voornaam: "Fleur", achternaam: "Mulder", geb: "2007-02-11", sinds: "2025-06-01", pos: ["pos-kassa", "pos-uitgifte", "pos-bakken"], besch: STUDENT, c: ["minmax", 8, 20, 14.99] },
  { id: "u-jesse", voornaam: "Jesse", achternaam: "de Graaf", geb: "2004-08-30", sinds: "2024-02-01", pos: ["pos-bakken", "pos-kassa"], besch: ALLES("11:00", "22:00", [1, 2, 3, 4, 5]), c: ["minmax", 16, 32, 15.6] },
  { id: "u-amira", voornaam: "Amira", achternaam: "Haddou", geb: "2008-04-02", sinds: "2025-09-01", pos: ["pos-kassa", "pos-uitgifte"], besch: SCHOLIER, c: ["oproep", 0, 16, 10.85] },
  { id: "u-bas", voornaam: "Bas", achternaam: "Kuipers", geb: "2010-01-15", sinds: "2026-01-10", pos: ["pos-kassa", "pos-uitgifte"], besch: SCHOLIER, c: ["oproep", 0, 12, 8.6] },
  { id: "u-lieke", voornaam: "Lieke", achternaam: "Brouwer", rol: "shiftleider", functie: "f-shiftleider", geb: "2001-10-05", sinds: "2022-03-01", pos: ["pos-shift", "pos-bakken", "pos-kassa"], besch: ALLES("10:00", "22:00", [0, 3, 4, 5, 6]), c: ["vast", 32, 32, 16.9] },
  { id: "u-sem", voornaam: "Sem", achternaam: "Jacobs", vest: ["v-centrum", "v-markt"], geb: "2005-12-12", sinds: "2024-11-01", pos: ["pos-bakken", "pos-kassa"], besch: ALLES("11:00", "22:00", [1, 2, 3, 5, 6]), c: ["minmax", 12, 28, 15.2] },
  { id: "u-noah", voornaam: "Noah", achternaam: "Smits", geb: "2009-07-21", sinds: "2026-03-01", pos: ["pos-kassa", "pos-uitgifte", "pos-bakken"], besch: STUDENT, c: ["oproep", 0, 16, 9.7] },
  { id: "u-eva", voornaam: "Eva", achternaam: "Meijer", vest: ["v-markt", "v-centrum"], geb: "2003-03-03", sinds: "2023-05-01", pos: ["pos-kassa", "pos-bakken", "pos-uitgifte"], besch: ALLES("10:00", "21:00", [1, 2, 4, 5, 6]), c: ["minmax", 20, 32, 15.9] },
  { id: "u-ruben", voornaam: "Ruben", achternaam: "Vos", vest: ["v-markt"], rol: "shiftleider", functie: "f-shiftleider", geb: "1998-06-18", sinds: "2021-08-01", pos: ["pos-shift", "pos-bakken", "pos-kassa"], besch: ALLES("10:00", "21:00", [1, 2, 3, 4, 5, 6]), c: ["vast", 36, 36, 17.4] },
  { id: "u-zoe", voornaam: "Zoë", achternaam: "Bakker", vest: ["v-markt"], geb: "2006-09-09", sinds: "2025-02-01", pos: ["pos-kassa", "pos-uitgifte"], besch: STUDENT, c: ["minmax", 8, 16, 14.99] },
];
const BESTAAND: Mens[] = [
  { id: "u-sanne", geb: "2009-05-14", pos: ["pos-kassa", "pos-uitgifte", "pos-bakken"], besch: STUDENT, c: ["minmax", 8, 16, 15.2, 30] },
  { id: "u-daan", geb: "2007-11-19", pos: ["pos-bakken", "pos-kassa"], besch: ALLES("12:00", "22:00", [1, 3, 5, 6, 0]), c: ["minmax", 12, 24, 15.9, 25] },
  { id: "u-mo", geb: "2010-03-02", pos: ["pos-kassa", "pos-uitgifte"], besch: SCHOLIER, c: ["oproep", 0, 12, 14.99, 160] },
  { id: "u-yara", geb: "2001-07-07", pos: ["pos-shift", "pos-bakken", "pos-kassa"], besch: ALLES("10:00", "22:00", [1, 2, 5, 6]), c: ["vast", 28, 28, 16.4] },
  { id: "u-lars", geb: "2005-01-20", pos: ["pos-kassa", "pos-bakken", "pos-uitgifte"], besch: ALLES("11:00", "19:00", [1, 2, 3, 4, 6]), c: ["minmax", 12, 24, 15.4, 200] },
  { id: "u-noor", geb: "1990-04-12", pos: ["pos-shift", "pos-kassa"], besch: ALLES("10:00", "18:00", [1, 2, 3, 4, 5]), c: ["vast", 38, 38, 19.8] },
  { id: "u-tim", geb: "2008-02-27", pos: ["pos-kassa", "pos-bakken"], besch: ALLES("07:00", "21:00", [1, 2, 3, 4, 5]), c: ["minmax", 8, 20, 15.0] },
];

const hashVan = (s: string) => createHash("sha256").update(s).digest("hex");
const HANDTEKENING = "M10 40 C 30 10, 50 10, 60 35 S 90 60, 110 30 S 140 10, 160 38";

export async function seedPersoneel(db: DB) {
  const fns = await db.select().from(t.franchisenemer);
  const vest = await db.select().from(t.vestiging);
  const fnNaam = (fnId: string) => fns.find((f) => f.id === fnId)?.naam ?? "De werkgever";
  const functies = await db.select().from(t.functie);

  for (const v of vest) await db.update(t.vestiging).set({ openingstijden: OPENING[v.id] ?? {}, adres: ADRES[v.id] ?? null }).where(eq(t.vestiging.id, v.id));
  await db.insert(t.positie).values(POSITIES);
  await db.insert(t.bezettingsnorm).values(Object.entries(NORMEN).flatMap(([vestigingId, regels]) => regels.flatMap(([dagen, positieId, aantal, van, tot]) =>
    dagen.map((weekdag) => ({ id: `bn-${vestigingId.slice(2)}-${weekdag}-${positieId.slice(4)}-${van.replace(":", "")}`, vestigingId, weekdag, positieId, aantal, van, tot })))));

  // Nieuwe medewerkers
  await db.insert(t.gebruiker).values(NIEUW.map((m) => ({
    id: m.id, voornaam: m.voornaam!, achternaam: m.achternaam!, rol: m.rol ?? "medewerker" as const, functieId: m.functie ?? "f-medewerker",
    franchisenemerId: "fn-jansen", mobiel: "06 •• •• •• " + m.id.length, inDienstSinds: m.sinds!, personeelsnummer: m.id.slice(2).toUpperCase().padEnd(6, "0"),
  })));
  await db.insert(t.gebruikerVestiging).values(NIEUW.flatMap((m) => (m.vest ?? ["v-centrum"]).map((v) => ({ gebruikerId: m.id, vestigingId: v }))));
  await db.insert(t.salaris).values(NIEUW.map((m) => ({ gebruikerId: m.id, uurloon: m.c[3], schaalMin: 14.99, schaalMax: m.functie ? 18.4 : 17.1 })));
  // Noor (manager) werkt ook op de Markt; Sem en Eva op beide vestigingen
  const alle = [...BESTAAND, ...NIEUW];
  const gebr = await db.select().from(t.gebruiker).where(inArray(t.gebruiker.id, alle.map((m) => m.id)));
  const gv = await db.select().from(t.gebruikerVestiging).where(inArray(t.gebruikerVestiging.gebruikerId, alle.map((m) => m.id)));
  const vestVan = (id: string) => gv.filter((x) => x.gebruikerId === id).map((x) => x.vestigingId);

  for (const m of alle) {
    const g = gebr.find((x) => x.id === m.id)!;
    await db.update(t.gebruiker).set({
      geboortedatum: m.geb, email: `${g.voornaam.toLowerCase().replace("ë", "e")}@voorbeeld.nl`, agendaToken: `ag-${m.id.slice(2)}`,
      persoonsgegevens: { adres: "Voorbeeldstraat 1", postcode: "3011 AA", woonplaats: "Rotterdam", iban: "NL•• •••• •••• ••" + (10 + m.id.length), noodcontactNaam: "Ouder/verzorger", noodcontactTelefoon: "06 •• •• •• 99", bsnLaatste4: "••" + String(m.id.length).padStart(2, "0"), loonheffingskorting: true },
    }).where(eq(t.gebruiker.id, m.id));
  }
  await db.insert(t.gebruikerPositie).values(alle.flatMap((m) => m.pos.map((p) => ({ gebruikerId: m.id, positieId: p }))));
  await db.insert(t.beschikbaarheid).values(alle.flatMap((m) => Object.entries(m.besch).map(([wd, [van, tot]]) => ({ gebruikerId: m.id, weekdag: Number(wd), van, tot }))));

  // Contracten (getekend), plus een verlenging voor Sanne die nog getekend moet worden
  for (const m of alle) {
    const g = gebr.find((x) => x.id === m.id)!;
    const [type, min, max, loon, eindOver] = m.c;
    const eind = eindOver !== undefined ? dag(eindOver) : null;
    const functie = functies.find((f) => f.id === g.functieId)?.naam ?? "Medewerker";
    const velden = { werkgever: fnNaam(g.franchisenemerId ?? "fn-jansen"), vestigingen: vestVan(m.id).map((v) => vest.find((x) => x.id === v)!.naam), naam: `${g.voornaam} ${g.achternaam}`, geboortedatum: m.geb, functie, type, urenMin: min, urenMax: max, uurloon: loon, start: g.inDienstSinds, eind, proeftijdTot: null, volgnummer: 1 };
    const tekst = contractTekst(velden);
    const getekend = new Date(`${g.inDienstSinds}T10:00:00`); getekend.setDate(getekend.getDate() - 4);
    await db.insert(t.contract).values({
      id: `ct-${m.id.slice(2)}-1`, gebruikerId: m.id, volgnummer: 1, type, urenMin: min, urenMax: max, uurloon: loon, functieId: g.functieId, start: g.inDienstSinds, eind,
      tekst, status: "getekend", documentHash: hashVan(tekst), ondertekendWerknemer: getekend, handtekeningWerknemer: HANDTEKENING, ondertekendWerkgever: getekend, handtekeningWerkgever: HANDTEKENING, werkgeverOndertekenaarId: "u-erik", aangemaaktDoor: "u-erik",
    });
  }
  {
    const start = dag(31);
    const velden = { werkgever: fnNaam("fn-jansen"), vestigingen: ["Centrum"], naam: "Sanne de Wit", geboortedatum: "2009-05-14", functie: "Medewerker Bakken & Uitgifte", type: "minmax" as const, urenMin: 12, urenMax: 20, uurloon: 15.6, start, eind: deadlineVan(start, 365), proeftijdTot: null, volgnummer: 2 };
    const tekst = contractTekst(velden);
    await db.insert(t.contract).values({ id: "ct-sanne-2", gebruikerId: "u-sanne", volgnummer: 2, type: "minmax", urenMin: 12, urenMax: 20, uurloon: 15.6, functieId: "f-medewerker", start, eind: velden.eind, tekst, status: "ter-ondertekening", documentHash: hashVan(tekst), aangemaaktDoor: "u-erik" });
  }

  // Dossier (alleen metadata; in de demo zonder bestand)
  await db.insert(t.dossierDocument).values([
    ...alle.map((m) => ({ id: `dd-id-${m.id.slice(2)}`, gebruikerId: m.id, categorie: "identiteit" as const, titel: "Kopie identiteitsbewijs", bestandsnaam: "id.jpg", grootte: 380, geuploadDoor: m.id, tijd: uur(-24 * 200) })),
    { id: "dd-haccp-daan", gebruikerId: "u-daan", categorie: "certificaat", titel: "HACCP-basis", vervalt: dag(18), bestandsnaam: "haccp.pdf", grootte: 120, geuploadDoor: "u-daan", tijd: uur(-24 * 700) },
    { id: "dd-haccp-sanne", gebruikerId: "u-sanne", categorie: "certificaat", titel: "HACCP-basis", vervalt: dag(540), bestandsnaam: "haccp.pdf", grootte: 118, geuploadDoor: "u-sanne", tijd: uur(-24 * 180) },
    { id: "dd-bhv-yara", gebruikerId: "u-yara", categorie: "certificaat", titel: "BHV", vervalt: dag(-6), bestandsnaam: "bhv.pdf", grootte: 96, geuploadDoor: "u-yara", tijd: uur(-24 * 370) },
    { id: "dd-lh-sanne", gebruikerId: "u-sanne", categorie: "loonheffing", titel: "Opgaaf gegevens loonheffingen", bestandsnaam: "loonheffing.pdf", grootte: 64, geuploadDoor: "u-sanne", tijd: uur(-24 * 600) },
  ]);

  // Verlof en ziekte
  await db.insert(t.verlof).values([
    { id: "vl-daan", gebruikerId: "u-daan", type: "vakantie", van: dag(9), tot: dag(13), uren: 16, status: "aangevraagd", opmerking: "Weekje weg met vrienden" },
    { id: "vl-fleur", gebruikerId: "u-fleur", type: "vakantie", van: dag(2), tot: dag(4), uren: 12, status: "goedgekeurd", behandeldDoor: "u-noor" },
    { id: "vl-jesse", gebruikerId: "u-jesse", type: "ziek", van: dag(-1), tot: null, status: "goedgekeurd", opmerking: "Griep" },
    { id: "vl-sanne", gebruikerId: "u-sanne", type: "bijzonder", van: dag(20), tot: dag(20), uren: 4, status: "aangevraagd", opmerking: "Rijexamen" },
  ]);

  // Rooster: vorige, deze en volgende week via dezelfde suggestie als in de app
  const ma = isoDatum(weekStart(new Date()));
  const za = new Date(`${ma}T11:00:00`); za.setDate(za.getDate() + 5); if (za.getTime() < Date.now()) za.setDate(za.getDate() + 7);
  const moZa: Periode = { start: za, eind: new Date(za.getTime() + 7 * 3600000) };
  await db.insert(t.dienst).values({ id: "d-mo-za", vestigingId: "v-centrum", positieId: "pos-kassa", gebruikerId: "u-mo", start: moZa.start, eind: moZa.eind, pauzeMin: 30, status: "gepubliceerd" });
  const bezet: Record<string, Periode[]> = { "u-mo": [moZa] };
  const verlof = await db.select().from(t.verlof).where(eq(t.verlof.status, "goedgekeurd"));
  const afwezig = (id: string) => {
    const set = new Set<string>();
    for (const v of verlof.filter((x) => x.gebruikerId === id)) for (let d = v.van; d <= (v.tot ?? dag(7)); d = deadlineVan(d, 1)) set.add(d);
    return set;
  };
  const diensten: (typeof t.dienst.$inferInsert)[] = [];
  let n = 0;
  for (const w of [-1, 0, 1]) {
    const maandag = deadlineVan(ma, w * 7);
    for (const v of vest) {
      const normen = (NORMEN[v.id] ?? []).flatMap(([dagen, positieId, aantal, van, tot]) => dagen.map((weekdag) => ({ weekdag, positieId, aantal, van, tot })));
      const slots = slotsVoorWeek(maandag, normen, (d) => !OPENING[v.id]?.[new Date(`${d}T12:00:00`).getDay()]);
      const kandidaten: PlanKandidaat[] = alle.filter((m) => vestVan(m.id).includes(v.id)).map((m) => ({
        id: m.id, naam: m.id, geboortedatum: m.geb, positieIds: m.pos, afwezig: afwezig(m.id),
        beschikbaar: Object.fromEntries(Object.entries(m.besch).map(([wd, [van, tot]]) => [Number(wd), { van, tot }])),
        urenMin: m.c[1], urenMax: m.c[2] || 12,
      }));
      const res = maakSuggestie({ slots, kandidaten, bestaand: bezet, minLeeftijd: Object.fromEntries(POSITIES.map((p) => [p.id, p.minLeeftijd])) });
      for (const tw of res.toewijzingen) {
        const p = { start: opTijd(tw.slot.datum, tw.slot.van), eind: opTijd(tw.slot.datum, tw.slot.tot) };
        if (tw.gebruikerId) (bezet[tw.gebruikerId] ??= []).push(p);
        diensten.push({ id: `d-${++n}`, vestigingId: v.id, positieId: tw.slot.positieId, gebruikerId: tw.gebruikerId, start: p.start, eind: p.eind, pauzeMin: tw.pauzeMin, status: w < 1 ? "gepubliceerd" : "concept", bron: "suggestie" });
      }
    }
  }
  for (let i = 0; i < diensten.length; i += 200) await db.insert(t.dienst).values(diensten.slice(i, i + 200));

  // Klokregels voor afgelopen diensten: vorige week goedgekeurd, deze week ingediend
  const mins = (k: number) => k * 60000;
  const nogInvullen = (d: (typeof diensten)[number]) => (d.start as Date).getTime() >= Date.now() - 10 * 86400000 && ["u-sanne", "u-daan"].includes(d.gebruikerId ?? "");
  const klok = diensten.filter((d) => d.gebruikerId && (d.eind as Date).getTime() < Date.now() && !nogInvullen(d)).map((d, i) => {
    const s = d.start as Date, e = d.eind as Date;
    const vorigeWeek = s < new Date(`${ma}T00:00:00`);
    return { id: `kl-${i}`, gebruikerId: d.gebruikerId!, vestigingId: d.vestigingId, dienstId: d.id, in: new Date(s.getTime() - mins((i % 4) * 2)), uit: new Date(e.getTime() + mins(i % 3 === 0 ? 14 : 3)), pauzeMin: d.pauzeMin ?? 0, status: vorigeWeek ? "goedgekeurd" as const : "ingediend" as const, goedgekeurdDoor: vorigeWeek ? "u-noor" : null };
  });
  for (let i = 0; i < klok.length; i += 200) await db.insert(t.klok).values(klok.slice(i, i + 200));

  // Werving
  await db.insert(t.vacature).values([
    { id: "vac-centrum", slug: "medewerker-centrum-rotterdam", vestigingId: "v-centrum", functieId: "f-medewerker", titel: "Medewerker Bakken & Uitgifte", omschrijving: "Jij bakt de lekkerste patat van Rotterdam en helpt gasten snel en vriendelijk. Geen ervaring nodig: je leert alles in de app en op de vloer. Vanaf 15 jaar.", uren: "8 – 20 uur per week", gemaakt: uur(-24 * 12) },
    { id: "vac-markt", slug: "shiftleider-markt-rotterdam", vestigingId: "v-markt", functieId: "f-shiftleider", titel: "Shiftleider", omschrijving: "Je stuurt de dienst aan, zorgt dat alles volgens het handboek gaat en houdt het team scherp en gezellig. Ervaring in de horeca is een pré.", uren: "24 – 32 uur per week", gemaakt: uur(-24 * 5) },
    { id: "vac-station", slug: "medewerker-station-delft", vestigingId: "v-station", functieId: "f-medewerker", titel: "Medewerker ochtenddienst", omschrijving: "Vroege vogel? Je opent de vestiging met het team en helpt reizigers aan hun ontbijt en patat.", uren: "12 – 24 uur per week", status: "gesloten", gemaakt: uur(-24 * 60) },
  ]);
  const notitie = (door: string, h: number, tekst: string) => ({ door, tijd: uur(h).toISOString(), tekst });
  // Elke sollicitatie heeft meteen een dossier in opbouw (status kandidaat): adres, beschikbaarheid per dag, eventueel cv
  const dossiers = [
    { k: "k-1", id: "u-k1", voornaam: "Daphne", achternaam: "Verhoeven", fn: "fn-jansen", geb: "2009-09-01", mobiel: "06 •• •• •• 31", email: "daphne@voorbeeld.nl", adres: "Witte de Withstraat 12", postcode: "3012 BP", woonplaats: "Rotterdam", besch: [[3, "13:00", "21:00"], [6, "10:00", "19:00"], [0, "11:00", "19:00"]] },
    { k: "k-2", id: "u-k2", voornaam: "Thijs", achternaam: "Koster", fn: "fn-jansen", geb: "2006-01-12", mobiel: "06 •• •• •• 32", email: "thijs@voorbeeld.nl", adres: "Nieuwe Binnenweg 140", postcode: "3015 BH", woonplaats: "Rotterdam", besch: [[1, "17:00", "22:00"], [2, "17:00", "22:00"], [4, "17:00", "22:00"]] },
    { k: "k-3", id: "u-k3", voornaam: "Yasmin", achternaam: "Ouali", fn: "fn-jansen", geb: "2008-03-15", mobiel: "06 •• •• •• 33", email: "yasmin@voorbeeld.nl", adres: "Zwart Janstraat 4", postcode: "3035 AN", woonplaats: "Rotterdam", besch: [[6, "10:00", "22:00"], [0, "10:00", "22:00"]] },
    { k: "k-4", id: "u-k4", voornaam: "Kevin", achternaam: "Dekker", fn: "fn-jansen", geb: "1999-11-02", mobiel: "06 •• •• •• 34", email: "kevin@voorbeeld.nl", adres: "Goudsesingel 77", postcode: "3031 EH", woonplaats: "Rotterdam", besch: [1, 2, 3, 4, 5].map((d) => [d, "09:00", "18:00"]) },
    { k: "k-5", id: "u-k5", voornaam: "Milan", achternaam: "Peeters", fn: "fn-jansen", geb: "2007-05-05", mobiel: "06 •• •• •• 35", email: "milan@voorbeeld.nl", adres: "Oostzeedijk 30", postcode: "3063 BE", woonplaats: "Rotterdam", besch: [[1, "16:00", "21:00"], [3, "16:00", "21:00"]] },
  ] as const;
  for (const d of dossiers) {
    await db.insert(t.gebruiker).values({ id: d.id, voornaam: d.voornaam, achternaam: d.achternaam, rol: "medewerker", functieId: "f-medewerker", franchisenemerId: d.fn, mobiel: d.mobiel, email: d.email, geboortedatum: d.geb, inDienstSinds: isoDatum(new Date()), personeelsnummer: `K-${d.k}`, actief: false, status: "kandidaat", persoonsgegevens: { adres: d.adres, postcode: d.postcode, woonplaats: d.woonplaats } });
    await db.insert(t.beschikbaarheid).values(d.besch.map(([weekdag, van, tot]) => ({ gebruikerId: d.id, weekdag: weekdag as number, van: van as string, tot: tot as string })));
  }
  await db.insert(t.dossierDocument).values({ id: "dd-cv-kevin", gebruikerId: "u-k4", categorie: "cv", titel: "CV", bestandsnaam: "cv-kevin-dekker.pdf", mime: "text/plain", grootte: 1, inhoud: Buffer.from("Kevin Dekker\nShiftleider, Lunchroom De Kaap (2022–2025)\nMBO Horeca niveau 4").toString("base64") });
  await db.insert(t.kandidaat).values([
    { id: "k-1", gebruikerId: "u-k1", vacatureId: "vac-centrum", voornaam: "Daphne", achternaam: "Verhoeven", email: "daphne@voorbeeld.nl", mobiel: "06 •• •• •• 31", geboortedatum: "2009-09-01", motivatie: "Ik wil graag mijn eerste bijbaan en eet zelf ook graag bij Bram Ladage!", fase: "nieuw", tijd: uur(-5) },
    { id: "k-2", gebruikerId: "u-k2", vacatureId: "vac-centrum", voornaam: "Thijs", achternaam: "Koster", email: "thijs@voorbeeld.nl", mobiel: "06 •• •• •• 32", geboortedatum: "2006-01-12", motivatie: "Ik studeer en zoek 12 uur per week.", bron: "referral", aangedragenDoor: "u-sanne", fase: "gesprek", gesprekOp: uur(26), notities: [notitie("u-noor", -20, "Telefonisch gesproken, enthousiast. Gesprek ingepland.")], tijd: uur(-48) },
    { id: "k-3", gebruikerId: "u-k3", vacatureId: "vac-centrum", voornaam: "Yasmin", achternaam: "Ouali", email: "yasmin@voorbeeld.nl", mobiel: "06 •• •• •• 33", geboortedatum: "2008-03-15", fase: "proefdraaien", gesprekOp: uur(-60), beoordeling: 4, notities: [notitie("u-noor", -60, "Goed gesprek, vriendelijk en rustig."), notitie("u-noor", -50, "Proefdraaien zaterdag 11–14 uur met Yara.")], tijd: uur(-24 * 6) },
    { id: "k-4", gebruikerId: "u-k4", vacatureId: "vac-markt", voornaam: "Kevin", achternaam: "Dekker", email: "kevin@voorbeeld.nl", mobiel: "06 •• •• •• 34", geboortedatum: "1999-11-02", motivatie: "Drie jaar shiftleider geweest bij een lunchroom.", beschikbaarheid: "Fulltime beschikbaar", fase: "aanbod", gesprekOp: uur(-24 * 3), beoordeling: 5, notities: [notitie("u-erik", -70, "Sterke kandidaat. Aanbod: 32 uur, € 16,90.")], tijd: uur(-24 * 5) },
    { id: "k-5", gebruikerId: "u-k5", vacatureId: "vac-centrum", voornaam: "Milan", achternaam: "Peeters", email: "milan@voorbeeld.nl", mobiel: "06 •• •• •• 35", geboortedatum: "2007-05-05", fase: "afgewezen", notities: [notitie("u-noor", -100, "Niet beschikbaar in het weekend, past niet bij de vacature.")], tijd: uur(-24 * 9) },
  ]);

  // Preboarding: Lotte start volgende week
  const startLotte = deadlineVan(ma, 7);
  await db.insert(t.gebruiker).values({ id: "u-lotte", voornaam: "Lotte", achternaam: "de Boer", rol: "medewerker", functieId: "f-medewerker", franchisenemerId: "fn-jansen", mobiel: "06 •• •• •• 41", inDienstSinds: startLotte, personeelsnummer: "LOTTE0", actief: false, status: "preboarding", geboortedatum: "2008-08-08", email: "lotte@voorbeeld.nl", uitnodigingToken: "welkom-lotte", agendaToken: "ag-lotte", persoonsgegevens: {} });
  await db.insert(t.gebruikerVestiging).values({ gebruikerId: "u-lotte", vestigingId: "v-centrum" });
  await db.insert(t.gebruikerPositie).values([{ gebruikerId: "u-lotte", positieId: "pos-kassa" }, { gebruikerId: "u-lotte", positieId: "pos-uitgifte" }]);
  await db.insert(t.kandidaat).values({ id: "k-6", vacatureId: "vac-centrum", voornaam: "Lotte", achternaam: "de Boer", email: "lotte@voorbeeld.nl", mobiel: "06 •• •• •• 41", geboortedatum: "2008-08-08", fase: "aangenomen", gebruikerId: "u-lotte", beoordeling: 4, notities: [notitie("u-noor", -24 * 8, "Proefdraaien ging top. Aangenomen!")], tijd: uur(-24 * 14) });
  {
    const tekst = contractTekst({ werkgever: fnNaam("fn-jansen"), vestigingen: ["Centrum"], naam: "Lotte de Boer", geboortedatum: "2008-08-08", functie: "Medewerker Bakken & Uitgifte", type: "minmax", urenMin: 8, urenMax: 16, uurloon: 10.85, start: startLotte, eind: deadlineVan(startLotte, 364), proeftijdTot: deadlineVan(startLotte, 30), volgnummer: 1 });
    await db.insert(t.contract).values({ id: "ct-lotte-1", gebruikerId: "u-lotte", volgnummer: 1, type: "minmax", urenMin: 8, urenMax: 16, uurloon: 10.85, functieId: "f-medewerker", start: startLotte, eind: deadlineVan(startLotte, 364), proeftijdTot: deadlineVan(startLotte, 30), tekst, status: "ter-ondertekening", documentHash: hashVan(tekst), aangemaaktDoor: "u-noor" });
  }
  const taken = (id: string, fase: keyof typeof LIFECYCLE, basis: string, klaar: string[] = []) =>
    LIFECYCLE[fase].map((s, i) => ({ id: `lc-${id.slice(2)}-${fase}-${s.sleutel}`, gebruikerId: id, fase, sleutel: s.sleutel, titel: s.titel, wie: s.wie, volgorde: i, deadline: deadlineVan(basis, s.dagen ?? 0), klaar: klaar.includes(s.sleutel) ? uur(-30) : null, klaarDoor: klaar.includes(s.sleutel) ? id : null }));
  await db.insert(t.lifecycleTaak).values([
    ...taken("u-lotte", "preboarding", startLotte, ["gegevens"]),
    ...taken("u-mo", "onboarding", "2026-10-20", ["voorstellen", "checkin-1"]),
  ]);

  // Offboarding: Lars stopt eind van de maand
  const laatsteDag = dag(19);
  await db.update(t.gebruiker).set({ uitDienstPer: laatsteDag, uitDienstReden: "Gaat studeren in een andere stad" }).where(eq(t.gebruiker.id, "u-lars"));
  await db.insert(t.lifecycleTaak).values(taken("u-lars", "offboarding", laatsteDag, ["verlof"]));
}
