import path from "node:path";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Databaseverbinding.
 * - DATABASE_URL gezet (Railway): PostgreSQL via node-postgres.
 * - Niet gezet (lokaal): PGlite, een volwaardige PostgreSQL in-process,
 *   opgeslagen in ./.data/pglite (of in het geheugen met PGLITE=memory).
 * Bij de eerste verbinding worden migraties uitgevoerd en, als de database leeg is, demodata geladen.
 */
export type DB = NodePgDatabase<typeof schema>;

const MIGRATIES = path.join(process.cwd(), "drizzle");
const g = globalThis as unknown as { __intradageDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  return (g.__intradageDb ??= verbind().catch((e) => {
    g.__intradageDb = undefined; // volgende request opnieuw proberen
    throw e;
  }));
}

async function verbind(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  let db: DB;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const ssl = /sslmode=require/.test(url) || process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;
    const pool = new Pool({ connectionString: url, ssl, max: Number(process.env.DATABASE_POOL ?? 10) });
    db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIES });
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = process.env.PGLITE === "memory" ? undefined : path.join(process.cwd(), ".data", "pglite");
    const client = new PGlite(dir);
    const pdb = drizzle(client, { schema });
    await migrate(pdb, { migrationsFolder: MIGRATIES });
    db = pdb as unknown as DB;
  }
  await seedAlsLeeg(db);
  return db;
}

async function seedAlsLeeg(db: DB) {
  const { seed } = await import("./seed");
  await db.transaction(async (tx) => {
    // Voorkomt dubbel seeden als meerdere instanties tegelijk starten
    await tx.execute(sql`select pg_advisory_xact_lock(7420131)`);
    const [{ n }] = (await tx.execute<{ n: number }>(sql`select count(*)::int as n from gebruiker`)).rows;
    if (n === 0) await seed(tx as unknown as DB);
    // Nieuwe modules op een bestaande database: alleen hun eigen demodata laden
    const [{ w }] = (await tx.execute<{ w: number }>(sql`select count(*)::int as w from waarde`)).rows;
    if (w === 0) {
      const { seedBetrokkenheid } = await import("./seed-betrokkenheid");
      await seedBetrokkenheid(tx as unknown as DB);
    }
    const [{ p }] = (await tx.execute<{ p: number }>(sql`select count(*)::int as p from positie`)).rows;
    if (p === 0) {
      const { seedPersoneel } = await import("./seed-personeel");
      await seedPersoneel(tx as unknown as DB);
    }
  });
}
