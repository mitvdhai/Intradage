CREATE TYPE "public"."aanmeld_status" AS ENUM('ja', 'misschien', 'nee');--> statement-breakpoint
CREATE TYPE "public"."actiepunt_status" AS ENUM('open', 'klaar');--> statement-breakpoint
CREATE TYPE "public"."beloning_status" AS ENUM('aangevraagd', 'uitgereikt', 'afgewezen');--> statement-breakpoint
CREATE TYPE "public"."checklist_soort" AS ENUM('dagtaak', 'evaluatie');--> statement-breakpoint
CREATE TYPE "public"."doel_type" AS ENUM('bericht', 'waardering');--> statement-breakpoint
CREATE TYPE "public"."enquete_type" AS ENUM('poll', 'pulse', 'enps', 'survey', 'idee');--> statement-breakpoint
CREATE TYPE "public"."uitvoering_status" AS ENUM('concept', 'afgerond');--> statement-breakpoint
CREATE TABLE "actiepunt" (
	"id" text PRIMARY KEY NOT NULL,
	"uitvoering_id" text,
	"vestiging_id" text NOT NULL,
	"tekst" text NOT NULL,
	"eigenaar_id" text NOT NULL,
	"deadline" date NOT NULL,
	"status" "actiepunt_status" DEFAULT 'open' NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beloning" (
	"id" text PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"omschrijving" text NOT NULL,
	"punten" smallint NOT NULL,
	"emoji" text NOT NULL,
	"actief" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "beloning_aanvraag" (
	"id" text PRIMARY KEY NOT NULL,
	"beloning_id" text NOT NULL,
	"gebruiker_id" text NOT NULL,
	"punten" smallint NOT NULL,
	"status" "beloning_status" DEFAULT 'aangevraagd' NOT NULL,
	"behandeld_door" text,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_sjabloon" (
	"id" text PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"soort" "checklist_soort" NOT NULL,
	"omschrijving" text NOT NULL,
	"onderdelen" jsonb NOT NULL,
	"rollen" text[] NOT NULL,
	"versie" smallint DEFAULT 1 NOT NULL,
	"actief" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_uitvoering" (
	"id" text PRIMARY KEY NOT NULL,
	"sjabloon_id" text NOT NULL,
	"sjabloon_versie" smallint NOT NULL,
	"vestiging_id" text NOT NULL,
	"uitgevoerd_door" text NOT NULL,
	"datum" timestamp with time zone DEFAULT now() NOT NULL,
	"antwoorden" jsonb NOT NULL,
	"score" numeric(4, 1),
	"knockout" boolean DEFAULT false NOT NULL,
	"status" "uitvoering_status" DEFAULT 'concept' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquete" (
	"id" text PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"intro" text,
	"type" "enquete_type" NOT NULL,
	"vragen" jsonb NOT NULL,
	"doelgroep" jsonb NOT NULL,
	"anoniem" boolean DEFAULT true NOT NULL,
	"opent" timestamp with time zone DEFAULT now() NOT NULL,
	"sluit" timestamp with time zone,
	"gemaakt_door" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquete_antwoord" (
	"id" serial PRIMARY KEY NOT NULL,
	"enquete_id" text NOT NULL,
	"gebruiker_id" text,
	"franchisenemer_id" text,
	"antwoorden" jsonb NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquete_deelname" (
	"enquete_id" text NOT NULL,
	"gebruiker_id" text NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquete_deelname_enquete_id_gebruiker_id_pk" PRIMARY KEY("enquete_id","gebruiker_id")
);
--> statement-breakpoint
CREATE TABLE "evenement" (
	"id" text PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"omschrijving" text NOT NULL,
	"start" timestamp with time zone NOT NULL,
	"eind" timestamp with time zone NOT NULL,
	"locatie" text NOT NULL,
	"doelgroep" jsonb NOT NULL,
	"gemaakt_door" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evenement_aanmelding" (
	"evenement_id" text NOT NULL,
	"gebruiker_id" text NOT NULL,
	"status" "aanmeld_status" NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evenement_aanmelding_evenement_id_gebruiker_id_pk" PRIMARY KEY("evenement_id","gebruiker_id")
);
--> statement-breakpoint
CREATE TABLE "like" (
	"doel_type" "doel_type" NOT NULL,
	"doel_id" text NOT NULL,
	"gebruiker_id" text NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "like_doel_type_doel_id_gebruiker_id_pk" PRIMARY KEY("doel_type","doel_id","gebruiker_id")
);
--> statement-breakpoint
CREATE TABLE "waarde" (
	"id" text PRIMARY KEY NOT NULL,
	"naam" text NOT NULL,
	"omschrijving" text NOT NULL,
	"emoji" text NOT NULL,
	"volgorde" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waardering" (
	"id" text PRIMARY KEY NOT NULL,
	"van_id" text NOT NULL,
	"aan_id" text NOT NULL,
	"waarde_id" text NOT NULL,
	"tekst" text NOT NULL,
	"punten" smallint DEFAULT 10 NOT NULL,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "niet_zelf" CHECK ("waardering"."van_id" <> "waardering"."aan_id")
);
--> statement-breakpoint
ALTER TABLE "bericht" ADD COLUMN "afzender_gebruiker_id" text;--> statement-breakpoint
ALTER TABLE "gebruiker" ADD COLUMN "over_mij" text;--> statement-breakpoint
ALTER TABLE "actiepunt" ADD CONSTRAINT "actiepunt_uitvoering_id_checklist_uitvoering_id_fk" FOREIGN KEY ("uitvoering_id") REFERENCES "public"."checklist_uitvoering"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actiepunt" ADD CONSTRAINT "actiepunt_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actiepunt" ADD CONSTRAINT "actiepunt_eigenaar_id_gebruiker_id_fk" FOREIGN KEY ("eigenaar_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beloning_aanvraag" ADD CONSTRAINT "beloning_aanvraag_beloning_id_beloning_id_fk" FOREIGN KEY ("beloning_id") REFERENCES "public"."beloning"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beloning_aanvraag" ADD CONSTRAINT "beloning_aanvraag_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beloning_aanvraag" ADD CONSTRAINT "beloning_aanvraag_behandeld_door_gebruiker_id_fk" FOREIGN KEY ("behandeld_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_uitvoering" ADD CONSTRAINT "checklist_uitvoering_sjabloon_id_checklist_sjabloon_id_fk" FOREIGN KEY ("sjabloon_id") REFERENCES "public"."checklist_sjabloon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_uitvoering" ADD CONSTRAINT "checklist_uitvoering_vestiging_id_vestiging_id_fk" FOREIGN KEY ("vestiging_id") REFERENCES "public"."vestiging"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_uitvoering" ADD CONSTRAINT "checklist_uitvoering_uitgevoerd_door_gebruiker_id_fk" FOREIGN KEY ("uitgevoerd_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquete" ADD CONSTRAINT "enquete_gemaakt_door_gebruiker_id_fk" FOREIGN KEY ("gemaakt_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquete_antwoord" ADD CONSTRAINT "enquete_antwoord_enquete_id_enquete_id_fk" FOREIGN KEY ("enquete_id") REFERENCES "public"."enquete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquete_antwoord" ADD CONSTRAINT "enquete_antwoord_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquete_deelname" ADD CONSTRAINT "enquete_deelname_enquete_id_enquete_id_fk" FOREIGN KEY ("enquete_id") REFERENCES "public"."enquete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquete_deelname" ADD CONSTRAINT "enquete_deelname_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement" ADD CONSTRAINT "evenement_gemaakt_door_gebruiker_id_fk" FOREIGN KEY ("gemaakt_door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_aanmelding" ADD CONSTRAINT "evenement_aanmelding_evenement_id_evenement_id_fk" FOREIGN KEY ("evenement_id") REFERENCES "public"."evenement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_aanmelding" ADD CONSTRAINT "evenement_aanmelding_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "like" ADD CONSTRAINT "like_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waardering" ADD CONSTRAINT "waardering_van_id_gebruiker_id_fk" FOREIGN KEY ("van_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waardering" ADD CONSTRAINT "waardering_aan_id_gebruiker_id_fk" FOREIGN KEY ("aan_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waardering" ADD CONSTRAINT "waardering_waarde_id_waarde_id_fk" FOREIGN KEY ("waarde_id") REFERENCES "public"."waarde"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actiepunt_vestiging_idx" ON "actiepunt" USING btree ("vestiging_id","status");--> statement-breakpoint
CREATE INDEX "uitvoering_vestiging_idx" ON "checklist_uitvoering" USING btree ("vestiging_id","datum");--> statement-breakpoint
CREATE INDEX "antwoord_enquete_idx" ON "enquete_antwoord" USING btree ("enquete_id");--> statement-breakpoint
CREATE INDEX "like_doel_idx" ON "like" USING btree ("doel_type","doel_id");--> statement-breakpoint
CREATE INDEX "waardering_aan_idx" ON "waardering" USING btree ("aan_id");--> statement-breakpoint
CREATE INDEX "waardering_tijd_idx" ON "waardering" USING btree ("tijd");--> statement-breakpoint
ALTER TABLE "bericht" ADD CONSTRAINT "bericht_afzender_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("afzender_gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;