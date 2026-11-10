import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import type { DB } from "./client";
import * as t from "./schema";
import { leegmaken, seed } from "./seed";

// Draait tegen een echte PostgreSQL (PGlite in het geheugen) met de echte migraties.
let db: DB;

beforeAll(async () => {
  process.env.PGLITE = "memory";
  delete process.env.DATABASE_URL;
  const { getDb } = await import("./client");
  db = await getDb();
}, 60_000);

afterAll(async () => {
  await leegmaken(db);
});

describe("database", () => {
  it("migreert en seedt de demodata", async () => {
    const [{ n }] = (await db.execute<{ n: number }>(sql`select count(*)::int as n from gebruiker`)).rows;
    expect(n).toBeGreaterThan(5);
    const fp = await db.select().from(t.functieProfiel).where(eq(t.functieProfiel.functieId, "f-medewerker"));
    expect(fp.reduce((s, r) => s + r.weging, 0)).toBe(100);
  });

  it("dwingt geldige niveaus af met een check-constraint", async () => {
    await expect(db.insert(t.beoordelingScore).values({ beoordelingId: "bo-sanne", itemId: "v-bakken", bron: "beoordelaar", niveau: 7 })).rejects.toThrow();
  });

  it("staat maar één beoordeling per medewerker per periode toe", async () => {
    await expect(db.insert(t.beoordeling).values({ id: "dubbel", gebruikerId: "u-sanne", functieId: "f-medewerker", beoordelaarId: "u-erik", periode: "2026", status: "zelfbeoordeling" })).rejects.toThrow();
  });

  it("bewaart geldbedragen exact", async () => {
    const [s] = await db.select().from(t.salaris).where(eq(t.salaris.gebruikerId, "u-sanne"));
    expect(s.uurloon).toBe(15.2);
  });

  it("weigert een waardering aan jezelf", async () => {
    await expect(db.insert(t.waardering).values({ id: "zelf", vanId: "u-sanne", aanId: "u-sanne", waardeId: "w-samen", tekst: "ik" })).rejects.toThrow();
  });

  it("kan opnieuw seeden na leegmaken", async () => {
    await leegmaken(db);
    await seed(db);
    const [{ n }] = (await db.execute<{ n: number }>(sql`select count(*)::int as n from bericht where afzender_type <> 'medewerker'`)).rows;
    expect(n).toBe(5);
    const [{ w }] = (await db.execute<{ w: number }>(sql`select count(*)::int as w from waardering`)).rows;
    expect(w).toBeGreaterThan(0);
  });

  it("het gegenereerde rooster houdt zich aan de Arbeidstijdenwet en vult het grootste deel", async () => {
    const { controleerDienst, leeftijdOp } = await import("../planning/atw");
    const diensten = await db.select().from(t.dienst);
    const mensen = await db.select().from(t.gebruiker);
    const bezet = diensten.filter((d) => d.gebruikerId);
    expect(bezet.length / diensten.length).toBeGreaterThan(0.6);
    for (const d of bezet) {
      const m = mensen.find((x) => x.id === d.gebruikerId)!;
      const andere = bezet.filter((x) => x.gebruikerId === d.gebruikerId && x.id !== d.id).map((x) => ({ start: x.start, eind: x.eind }));
      expect(controleerDienst({ start: d.start, eind: d.eind }, leeftijdOp(m.geboortedatum, d.start.toLocaleDateString("sv-SE")), andere), `${m.voornaam} ${d.start.toISOString()}`).toEqual([]);
    }
  });

  it("weigert een contract met min > max uren", async () => {
    await expect(db.insert(t.contract).values({ id: "fout", gebruikerId: "u-sanne", volgnummer: 9, type: "minmax", urenMin: 20, urenMax: 10, uurloon: 15, start: "2026-01-01", tekst: "x" })).rejects.toThrow();
  });
});
