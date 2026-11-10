CREATE TABLE "persoon_recht" (
	"gebruiker_id" text NOT NULL,
	"module" text NOT NULL,
	"niveau" smallint NOT NULL,
	"door" text,
	"reden" text,
	"tijd" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persoon_recht_gebruiker_id_module_pk" PRIMARY KEY("gebruiker_id","module"),
	CONSTRAINT "persoon_recht_niveau" CHECK ("persoon_recht"."niveau" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE "rol_recht" (
	"rol" "rol" NOT NULL,
	"module" text NOT NULL,
	"niveau" smallint NOT NULL,
	CONSTRAINT "rol_recht_rol_module_pk" PRIMARY KEY("rol","module"),
	CONSTRAINT "rol_recht_niveau" CHECK ("rol_recht"."niveau" between 0 and 2)
);
--> statement-breakpoint
ALTER TABLE "persoon_recht" ADD CONSTRAINT "persoon_recht_gebruiker_id_gebruiker_id_fk" FOREIGN KEY ("gebruiker_id") REFERENCES "public"."gebruiker"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persoon_recht" ADD CONSTRAINT "persoon_recht_door_gebruiker_id_fk" FOREIGN KEY ("door") REFERENCES "public"."gebruiker"("id") ON DELETE no action ON UPDATE no action;