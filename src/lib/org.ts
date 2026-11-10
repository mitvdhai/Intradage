import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { getDb } from "./db/client";
import * as t from "./db/schema";
import { type Rechten } from "./rechten";
import type { Beloningsregeling, Franchisenemer, Functie, Gebruiker, ProfielItem, Regio, Vestiging } from "./types";

/**
 * Referentiedata die bijna elke pagina nodig heeft (organisatie, mensen, functiehuis).
 * Klein genoeg (honderden rijen) om per request in één keer te laden; React `cache`
 * zorgt dat dit binnen één request maar één keer gebeurt.
 */
export interface Org {
  regio: Regio[];
  franchisenemers: Franchisenemer[];
  vestigingen: Vestiging[];
  gebruikers: Gebruiker[];
  functies: Functie[];
  profielItems: ProfielItem[];
  itemMap: Map<string, ProfielItem>;
  regeling: Beloningsregeling;
  rechten: Rechten;
}

export const getOrg = cache(async (): Promise<Org> => {
  const db = await getDb();
  const [regio, fns, vest, gebr, gv, functies, profiel, items, regelingen] = await Promise.all([
    db.select().from(t.regio),
    db.select().from(t.franchisenemer),
    db.select().from(t.vestiging).orderBy(asc(t.vestiging.naam)),
    db.select().from(t.gebruiker).where(eq(t.gebruiker.actief, true)).orderBy(asc(t.gebruiker.voornaam)),
    db.select().from(t.gebruikerVestiging),
    db.select().from(t.functie).orderBy(asc(t.functie.trede)),
    db.select().from(t.functieProfiel),
    db.select().from(t.profielItem),
    db.select().from(t.beloningsregeling).where(eq(t.beloningsregeling.actief, true)),
  ]);
  const [rolR, persR] = await Promise.all([db.select().from(t.rolRecht), db.select().from(t.persoonRecht)]);
  const rechten: Rechten = { rol: new Map(), persoon: new Map() };
  for (const r of rolR) rechten.rol.set(r.rol, { ...rechten.rol.get(r.rol), [r.module]: r.niveau });
  for (const r of persR) rechten.persoon.set(r.gebruikerId, { ...rechten.persoon.get(r.gebruikerId), [r.module]: r.niveau });

  const vestPer = new Map<string, string[]>();
  for (const r of gv) vestPer.set(r.gebruikerId, [...(vestPer.get(r.gebruikerId) ?? []), r.vestigingId]);

  // Na de laatste werkdag sluit het account automatisch (offboarding)
  const vandaag = new Date().toLocaleDateString("sv-SE");
  const gebruikers: Gebruiker[] = gebr.filter((g) => !g.uitDienstPer || g.uitDienstPer >= vandaag).map((g) => ({
    id: g.id, voornaam: g.voornaam, achternaam: g.achternaam, rol: g.rol,
    functieId: g.functieId ?? undefined, franchisenemerId: g.franchisenemerId ?? undefined, discipline: g.discipline ?? undefined,
    vestigingIds: vestPer.get(g.id) ?? [], mobiel: g.mobiel, inDienstSinds: g.inDienstSinds,
    verjaardag: g.verjaardag ?? undefined, toonVerjaardag: g.toonVerjaardag, personeelsnummer: g.personeelsnummer, overMij: g.overMij ?? undefined,
  }));

  const profielItems: ProfielItem[] = items.map((i) => ({ ...i, niveaus: i.niveaus as ProfielItem["niveaus"] }));
  const functieLijst: Functie[] = functies.map((f) => ({
    ...f,
    profiel: profiel.filter((p) => p.functieId === f.id).map((p) => ({
      itemId: p.itemId, weging: p.weging, vereistNiveau: p.vereistNiveau as 1 | 2 | 3 | 4, voorwaarde: p.voorwaarde || undefined,
    })),
  }));

  const r = regelingen[0];
  if (!r) throw new Error("Geen actieve beloningsregeling gevonden.");

  return {
    regio,
    franchisenemers: fns,
    vestigingen: vest,
    gebruikers,
    functies: functieLijst,
    profielItems,
    itemMap: new Map(profielItems.map((i) => [i.id, i])),
    rechten,
    regeling: { versie: r.versie, banden: r.banden, verhoging: r.verhoging, maxUitkomstBijOntbrekendeVoorwaarde: r.maxUitkomstBijOntbrekendeVoorwaarde },
  };
});
