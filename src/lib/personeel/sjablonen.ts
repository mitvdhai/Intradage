// Sjablonen voor personeelsbeheer: contracttekst en de stappen van pre-, on- en offboarding.
// Bewust in code en niet in een editor: de juridische tekst hoort bij een versie die HQ HR laat toetsen.

export const CONTRACT_SJABLOON_VERSIE = "horeca-2026.1";

const TYPE_TEKST = {
  oproep: "oproepovereenkomst met uitgestelde prestatieplicht (0-urencontract)",
  minmax: "min-maxcontract",
  vast: "arbeidsovereenkomst met een vaste arbeidsduur",
} as const;

const euro = (n: number) => `€ ${n.toFixed(2).replace(".", ",")}`;
const datumNL = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

export function contractTekst(c: {
  werkgever: string; vestigingen: string[]; naam: string; geboortedatum?: string | null; functie: string;
  type: keyof typeof TYPE_TEKST; urenMin: number; urenMax: number; uurloon: number; start: string; eind?: string | null; proeftijdTot?: string | null; volgnummer: number;
}) {
  const uren = c.type === "oproep" ? "Er is geen vast aantal uren afgesproken. Je werkgever roept je minstens 4 dagen van tevoren op."
    : c.type === "minmax" ? `Je werkt minimaal ${c.urenMin} en maximaal ${c.urenMax} uur per week, volgens het rooster.`
    : `Je werkt ${c.urenMax} uur per week, volgens het rooster.`;
  return [
    `ARBEIDSOVEREENKOMST (${TYPE_TEKST[c.type]})`,
    `Sjabloon ${CONTRACT_SJABLOON_VERSIE} · contract ${c.volgnummer} in de keten`,
    "",
    `1. Partijen. ${c.werkgever}, franchisenemer van Bram Ladage (hierna: de werkgever), en ${c.naam}${c.geboortedatum ? `, geboren op ${datumNL(c.geboortedatum)}` : ""} (hierna: de werknemer).`,
    `2. Functie en plaats. De werknemer treedt in dienst als ${c.functie}. Het werk wordt verricht in de vestiging(en) ${c.vestigingen.join(", ")}. De functieomschrijving staat in het functiehuis in Intradage.`,
    `3. Duur. Deze overeenkomst gaat in op ${datumNL(c.start)} en geldt ${c.eind ? `tot en met ${datumNL(c.eind)}` : "voor onbepaalde tijd"}.${c.proeftijdTot ? ` Er geldt een proeftijd tot en met ${datumNL(c.proeftijdTot)}.` : ""}`,
    `4. Arbeidsduur. ${uren} Het rooster wordt minstens 4 dagen van tevoren bekendgemaakt in Intradage.`,
    `5. Loon. Het bruto uurloon bedraagt ${euro(c.uurloon)}, exclusief 8% vakantietoeslag. Het loon wordt maandelijks betaald.`,
    "6. Vakantie. De werknemer bouwt vakantie-uren op naar rato van de gewerkte uren, volgens de wet en de cao.",
    "7. Cao. Op deze overeenkomst is de cao voor het Horeca- en aanverwante bedrijf van toepassing.",
    "8. Regels op de werkvloer. De werknemer houdt zich aan het operationeel handboek, de hygiëne- en allergenenregels en de Arbeidstijdenwet.",
    "9. Privacy. De werkgever verwerkt persoonsgegevens alleen voor de uitvoering van deze overeenkomst en de wettelijke verplichtingen, zoals beschreven in de privacyverklaring.",
    "",
    "Aldus overeengekomen en digitaal ondertekend in Intradage. Van de ondertekening worden tijdstip, ondertekenaar en een vingerafdruk (hash) van deze tekst vastgelegd.",
  ].join("\n");
}

export interface LifecycleStap { sleutel: string; titel: string; wie: "medewerker" | "leiding"; dagen?: number }

/** dagen = deadline in dagen ten opzichte van de startdatum (pre-/onboarding) of de laatste werkdag (offboarding). */
export const LIFECYCLE: Record<"preboarding" | "onboarding" | "offboarding", LifecycleStap[]> = {
  preboarding: [
    { sleutel: "gegevens", titel: "Persoonsgegevens en IBAN invullen", wie: "medewerker", dagen: -5 },
    { sleutel: "identiteit", titel: "Identiteitsbewijs uploaden", wie: "medewerker", dagen: -5 },
    { sleutel: "beschikbaarheid", titel: "Beschikbaarheid doorgeven", wie: "medewerker", dagen: -4 },
    { sleutel: "contract-werknemer", titel: "Contract lezen en tekenen", wie: "medewerker", dagen: -3 },
    { sleutel: "contract-werkgever", titel: "Contract tekenen als werkgever", wie: "leiding", dagen: -2 },
    { sleutel: "eerste-dienst", titel: "Eerste dienst inplannen (met buddy)", wie: "leiding", dagen: -2 },
    { sleutel: "kleding", titel: "Werkkleding en kluisje klaarleggen", wie: "leiding", dagen: -1 },
  ],
  onboarding: [
    { sleutel: "leerpad", titel: "Onboarding-leerpad afronden", wie: "medewerker", dagen: 14 },
    { sleutel: "voorstellen", titel: "Jezelf voorstellen op de tijdlijn", wie: "medewerker", dagen: 3 },
    { sleutel: "checkin-1", titel: "Check-in na de eerste week", wie: "leiding", dagen: 7 },
    { sleutel: "checkin-4", titel: "Check-in na 4 weken", wie: "leiding", dagen: 28 },
    { sleutel: "proeftijd", titel: "Proeftijd evalueren", wie: "leiding", dagen: 50 },
  ],
  offboarding: [
    { sleutel: "diensten", titel: "Diensten na de laatste werkdag vrijgeven", wie: "leiding", dagen: -14 },
    { sleutel: "verlof", titel: "Verlofsaldo doorgeven aan de loonadministratie", wie: "leiding", dagen: -7 },
    { sleutel: "exit", titel: "Exitpeiling invullen", wie: "medewerker", dagen: -3 },
    { sleutel: "gesprek", titel: "Eindgesprek voeren", wie: "leiding", dagen: -2 },
    { sleutel: "inleveren", titel: "Werkkleding, sleutels en pas ingeleverd", wie: "leiding", dagen: 0 },
    { sleutel: "account", titel: "Account sluit automatisch na de laatste werkdag", wie: "leiding", dagen: 1 },
  ],
};

export function deadlineVan(basis: string, dagen = 0) {
  const d = new Date(`${basis}T12:00:00`);
  d.setDate(d.getDate() + dagen);
  return isoDatum(d);
}

export const isoDatum = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Ketenregeling (art. 7:668a BW): max. 3 tijdelijke contracten in max. 3 jaar; daarna onbepaalde tijd. */
export function ketenSignaal(contracten: { start: string; eind?: string | null; volgnummer: number }[]) {
  const tijdelijk = contracten.filter((c) => c.eind).sort((a, b) => a.start.localeCompare(b.start));
  if (!tijdelijk.length) return null;
  const eerste = new Date(`${tijdelijk[0].start}T12:00:00`);
  const laatsteEind = new Date(`${tijdelijk[tijdelijk.length - 1].eind}T12:00:00`);
  const jaren = (laatsteEind.getTime() - eerste.getTime()) / (365.25 * 86400000);
  if (tijdelijk.length >= 3 || jaren >= 3) return "Volgende contract moet voor onbepaalde tijd zijn (ketenregeling)";
  if (tijdelijk.length === 2) return "Nog één tijdelijk contract mogelijk (ketenregeling)";
  return null;
}
