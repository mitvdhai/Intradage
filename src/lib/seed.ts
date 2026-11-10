import type {
  Bericht, Beoordeling, ChatBericht, ChatGroep, Document, Franchisenemer, Gebruiker,
  HandboekDoc, LeerItem, LeerVoortgang, LeesStatus, Reactie, Regio, RuilVerzoek, Salarisgegevens, Vestiging,
} from "./types";

// Demodata. Namen van franchisenemers en vestigingen zijn fictief.

const nu = new Date();
const dagen = (n: number) => new Date(nu.getTime() + n * 86400000).toISOString();
const uren = (n: number) => new Date(nu.getTime() + n * 3600000).toISOString();

export const REGIO: Regio[] = [
  { id: "r-zh", naam: "Zuid-Holland" },
  { id: "r-mid", naam: "Midden" },
];

export const FRANCHISENEMERS: Franchisenemer[] = [
  { id: "fn-jansen", naam: "Jansen Frites B.V.", regioId: "r-zh" },
  { id: "fn-devries", naam: "De Vries Horeca", regioId: "r-zh" },
  { id: "fn-bakker", naam: "Bakker & Zn.", regioId: "r-mid" },
];

export const VESTIGINGEN: Vestiging[] = [
  { id: "v-centrum", naam: "Centrum", plaats: "Rotterdam", franchisenemerId: "fn-jansen" },
  { id: "v-markt", naam: "Markt", plaats: "Rotterdam", franchisenemerId: "fn-jansen" },
  { id: "v-station", naam: "Station", plaats: "Delft", franchisenemerId: "fn-devries" },
  { id: "v-plein", naam: "Plein", plaats: "Gouda", franchisenemerId: "fn-bakker" },
];

const g = (p: Partial<Gebruiker> & Pick<Gebruiker, "id" | "voornaam" | "achternaam" | "rol">): Gebruiker => ({
  vestigingIds: [], mobiel: "06 12 34 56 78", inDienstSinds: "2025-03-01", personeelsnummer: p.id.toUpperCase(), ...p,
});

export const GEBRUIKERS: Gebruiker[] = [
  g({ id: "u-sanne", voornaam: "Sanne", achternaam: "de Wit", rol: "medewerker", functieId: "f-medewerker", vestigingIds: ["v-centrum"], franchisenemerId: "fn-jansen", inDienstSinds: "2025-03-03", verjaardag: "05-14", toonVerjaardag: true, mobiel: "06 •• •• •• 12" }),
  g({ id: "u-daan", voornaam: "Daan", achternaam: "Visser", rol: "medewerker", functieId: "f-medewerker", vestigingIds: ["v-centrum"], franchisenemerId: "fn-jansen", inDienstSinds: "2024-09-01", verjaardag: "11-19", toonVerjaardag: true }),
  g({ id: "u-mo", voornaam: "Mo", achternaam: "El Amrani", rol: "medewerker", functieId: "f-medewerker", vestigingIds: ["v-centrum"], franchisenemerId: "fn-jansen", inDienstSinds: "2026-10-20" }),
  g({ id: "u-yara", voornaam: "Yara", achternaam: "Bos", rol: "shiftleider", functieId: "f-shiftleider", vestigingIds: ["v-centrum"], franchisenemerId: "fn-jansen", inDienstSinds: "2023-05-01" }),
  g({ id: "u-lars", voornaam: "Lars", achternaam: "Kok", rol: "medewerker", functieId: "f-medewerker", vestigingIds: ["v-markt"], franchisenemerId: "fn-jansen" }),
  g({ id: "u-noor", voornaam: "Noor", achternaam: "Smit", rol: "manager", functieId: "f-manager", vestigingIds: ["v-centrum", "v-markt"], franchisenemerId: "fn-jansen", inDienstSinds: "2021-01-01" }),
  g({ id: "u-erik", voornaam: "Erik", achternaam: "Jansen", rol: "franchisenemer", vestigingIds: ["v-centrum", "v-markt"], franchisenemerId: "fn-jansen", inDienstSinds: "2019-01-01" }),
  g({ id: "u-ilse", voornaam: "Ilse", achternaam: "de Vries", rol: "franchisenemer", vestigingIds: ["v-station"], franchisenemerId: "fn-devries" }),
  g({ id: "u-tim", voornaam: "Tim", achternaam: "Peters", rol: "medewerker", functieId: "f-medewerker", vestigingIds: ["v-station"], franchisenemerId: "fn-devries" }),
  g({ id: "u-lisa", voornaam: "Lisa", achternaam: "Ladage", rol: "hq", discipline: "kwaliteit" }),
  g({ id: "u-joost", voornaam: "Joost", achternaam: "Meijer", rol: "hq", discipline: "hr" }),
];

/** Personen waarmee je in de demo kunt inloggen. */
export const PERSONAS = [
  { id: "u-sanne", uitleg: "Medewerker, 17 jaar, parttime · ziet alleen haar eigen functie" },
  { id: "u-yara", uitleg: "Shiftleider · zelfde app, andere functie en profiel" },
  { id: "u-erik", uitleg: "Franchisenemer · beoordeelt zijn team, ziet alleen eigen vestigingen" },
  { id: "u-lisa", uitleg: "HQ Kwaliteit · beheeromgeving, berichten en evaluaties" },
  { id: "u-joost", uitleg: "HQ HR · beheert functiehuis en beloningsregeling" },
];

export const BERICHTEN: Bericht[] = [
  { id: "b-allergenen", titel: "Nieuwe allergenenkaart vanaf maandag", urgentie: "verplicht", vastgezet: true,
    afzender: { type: "hq", discipline: "kwaliteit" }, doelgroep: {}, gepubliceerd: uren(-2), handboekDocId: "d-allergenen",
    inhoud: "Vanaf maandag hangt bij elke kassa de nieuwe allergenenkaart. Wat verandert er?\n- Saus X bevat nu mosterd\n- Twijfel je? Vraag het je shiftleider\n- Gooi de oude kaart direct weg" },
  { id: "b-record", titel: "Record op zaterdag! 🍟", urgentie: "info", vastgezet: false,
    afzender: { type: "fn", franchisenemerId: "fn-jansen", naam: "Erik (franchisenemer)" }, doelgroep: { franchisenemerIds: ["fn-jansen"] }, gepubliceerd: uren(-20),
    inhoud: "Wat een zaterdag! Centrum en Markt samen het beste resultaat ooit. Dank aan iedereen die stond. Vrijdag trakteer ik." },
  { id: "b-kruiden", titel: "Nieuwe kruidenmix vanaf 1 december", urgentie: "belangrijk", vastgezet: false,
    afzender: { type: "hq", discipline: "inkoop" }, doelgroep: { rollen: ["shiftleider", "manager", "franchisenemer"] }, gepubliceerd: dagen(-1),
    inhoud: "Vanaf 1 december leveren we een nieuwe kruidenmix. Bestel vanaf nu alleen nog de nieuwe artikelcode. De oude voorraad mag je opmaken." },
  { id: "b-campagne", titel: "Campagne 'Winterbram' start 1 december", urgentie: "info", vastgezet: false,
    afzender: { type: "hq", discipline: "marketing" }, doelgroep: {}, gepubliceerd: dagen(-2),
    inhoud: "In december staat de Snert Stoof op de kaart. Posters komen in week 47. Instructies voor de bereiding vind je in het handboek." },
  { id: "b-fn-overleg", titel: "FN-overleg 25 november", urgentie: "belangrijk", vastgezet: false,
    afzender: { type: "hq", discipline: "operations" }, doelgroep: { rollen: ["franchisenemer"] }, gepubliceerd: dagen(-3),
    inhoud: "Graag zien we alle franchisenemers op 25 november in Rotterdam. Op de agenda: evaluatieresultaten Q3 en de uitrol van Intradage." },
];

export const LEESSTATUS: Record<string, Record<string, LeesStatus>> = {
  "b-allergenen": { "u-daan": { gelezen: uren(-1), bevestigd: uren(-1) }, "u-yara": { gelezen: uren(-1.5), bevestigd: uren(-1.5) }, "u-lars": { gelezen: uren(-1) } },
  "b-record": { "u-sanne": { gelezen: uren(-10) }, "u-daan": { gelezen: uren(-9) } },
};

export const REACTIES: Reactie[] = [
  { id: "r1", berichtId: "b-record", gebruikerId: "u-yara", tekst: "Topteam! 💪", tijd: uren(-18) },
  { id: "r2", berichtId: "b-record", gebruikerId: "u-daan", tekst: "Was echt druk maar gezellig", tijd: uren(-17) },
  { id: "r3", berichtId: "b-allergenen", gebruikerId: "u-daan", tekst: "Geldt dit ook voor de vega-saus?", tijd: uren(-1) },
];

export const CHAT_GROEPEN: ChatGroep[] = [
  { id: "g-centrum", naam: "Team Centrum", type: "vestiging", vestigingId: "v-centrum" },
  { id: "g-markt", naam: "Team Markt", type: "vestiging", vestigingId: "v-markt" },
  { id: "g-station", naam: "Team Station", type: "vestiging", vestigingId: "v-station" },
  { id: "g-jansen", naam: "Jansen Frites – iedereen", type: "franchisenemer", franchisenemerId: "fn-jansen" },
  { id: "g-shiftleiders", naam: "Shiftleiders", type: "shiftleiders" },
  { id: "g-hq", naam: "Aankondigingen HQ", type: "hq-kanaal", alleenLezen: true },
];

export const CHAT_BERICHTEN: ChatBericht[] = [
  { id: "c1", groepId: "g-centrum", gebruikerId: "u-erik", tekst: "Morgen levering om 7:30 i.p.v. 8:00. Wie opent?", tijd: uren(-3) },
  { id: "c2", groepId: "g-centrum", gebruikerId: "u-yara", tekst: "Ik open 👍", tijd: uren(-2.8) },
  { id: "c3", groepId: "g-centrum", gebruikerId: "u-mo", tekst: "Kan iemand mijn zaterdag overnemen? Familiefeest.", tijd: uren(-1), ruilDienstId: "d-mo-za" },
  { id: "c4", groepId: "g-shiftleiders", gebruikerId: "u-noor", tekst: "Denk aan de nieuwe allergenenkaart bij de briefing.", tijd: uren(-4) },
  { id: "c5", groepId: "g-hq", gebruikerId: "u-lisa", tekst: "Welkom in Intradage! Vragen over de app? Stel ze hier aan je shiftleider.", tijd: dagen(-1) },
];

export const RUILVERZOEKEN: RuilVerzoek[] = [
  { id: "rv-mo", dienstId: "d-mo-za", aangebodenDoor: "u-mo", status: "open" },
];

export const LEERITEMS: LeerItem[] = [
  { id: "l-welkom", titel: "Welkom bij Bram Ladage", type: "video", duurMin: 3, functieIds: [], onboarding: true, volgorde: 1,
    inhoud: "Sinds 1967 bakt Bram Ladage verse patat van echte aardappelen. In deze video hoor je waarom dat verschil maakt, en wat we van elkaar verwachten." },
  { id: "l-handen", titel: "Handen wassen, de juiste manier", type: "video", duurMin: 2, functieIds: [], onboarding: true, volgorde: 2,
    inhoud: "Was je handen bij elke taakwissel, na pauze en na het aanraken van afval. 20 seconden, ook tussen je vingers.", profielItemId: "c-hygiene" },
  { id: "l-frituur", titel: "Quiz: frituurvet verversen", type: "quiz", duurMin: 3, functieIds: ["f-medewerker", "f-shiftleider"], onboarding: true, volgorde: 3,
    inhoud: "Test je kennis over frituurvet.", profielItemId: "v-bakken", handboekDocId: "d-bakken",
    quiz: [
      { vraag: "Hoe lang mag gebakken patat in de warmhoudbak blijven?", opties: ["3 minuten", "7 minuten", "15 minuten"], juist: 1 },
      { vraag: "Wat doe je als het vet donker kleurt en schuimt?", opties: ["Bijvullen met vers vet", "Doorbakken tot sluitingstijd", "Melden en verversen volgens instructie"], juist: 2 },
    ] },
  { id: "l-puntzak", titel: "Challenge: de perfecte puntzak", type: "challenge", duurMin: 5, functieIds: ["f-medewerker"], onboarding: true, volgorde: 4,
    inhoud: "Vul een puntzak volgens de standaard: tot 1 cm onder de rand, saus ernaast in het bakje. Maak een foto en dien hem in; je franchisenemer beoordeelt hem.", profielItemId: "v-bakken" },
  { id: "l-allergenen", titel: "Allergenen: wat moet je weten?", type: "module", duurMin: 8, functieIds: [], onboarding: true, volgorde: 5,
    inhoud: "Je leert de 14 allergenen, hoe je de allergenenkaart gebruikt en wat je doet als je het niet zeker weet.", profielItemId: "k-allergenen", handboekDocId: "d-allergenen" },
  { id: "l-kassa", titel: "Kassa-tips voor drukke momenten", type: "module", duurMin: 6, functieIds: ["f-medewerker", "f-shiftleider"],
    inhoud: "Sneltoetsen, retouren en wat je doet als de pin uitvalt.", profielItemId: "v-kassa" },
  { id: "l-shift", titel: "Een shift indelen in 5 stappen", type: "module", duurMin: 10, functieIds: ["f-shiftleider", "f-manager"],
    inhoud: "Van briefing tot overdracht: zo zorg je dat iedereen weet wat hij doet.", profielItemId: "v-shift" },
];

export const VOORTGANG: LeerVoortgang[] = [
  { gebruikerId: "u-sanne", itemId: "l-welkom", status: "afgerond", tijd: dagen(-10) },
  { gebruikerId: "u-sanne", itemId: "l-handen", status: "afgerond", tijd: dagen(-9) },
  { gebruikerId: "u-sanne", itemId: "l-allergenen", status: "afgerond", tijd: dagen(-5) },
  { gebruikerId: "u-daan", itemId: "l-puntzak", status: "ingediend", inzending: "Foto: puntzak met mayonaise ernaast", tijd: uren(-6) },
  { gebruikerId: "u-mo", itemId: "l-welkom", status: "afgerond", tijd: dagen(-3) },
];

export const HANDBOEK: HandboekDoc[] = [
  { id: "d-bakken", titel: "Bakinstructie patat", versie: "3.1", eigenaar: "operations", bijgewerkt: dagen(-40), reviewVoor: dagen(140), doelgroep: {},
    inhoud: `## Voorbereiden
Controleer bij de start van de dienst de temperatuur van de friteuses: voorbakken op 160 °C, afbakken op 180 °C. Noteer de temperatuur op de HACCP-lijst.

## Afbakken
Bak een portie af tot hij goudgeel is, ongeveer 2,5 minuut. Schud het mandje halverwege. Laat de patat 10 seconden uitlekken.

## Warmhoudbak
Gebakken patat mag maximaal 7 minuten in de warmhoudbak blijven. Daarna gooi je hem weg, ook als hij er nog goed uitziet. Zet bij elke nieuwe portie de timer.

## Frituurvet
Ververs het vet volgens het schema of eerder als het donker kleurt, schuimt of rookt. Meld dit aan de shiftleider en noteer het op de vetlijst.` },
  { id: "d-allergenen", titel: "Allergenen", versie: "4.2", eigenaar: "kwaliteit", bijgewerkt: dagen(-2), reviewVoor: dagen(90), doelgroep: {},
    inhoud: `## Allergenenkaart
Bij elke kassa hangt de actuele allergenenkaart. Gebruik altijd de kaart; zeg nooit uit je hoofd dat iets veilig is.

## Wijzigingen november
Saus X bevat sinds deze maand mosterd. De vega-saus is ongewijzigd. Gooi de oude kaart weg.

## Twijfel
Weet je het niet zeker? Vraag het je shiftleider. Een gast met een allergie help je liever langzaam dan fout.

## Kruisbesmetting
Snacks worden mogelijk samen met andere snacks gebakken. Vertel dit aan gasten die vragen naar vegetarisch, veganistisch of halal.` },
  { id: "d-openen", titel: "Openen en sluiten", versie: "2.0", eigenaar: "operations", bijgewerkt: dagen(-60), reviewVoor: dagen(-5), doelgroep: { rollen: ["shiftleider", "manager", "franchisenemer"] },
    inhoud: `## Openen
Zet 45 minuten voor opening de friteuses aan. Controleer de koeling (maximaal 7 °C) en noteer de waarde. Tel de kassalade.

## Sluiten
Filter het vet, maak de friteuses schoon en zet ze uit. Tel de kassa af en doe de afdracht. Controleer of alle deuren en ramen dicht zijn.` },
  { id: "d-hygiene", titel: "Hygiënecode", versie: "5.0", eigenaar: "kwaliteit", bijgewerkt: dagen(-30), reviewVoor: dagen(200), doelgroep: {},
    inhoud: `## Handen wassen
Was je handen bij elke taakwissel, na de pauze, na toiletbezoek en na het aanraken van afval. Minimaal 20 seconden.

## Koeling
De koelcel mag maximaal 7 °C zijn. Is het warmer? Meld het direct aan de shiftleider en verplaats de producten.

## Kleding
Draag schone werkkleding en een haarnetje of pet. Sieraden aan handen en polsen zijn niet toegestaan.` },
  { id: "d-snert", titel: "Snert Stoof bereiden", versie: "1.0", eigenaar: "marketing", bijgewerkt: dagen(-2), reviewVoor: dagen(60), doelgroep: {},
    inhoud: `## Bereiding
Verwarm de snert tot minimaal 75 °C kerntemperatuur. Serveer over een portie verse patat, met een plak rookworst erbij.

## Bewaren
Opgewarmde snert mag maximaal 2 uur warm worden gehouden.` },
];

export const SALARIS: Salarisgegevens[] = [
  { gebruikerId: "u-sanne", uurloon: 15.2, schaalMin: 14.99, schaalMax: 17.1 },
  { gebruikerId: "u-daan", uurloon: 15.9, schaalMin: 14.99, schaalMax: 17.1 },
  { gebruikerId: "u-mo", uurloon: 14.99, schaalMin: 14.99, schaalMax: 17.1 },
  { gebruikerId: "u-lars", uurloon: 15.4, schaalMin: 14.99, schaalMax: 17.1 },
  { gebruikerId: "u-yara", uurloon: 16.4, schaalMin: 15.21, schaalMax: 18.4 },
  { gebruikerId: "u-noor", uurloon: 19.8, schaalMin: 17.61, schaalMax: 22.5 },
  { gebruikerId: "u-tim", uurloon: 15.0, schaalMin: 14.99, schaalMax: 17.1 },
];

export const BEOORDELINGEN: Beoordeling[] = [
  { id: "bo-sanne", gebruikerId: "u-sanne", functieId: "f-medewerker", beoordelaarId: "u-erik", periode: "2026", status: "beoordelen",
    zelf: { "c-gastgericht": 3, "c-samenwerken": 3, "c-hygiene": 2, "c-stress": 2, "v-bakken": 3, "v-kassa": 2, "v-openen": 2, "v-voorraad": 2, "v-allergenen": 3, "k-haccp": 2, "k-allergenen": 2 },
    beoordelaar: { "c-gastgericht": 3, "c-samenwerken": 3, "c-hygiene": 3 },
    bijgewerkt: dagen(-1) },
  { id: "bo-daan", gebruikerId: "u-daan", functieId: "f-medewerker", beoordelaarId: "u-erik", periode: "2026", status: "zelfbeoordeling",
    zelf: {}, beoordelaar: {}, bijgewerkt: dagen(-2) },
  { id: "bo-yara", gebruikerId: "u-yara", functieId: "f-shiftleider", beoordelaarId: "u-erik", periode: "2026", status: "besloten",
    zelf: {}, beoordelaar: { "c-leiding": 3, "c-gastgericht": 3, "c-hygiene": 4, "c-stress": 3, "v-shift": 3, "v-bakken": 4, "v-kassa": 4, "v-openen": 4, "v-inwerken": 4, "k-haccp": 2, "k-allergenen": 3, "k-bhv": 2 },
    besluit: { percentage: 3, nieuwUurloon: 16.89, door: "u-erik", tijd: dagen(-4), toelichting: "Sterke shiftleider, inwerken van Mo ging uitstekend." },
    bijgewerkt: dagen(-4) },
];

/** Behaalde niveaus uit de laatst afgeronde beoordeling of startniveau, voor "Mijn profiel". */
export const HUIDIG_NIVEAU: Record<string, Record<string, number>> = {
  "u-sanne": { "c-gastgericht": 3, "c-samenwerken": 2, "c-hygiene": 2, "c-stress": 2, "v-bakken": 3, "v-kassa": 2, "v-openen": 2, "v-voorraad": 2, "v-allergenen": 3, "k-haccp": 2, "k-allergenen": 2 },
  "u-yara": { "c-leiding": 3, "c-gastgericht": 3, "c-hygiene": 4, "c-stress": 3, "v-shift": 3, "v-bakken": 4, "v-kassa": 4, "v-openen": 4, "v-inwerken": 4, "k-haccp": 2, "k-allergenen": 3, "k-bhv": 2 },
};

export function maakDocumenten(): Document[] {
  const lijst: Document[] = [];
  for (const u of GEBRUIKERS.filter((x) => x.rol !== "hq")) {
    for (let m = 1; m <= 3; m++) {
      const d = new Date(nu.getFullYear(), nu.getMonth() - m, 25);
      lijst.push({ id: `doc-${u.id}-${m}`, gebruikerId: u.id, type: "loonstrook", titel: d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" }), datum: d.toISOString() });
    }
    lijst.push({ id: `doc-${u.id}-contract`, gebruikerId: u.id, type: "contract", titel: "Arbeidsovereenkomst", datum: u.inDienstSinds });
  }
  return lijst;
}
