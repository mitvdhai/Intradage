// Domeinmodel Intradage. Bewust los van opslag: de store kan later
// zonder wijzigingen in de UI worden vervangen door PostgreSQL.

export type Rol = "medewerker" | "shiftleider" | "manager" | "franchisenemer" | "hq";
export type Discipline = "operations" | "marketing" | "hr" | "inkoop" | "kwaliteit";

export interface Regio { id: string; naam: string }
export interface Franchisenemer { id: string; naam: string; regioId: string }
export interface Vestiging { id: string; naam: string; plaats: string; franchisenemerId: string }

export interface Gebruiker {
  id: string;
  voornaam: string;
  achternaam: string;
  rol: Rol;
  functieId?: string; // koppeling met het functiehuis
  vestigingIds: string[]; // medewerkers: 1; manager/FN: meerdere; HQ: leeg = alles
  franchisenemerId?: string;
  discipline?: Discipline; // alleen HQ
  mobiel: string;
  inDienstSinds: string; // ISO-datum
  verjaardag?: string; // MM-DD, alleen tonen bij opt-in
  toonVerjaardag?: boolean;
  personeelsnummer: string; // sleutel richting HorecaManager
  overMij?: string;
}

/** Lege lijst = geen beperking op die dimensie. */
export interface Doelgroep {
  rollen?: Rol[];
  functieIds?: string[];
  vestigingIds?: string[];
  franchisenemerIds?: string[];
  regioIds?: string[];
}

export type Urgentie = "info" | "belangrijk" | "verplicht";

export interface Bericht {
  id: string;
  titel: string;
  inhoud: string; // eenvoudige tekst; regels die met "- " beginnen worden een lijst
  afzender:
    | { type: "hq"; discipline: Discipline }
    | { type: "fn"; franchisenemerId: string; naam: string }
    | { type: "medewerker"; gebruikerId: string; naam: string };
  doelgroep: Doelgroep;
  urgentie: Urgentie;
  vastgezet: boolean;
  gepubliceerd: string; // ISO
  vervalt?: string;
  handboekDocId?: string;
}

export interface LeesStatus { gelezen?: string; bevestigd?: string }
export interface Reactie { id: string; berichtId: string; gebruikerId: string; tekst: string; tijd: string }

export interface ChatGroep {
  id: string;
  naam: string;
  type: "vestiging" | "franchisenemer" | "shiftleiders" | "hq-kanaal";
  vestigingId?: string;
  franchisenemerId?: string;
  alleenLezen?: boolean;
}
export interface ChatBericht {
  id: string;
  groepId: string;
  gebruikerId: string;
  tekst: string;
  tijd: string;
  ruilDienstId?: string;
}

export type LeerType = "video" | "quiz" | "module" | "challenge";
export interface LeerItem {
  id: string;
  titel: string;
  type: LeerType;
  duurMin: number;
  functieIds: string[]; // leeg = iedereen
  onboarding?: boolean;
  volgorde?: number;
  inhoud: string;
  quiz?: { vraag: string; opties: string[]; juist: number }[];
  handboekDocId?: string;
  profielItemId?: string; // welk onderdeel van het functieprofiel dit ontwikkelt
}
export interface LeerVoortgang {
  gebruikerId: string;
  itemId: string;
  status: "gestart" | "ingediend" | "afgerond" | "afgekeurd";
  inzending?: string;
  feedback?: string;
  beoordeeldDoor?: string;
  tijd: string;
}

export interface HandboekDoc {
  id: string;
  titel: string;
  versie: string;
  eigenaar: Discipline;
  bijgewerkt: string;
  reviewVoor: string;
  doelgroep: Doelgroep;
  inhoud: string; // markdown-achtig: "## Kop" + alinea's
}

export interface Dienst {
  id: string;
  gebruikerId: string;
  vestigingId: string;
  start: string; // ISO
  eind: string;
  taak: string;
}

export interface RuilVerzoek {
  id: string;
  dienstId: string;
  aangebodenDoor: string;
  overgenomenDoor?: string;
  status: "open" | "wacht-op-akkoord" | "goedgekeurd" | "afgewezen";
}

export interface Document {
  id: string;
  gebruikerId: string;
  type: "loonstrook" | "contract";
  titel: string;
  datum: string;
}

// ---------- Functiehuis ----------

export type ProfielCategorie = "competentie" | "vaardigheid" | "kennis";

export interface ProfielItem {
  id: string;
  categorie: ProfielCategorie;
  naam: string;
  omschrijving: string;
  /** Gedragsbeschrijving per niveau 1..4 */
  niveaus: [string, string, string, string];
}

export interface FunctieProfielRegel {
  itemId: string;
  /** Aandeel in de totale beoordeling, in procenten. Alle regels van een functie tellen op tot 100. */
  weging: number;
  vereistNiveau: 1 | 2 | 3 | 4;
  /** Voorwaarde (bijv. geldig certificaat): niet behaald = uitkomst wordt begrensd. */
  voorwaarde?: boolean;
}

export interface Functie {
  id: string;
  naam: string;
  familie: "vestiging" | "franchise" | "hq";
  trede: number; // positie in de loopbaanladder binnen de familie
  functiegroep: string; // indeling volgens Handboek Referentiefuncties Horeca
  doel: string;
  kerntaken: string[];
  verantwoordelijkheden: string[];
  plaatsInOrganisatie: string;
  profiel: FunctieProfielRegel[];
}

export interface Salarisgegevens {
  gebruikerId: string;
  uurloon: number;
  schaalMin: number; // basisloon functiegroep
  schaalMax: number; // eindloon functiegroep
}

export type Uitkomst = "onvoldoende" | "matig" | "goed" | "zeer goed" | "uitstekend";

export interface Beloningsregeling {
  versie: string;
  /** Ondergrens (inclusief) van de gewogen score per uitkomst; oplopend gesorteerd. */
  banden: { uitkomst: Uitkomst; vanaf: number }[];
  /** Verhogingspercentage per uitkomst. */
  verhoging: Record<Uitkomst, number>;
  /** Hoogste uitkomst als een voorwaarde niet is behaald. */
  maxUitkomstBijOntbrekendeVoorwaarde: Uitkomst;
}

export type BeoordelingStatus = "zelfbeoordeling" | "beoordelen" | "gesprek" | "besloten";

export interface Beoordeling {
  id: string;
  gebruikerId: string;
  functieId: string;
  beoordelaarId: string;
  periode: string; // bijv. "2026"
  status: BeoordelingStatus;
  /** Behaald niveau 1..4 per profielitem */
  zelf: Record<string, number>;
  beoordelaar: Record<string, number>;
  toelichting?: string;
  besluit?: {
    percentage: number;
    nieuwUurloon: number;
    door: string;
    tijd: string;
    toelichting: string;
  };
  bijgewerkt: string;
}

export interface AuditRegel {
  tijd: string;
  gebruikerId: string;
  actie: string;
  details?: string;
}
