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
}, (t) => [index("vestiging_fn_idx").on(t.franchisenemerId)]);

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
}, (t) => [index("gebruiker_fn_idx").on(t.franchisenemerId)]);

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
