CREATE TYPE "public"."contract_status" AS ENUM('concept', 'ter-ondertekening', 'getekend', 'beeindigd');--> statement-breakpoint
CREATE TYPE "public"."contract_type" AS ENUM('oproep', 'minmax', 'vast');--> statement-breakpoint
CREATE TYPE "public"."dienst_status" AS ENUM('concept', 'gepubliceerd');--> statement-breakpoint
CREATE TYPE "public"."kandidaat_fase" AS ENUM('nieuw', 'gesprek', 'proefdraaien', 'aanbod', 'aangenomen', 'afgewezen');--> statement-breakpoint
CREATE TYPE "public"."klok_status" AS ENUM('open', 'ingediend', 'goedgekeurd');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_fase" AS ENUM('preboarding', 'onboarding', 'offboarding');--> statement-breakpoint
CREATE TYPE "public"."verlof_status" AS ENUM('aangevraagd', 'goedgekeurd', 'afgewezen');--> statement-breakpoint
CREATE TYPE "public"."verlof_type" AS ENUM('vakantie', 'bijzonder', 'onbetaald', 'ziek');--> statement-breakpoint
CREATE TABLE "beschikbaarheid" (
	"gebruiker_id" text NOT NULL,
	"weekdag" smallint NOT NULL,
	"van" text NOT NULL,
	"tot" text NOT NULL,
	CONSTRAINT "beschikbaarheid_gebruiker_id_weekdag_pk" PRIMARY KEY("gebruiker_id","weekdag")
);
--> statement-breakpoint
CREATE TABLE "bezettingsnorm" (
	"id" text PRIMARY KEY NOT NULL,
	"vestiging_id" text NOT NULL,
	"weekdag" smallint NOT NULL,
	"positie_id" text NOT NULL,
	"aantal" smallint NOT NULL,
	"van" text NOT NULL,
	"tot" text NOT NULL,
	CONSTRAINT "norm_weekdag" CHECK ("bezettingsnorm"."weekdag" between 0 and 6),
	CONSTRAINT "norm_aantal" CHECK ("bezettingsnorm"."aantal" between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "contract" (
	"id" text PRIMARY KEY NOT NULL,
	"gebruiker_id" text NOT NULL,
	"volgnummer" smallint NOT NULL,
	"type" "contract_type" NOT NULL,
	"uren_min" numeric(4, 1) NOT NULL,
	"uren_max" numeric(4, 1) NOT NULL,
	"uurloon" numeric(8, 2) NOT NULL,
	"functie_id" text,
	"start" date NOT NULL,
	"eind" date,
	"proeftijd_tot" date,
	"tekst" text NOT NULL,
	"status" "contract_status" DEFAULT 'concept' NOT NULL,
	"document_hash" text,
	"ondertekend_werknemer" timestamp with time zone,
	"handtekening_werknemer" text,
	"ondertekend_werkgever" timestamp with time zone,
	"handtekening_werkgever" text,
	"werkgever_ondertekenaar_id" text,
	"aangemaakt" timestamp with time zone DEFAULT now() NOT NULL,
	"aangemaakt_door" text,
	CONSTRAINT "contract_uren" CHECK ("contract"."uren_min" >= 0 and "contract"."uren_max" >= "contract"."uren_min")
);
--> statement-breakpoint
CREATE TABLE "dienst" (
	"id" text PRIMARY KEY NOT NULL,
	"vestiging_id" text NOT NULL,
	"positie_id" text NOT NULL,
	"gebruiker_id" text,
	"start" timestamp with time zone NOT NULL,
	"eind" timestamp with time zone NOT NULL,
	"pauze_min" smallint DEFAULT 0 NOT NULL,
	"status" "dienst_status" DEFAULT 'concept' NOT NULL,
	"bron" text DEFAULT 'handmatig' NOT NULL,
	CONSTRAINT "dienst_volgorde" CHECK ("dienst"."eind" > "dienst"."start")
);
--> statement-breakpoint
CREATE TABLE "dossier_document" (
	"id" text PRIMARY KEY NOT NULL,
	"gebruiker_id" text NOT NULL,
	"categorie" text NOT NULL,
	"titel" text NOT NULL,
	"bestandsnaam" text,
	"mime" text,
	"grootte_kb" smallint,
	"inhoud" text,
	"vervalt" date,
	"geupload_door" text,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gebruiker_positie" (
	"gebruiker_id" text NOT NULL,
	"positie_id" text NOT NULL,
	CONSTRAINT "gebruiker_positie_gebruiker_id_positie_id_pk" PRIMARY KEY("gebruiker_id","positie_id")
);
--> statement-breakpoint
CREATE TABLE "kandidaat" (
	"id" text PRIMARY KEY NOT NULL,
	"vacature_id" text NOT NULL,
	"voornaam" text NOT NULL,
	"achternaam" text NOT NULL,
	"email" text NOT NULL,
	"mobiel" text NOT NULL,
	"geboortedatum" date,
	"motivatie" text,
	"beschikbaarheid" text,
	"bron" text DEFAULT 'website' NOT NULL,
	"aangedragen_door" text,
	"fase" "kandidaat_fase" DEFAULT 'nieuw' NOT NULL,
	"gesprek_op" timestamp with time zone,
	"beoordeling" smallint,
	"notities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gebruiker_id" text,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "klok" (
	"id" text PRIMARY KEY NOT NULL,
	"gebruiker_id" text NOT NULL,
	"vestiging_id" text NOT NULL,
	"dienst_id" text,
	"in" timestamp with time zone NOT NULL,
	"uit" timestamp with time zone,
	"pauze_min" smallint DEFAULT 0 NOT NULL,
	"status" "klok_status" DEFAULT 'open' NOT NULL,
	"goedgekeurd_door" text,
	"opmerking" text
);
--> statement-breakpoint
CREATE TABLE "lifecycle_taak" (
	"id" text PRIMARY KEY NOT NULL,
	"gebruiker_id" text NOT NULL,
	"fase" "lifecycle_fase" NOT NULL,
	"sleutel" text NOT NULL,
	"titel" text NOT NULL,
	"wie" text NOT NULL,
	"volgorde" smallint NOT NULL,
	"deadline" date,
	"klaar" timestamp with time zone,
	"klaar_door" text,
	CONSTRAINT "lifecycle_uniek" UNIQUE("gebruiker_id","fase","sleutel")
);
--> statement-breakpoint
CREATE TABLE "positie" (
	"id" text PRIMARY KEY NOT NULL,
	"naam" text NOT NULL,
	"kleur" text NOT NULL,
	"volgorde" smallint NOT NULL,
	"min_leeftijd" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacature" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"vestiging_id" text NOT NULL,
	"functie_id" text,
	"titel" text NOT NULL,
	"omschrijving" text NOT NULL,
	"uren" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"gemaakt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vacature_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "verlof" (
	"id" text PRIMARY KEY NOT NULL,
	"gebruiker_id" text NOT NULL,
	"type" "verlof_type" NOT NULL,
	"van" date NOT NULL,
	"tot" date,
	"uren" numeric(6, 1),
	"status" "verlof_status" DEFAULT 'aangevraagd' NOT NULL,
	"opmerking" text,
	"behandeld_door" text,
	"aangevraagd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "status" text DEFAULT 'actief' NOT NULL;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "geboortedatum" date;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "persoonsgegevens" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "uit_dienst_per" date;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "uit_dienst_reden" text;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "uitnodiging_token" text;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "agenda_token" text;--> statement-breakpoint
ALTER TABLE "vestiging" ADD COLUMN "adres" text;--> statement-breakpoint
ALTER TABLE "vestiging" ADD COLUMN "openingstijden" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "beschikbaarheid" ADD CONSTRAINT "beschikbaarheid_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bezettingsnorm" ADD CONSTRAINT "bezettingsnorm_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bezettingsnorm" ADD CONSTRAINT "bezettingsnorm_positie_id_positie_id_fk" FOREIGN KEY ("positie_id") REFERENCES "public"."positie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_functie_id_functie_id_fk" FOREIGN KEY ("functie_id") REFERENCES "public"."functie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_werkgever_ondertekenaar_id_gebruiker_id_fk" FOREIGN KEY ("werkgever_ondertekenaar_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract" ADD CONSTRAINT "contract_aangemaakt_door_gebruiker_id_fk" FOREIGN KEY ("aangemaakt_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dienst" ADD CONSTRAINT "dienst_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dienst" ADD CONSTRAINT "dienst_positie_id_positie_id_fk" FOREIGN KEY ("positie_id") REFERENCES "public"."positie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dienst" ADD CONSTRAINT "dienst_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_document" ADD CONSTRAINT "dossier_document_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossier_document" ADD CONSTRAINT "dossier_document_geupload_door_gebruiker_id_fk" FOREIGN KEY ("geupload_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gebruiker_positie" ADD CONSTRAINT "gebruiker_positie_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gebruiker_positie" ADD CONSTRAINT "gebruiker_positie_positie_id_positie_id_fk" FOREIGN KEY ("positie_id") REFERENCES "public"."positie"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kandidaat" ADD CONSTRAINT "kandidaat_vacature_id_vacature_id_fk" FOREIGN KEY ("vacature_id") REFERENCES "public"."vacature"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kandidaat" ADD CONSTRAINT "kandidaat_aangedragen_door_gebruiker_id_fk" FOREIGN KEY ("aangedragen_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kandidaat" ADD CONSTRAINT "kandidaat_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "klok" ADD CONSTRAINT "klok_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "klok" ADD CONSTRAINT "klok_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "klok" ADD CONSTRAINT "klok_dienst_id_dienst_id_fk" FOREIGN KEY ("dienst_id") REFERENCES "public"."dienst"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "klok" ADD CONSTRAINT "klok_goedgekeurd_door_gebruiker_id_fk" FOREIGN KEY ("goedgekeurd_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_taak" ADD CONSTRAINT "lifecycle_taak_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_taak" ADD CONSTRAINT "lifecycle_taak_klaar_door_gebruiker_id_fk" FOREIGN KEY ("klaar_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacature" ADD CONSTRAINT "vacature_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacature" ADD CONSTRAINT "vacature_functie_id_functie_id_fk" FOREIGN KEY ("functie_id") REFERENCES "public"."functie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verlof" ADD CONSTRAINT "verlof_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verlof" ADD CONSTRAINT "verlof_behandeld_door_gebruiker_id_fk" FOREIGN KEY ("behandeld_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "norm_vestiging_idx" ON "bezettingsnorm" USING btree ("vestiging_id","weekdag");--> statement-breakpoint
CREATE INDEX "contract_gebruiker_idx" ON "contract" USING btree ("gebruiker_id");--> statement-breakpoint
CREATE INDEX "dienst_vestiging_idx" ON "dienst" USING btree ("vestiging_id","start");--> statement-breakpoint
CREATE INDEX "dienst_gebruiker_idx" ON "dienst" USING btree ("gebruiker_id","start");--> statement-breakpoint
CREATE INDEX "dossier_gebruiker_idx" ON "dossier_document" USING btree ("gebruiker_id");--> statement-breakpoint
CREATE INDEX "kandidaat_vacature_idx" ON "kandidaat" USING btree ("vacature_id","fase");--> statement-breakpoint
CREATE INDEX "klok_gebruiker_idx" ON "klok" USING btree ("gebruiker_id","in");--> statement-breakpoint
CREATE INDEX "verlof_gebruiker_idx" ON "verlof" USING btree ("gebruiker_id","van");--> statement-breakpoint
ALTER TABLE "gebruiker" ADD CONSTRAINT "gebruiker_uitnodiging_token_unique" UNIQUE("uitnodiging_token");--> statement-breakpoint
ALTER TABLE "gebruiker" ADD CONSTRAINT "gebruiker_agenda_token_unique" UNIQUE("agenda_token");