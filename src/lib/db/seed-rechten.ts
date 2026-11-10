import { ROLLEN, STANDAARD, MODULES } from "../rechten";
import type { DB } from "./client";
import * as t from "./schema";

/** Standaardverdeling vastleggen (zodat HQ hem kan aanpassen) plus twee voorbeelden van uitzonderingen per persoon. */
export async function seedRechten(db: DB) {
  await db.insert(t.rolRecht).values(ROLLEN.flatMap((rol) => MODULES.map((m) => ({ rol, module: m.id, niveau: STANDAARD[rol][m.id] })))).onConflictDoNothing();
  const bestaat = async (id: string) => (await db.select({ id: t.gebruiker.id }).from(t.gebruiker)).some((g) => g.id === id);
  const voorbeelden = [
    { gebruikerId: "u-yara", module: "planning", niveau: 2, door: "u-erik", reden: "Maakt het weekrooster voor Centrum" },
    { gebruikerId: "u-lisa", module: "regeling", niveau: 0, door: "u-joost", reden: "Salaris is voorbehouden aan HQ HR" },
    { gebruikerId: "u-lisa", module: "functiehuis", niveau: 1, door: "u-joost", reden: "Alleen HQ HR wijzigt profielen" },
  ];
  for (const v of voorbeelden) if (await bestaat(v.gebruikerId) && await bestaat(v.door)) await db.insert(t.persoonRecht).values(v).onConflictDoNothing();
}
