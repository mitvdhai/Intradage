CREATE TYPE "public"."beoordeling_status" AS ENUM('zelfbeoordeling', 'beoordelen', 'gesprek', 'besloten');--> statement-breakpoint
CREATE TYPE "public"."profiel_categorie" AS ENUM('competentie', 'vaardigheid', 'kennis');--> statement-breakpoint
CREATE TYPE "public"."chat_type" AS ENUM('vestiging', 'franchisenemer', 'shiftleiders', 'hq-kanaal');--> statement-breakpoint
CREATE TYPE "public"."discipline" AS ENUM('operations', 'marketing', 'hr', 'inkoop', 'kwaliteit');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('loonstrook', 'contract');--> statement-breakpoint
CREATE TYPE "public"."functie_familie" AS ENUM('vestiging', 'franchise', 'hq');--> statement-breakpoint
CREATE TYPE "public"."leer_type" AS ENUM('video', 'quiz', 'module', 'challenge');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('medewerker', 'shiftleider', 'manager', 'franchisenemer', 'hq');--> statement-breakpoint
CREATE TYPE "public"."ruil_status" AS ENUM('open', 'wacht-op-akkoord', 'goedgekeurd', 'afgewezen');--> statement-breakpoint
CREATE TYPE "public"."score_bron" AS ENUM('zelf', 'beoordelaar');--> statement-breakpoint
CREATE TYPE "public"."urgentie" AS ENUM('info', 'belangrijk', 'verplicht');--> statement-breakpoint
CREATE TYPE "public"."voortgang_status" AS ENUM('gestart', 'ingediend', 'afgerond', 'afgekeurd');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	"gebruiker_id" text NOT NULL,
	"actie" text NOT NULL,
	"details" text
);
--> statement-breakpoint
CREATE TABLE "beloningsregeling" (
	"versie" text PRIMARY KEY NOT NULL,
	"actief" boolean DEFAULT true NOT NULL,
	"banden" jsonb NOT NULL,
	"verhoging" jsonb NOT NULL,
	"max_uitkomst_bij_ontbrekende_voorwaarde" text NOT NULL,
	"gewijzigd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beoordeling" (
	"id" text PRIMARY KEY NOT NULL,
	"gebruiker_id" text NOT NULL,
	"functie_id" text NOT NULL,
	"beoordelaar_id" text NOT NULL,
	"periode" text NOT NULL,
	"status" "beoordeling_status" NOT NULL,
	"toelichting" text,
	"besluit_percentage" numeric(4, 1),
	"besluit_uurloon" numeric(8, 2),
	"besluit_door" text,
	"besluit_tijd" timestamp with time zone,
	"besluit_toelichting" text,
	"bijgewerkt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "beoordeling_per_periode" UNIQUE("gebruiker_id","periode")
);
--> statement-breakpoint
CREATE TABLE "beoordeling_score" (
	"beoordeling_id" text NOT NULL,
	"item_id" text NOT NULL,
	"bron" "score_bron" NOT NULL,
	"niveau" smallint NOT NULL,
	CONSTRAINT "beoordeling_score_beoordeling_id_item_id_bron_pk" PRIMARY KEY("beoordeling_id","item_id","bron"),
	CONSTRAINT "score_niveau" CHECK ("beoordeling_score"."niveau" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "bericht" (
	"id" text PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"inhoud" text NOT NULL,
	"afzender_type" text NOT NULL,
	"afzender_discipline" "discipline",
	"afzender_franchisenemer_id" text,
	"afzender_naam" text,
	"doelgroep" jsonb NOT NULL,
	"urgentie" "urgentie" NOT NULL,
	"vastgezet" boolean DEFAULT false NOT NULL,
	"gepubliceerd" timestamp with time zone DEFAULT now() NOT NULL,
	"vervalt" timestamp with time zone,
	"handboek_doc_id" text
);
--> statement-breakpoint
CREATE TABLE "bericht_status" (
	"bericht_id" text NOT NULL,
	"gebruiker_id" text NOT NULL,
	"gelezen" timestamp with time zone,
	"bevestigd" timestamp with time zone,
	CONSTRAINT "bericht_status_bericht_id_gebruiker_id_pk" PRIMARY KEY("bericht_id","gebruiker_id")
);
--> statement-breakpoint
CREATE TABLE "chat_bericht" (
	"id" text PRIMARY KEY NOT NULL,
	"groep_id" text NOT NULL,
	"gebruiker_id" text NOT NULL,
	"tekst" text NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	"ruil_dienst_id" text
);
--> statement-breakpoint
CREATE TABLE "chat_groep" (
	"id" text PRIMARY KEY NOT NULL,
	"naam" text NOT NULL,
	"type" "chat_type" NOT NULL,
	"vestiging_id" text,
	"franchisenemer_id" text,
	"alleen_lezen" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"gebruiker_id" text NOT NULL,
	"type" "document_type" NOT NULL,
	"titel" text NOT NULL,
	"datum" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "franchisenemer" (
	"id" text PRIMARY KEY NOT NULL,
	"naam" text NOT NULL,
	"regio_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functie" (
	"id" text PRIMARY KEY NOT NULL,
	"naam" text NOT NULL,
	"familie" "functie_familie" NOT NULL,
	"trede" smallint NOT NULL,
	"functiegroep" text NOT NULL,
	"doel" text NOT NULL,
	"kerntaken" text[] NOT NULL,
	"verantwoordelijkheden" text[] NOT NULL,
	"plaats_in_organisatie" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functie_profiel" (
	"functie_id" text NOT NULL,
	"item_id" text NOT NULL,
	"weging" smallint NOT NULL,
	"vereist_niveau" smallint NOT NULL,
	"voorwaarde" boolean DEFAULT false NOT NULL,
	CONSTRAINT "functie_profiel_functie_id_item_id_pk" PRIMARY KEY("functie_id","item_id"),
	CONSTRAINT "weging_positief" CHECK ("functie_profiel"."weging" > 0 and "functie_profiel"."weging" <= 100),
	CONSTRAINT "niveau_bereik" CHECK ("functie_profiel"."vereist_niveau" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "gebruiker" (
	"id" text PRIMARY KEY NOT NULL,
	"voornaam" text NOT NULL,
	"achternaam" text NOT NULL,
	"rol" "rol" NOT NULL,
	"functie_id" text,
	"franchisenemer_id" text,
	"discipline" "discipline",
	"mobiel" text NOT NULL,
	"in_dienst_sinds" date NOT NULL,
	"verjaardag" text,
	"toon_verjaardag" boolean DEFAULT false NOT NULL,
	"personeelsnummer" text NOT NULL,
	"actief" boolean DEFAULT true NOT NULL,
	CONSTRAINT "gebruiker_personeelsnummer_unique" UNIQUE("personeelsnummer")
);
--> statement-breakpoint
CREATE TABLE "gebruiker_vestiging" (
	"gebruiker_id" text NOT NULL,
	"vestiging_id" text NOT NULL,
	CONSTRAINT "gebruiker_vestiging_gebruiker_id_vestiging_id_pk" PRIMARY KEY("gebruiker_id","vestiging_id")
);
--> statement-breakpoint
CREATE TABLE "handboek_doc" (
	"id" text PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"versie" text NOT NULL,
	"eigenaar" "discipline" NOT NULL,
	"bijgewerkt" timestamp with time zone NOT NULL,
	"review_voor" timestamp with time zone NOT NULL,
	"doelgroep" jsonb NOT NULL,
	"inhoud" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leer_item" (
	"id" text PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"type" "leer_type" NOT NULL,
	"duur_min" smallint NOT NULL,
	"functie_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"onboarding" boolean DEFAULT false NOT NULL,
	"volgorde" smallint,
	"inhoud" text NOT NULL,
	"quiz" jsonb,
	"handboek_doc_id" text,
	"profiel_item_id" text
);
--> statement-breakpoint
CREATE TABLE "leer_voortgang" (
	"gebruiker_id" text NOT NULL,
	"item_id" text NOT NULL,
	"status" "voortgang_status" NOT NULL,
	"inzending" text,
	"feedback" text,
	"beoordeeld_door" text,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leer_voortgang_gebruiker_id_item_id_pk" PRIMARY KEY("gebruiker_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "medewerker_niveau" (
	"gebruiker_id" text NOT NULL,
	"item_id" text NOT NULL,
	"niveau" smallint NOT NULL,
	"bijgewerkt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medewerker_niveau_gebruiker_id_item_id_pk" PRIMARY KEY("gebruiker_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "ontgrendeling" (
	"gebruiker_id" text PRIMARY KEY NOT NULL,
	"tot" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiel_item" (
	"id" text PRIMARY KEY NOT NULL,
	"categorie" "profiel_categorie" NOT NULL,
	"naam" text NOT NULL,
	"omschrijving" text NOT NULL,
	"niveaus" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reactie" (
	"id" text PRIMARY KEY NOT NULL,
	"bericht_id" text NOT NULL,
	"gebruiker_id" text NOT NULL,
	"tekst" text NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regio" (
	"id" text PRIMARY KEY NOT NULL,
	"naam" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ruilverzoek" (
	"id" text PRIMARY KEY NOT NULL,
	"dienst_id" text NOT NULL,
	"aangeboden_door" text NOT NULL,
	"overgenomen_door" text,
	"status" "ruil_status" DEFAULT 'open' NOT NULL,
	"aangemaakt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salaris" (
	"gebruiker_id" text PRIMARY KEY NOT NULL,
	"uurloon" numeric(8, 2) NOT NULL,
	"schaal_min" numeric(8, 2) NOT NULL,
	"schaal_max" numeric(8, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vestiging" (
	"id" text PRIMARY KEY NOT NULL,
	"naam" text NOT NULL,
	"plaats" text NOT NULL,
	"franchisenemer_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beoordeling" ADD CONSTRAINT "beoordeling_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beoordeling" ADD CONSTRAINT "beoordeling_functie_id_functie_id_fk" FOREIGN KEY ("functie_id") REFERENCES "public"."functie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beoordeling" ADD CONSTRAINT "beoordeling_beoordelaar_id_gebruiker_id_fk" FOREIGN KEY ("beoordelaar_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beoordeling" ADD CONSTRAINT "beoordeling_besluit_door_gebruiker_id_fk" FOREIGN KEY ("besluit_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beoordeling_score" ADD CONSTRAINT "beoordeling_score_beoordeling_id_beoordeling_id_fk" FOREIGN KEY ("beoordeling_id") REFERENCES "public"."beoordeling"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beoordeling_score" ADD CONSTRAINT "beoordeling_score_item_id_profiel_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."profiel_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bericht" ADD CONSTRAINT "bericht_afzender_franchisenemer_id_franchisenemer_id_fk" FOREIGN KEY ("afzender_franchisenemer_id") REFERENCES "public"."franchisenemer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bericht" ADD CONSTRAINT "bericht_handboek_doc_id_handboek_doc_id_fk" FOREIGN KEY ("handboek_doc_id") REFERENCES "public"."handboek_doc"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bericht_status" ADD CONSTRAINT "bericht_status_bericht_id_bericht_id_fk" FOREIGN KEY ("bericht_id") REFERENCES "public"."bericht"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bericht_status" ADD CONSTRAINT "bericht_status_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bericht" ADD CONSTRAINT "chat_bericht_groep_id_chat_groep_id_fk" FOREIGN KEY ("groep_id") REFERENCES "public"."chat_groep"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_bericht" ADD CONSTRAINT "chat_bericht_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groep" ADD CONSTRAINT "chat_groep_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groep" ADD CONSTRAINT "chat_groep_franchisenemer_id_franchisenemer_id_fk" FOREIGN KEY ("franchisenemer_id") REFERENCES "public"."franchisenemer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchisenemer" ADD CONSTRAINT "franchisenemer_regio_id_regio_id_fk" FOREIGN KEY ("regio_id") REFERENCES "public"."regio"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functie_profiel" ADD CONSTRAINT "functie_profiel_functie_id_functie_id_fk" FOREIGN KEY ("functie_id") REFERENCES "public"."functie"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functie_profiel" ADD CONSTRAINT "functie_profiel_item_id_profiel_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."profiel_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD CONSTRAINT "gebruiker_functie_id_functie_id_fk" FOREIGN KEY ("functie_id") REFERENCES "public"."functie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD CONSTRAINT "gebruiker_franchisenemer_id_franchisenemer_id_fk" FOREIGN KEY ("franchisenemer_id") REFERENCES "public"."franchisenemer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gebruiker_vestiging" ADD CONSTRAINT "gebruiker_vestiging_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gebruiker_vestiging" ADD CONSTRAINT "gebruiker_vestiging_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leer_item" ADD CONSTRAINT "leer_item_handboek_doc_id_handboek_doc_id_fk" FOREIGN KEY ("handboek_doc_id") REFERENCES "public"."handboek_doc"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leer_item" ADD CONSTRAINT "leer_item_profiel_item_id_profiel_item_id_fk" FOREIGN KEY ("profiel_item_id") REFERENCES "public"."profiel_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leer_voortgang" ADD CONSTRAINT "leer_voortgang_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leer_voortgang" ADD CONSTRAINT "leer_voortgang_item_id_leer_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."leer_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leer_voortgang" ADD CONSTRAINT "leer_voortgang_beoordeeld_door_gebruiker_id_fk" FOREIGN KEY ("beoordeeld_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medewerker_niveau" ADD CONSTRAINT "medewerker_niveau_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medewerker_niveau" ADD CONSTRAINT "medewerker_niveau_item_id_profiel_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."profiel_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontgrendeling" ADD CONSTRAINT "ontgrendeling_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactie" ADD CONSTRAINT "reactie_bericht_id_bericht_id_fk" FOREIGN KEY ("bericht_id") REFERENCES "public"."bericht"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactie" ADD CONSTRAINT "reactie_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruilverzoek" ADD CONSTRAINT "ruilverzoek_aangeboden_door_gebruiker_id_fk" FOREIGN KEY ("aangeboden_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ruilverzoek" ADD CONSTRAINT "ruilverzoek_overgenomen_door_gebruiker_id_fk" FOREIGN KEY ("overgenomen_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salaris" ADD CONSTRAINT "salaris_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vestiging" ADD CONSTRAINT "vestiging_franchisenemer_id_franchisenemer_id_fk" FOREIGN KEY ("franchisenemer_id") REFERENCES "public"."franchisenemer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_tijd_idx" ON "audit_log" USING btree ("tijd");--> statement-breakpoint
CREATE INDEX "beoordeling_beoordelaar_idx" ON "beoordeling" USING btree ("beoordelaar_id");--> statement-breakpoint
CREATE INDEX "bericht_gepubliceerd_idx" ON "bericht" USING btree ("gepubliceerd");--> statement-breakpoint
CREATE INDEX "chat_groep_tijd_idx" ON "chat_bericht" USING btree ("groep_id","tijd");--> statement-breakpoint
CREATE INDEX "document_gebruiker_idx" ON "document" USING btree ("gebruiker_id");--> statement-breakpoint
CREATE INDEX "gebruiker_fn_idx" ON "gebruiker" USING btree ("franchisenemer_id");--> statement-breakpoint
CREATE INDEX "gv_vestiging_idx" ON "gebruiker_vestiging" USING btree ("vestiging_id");--> statement-breakpoint
CREATE INDEX "voortgang_status_idx" ON "leer_voortgang" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reactie_bericht_idx" ON "reactie" USING btree ("bericht_id");--> statement-breakpoint
CREATE INDEX "ruil_dienst_idx" ON "ruilverzoek" USING btree ("dienst_id");--> statement-breakpoint
CREATE INDEX "vestiging_fn_idx" ON "vestiging" USING btree ("franchisenemer_id");