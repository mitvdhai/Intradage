import "server-only";
import { and, asc, eq, gt, lt, ne } from "drizzle-orm";
import { getDb } from "../db/client";
import * as t from "../db/schema";
import type { Dienst, Gebruiker } from "../types";

/**
 * Het rooster komt uit Intradage zelf (tabel `dienst`), niet meer uit HorecaManager.
 * De interface is gebleven, zodat schermen die diensten tonen niet hoefden te veranderen.
 * Medewerkers zien alleen gepubliceerde diensten.
 */
export interface StaffAdapter {
  naam: string;
  rooster(gebruiker: Gebruiker, van: Date, tot: Date): Promise<Dienst[]>;
  collegas(dienst: Dienst, gebruikers: Gebruiker[]): Promise<string[]>;
  /** Een goedgekeurde ruil wordt direct in het rooster verwerkt */
  ondersteuntSchrijven: boolean;
  laatsteSync(): Date;
}

class IntradageRooster implements StaffAdapter {
  naam = "Intradage-rooster";
  ondersteuntSchrijven = true;
  laatsteSync() { return new Date(); }

  async rooster(gebruiker: Gebruiker, van: Date, tot: Date): Promise<Dienst[]> {
    const db = await getDb();
    const rijen = await db.select({ d: t.dienst, positie: t.positie.naam }).from(t.dienst)
      .innerJoin(t.positie, eq(t.positie.id, t.dienst.positieId))
      .where(and(eq(t.dienst.gebruikerId, gebruiker.id), eq(t.dienst.status, "gepubliceerd"), lt(t.dienst.start, tot), gt(t.dienst.eind, van)))
      .orderBy(asc(t.dienst.start));
    return rijen.map(({ d, positie }) => ({ id: d.id, gebruikerId: gebruiker.id, vestigingId: d.vestigingId, start: d.start.toISOString(), eind: d.eind.toISOString(), taak: positie }));
  }

  async collegas(dienst: Dienst, gebruikers: Gebruiker[]): Promise<string[]> {
    const db = await getDb();
    const dagStart = new Date(dienst.start); dagStart.setHours(0, 0, 0, 0);
    const dagEind = new Date(dagStart.getTime() + 86400000);
    const rijen = await db.select({ g: t.dienst.gebruikerId }).from(t.dienst)
      .where(and(eq(t.dienst.vestigingId, dienst.vestigingId), eq(t.dienst.status, "gepubliceerd"), lt(t.dienst.start, dagEind), gt(t.dienst.eind, dagStart), ne(t.dienst.id, dienst.id)));
    const ids = new Set(rijen.map((r) => r.g).filter((x): x is string => !!x && x !== dienst.gebruikerId));
    return gebruikers.filter((g) => ids.has(g.id)).map((g) => g.voornaam);
  }
}

const g = globalThis as unknown as { __rooster?: StaffAdapter };
export const staff: StaffAdapter = (g.__rooster ??= new IntradageRooster());

/** Volgende zaterdag 11:00 (of vandaag als het zaterdag is). */
export function volgendeZaterdag(basis = new Date()) {
  const d = new Date(basis);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  d.setHours(11, 0, 0, 0);
  return d;
}
