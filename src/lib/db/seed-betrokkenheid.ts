import type { DB } from "./client";
import * as t from "./schema";
import type { ChecklistOnderdeel } from "./schema";

// Demodata voor tijdlijn, waardering, enquêtes, evenementen en checklists.
// De kernwaarden zijn voorbeelden: vaststellen met HQ.

const nu = Date.now();
const uren = (n: number) => new Date(nu + n * 3600000);
const dagen = (n: number) => new Date(nu + n * 86400000);
const datum = (n: number) => dagen(n).toISOString().slice(0, 10);
const opDag = (n: number, uur: number) => { const d = dagen(n); d.setHours(uur, 0, 0, 0); return d; };

export const EVALUATIE_KWALITEIT: ChecklistOnderdeel[] = [
  { id: "hyg", naam: "Hygiëne", weging: 30, vragen: [
    { id: "hyg-1", tekst: "Werkbanken schoon en vrij", type: "score" },
    { id: "hyg-2", tekst: "Temperatuur koelcel", type: "meting", max: 7, eenheid: "°C", knockout: true },
    { id: "hyg-3", tekst: "Handen wassen bij taakwissel", type: "score" },
    { id: "hyg-4", tekst: "HACCP-registraties bijgewerkt", type: "ja-nee", knockout: true },
  ] },
  { id: "prod", naam: "Productkwaliteit", weging: 40, vragen: [
    { id: "prod-1", tekst: "Patat goudgeel en krokant", type: "score" },
    { id: "prod-2", tekst: "Warmhoudtijd ≤ 7 minuten", type: "meting", max: 7, eenheid: "min" },
    { id: "prod-3", tekst: "Puntzak volgens standaard gevuld", type: "score" },
    { id: "prod-4", tekst: "Vet ververst volgens schema", type: "ja-nee" },
  ] },
  { id: "klant", naam: "Klantvriendelijkheid", weging: 30, vragen: [
    { id: "kl-1", tekst: "Gast binnen 10 seconden begroet", type: "ja-nee" },
    { id: "kl-2", tekst: "Vriendelijk en vlot geholpen", type: "score" },
    { id: "kl-3", tekst: "Allergenenvraag correct beantwoord", type: "ja-nee", knockout: true },
  ] },
];

const OPENEN: ChecklistOnderdeel[] = [
  { id: "o", naam: "Openen", weging: 100, vragen: [
    { id: "o-1", tekst: "Friteuses 45 min voor opening aan", type: "ja-nee" },
    { id: "o-2", tekst: "Temperatuur koelcel", type: "meting", max: 7, eenheid: "°C", knockout: true },
    { id: "o-3", tekst: "Temperatuur friteuse afbakken", type: "meting", eenheid: "°C" },
    { id: "o-4", tekst: "Kassalade geteld", type: "ja-nee" },
    { id: "o-5", tekst: "Allergenenkaart hangt bij de kassa", type: "ja-nee" },
  ] },
];
const SLUITEN: ChecklistOnderdeel[] = [
  { id: "s", naam: "Sluiten", weging: 100, vragen: [
    { id: "s-1", tekst: "Vet gefilterd", type: "ja-nee" },
    { id: "s-2", tekst: "Friteuses schoon en uit", type: "ja-nee" },
    { id: "s-3", tekst: "Kassa afgeteld en afgedragen", type: "ja-nee" },
    { id: "s-4", tekst: "Deuren en ramen dicht", type: "ja-nee" },
  ] },
];
const HACCP: ChecklistOnderdeel[] = [
  { id: "t", naam: "Temperaturen", weging: 100, vragen: [
    { id: "t-1", tekst: "Koelcel", type: "meting", max: 7, eenheid: "°C", knockout: true },
    { id: "t-2", tekst: "Vriezer", type: "meting", max: -18, eenheid: "°C", knockout: true },
    { id: "t-3", tekst: "Snert in warmhoudpan (≥ 75 °C)", type: "ja-nee" },
  ] },
];

/** Antwoorden die op een bepaald cijfer uitkomen, voor de demodata. */
function antwoorden(niveau: "goed" | "matig" | "ko") {
  const s = niveau === "goed" ? 5 : 3;
  return {
    "hyg-1": { waarde: s }, "hyg-2": { waarde: niveau === "ko" ? 9 : 4, opmerking: niveau === "ko" ? "Deur van de koelcel sluit niet goed" : undefined },
    "hyg-3": { waarde: s }, "hyg-4": { waarde: true },
    "prod-1": { waarde: s }, "prod-2": { waarde: niveau === "goed" ? 5 : 8 }, "prod-3": { waarde: niveau === "goed" ? 4 : 3 }, "prod-4": { waarde: true },
    "kl-1": { waarde: niveau !== "matig" }, "kl-2": { waarde: niveau === "goed" ? 5 : 3 }, "kl-3": { waarde: true },
  };
}

export async function seedBetrokkenheid(db: DB) {
  const { berekenChecklist } = await import("../checklist/score");

  await db.insert(t.waarde).values([
    { id: "w-gastvrij", naam: "Gastvrij", omschrijving: "Elke gast voelt zich welkom", emoji: "😊", volgorde: 1 },
    { id: "w-samen", naam: "Samen", omschrijving: "We helpen elkaar, ook als het druk is", emoji: "🤝", volgorde: 2 },
    { id: "w-vakmanschap", naam: "Vakmanschap", omschrijving: "Elke puntzak volgens de standaard", emoji: "🍟", volgorde: 3 },
    { id: "w-schoon", naam: "Schoon & veilig", omschrijving: "Hygiëne en veiligheid op één", emoji: "🧼", volgorde: 4 },
    { id: "w-extra", naam: "Extra mijl", omschrijving: "Net dat beetje meer", emoji: "🚀", volgorde: 5 },
  ]);
  await db.insert(t.waardering).values([
    { id: "wd-1", vanId: "u-erik", aanId: "u-yara", waardeId: "w-samen", tekst: "Mo zo goed ingewerkt in zijn eerste week. Top gedaan!", tijd: uren(-5) },
    { id: "wd-2", vanId: "u-yara", aanId: "u-sanne", waardeId: "w-gastvrij", tekst: "Zaterdag bij de rij buiten iedereen met een glimlach geholpen 🙌", tijd: uren(-26) },
    { id: "wd-3", vanId: "u-noor", aanId: "u-daan", waardeId: "w-schoon", tekst: "Koelcel-probleem direct gezien en gemeld. Precies goed.", tijd: dagen(-3) },
    { id: "wd-4", vanId: "u-lisa", aanId: "u-lars", waardeId: "w-vakmanschap", tekst: "Hoogste score op productkwaliteit tijdens de evaluatie van Markt!", tijd: dagen(-6) },
    { id: "wd-5", vanId: "u-daan", aanId: "u-sanne", waardeId: "w-samen", tekst: "Bedankt voor het overnemen van mijn dienst!", tijd: dagen(-8) },
  ]);
  await db.insert(t.like).values([
    { doelType: "waardering", doelId: "wd-1", gebruikerId: "u-sanne" }, { doelType: "waardering", doelId: "wd-1", gebruikerId: "u-daan" },
    { doelType: "waardering", doelId: "wd-2", gebruikerId: "u-erik" }, { doelType: "bericht", doelId: "b-record", gebruikerId: "u-yara" },
    { doelType: "bericht", doelId: "b-record", gebruikerId: "u-daan" }, { doelType: "bericht", doelId: "b-record", gebruikerId: "u-mo" },
  ]);
  await db.insert(t.bericht).values({
    id: "p-mo", titel: "Eerste week erop zitten!", inhoud: "Hoi allemaal, ik ben Mo en werk sinds kort bij Centrum. Bedankt voor de warme ontvangst. Ik moet nog oefenen met de puntzak 😅",
    afzenderType: "medewerker", afzenderGebruikerId: "u-mo", afzenderNaam: "Mo", urgentie: "info", vastgezet: false,
    doelgroep: { vestigingIds: ["v-centrum"] }, gepubliceerd: uren(-30),
  });

  await db.insert(t.beloning).values([
    { id: "bl-brammetje", titel: "Brammetje + drankje", omschrijving: "Gratis puntzak met drankje tijdens je pauze", punten: 30, emoji: "🍟" },
    { id: "bl-bios", titel: "Bioscoopbon", omschrijving: "Voor één persoon, inclusief popcorn", punten: 150, emoji: "🎬" },
    { id: "bl-hoodie", titel: "Bram Ladage-hoodie", omschrijving: "Limited edition, kies je maat", punten: 250, emoji: "🧥" },
    { id: "bl-vrij", titel: "Extra vrije middag", omschrijving: "In overleg met je leidinggevende", punten: 400, emoji: "🌴" },
  ]);
  await db.insert(t.beloningAanvraag).values({ id: "ba-1", beloningId: "bl-brammetje", gebruikerId: "u-sanne", punten: 30, tijd: uren(-3) });

  await db.insert(t.enquete).values([
    { id: "e-pulse", titel: "Hoe was je week?", intro: "Eén vraag, tien seconden. Anoniem.", type: "pulse", anoniem: true, doelgroep: {}, gemaaktDoor: "u-joost", opent: dagen(-2), sluit: dagen(5),
      vragen: [{ id: "q1", type: "schaal", tekst: "Hoe voelde je je deze week op je werk?", min: 1, max: 5, labels: ["😞", "😄"] }, { id: "q2", type: "open", tekst: "Wil je er iets over kwijt? (optioneel)" }] },
    { id: "e-enps", titel: "Kwartaalvraag", intro: "Anoniem. We gebruiken de uitkomst om Bram Ladage nog beter te maken.", type: "enps", anoniem: true, doelgroep: {}, gemaaktDoor: "u-joost", opent: dagen(-5), sluit: dagen(10),
      vragen: [{ id: "q1", type: "schaal", tekst: "Hoe waarschijnlijk is het dat je Bram Ladage aanraadt als werkgever aan een vriend?", min: 0, max: 10, labels: ["Zeer onwaarschijnlijk", "Zeer waarschijnlijk"] }, { id: "q2", type: "open", tekst: "Wat is de belangrijkste reden voor je cijfer?" }] },
    { id: "e-poll", titel: "Welke wintersnack wil jij?", intro: "Stem mee voor de winteractie!", type: "poll", anoniem: false, doelgroep: {}, gemaaktDoor: "u-lisa", opent: dagen(-1), sluit: dagen(6),
      vragen: [{ id: "q1", type: "keuze", tekst: "Kies je favoriet", opties: ["Snert Stoof", "Stamppotkroket", "Patat stoofvlees"] }] },
    { id: "e-idee", titel: "Ideeënbox", intro: "Heb je een idee om het werk beter of leuker te maken? Laat het weten!", type: "idee", anoniem: false, doelgroep: {}, gemaaktDoor: "u-lisa", opent: dagen(-30), sluit: null,
      vragen: [{ id: "q1", type: "open", tekst: "Jouw idee" }] },
  ]);
  const antw = (enqueteId: string, gebruikerId: string, fn: string, a: Record<string, string | number>, anoniem: boolean) => ({ enqueteId, gebruikerId: anoniem ? null : gebruikerId, franchisenemerId: fn, antwoorden: a });
  const deel = [
    ["e-pulse", "u-daan", "fn-jansen", { q1: 4 }], ["e-pulse", "u-yara", "fn-jansen", { q1: 5, q2: "Leuk team!" }], ["e-pulse", "u-lars", "fn-jansen", { q1: 3 }],
    ["e-pulse", "u-tim", "fn-devries", { q1: 2, q2: "Te weinig bezetting op vrijdag" }], ["e-pulse", "u-noor", "fn-jansen", { q1: 4 }],
    ["e-enps", "u-daan", "fn-jansen", { q1: 9 }], ["e-enps", "u-yara", "fn-jansen", { q1: 10, q2: "Gezellig en duidelijk" }], ["e-enps", "u-lars", "fn-jansen", { q1: 7 }],
    ["e-enps", "u-tim", "fn-devries", { q1: 5, q2: "Roosters komen laat" }], ["e-enps", "u-noor", "fn-jansen", { q1: 8 }],
    ["e-poll", "u-daan", "fn-jansen", { q1: "Snert Stoof" }], ["e-poll", "u-yara", "fn-jansen", { q1: "Stamppotkroket" }], ["e-poll", "u-noor", "fn-jansen", { q1: "Snert Stoof" }],
    ["e-idee", "u-yara", "fn-jansen", { q1: "Een vaste plek voor de allergenenkaart bij de uitgifte, niet alleen bij de kassa." }],
  ] as const;
  for (const [e, g, fn, a] of deel) {
    const anoniem = e === "e-pulse" || e === "e-enps";
    await db.insert(t.enqueteDeelname).values({ enqueteId: e, gebruikerId: g });
    await db.insert(t.enqueteAntwoord).values(antw(e, g, fn, { ...a }, anoniem));
  }

  await db.insert(t.evenement).values([
    { id: "ev-bowlen", titel: "Teamavond: bowlen", omschrijving: "Na sluiting gaan we bowlen. Eten en drinken van de zaak!", start: opDag(6, 21), eind: opDag(6, 23), locatie: "Bowling Centrum, Rotterdam", doelgroep: { franchisenemerIds: ["fn-jansen"] }, gemaaktDoor: "u-erik" },
    { id: "ev-fn", titel: "FN-overleg", omschrijving: "Evaluatieresultaten Q3 en de uitrol van Intradage.", start: opDag(15, 10), eind: opDag(15, 13), locatie: "HQ Rotterdam", doelgroep: { rollen: ["franchisenemer", "manager"] }, gemaaktDoor: "u-lisa" },
    { id: "ev-winter", titel: "Kick-off Winterbram", omschrijving: "Korte livestream: zo bereid je de Snert Stoof en zo zet je de winteractie neer.", start: opDag(20, 15), eind: opDag(20, 15), locatie: "Online (link volgt)", doelgroep: {}, gemaaktDoor: "u-lisa" },
  ]);
  await db.insert(t.evenementAanmelding).values([
    { evenementId: "ev-bowlen", gebruikerId: "u-yara", status: "ja" }, { evenementId: "ev-bowlen", gebruikerId: "u-daan", status: "ja" },
    { evenementId: "ev-bowlen", gebruikerId: "u-mo", status: "misschien" }, { evenementId: "ev-fn", gebruikerId: "u-erik", status: "ja" },
  ]);

  await db.insert(t.checklistSjabloon).values([
    { id: "cl-evaluatie", titel: "Vestigingsevaluatie", soort: "evaluatie", omschrijving: "Periodieke audit door HQ Kwaliteit of de vestigingsmanager.", onderdelen: EVALUATIE_KWALITEIT, rollen: ["hq", "manager", "franchisenemer"] },
    { id: "cl-openen", titel: "Openen", soort: "dagtaak", omschrijving: "Elke ochtend vóór opening.", onderdelen: OPENEN, rollen: ["shiftleider", "manager", "franchisenemer"] },
    { id: "cl-sluiten", titel: "Sluiten", soort: "dagtaak", omschrijving: "Elke avond na sluiting.", onderdelen: SLUITEN, rollen: ["shiftleider", "manager", "franchisenemer"] },
    { id: "cl-haccp", titel: "HACCP-temperaturen", soort: "dagtaak", omschrijving: "Twee keer per dienst meten en noteren.", onderdelen: HACCP, rollen: ["medewerker", "shiftleider", "manager", "franchisenemer"] },
  ]);
  const evals = [
    { id: "ui-c1", vestigingId: "v-centrum", door: "u-lisa", d: -62, n: "matig" as const },
    { id: "ui-c2", vestigingId: "v-centrum", door: "u-lisa", d: -14, n: "goed" as const },
    { id: "ui-m1", vestigingId: "v-markt", door: "u-lisa", d: -20, n: "matig" as const },
    { id: "ui-s1", vestigingId: "v-station", door: "u-lisa", d: -9, n: "ko" as const },
  ];
  for (const e of evals) {
    const a = antwoorden(e.n);
    const u = berekenChecklist(EVALUATIE_KWALITEIT, a);
    await db.insert(t.checklistUitvoering).values({ id: e.id, sjabloonId: "cl-evaluatie", sjabloonVersie: 1, vestigingId: e.vestigingId, uitgevoerdDoor: e.door, datum: dagen(e.d), antwoorden: a, score: u.cijfer, knockout: u.knockouts.length > 0, status: "afgerond" });
  }
  await db.insert(t.checklistUitvoering).values({ id: "ui-open-1", sjabloonId: "cl-openen", sjabloonVersie: 1, vestigingId: "v-centrum", uitgevoerdDoor: "u-yara", datum: dagen(-1), antwoorden: { "o-1": { waarde: true }, "o-2": { waarde: 5 }, "o-3": { waarde: 180 }, "o-4": { waarde: true }, "o-5": { waarde: true } }, score: 10, status: "afgerond" });
  await db.insert(t.actiepunt).values([
    { id: "ap-1", uitvoeringId: "ui-s1", vestigingId: "v-station", tekst: "Monteur laten kijken naar de deur van de koelcel", eigenaarId: "u-ilse", deadline: datum(2) },
    { id: "ap-2", uitvoeringId: "ui-m1", vestigingId: "v-markt", tekst: "Warmhoudtijd: timer bij elke portie gebruiken, team briefen", eigenaarId: "u-noor", deadline: datum(-3) },
    { id: "ap-3", uitvoeringId: "ui-c1", vestigingId: "v-centrum", tekst: "Begroeting binnen 10 seconden oefenen in de briefing", eigenaarId: "u-noor", deadline: datum(-40), status: "klaar" },
  ]);
}
