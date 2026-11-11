import { sql } from "drizzle-orm";
import {
  boolean, check, date, index, jsonb, numeric, pgEnum, pgTable, primaryKey, serial, smallint, text, timestamp, unique,
} from "drizzle-orm/pg-core";
import type { Doelgroep, Uitkomst } from "../types";

// Relationeel schema voor Intradage (PostgreSQL).
// Organisatie en mensen komen straks uit HorecaManager (sync); diensten niet:
// die blijven bron in HorecaManager en worden live opgevraagd.

const ts = (naam: string) => timestamp(naam, { withTimezone: true, mode: "date" });
const geld = (naam: string) => numeric(naam, { precision: 8, scale: 2, mode: "number" });

export const rolEnum = pgEnum("rol", ["medewerker", "shiftleider", "manager", "franchisenemer", "hq"]);
export const disciplineEnum = pgEnum("discipline", ["operations", "marketing", "hr", "inkoop", "kwaliteit"]);
export const urgentieEnum = pgEnum("urgentie", ["info", "belangrijk", "verplicht"]);
export const chatTypeEnum = pgEnum("chat_type", ["vestiging", "franchisenemer", "shiftleiders", "hq-kanaal"]);
export const ruilStatusEnum = pgEnum("ruil_status", ["open", "wacht-op-akkoord", "goedgekeurd", "afgewezen"]);
export const leerTypeEnum = pgEnum("leer_type", ["video", "quiz", "module", "challenge"]);
export const voortgangStatusEnum = pgEnum("voortgang_status", ["gestart", "ingediend", "afgerond", "afgekeurd"]);
export const documentTypeEnum = pgEnum("document_type", ["loonstrook", "contract"]);
export const categorieEnum = pgEnum("profiel_categorie", ["competentie", "vaardigheid", "kennis"]);
export const familieEnum = pgEnum("functie_familie", ["vestiging", "franchise", "hq"]);
export const beoordelingStatusEnum = pgEnum("beoordeling_status", ["zelfbeoordeling", "beoordelen", "gesprek", "besloten"]);
export const scoreBronEnum = pgEnum("score_bron", ["zelf", "beoordelaar"]);

// ---------- Organisatie ----------

export const regio = pgTable("regio", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
});

export const franchisenemer = pgTable("franchisenemer", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  regioId: text("regio_id").notNull().references(() => regio.id),
});

export const vestiging = pgTable("vestiging", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  plaats: text("plaats").notNull(),
  franchisenemerId: text("franchisenemer_id").notNull().references(() => franchisenemer.id),
  adres: text("adres"),
  /** Per weekdag ("0" = zondag … "6" = zaterdag): open/sluit als "HH:MM", of null = gesloten */
  openingstijden: jsonb("openingstijden").$type<Openingstijden>().notNull().default({}),
}, (t) => [index("vestiging_fn_idx").on(t.franchisenemerId)]);

export type Openingstijden = Record<string, { open: string; sluit: string } | null>;

// ---------- Functiehuis ----------

export const functie = pgTable("functie", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  familie: familieEnum("familie").notNull(),
  trede: smallint("trede").notNull(),
  functiegroep: text("functiegroep").notNull(),
  doel: text("doel").notNull(),
  kerntaken: text("kerntaken").array().notNull(),
  verantwoordelijkheden: text("verantwoordelijkheden").array().notNull(),
  plaatsInOrganisatie: text("plaats_in_organisatie").notNull(),
});

export const profielItem = pgTable("profiel_item", {
  id: text("id").primaryKey(),
  categorie: categorieEnum("categorie").notNull(),
  naam: text("naam").notNull(),
  omschrijving: text("omschrijving").notNull(),
  niveaus: text("niveaus").array().notNull(),
});

export const functieProfiel = pgTable("functie_profiel", {
  functieId: text("functie_id").notNull().references(() => functie.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => profielItem.id),
  weging: smallint("weging").notNull(),
  vereistNiveau: smallint("vereist_niveau").notNull(),
  voorwaarde: boolean("voorwaarde").notNull().default(false),
}, (t) => [
  primaryKey({ columns: [t.functieId, t.itemId] }),
  check("weging_positief", sql`${t.weging} > 0 and ${t.weging} <= 100`),
  check("niveau_bereik", sql`${t.vereistNiveau} between 1 and 4`),
]);

// ---------- Mensen ----------

export const gebruiker = pgTable("gebruiker", {
  id: text("id").primaryKey(),
  voornaam: text("voornaam").notNull(),
  achternaam: text("achternaam").notNull(),
  rol: rolEnum("rol").notNull(),
  functieId: text("functie_id").references(() => functie.id),
  franchisenemerId: text("franchisenemer_id").references(() => franchisenemer.id),
  discipline: disciplineEnum("discipline"),
  mobiel: text("mobiel").notNull(),
  inDienstSinds: date("in_dienst_sinds", { mode: "string" }).notNull(),
  verjaardag: text("verjaardag"), // MM-DD
  toonVerjaardag: boolean("toon_verjaardag").notNull().default(false),
  personeelsnummer: text("personeelsnummer").notNull().unique(), // sleutel richting HorecaManager
  actief: boolean("actief").notNull().default(true), // false = uit dienst (offboarding)
  overMij: text("over_mij"),
  // Personeelsbeheer (eigen bron, geen HorecaManager meer)
  status: text("status").$type<"kandidaat" | "preboarding" | "actief" | "uit-dienst">().notNull().default("actief"),
  geboortedatum: date("geboortedatum", { mode: "string" }),
  email: text("email"),
  persoonsgegevens: jsonb("persoonsgegevens").$type<Persoonsgegevens>().notNull().default({}),
  uitDienstPer: date("uit_dienst_per", { mode: "string" }),
  uitDienstReden: text("uit_dienst_reden"),
  uitnodigingToken: text("uitnodiging_token").unique(),
  agendaToken: text("agenda_token").unique(),
}, (t) => [index("gebruiker_fn_idx").on(t.franchisenemerId)]);

export interface Persoonsgegevens {
  adres?: string; postcode?: string; woonplaats?: string; iban?: string;
  noodcontactNaam?: string; noodcontactTelefoon?: string;
  /** Alleen de laatste 4 cijfers; het volledige BSN gaat versleuteld naar de loonadministratie */
  bsnLaatste4?: string; loonheffingskorting?: boolean;
}

export const gebruikerVestiging = pgTable("gebruiker_vestiging", {
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  vestigingId: text("vestiging_id").notNull().references(() => vestiging.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.gebruikerId, t.vestigingId] }), index("gv_vestiging_idx").on(t.vestigingId)]);

export const salaris = pgTable("salaris", {
  gebruikerId: text("gebruiker_id").primaryKey().references(() => gebruiker.id, { onDelete: "cascade" }),
  uurloon: geld("uurloon").notNull(),
  schaalMin: geld("schaal_min").notNull(),
  schaalMax: geld("schaal_max").notNull(),
});

// ---------- Communicatie ----------

export const handboekDoc = pgTable("handboek_doc", {
  id: text("id").primaryKey(),
  titel: text("titel").notNull(),
  versie: text("versie").notNull(),
  eigenaar: disciplineEnum("eigenaar").notNull(),
  bijgewerkt: ts("bijgewerkt").notNull(),
  reviewVoor: ts("review_voor").notNull(),
  doelgroep: jsonb("doelgroep").$type<Doelgroep>().notNull(),
  inhoud: text("inhoud").notNull(),
});

export const bericht = pgTable("bericht", {
  id: text("id").primaryKey(),
  titel: text("titel").notNull(),
  inhoud: text("inhoud").notNull(),
  afzenderType: text("afzender_type", { enum: ["hq", "fn", "medewerker"] }).notNull(),
  afzenderGebruikerId: text("afzender_gebruiker_id").references(() => gebruiker.id),
  afzenderDiscipline: disciplineEnum("afzender_discipline"),
  afzenderFranchisenemerId: text("afzender_franchisenemer_id").references(() => franchisenemer.id),
  afzenderNaam: text("afzender_naam"),
  doelgroep: jsonb("doelgroep").$type<Doelgroep>().notNull(),
  urgentie: urgentieEnum("urgentie").notNull(),
  vastgezet: boolean("vastgezet").notNull().default(false),
  gepubliceerd: ts("gepubliceerd").notNull().defaultNow(),
  vervalt: ts("vervalt"),
  handboekDocId: text("handboek_doc_id").references(() => handboekDoc.id),
}, (t) => [index("bericht_gepubliceerd_idx").on(t.gepubliceerd)]);

export const berichtStatus = pgTable("bericht_status", {
  berichtId: text("bericht_id").notNull().references(() => bericht.id, { onDelete: "cascade" }),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  gelezen: ts("gelezen"),
  bevestigd: ts("bevestigd"),
}, (t) => [primaryKey({ columns: [t.berichtId, t.gebruikerId] })]);

export const reactie = pgTable("reactie", {
  id: text("id").primaryKey(),
  berichtId: text("bericht_id").notNull().references(() => bericht.id, { onDelete: "cascade" }),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id),
  tekst: text("tekst").notNull(),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [index("reactie_bericht_idx").on(t.berichtId)]);

export const chatGroep = pgTable("chat_groep", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  type: chatTypeEnum("type").notNull(),
  vestigingId: text("vestiging_id").references(() => vestiging.id),
  franchisenemerId: text("franchisenemer_id").references(() => franchisenemer.id),
  alleenLezen: boolean("alleen_lezen").notNull().default(false),
});

export const chatBericht = pgTable("chat_bericht", {
  id: text("id").primaryKey(),
  groepId: text("groep_id").notNull().references(() => chatGroep.id, { onDelete: "cascade" }),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id),
  tekst: text("tekst").notNull(),
  tijd: ts("tijd").notNull().defaultNow(),
  ruilDienstId: text("ruil_dienst_id"),
}, (t) => [index("chat_groep_tijd_idx").on(t.groepId, t.tijd)]);

/** Diensten zelf staan in HorecaManager; hier alleen het ruilverzoek met de dienst-id. */
export const ruilverzoek = pgTable("ruilverzoek", {
  id: text("id").primaryKey(),
  dienstId: text("dienst_id").notNull(),
  aangebodenDoor: text("aangeboden_door").notNull().references(() => gebruiker.id),
  overgenomenDoor: text("overgenomen_door").references(() => gebruiker.id),
  status: ruilStatusEnum("status").notNull().default("open"),
  aangemaakt: ts("aangemaakt").notNull().defaultNow(),
}, (t) => [index("ruil_dienst_idx").on(t.dienstId)]);

// ---------- Leren ----------

export const leerItem = pgTable("leer_item", {
  id: text("id").primaryKey(),
  titel: text("titel").notNull(),
  type: leerTypeEnum("type").notNull(),
  duurMin: smallint("duur_min").notNull(),
  functieIds: text("functie_ids").array().notNull().default(sql`'{}'::text[]`),
  onboarding: boolean("onboarding").notNull().default(false),
  volgorde: smallint("volgorde"),
  inhoud: text("inhoud").notNull(),
  quiz: jsonb("quiz").$type<{ vraag: string; opties: string[]; juist: number }[]>(),
  handboekDocId: text("handboek_doc_id").references(() => handboekDoc.id),
  profielItemId: text("profiel_item_id").references(() => profielItem.id),
});

export const leerVoortgang = pgTable("leer_voortgang", {
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => leerItem.id, { onDelete: "cascade" }),
  status: voortgangStatusEnum("status").notNull(),
  inzending: text("inzending"),
  feedback: text("feedback"),
  beoordeeldDoor: text("beoordeeld_door").references(() => gebruiker.id),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.gebruikerId, t.itemId] }), index("voortgang_status_idx").on(t.status)]);

// ---------- Documenten ----------

export const document = pgTable("document", {
  id: text("id").primaryKey(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  titel: text("titel").notNull(),
  datum: ts("datum").notNull(),
}, (t) => [index("document_gebruiker_idx").on(t.gebruikerId)]);

export const ontgrendeling = pgTable("ontgrendeling", {
  gebruikerId: text("gebruiker_id").primaryKey().references(() => gebruiker.id, { onDelete: "cascade" }),
  tot: ts("tot").notNull(),
});

// ---------- Beoordelen ----------

export const beloningsregeling = pgTable("beloningsregeling", {
  versie: text("versie").primaryKey(),
  actief: boolean("actief").notNull().default(true),
  banden: jsonb("banden").$type<{ uitkomst: Uitkomst; vanaf: number }[]>().notNull(),
  verhoging: jsonb("verhoging").$type<Record<Uitkomst, number>>().notNull(),
  maxUitkomstBijOntbrekendeVoorwaarde: text("max_uitkomst_bij_ontbrekende_voorwaarde").$type<Uitkomst>().notNull(),
  gewijzigd: ts("gewijzigd").notNull().defaultNow(),
});

export const beoordeling = pgTable("beoordeling", {
  id: text("id").primaryKey(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  functieId: text("functie_id").notNull().references(() => functie.id),
  beoordelaarId: text("beoordelaar_id").notNull().references(() => gebruiker.id),
  periode: text("periode").notNull(),
  status: beoordelingStatusEnum("status").notNull(),
  toelichting: text("toelichting"),
  besluitPercentage: numeric("besluit_percentage", { precision: 4, scale: 1, mode: "number" }),
  besluitUurloon: geld("besluit_uurloon"),
  besluitDoor: text("besluit_door").references(() => gebruiker.id),
  besluitTijd: ts("besluit_tijd"),
  besluitToelichting: text("besluit_toelichting"),
  bijgewerkt: ts("bijgewerkt").notNull().defaultNow(),
}, (t) => [unique("beoordeling_per_periode").on(t.gebruikerId, t.periode), index("beoordeling_beoordelaar_idx").on(t.beoordelaarId)]);

export const beoordelingScore = pgTable("beoordeling_score", {
  beoordelingId: text("beoordeling_id").notNull().references(() => beoordeling.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => profielItem.id),
  bron: scoreBronEnum("bron").notNull(),
  niveau: smallint("niveau").notNull(),
}, (t) => [primaryKey({ columns: [t.beoordelingId, t.itemId, t.bron] }), check("score_niveau", sql`${t.niveau} between 1 and 4`)]);

/** Laatst vastgestelde niveau per profielonderdeel (na een besloten beoordeling). */
export const medewerkerNiveau = pgTable("medewerker_niveau", {
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => profielItem.id),
  niveau: smallint("niveau").notNull(),
  bijgewerkt: ts("bijgewerkt").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.gebruikerId, t.itemId] })]);

// ---------- Logboek ----------

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  tijd: ts("tijd").notNull().defaultNow(),
  gebruikerId: text("gebruiker_id").notNull(),
  actie: text("actie").notNull(),
  details: text("details"),
}, (t) => [index("audit_tijd_idx").on(t.tijd)]);


// ---------- Betrokkenheid: likes, waardering, beloningen ----------

export const doelTypeEnum = pgEnum("doel_type", ["bericht", "waardering"]);

/** Likes op tijdlijnitems (berichten, posts en waarderingen). */
export const like = pgTable("like", {
  doelType: doelTypeEnum("doel_type").notNull(),
  doelId: text("doel_id").notNull(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.doelType, t.doelId, t.gebruikerId] }), index("like_doel_idx").on(t.doelType, t.doelId)]);

/** Kernwaarden waaraan een waardering wordt gekoppeld. */
export const waarde = pgTable("waarde", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  omschrijving: text("omschrijving").notNull(),
  emoji: text("emoji").notNull(),
  volgorde: smallint("volgorde").notNull().default(0),
});

export const waardering = pgTable("waardering", {
  id: text("id").primaryKey(),
  vanId: text("van_id").notNull().references(() => gebruiker.id),
  aanId: text("aan_id").notNull().references(() => gebruiker.id),
  waardeId: text("waarde_id").notNull().references(() => waarde.id),
  tekst: text("tekst").notNull(),
  punten: smallint("punten").notNull().default(10),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [index("waardering_aan_idx").on(t.aanId), index("waardering_tijd_idx").on(t.tijd), check("niet_zelf", sql`${t.vanId} <> ${t.aanId}`)]);

export const beloning = pgTable("beloning", {
  id: text("id").primaryKey(),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving").notNull(),
  punten: smallint("punten").notNull(),
  emoji: text("emoji").notNull(),
  actief: boolean("actief").notNull().default(true),
});

export const beloningStatusEnum = pgEnum("beloning_status", ["aangevraagd", "uitgereikt", "afgewezen"]);
export const beloningAanvraag = pgTable("beloning_aanvraag", {
  id: text("id").primaryKey(),
  beloningId: text("beloning_id").notNull().references(() => beloning.id),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  punten: smallint("punten").notNull(),
  status: beloningStatusEnum("status").notNull().default("aangevraagd"),
  behandeldDoor: text("behandeld_door").references(() => gebruiker.id),
  tijd: ts("tijd").notNull().defaultNow(),
});

// ---------- Enquêtes, polls, ideeën ----------

export const enqueteTypeEnum = pgEnum("enquete_type", ["poll", "pulse", "enps", "survey", "idee"]);
export type EnqueteVraag =
  | { id: string; type: "keuze"; tekst: string; opties: string[] }
  | { id: string; type: "schaal"; tekst: string; min: number; max: number; labels?: [string, string] }
  | { id: string; type: "open"; tekst: string };

export const enquete = pgTable("enquete", {
  id: text("id").primaryKey(),
  titel: text("titel").notNull(),
  intro: text("intro"),
  type: enqueteTypeEnum("type").notNull(),
  vragen: jsonb("vragen").$type<EnqueteVraag[]>().notNull(),
  doelgroep: jsonb("doelgroep").$type<Doelgroep>().notNull(),
  anoniem: boolean("anoniem").notNull().default(true),
  opent: ts("opent").notNull().defaultNow(),
  sluit: ts("sluit"),
  gemaaktDoor: text("gemaakt_door").notNull().references(() => gebruiker.id),
});

/** Wie heeft meegedaan (los van de antwoorden, zodat anoniem ook echt anoniem is). */
export const enqueteDeelname = pgTable("enquete_deelname", {
  enqueteId: text("enquete_id").notNull().references(() => enquete.id, { onDelete: "cascade" }),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.enqueteId, t.gebruikerId] })]);

export const enqueteAntwoord = pgTable("enquete_antwoord", {
  id: serial("id").primaryKey(),
  enqueteId: text("enquete_id").notNull().references(() => enquete.id, { onDelete: "cascade" }),
  gebruikerId: text("gebruiker_id").references(() => gebruiker.id, { onDelete: "set null" }), // leeg bij anoniem
  franchisenemerId: text("franchisenemer_id"), // grove uitsplitsing, alleen getoond vanaf 5 antwoorden
  antwoorden: jsonb("antwoorden").$type<Record<string, string | number>>().notNull(),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [index("antwoord_enquete_idx").on(t.enqueteId)]);

// ---------- Evenementen ----------

export const evenement = pgTable("evenement", {
  id: text("id").primaryKey(),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving").notNull(),
  start: ts("start").notNull(),
  eind: ts("eind").notNull(),
  locatie: text("locatie").notNull(),
  doelgroep: jsonb("doelgroep").$type<Doelgroep>().notNull(),
  gemaaktDoor: text("gemaakt_door").notNull().references(() => gebruiker.id),
});

export const aanmeldStatusEnum = pgEnum("aanmeld_status", ["ja", "misschien", "nee"]);
export const evenementAanmelding = pgTable("evenement_aanmelding", {
  evenementId: text("evenement_id").notNull().references(() => evenement.id, { onDelete: "cascade" }),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  status: aanmeldStatusEnum("status").notNull(),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.evenementId, t.gebruikerId] })]);

// ---------- Checklists, dagtaken en vestigingsevaluaties ----------

export type ChecklistVraag = { id: string; tekst: string; type: "ja-nee" | "score" | "meting"; knockout?: boolean; max?: number; eenheid?: string };
export type ChecklistOnderdeel = { id: string; naam: string; weging: number; vragen: ChecklistVraag[] };

export const checklistSoortEnum = pgEnum("checklist_soort", ["dagtaak", "evaluatie"]);
export const checklistSjabloon = pgTable("checklist_sjabloon", {
  id: text("id").primaryKey(),
  titel: text("titel").notNull(),
  soort: checklistSoortEnum("soort").notNull(),
  omschrijving: text("omschrijving").notNull(),
  onderdelen: jsonb("onderdelen").$type<ChecklistOnderdeel[]>().notNull(),
  rollen: text("rollen").array().notNull(), // wie mag hem uitvoeren
  versie: smallint("versie").notNull().default(1),
  actief: boolean("actief").notNull().default(true),
});

export type ChecklistAntwoorden = Record<string, { waarde: number | boolean | null; opmerking?: string }>;
export const uitvoeringStatusEnum = pgEnum("uitvoering_status", ["concept", "afgerond"]);
export const checklistUitvoering = pgTable("checklist_uitvoering", {
  id: text("id").primaryKey(),
  sjabloonId: text("sjabloon_id").notNull().references(() => checklistSjabloon.id),
  sjabloonVersie: smallint("sjabloon_versie").notNull(),
  vestigingId: text("vestiging_id").notNull().references(() => vestiging.id),
  uitgevoerdDoor: text("uitgevoerd_door").notNull().references(() => gebruiker.id),
  datum: ts("datum").notNull().defaultNow(),
  antwoorden: jsonb("antwoorden").$type<ChecklistAntwoorden>().notNull(),
  score: numeric("score", { precision: 4, scale: 1, mode: "number" }),
  knockout: boolean("knockout").notNull().default(false),
  status: uitvoeringStatusEnum("status").notNull().default("concept"),
}, (t) => [index("uitvoering_vestiging_idx").on(t.vestigingId, t.datum)]);

export const actiepuntStatusEnum = pgEnum("actiepunt_status", ["open", "klaar"]);
export const actiepunt = pgTable("actiepunt", {
  id: text("id").primaryKey(),
  uitvoeringId: text("uitvoering_id").references(() => checklistUitvoering.id, { onDelete: "cascade" }),
  vestigingId: text("vestiging_id").notNull().references(() => vestiging.id),
  tekst: text("tekst").notNull(),
  eigenaarId: text("eigenaar_id").notNull().references(() => gebruiker.id),
  deadline: date("deadline", { mode: "string" }).notNull(),
  status: actiepuntStatusEnum("status").notNull().default("open"),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [index("actiepunt_vestiging_idx").on(t.vestigingId, t.status)]);


// ---------- Personeelsbeheer: planning, uren, verlof ----------

/** Posities op de werkvloer (kassa, bakken, uitgifte …). Losstaand van de functie: een medewerker kan op meerdere posities. */
export const positie = pgTable("positie", {
  id: text("id").primaryKey(),
  naam: text("naam").notNull(),
  kleur: text("kleur").notNull(),
  volgorde: smallint("volgorde").notNull(),
  minLeeftijd: smallint("min_leeftijd").notNull().default(0),
});

export const gebruikerPositie = pgTable("gebruiker_positie", {
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  positieId: text("positie_id").notNull().references(() => positie.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.gebruikerId, t.positieId] })]);

/** Standaardbezetting: per vestiging, weekdag en positie hoeveel mensen van hoe laat tot hoe laat. */
export const bezettingsnorm = pgTable("bezettingsnorm", {
  id: text("id").primaryKey(),
  vestigingId: text("vestiging_id").notNull().references(() => vestiging.id, { onDelete: "cascade" }),
  weekdag: smallint("weekdag").notNull(),
  positieId: text("positie_id").notNull().references(() => positie.id),
  aantal: smallint("aantal").notNull(),
  van: text("van").notNull(),
  tot: text("tot").notNull(),
}, (t) => [index("norm_vestiging_idx").on(t.vestigingId, t.weekdag), check("norm_weekdag", sql`${t.weekdag} between 0 and 6`), check("norm_aantal", sql`${t.aantal} between 1 and 20`)]);

/** Vast beschikbaarheidspatroon: per weekdag één blok (geen rij = niet beschikbaar). */
export const beschikbaarheid = pgTable("beschikbaarheid", {
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  weekdag: smallint("weekdag").notNull(),
  van: text("van").notNull(),
  tot: text("tot").notNull(),
}, (t) => [primaryKey({ columns: [t.gebruikerId, t.weekdag] })]);

export const dienstStatusEnum = pgEnum("dienst_status", ["concept", "gepubliceerd"]);
/** Een dienst. Zonder gebruiker = open dienst. */
export const dienst = pgTable("dienst", {
  id: text("id").primaryKey(),
  vestigingId: text("vestiging_id").notNull().references(() => vestiging.id, { onDelete: "cascade" }),
  positieId: text("positie_id").notNull().references(() => positie.id),
  gebruikerId: text("gebruiker_id").references(() => gebruiker.id, { onDelete: "set null" }),
  start: ts("start").notNull(),
  eind: ts("eind").notNull(),
  pauzeMin: smallint("pauze_min").notNull().default(0),
  status: dienstStatusEnum("status").notNull().default("concept"),
  bron: text("bron").$type<"handmatig" | "suggestie">().notNull().default("handmatig"),
}, (t) => [index("dienst_vestiging_idx").on(t.vestigingId, t.start), index("dienst_gebruiker_idx").on(t.gebruikerId, t.start), check("dienst_volgorde", sql`${t.eind} > ${t.start}`)]);

export const verlofTypeEnum = pgEnum("verlof_type", ["vakantie", "bijzonder", "onbetaald", "ziek"]);
export const verlofStatusEnum = pgEnum("verlof_status", ["aangevraagd", "goedgekeurd", "afgewezen"]);
export const verlof = pgTable("verlof", {
  id: text("id").primaryKey(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  type: verlofTypeEnum("type").notNull(),
  van: date("van", { mode: "string" }).notNull(),
  tot: date("tot", { mode: "string" }), // null bij een lopende ziekmelding
  uren: numeric("uren", { precision: 6, scale: 1, mode: "number" }),
  status: verlofStatusEnum("status").notNull().default("aangevraagd"),
  opmerking: text("opmerking"),
  behandeldDoor: text("behandeld_door").references(() => gebruiker.id),
  aangevraagd: ts("aangevraagd").notNull().defaultNow(),
}, (t) => [index("verlof_gebruiker_idx").on(t.gebruikerId, t.van)]);

export const klokStatusEnum = pgEnum("klok_status", ["open", "ingediend", "goedgekeurd"]);
/** Gewerkte tijd: in- en uitklokken, of handmatig ingediend. Basis voor de loonadministratie. */
export const klok = pgTable("klok", {
  id: text("id").primaryKey(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  vestigingId: text("vestiging_id").notNull().references(() => vestiging.id),
  dienstId: text("dienst_id").references(() => dienst.id, { onDelete: "set null" }),
  in: ts("in").notNull(),
  uit: ts("uit"),
  pauzeMin: smallint("pauze_min").notNull().default(0),
  status: klokStatusEnum("status").notNull().default("open"),
  goedgekeurdDoor: text("goedgekeurd_door").references(() => gebruiker.id),
  opmerking: text("opmerking"),
}, (t) => [index("klok_gebruiker_idx").on(t.gebruikerId, t.in)]);

// ---------- Personeelsbeheer: contracten, dossier, werving, lifecycle ----------

export const contractTypeEnum = pgEnum("contract_type", ["oproep", "minmax", "vast"]);
export const contractStatusEnum = pgEnum("contract_status", ["concept", "ter-ondertekening", "getekend", "beeindigd"]);
export const contract = pgTable("contract", {
  id: text("id").primaryKey(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  volgnummer: smallint("volgnummer").notNull(),
  type: contractTypeEnum("type").notNull(),
  urenMin: numeric("uren_min", { precision: 4, scale: 1, mode: "number" }).notNull(),
  urenMax: numeric("uren_max", { precision: 4, scale: 1, mode: "number" }).notNull(),
  uurloon: geld("uurloon").notNull(),
  functieId: text("functie_id").references(() => functie.id),
  start: date("start", { mode: "string" }).notNull(),
  eind: date("eind", { mode: "string" }), // null = onbepaalde tijd
  proeftijdTot: date("proeftijd_tot", { mode: "string" }),
  tekst: text("tekst").notNull(),
  status: contractStatusEnum("status").notNull().default("concept"),
  documentHash: text("document_hash"),
  ondertekendWerknemer: ts("ondertekend_werknemer"),
  handtekeningWerknemer: text("handtekening_werknemer"),
  ondertekendWerkgever: ts("ondertekend_werkgever"),
  handtekeningWerkgever: text("handtekening_werkgever"),
  werkgeverOndertekenaarId: text("werkgever_ondertekenaar_id").references(() => gebruiker.id),
  aangemaakt: ts("aangemaakt").notNull().defaultNow(),
  aangemaaktDoor: text("aangemaakt_door").references(() => gebruiker.id),
}, (t) => [index("contract_gebruiker_idx").on(t.gebruikerId), check("contract_uren", sql`${t.urenMin} >= 0 and ${t.urenMax} >= ${t.urenMin}`)]);

/** Personeelsdossier. In het prototype staat het bestand in de database (max. 2 MB); in productie in EU-objectopslag. */
export const dossierDocument = pgTable("dossier_document", {
  id: text("id").primaryKey(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  categorie: text("categorie").$type<DossierCategorie>().notNull(),
  titel: text("titel").notNull(),
  bestandsnaam: text("bestandsnaam"),
  mime: text("mime"),
  grootte: smallint("grootte_kb"),
  inhoud: text("inhoud"), // base64
  vervalt: date("vervalt", { mode: "string" }),
  geuploadDoor: text("geupload_door").references(() => gebruiker.id),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [index("dossier_gebruiker_idx").on(t.gebruikerId)]);
export type DossierCategorie = "cv" | "identiteit" | "contract" | "diploma" | "certificaat" | "loonheffing" | "verklaring" | "overig";

export const vacature = pgTable("vacature", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  vestigingId: text("vestiging_id").notNull().references(() => vestiging.id),
  functieId: text("functie_id").references(() => functie.id),
  titel: text("titel").notNull(),
  omschrijving: text("omschrijving").notNull(),
  uren: text("uren").notNull(),
  status: text("status").$type<"open" | "gesloten">().notNull().default("open"),
  gemaakt: ts("gemaakt").notNull().defaultNow(),
});

export const kandidaatFaseEnum = pgEnum("kandidaat_fase", ["nieuw", "gesprek", "proefdraaien", "aanbod", "aangenomen", "afgewezen"]);
export interface KandidaatNotitie { door: string; tijd: string; tekst: string }
export const kandidaat = pgTable("kandidaat", {
  id: text("id").primaryKey(),
  vacatureId: text("vacature_id").notNull().references(() => vacature.id),
  voornaam: text("voornaam").notNull(),
  achternaam: text("achternaam").notNull(),
  email: text("email").notNull(),
  mobiel: text("mobiel").notNull(),
  geboortedatum: date("geboortedatum", { mode: "string" }),
  motivatie: text("motivatie"),
  beschikbaarheid: text("beschikbaarheid"),
  bron: text("bron").notNull().default("website"),
  aangedragenDoor: text("aangedragen_door").references(() => gebruiker.id),
  fase: kandidaatFaseEnum("fase").notNull().default("nieuw"),
  gesprekOp: ts("gesprek_op"),
  beoordeling: smallint("beoordeling"),
  notities: jsonb("notities").$type<KandidaatNotitie[]>().notNull().default([]),
  gebruikerId: text("gebruiker_id").references(() => gebruiker.id),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [index("kandidaat_vacature_idx").on(t.vacatureId, t.fase)]);

export const lifecycleFaseEnum = pgEnum("lifecycle_fase", ["preboarding", "onboarding", "offboarding"]);
/** Stappen in pre-, on- en offboarding, per medewerker. */
export const lifecycleTaak = pgTable("lifecycle_taak", {
  id: text("id").primaryKey(),
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  fase: lifecycleFaseEnum("fase").notNull(),
  sleutel: text("sleutel").notNull(),
  titel: text("titel").notNull(),
  wie: text("wie").$type<"medewerker" | "leiding">().notNull(),
  volgorde: smallint("volgorde").notNull(),
  deadline: date("deadline", { mode: "string" }),
  klaar: ts("klaar"),
  klaarDoor: text("klaar_door").references(() => gebruiker.id),
}, (t) => [unique("lifecycle_uniek").on(t.gebruikerId, t.fase, t.sleutel)]);

// ---------- Rollen en rechten ----------

/** Niveau per rol en module (0 geen, 1 bekijken, 2 beheren). Ontbrekend = standaard uit de code. */
export const rolRecht = pgTable("rol_recht", {
  rol: rolEnum("rol").notNull(),
  module: text("module").notNull(),
  niveau: smallint("niveau").notNull(),
}, (t) => [primaryKey({ columns: [t.rol, t.module] }), check("rol_recht_niveau", sql`${t.niveau} between 0 and 2`)]);

/** Uitzondering voor één persoon (meer of juist minder dan de rol). */
export const persoonRecht = pgTable("persoon_recht", {
  gebruikerId: text("gebruiker_id").notNull().references(() => gebruiker.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  niveau: smallint("niveau").notNull(),
  door: text("door").references(() => gebruiker.id),
  reden: text("reden"),
  tijd: ts("tijd").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.gebruikerId, t.module] }), check("persoon_recht_niveau", sql`${t.niveau} between 0 and 2`)]);
